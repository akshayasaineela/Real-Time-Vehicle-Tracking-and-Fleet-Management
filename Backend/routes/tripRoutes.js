import express from "express";
import redis from "../config/redisClient.js";
import { getChannel } from "../config/rabbit.js";
import Trip from "../models/Trip.js";
import Driver from "../models/Driver.js";
import Vehicle from "../models/Vehicle.js";
import DriverPerformance from "../models/DriverPerformance.js";

// ---------------------------------------------------------------------------
// Safe RabbitMQ producer
// ---------------------------------------------------------------------------
function sendToQueue(queue, data) {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
  } catch (err) {
    console.log("RabbitMQ send error:", err.message);
  }
}

// ---------------------------------------------------------------------------
// ARCHIVE TRIP INTO DRIVER HISTORY
// ---------------------------------------------------------------------------
export async function archiveTripToDriver(trip) {
  const distanceKm = trip.distanceKm || 0;

  await Driver.findByIdAndUpdate(trip.driver, {
    $push: {
      tripHistory: {
        tripId: trip._id,
        startTime: trip.startTime,
        endTime: trip.endTime || new Date(),
        date: trip.startTime,
        origin: trip.origin || "Unknown",
        destination: trip.destination || "Unknown",
        distanceKm,
        durationMin: trip.duration,
        vehicle: trip.vehicle ? String(trip.vehicle) : null,
        status: "completed"
      }
    }
  });

  return distanceKm;
}

const router = express.Router();

// ---------------------------------------------------------------------------
// REDIS HELPERS
// ---------------------------------------------------------------------------
async function redisGet(key) {
  try { return await redis.get(key); } catch { return null; }
}
async function redisSet(key, value, ttl = 10) {
  try { await redis.set(key, value, { EX: ttl }); } catch {}
}
async function redisDel(key) {
  try { await redis.del(key); } catch {}
}

// ---------------------------------------------------------------------------
// STATUS CALCULATOR
// ---------------------------------------------------------------------------
function computeStatus(trip) {
  const now = new Date();
  const start = new Date(trip.startTime);
  const end = new Date(start.getTime() + trip.duration * 60000);
  if (now < start) return "scheduled";
  if (now >= start && now <= end) return "ongoing";
  return "completed";
}

// ---------------------------------------------------------------------------
// FETCH OSRM ROUTE
// ---------------------------------------------------------------------------
export async function fetchOSRMRoute(originCoords, destinationCoords) {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${originCoords.lng},${originCoords.lat};` +
      `${destinationCoords.lng},${destinationCoords.lat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes?.length) return [];

    return data.routes[0].geometry.coordinates.map(c => ({
      lat: c[1],
      lng: c[0],
    }));
  } catch (err) {
    console.log("OSRM route fetch failed:", err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// CREATE TRIP
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { 
      driver, vehicle, startTime, duration, 
      origin, destination, originCoords, destinationCoords 
    } = req.body;

    const fixedOrigin = typeof origin === "string" ? origin : origin?.label || "Unknown";
    const fixedDestination = typeof destination === "string" ? destination : destination?.label || "Unknown";

    if (!driver || !vehicle || !startTime || !duration || !originCoords || !destinationCoords) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const driverDoc = await Driver.findById(driver);
    const vehicleDoc = await Vehicle.findById(vehicle);

    if (!driverDoc) return res.status(400).json({ success: false, message: "Driver not found" });
    if (!vehicleDoc) return res.status(400).json({ success: false, message: "Vehicle not found" });

    // Conflict check
    const newStart = new Date(startTime);
    const newEnd = new Date(newStart.getTime() + duration * 60000);

    const overlappingTrips = await Trip.find(
      {
        status: { $in: ["scheduled", "ongoing"] },
        $expr: {
          $and: [
            { $lt: ["$startTime", newEnd] },
            { $gt: [{ $add: ["$startTime", { $multiply: ["$duration", 60000] }] }, newStart] }
          ]
        }
      },
      "driver vehicle"
    ).lean();

    const busyDrivers = overlappingTrips.map(t => String(t.driver));
    const busyVehicles = overlappingTrips.map(t => String(t.vehicle));

    if (busyDrivers.includes(String(driver)))
      return res.status(400).json({ success: false, message: "Driver already reserved" });

    if (busyVehicles.includes(String(vehicle)))
      return res.status(400).json({ success: false, message: "Vehicle already reserved" });

    // CREATE
    const trip = await Trip.create({
      driver,
      vehicle,
      startTime,
      duration,
      origin: fixedOrigin,
      destination: fixedDestination,
      originCoords,
      destinationCoords,
      status: "scheduled",
      routeIndex: 0,
      tempStats: { overspeed: 0, harshBrake: 0, harshAccel: 0, fatigue: 0 }
    });

    sendToQueue("trip_events", {
      type: "trip_created",
      tripId: trip._id,
      driver,
      vehicle,
      startTime,
      duration
    });

    // FETCH OSRM ROUTE (RESTORED)
    try {
      const route = await fetchOSRMRoute(originCoords, destinationCoords);
      if (route.length) {
        trip.route = route;
        await trip.save();
      }
    } catch (err) {
      console.log("OSRM route failed silently.");
    }

    await Vehicle.findByIdAndUpdate(vehicle, {
      lat: originCoords.lat,
      lng: originCoords.lng,
      destinationCoords,
      currentTripId: trip._id,
      status: "running",
      speed: 20
    });

    await Driver.findByIdAndUpdate(driver, {
      status: "reserved",
      currentTripId: trip._id
    });

    await redisDel("trips:list");

    res.json({ success: true, message: "Trip created", trip });

  } catch (err) {
    console.error("CREATE TRIP ERROR:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET TRIPS LIST
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const cacheKey = "trips:list";

    const cached = await redisGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (req.query.status) return res.json(parsed.filter(t => t.status === req.query.status));
      return res.json(parsed);
    }

    const trips = await Trip.find(
      {},
      "driver vehicle startTime duration origin destination originCoords destinationCoords status routeIndex"
    )
      .populate("driver", "driver phone")
      .populate("vehicle", "vehicleNumber model")
      .sort({ startTime: 1 })
      .lean();

    const enhanced = trips.map(t => ({
      ...t,
      status: computeStatus(t)
    }));

    await redisSet(cacheKey, JSON.stringify(enhanced), 10);

    if (req.query.status)
      return res.json(enhanced.filter(t => t.status === req.query.status));

    res.json(enhanced);

  } catch (err) {
    res.status(500).json({ message: "Error fetching trips" });
  }
});

// ---------------------------------------------------------------------------
// GET TRIP BY ID
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const cacheKey = `trip:${req.params.id}`;

    const cached = await redisGet(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const trip = await Trip.findById(
      req.params.id,
      "-route"
    ).lean();

    if (!trip) return res.status(404).json({ message: "Trip not found" });

    await redisSet(cacheKey, JSON.stringify(trip), 20);

    res.json(trip);

  } catch (err) {
    res.status(400).json({ message: "Invalid ID format" });
  }
});

// ---------------------------------------------------------------------------
// DELETE TRIP
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip)
      return res.status(404).json({ success: false, message: "Trip not found" });

    await archiveTripToDriver(trip);
    await Trip.findByIdAndDelete(req.params.id);

    const perf = await DriverPerformance.findOne({ driver: trip.driver });
    if (perf) {
      const estimatedDistance = (trip.route?.length || 0) * 0.05;
      perf.totalTrips += 1;
      perf.totalDistanceKm += estimatedDistance;
      perf.totalDrivingMinutes += trip.duration;
      await perf.save();
    }

    sendToQueue("trip_events", { type: "trip_deleted", tripId: req.params.id });

    await redisDel("trips:list");
    await redisDel(`trip:${req.params.id}`);

    res.json({ success: true, message: "Trip deleted" });

  } catch (err) {
    res.status(400).json({ message: "Error deleting trip" });
  }
});

// ---------------------------------------------------------------------------
// UPDATE COORDINATES
// ---------------------------------------------------------------------------
router.put("/update-coordinates/:id", async (req, res) => {
  try {
    const { originCoords, destinationCoords } = req.body;

    const updatedTrip = await Trip.findByIdAndUpdate(
      req.params.id,
      { originCoords, destinationCoords },
      { new: true }
    );

    if (!updatedTrip)
      return res.status(404).json({ message: "Trip not found" });

    sendToQueue("trip_events", {
      type: "coordinates_updated",
      tripId: updatedTrip._id,
      originCoords,
      destinationCoords
    });

    await redisDel("trips:list");
    await redisDel(`trip:${req.params.id}`);

    res.json({ success: true, message: "Coordinates updated", trip: updatedTrip });

  } catch (err) {
    res.status(400).json({ message: "Failed to update coordinates" });
  }
});

// ---------------------------------------------------------------------------
// ADD ROUTE POINT
// ---------------------------------------------------------------------------
router.post("/add-route-point/:id", async (req, res) => {
  try {
    const { lat, lng } = req.body;

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: "Trip not found" });

    trip.route.push({ lat, lng, time: new Date() });
    await trip.save();

    sendToQueue("trip_events", {
      type: "route_point_added",
      tripId: trip._id,
      lat,
      lng,
      time: new Date()
    });

    await redisDel(`trip:${req.params.id}`);

    res.json({ success: true, message: "Route point added", route: trip.route });

  } catch (err) {
    res.status(400).json({ message: "Failed to add route point" });
  }
});

// ---------------------------------------------------------------------------
// AVAILABILITY CHECK
// ---------------------------------------------------------------------------
router.get("/availability", async (req, res) => {
  try {
    const { startTime, duration } = req.query;

    if (!startTime || !duration) {
      return res.status(400).json({
        success: false,
        message: "Start time and duration required"
      });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + Number(duration) * 60000);

    const conflictingTrips = await Trip.find(
      {
        status: { $in: ["scheduled", "ongoing"] },
        $expr: {
          $and: [
            { $lt: ["$startTime", end] },
            { $gt: [{ $add: ["$startTime", { $multiply: ["$duration", 60000] }] }, start] }
          ]
        }
      },
      "driver vehicle"
    ).lean();

    const busyDrivers = conflictingTrips.map(t => String(t.driver));
    const busyVehicles = conflictingTrips.map(t => String(t.vehicle));

    const freeDrivers = await Driver.find(
      { _id: { $nin: busyDrivers } },
      "driver phone status"
    ).lean();

    const freeVehicles = await Vehicle.find(
      { _id: { $nin: busyVehicles } },
      "vehicleNumber model status"
    ).lean();

    res.json({
      success: true,
      drivers: freeDrivers,
      vehicles: freeVehicles
    });

  } catch (err) {
    console.error("Availability error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
