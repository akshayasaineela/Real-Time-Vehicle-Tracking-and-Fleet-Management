// ===================================================================================
// CLEAN BACKEND-ONLY SERVER.JS  (NO FRONTEND CODE)
// ===================================================================================

import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";

import client from "prom-client"; // ⭐ PROMETHEUS
import connectDB from "./config/db.js";
import redis from "./config/redisClient.js";
import { connectRabbit, getChannel } from "./config/rabbit.js";
import elastic from "./config/elasticsearch.js";

// ROUTES
import authRoutes from "./routes/auth.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import settingsRoutes from "./routes/settingRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoute.js";
import statsRoutes from "./routes/statsRoutes.js";
import { fetchOSRMRoute, archiveTripToDriver } from "./routes/tripRoutes.js";

// MODELS + UTILS
import { calculateDriverScore } from "./utils/calculateDriverScore.js";
import DriverPerformance from "./models/DriverPerformance.js";
import Vehicle from "./models/Vehicle.js";
import Trip from "./models/Trip.js";
import Driver from "./models/Driver.js";

dotenv.config({ path: "./.env" });

await connectDB(); // WAIT FOR DB
await connectRabbit();

// ===================================================================================
// SETUP SERVER + SOCKET.IO
// ===================================================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "UserInterface")));

// ===================================================================================
// PROMETHEUS BASIC METRICS
// ===================================================================================

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// API Request Counter
const apiRequestCount = new client.Counter({
  name: "api_request_total",
  help: "Total number of API requests",
  labelNames: ["method", "route", "status"],
});

// API Response Time Histogram
const apiResponseTime = new client.Histogram({
  name: "api_response_time_seconds",
  help: "API response time in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.7, 1, 2, 5],
});

// ⭐ GLOBAL METRICS MIDDLEWARE
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const timeInSeconds = diff[0] + diff[1] / 1e9;

    apiRequestCount.labels(req.method, req.path, res.statusCode).inc();
    apiResponseTime
      .labels(req.method, req.path, res.statusCode)
      .observe(timeInSeconds);
  });

  next();
});

// PROMETHEUS SCRAPE ENDPOINT
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});
//==============================================================================
// RABBITMQ PRODUCER
// ===================================================================================

function sendToQueue(queue, data) {
  try {
    const ch = getChannel();
    if (!ch) return; // ⛔ Rabbit down → skip silently

    ch.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
      persistent: false,
    });
  } catch (err) {
    // Never throw → NEVER block server
    console.log("RabbitMQ send FAILED (ignored):", err.message);
  }
}

// ===================================================================================
// REALISTIC REAL-TIME MOVEMENT + FULL TELEMATICS PERFORMANCE ENGINE
// ===================================================================================

const UPDATE_INTERVAL = 1000; // 1 sec updates
const DB_SAVE_INTERVAL = 5000; // Save to DB every 5 seconds
let lastDbSave = Date.now();

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function calculateRemainingDistance(route, routeIndex, lat, lng) {
  let distance = 0;

  // distance from current position to next route point
  if (routeIndex < route.length - 1) {
    distance +=
      calculateDistance(lat, lng, route[routeIndex + 1].lat, route[routeIndex + 1].lng);
  }

  // remaining full segments
  for (let i = routeIndex + 1; i < route.length - 1; i++) {
    distance += calculateDistance(
      route[i].lat,
      route[i].lng,
      route[i + 1].lat,
      route[i + 1].lng
    );
  }

  return distance; // km
}

setInterval(async () => {
  try {
    const now = new Date();

    const trips = await Trip.find(
      { status: { $in: ["scheduled", "ongoing"] } },
      "status startTime duration origin destination originCoords destinationCoords route routeIndex tempStats vehicle driver"
    );

    for (const trip of trips) {
      const start = new Date(trip.startTime);
      // --------------------------------------------------------------------
      // ENSURE tempStats ALWAYS EXISTS
      // --------------------------------------------------------------------
      if (!trip.tempStats) {
        trip.tempStats = {
          overspeed: 0,
          harshBrake: 0,
          harshAccel: 0,
          fatigue: 0,
        };
        await trip.save();
      }

      // --------------------------------------------------------------------
      // AUTO START TRIP
      // --------------------------------------------------------------------
      if (trip.status === "scheduled" && now >= start) {
        trip.status = "ongoing";
        trip.routeIndex = 0;
        trip.tempStats = {
          overspeed: 0,
          harshBrake: 0,
          harshAccel: 0,
          fatigue: 0,
        };
        await trip.save();

        sendToQueue("trip_events", { type: "trip_started", tripId: trip._id });
      }

      const vehicle = await Vehicle.findById(trip.vehicle);
      const driver = await Driver.findById(trip.driver);
      if (!vehicle || !driver) continue;

      // --------------------------------------------------------------------
      // GENERATE ROUTE USING OSRM
      // --------------------------------------------------------------------
      if (!trip.route || trip.route.length === 0) {
        const route = await fetchOSRMRoute(
          trip.originCoords,
          trip.destinationCoords
        );
        if (!route.length) continue;
        trip.route = route;
        trip.routeIndex = 0;
        await trip.save();
      }

      
      // --------------------------------------------------------------------
// REALISTIC SPEED ENGINE
// --------------------------------------------------------------------
const prevSpeed = vehicle.speed || 20;
let accel = Math.random() * 6 - 2;

const traffic = Math.random();
if (traffic < 0.04) accel -= 6;
if (traffic > 0.96) accel += 6;

let newSpeed = prevSpeed + accel;
newSpeed = Math.max(25, Math.min(newSpeed, 100));

const roundedSpeed = Math.round(newSpeed);
vehicle.speed = roundedSpeed;
vehicle.status = roundedSpeed === 0 ? "stopped" : "running";
vehicle.lastUpdated = now;


      // --------------------------------------------------------------------
      // MOVEMENT ENGINE — SMOOTH MOVEMENT
      // --------------------------------------------------------------------
      const prevLat = parseFloat(vehicle.lat);
      const prevLng = parseFloat(vehicle.lng);

      // distance vehicle can move in this 1 second (meters)
      const VISUAL_MULTIPLIER = 25;

let remainingDistance =
  ((vehicle.speed * 1000) / 3600) * VISUAL_MULTIPLIER;


while (
  remainingDistance > 0 &&
  trip.routeIndex < trip.route.length - 1
) {
  const curr = trip.route[trip.routeIndex];
  const next = trip.route[trip.routeIndex + 1];

  const segmentDistance =
    calculateDistance(curr.lat, curr.lng, next.lat, next.lng) * 1000;

  if (remainingDistance >= segmentDistance) {
    // consume full segment
    remainingDistance -= segmentDistance;
    trip.routeIndex++;

    vehicle.lat = next.lat;
    vehicle.lng = next.lng;
  } else {
    // move partially in this segment
    const ratio = remainingDistance / segmentDistance;

    vehicle.lat =
      curr.lat + (next.lat - curr.lat) * ratio;
    vehicle.lng =
      curr.lng + (next.lng - curr.lng) * ratio;

    remainingDistance = 0;
  }
}


const newLat = vehicle.lat;
const newLng = vehicle.lng;

// --------------------------------------------------------------------
// LIVE ETA CALCULATION
// --------------------------------------------------------------------
let etaSeconds = null;

if (vehicle.speed > 5) {
  const remainingKm = calculateRemainingDistance(
    trip.route,
    trip.routeIndex,
    newLat,
    newLng
  );

  const speedKms = vehicle.speed / 3600;
  etaSeconds = Math.max(0, remainingKm / speedKms);
}

// --------------------------------------------------------------------
// ✅ CHANGE 4 — COMPLETE TRIP WHEN DESTINATION IS REACHED
// --------------------------------------------------------------------
if (trip.routeIndex >= trip.route.length - 1) {
  trip.status = "completed";
  trip.endTime = new Date();

  // stop vehicle naturally
  vehicle.speed = 0;
  vehicle.status = "stopped";

  await vehicle.save();
  await trip.save();

  driver.status = "available";
  driver.currentTripId = null;
  await driver.save();

  await archiveTripToDriver(trip);
  io.emit("vehicle-update", {
  id: vehicle._id,
  lat: vehicle.lat,
  lng: vehicle.lng,
  speed: 0,
  status: "stopped",
  etaSeconds: 0,
  etaMinutes: 0,
});

  continue; // move to next trip
}

// --------------------------------------------------------------------
// DRIVER PERFORMANCE INIT (MISSING FIX)
// --------------------------------------------------------------------
let perf = await DriverPerformance.findOne({ driver: driver._id });
if (!perf) perf = await DriverPerformance.create({ driver: driver._id });

if (!perf._runtime) {
  perf._runtime = {
    overspeedSteps: 0,
    harshAccelSteps: 0,
    harshBrakeSteps: 0,
    steady: 0,
    lowSpeed: 0,
    longDriveFatigue: false,
  };
}

      const speedDiff = newSpeed - prevSpeed;
      const isMoving = roundedSpeed > 5;

      if (isMoving) {
        const d = calculateDistance(prevLat, prevLng, newLat, newLng);
        if (d < 1) {
          await DriverPerformance.updateOne(
            { driver: driver._id },
            {
              $inc: {
                totalDistanceKm: d,
                totalDrivingMinutes: 1 / 60,
                
              },
            }
          );
          perf.totalDrivingMinutes += 1 / 60;

        }
      }

      // harsh accel
      if (speedDiff >= 12) {
        perf._runtime.harshAccelSteps++;
        if (perf._runtime.harshAccelSteps >= 1) {
          await DriverPerformance.updateOne(
            { driver: driver._id },
            { $inc: { harshAccelerationCount: 1 } }
          );
          trip.tempStats.harshAccel++;

          perf._runtime.harshAccelSteps = 0;
        }
      }

      if (speedDiff <= -12) {
        perf._runtime.harshBrakeSteps++;
        if (perf._runtime.harshBrakeSteps >= 1) {
          await DriverPerformance.updateOne(
            { driver: driver._id },
            { $inc: { harshBrakingCount: 1 } }
          );
          trip.tempStats.harshBrake++;
          perf._runtime.harshBrakeSteps = 0;
        }
      }

      // overspeed
      if (newSpeed > 70) {
        perf._runtime.overspeedSteps++;
        if (perf._runtime.overspeedSteps >= 4) {
          await DriverPerformance.updateOne(
            { driver: driver._id },
            { $inc: { overspeedCount: 1 } }
          );
          trip.tempStats.overspeed++;
          perf._runtime.overspeedSteps = 0;
        }
      }

      // fatigue 1 (long driving)
      if (perf.totalDrivingMinutes > 120 && !perf._runtime.longDriveFatigue) {
        await DriverPerformance.updateOne(
          { driver: driver._id },
          { $inc: { fatigueAlerts: 1 } }
        );
        trip.tempStats.fatigue++;

        perf._runtime.longDriveFatigue = true;
      }

      // fatigue 2 (steady speed)
      if (Math.abs(speedDiff) < 2) {
        perf._runtime.steady++;
        if (perf._runtime.steady >= 25) {
          await DriverPerformance.updateOne(
            { driver: driver._id },
            { $inc: { fatigueAlerts: 1 } }
          );
          trip.tempStats.fatigue++;
          perf._runtime.steady = 0;
        }
      } else perf._runtime.steady = 0;

      // fatigue 3 (low speed)
      if (roundedSpeed < 10) {
        perf._runtime.lowSpeed++;
        if (perf._runtime.lowSpeed >= 40) {
          await DriverPerformance.updateOne(
            { driver: driver._id },
            { $inc: { fatigueAlerts: 1 } }
          );
          trip.tempStats.fatigue++;
          perf._runtime.lowSpeed = 0;
        }
      } else perf._runtime.lowSpeed = 0;

      // random micro fatigue
      if (Math.random() < 0.002) {
        await DriverPerformance.updateOne(
          { driver: driver._id },
          { $inc: { fatigueAlerts: 1 } }
        );
        trip.tempStats.fatigue++;
      }
      // --------------------------------------------------------------------
      // SAVE VEHICLE EVERY 5 SEC
      // --------------------------------------------------------------------
      if (Date.now() - lastDbSave >= DB_SAVE_INTERVAL) {
        await vehicle.save();
        lastDbSave = Date.now();
      }

      await perf.save();

      // --------------------------------------------------------------------
      // SOCKET.IO UPDATE
      // --------------------------------------------------------------------
      io.emit("vehicle-update", {
        id: vehicle._id,
        lat: vehicle.lat,
        lng: vehicle.lng,
        speed: vehicle.speed,
        status: vehicle.status,
         etaSeconds: etaSeconds ? Math.max(0, Math.round(etaSeconds)) : null,
  etaMinutes: etaSeconds ? Math.ceil(etaSeconds / 60) : null,
      });
    }
  } catch (err) {
    console.error("REAL-TIME ENGINE ERROR:", err.message);
  }
}, UPDATE_INTERVAL);

// ===================================================================================
// LIVE VEHICLES API
// ===================================================================================
app.get("/api/vehicles/live", async (req, res) => {
  try {
    const trips = await Trip.find(
      { status: { $ne: "completed" } },
      "vehicle driver destinationCoords originCoords"
    )
      .populate("vehicle", "vehicleNumber lat lng speed status fuel")
      .populate("driver", "driver")
      .lean();

    const live = trips
      .filter((t) => t.vehicle)
      .map((t) => ({
        _id: t.vehicle._id,
        vehicleNumber: t.vehicle.vehicleNumber,
        lat: Number(t.vehicle.lat),
        lng: Number(t.vehicle.lng),
        speed: t.vehicle.speed,
        status: t.vehicle.status,
        fuel: t.vehicle.fuel,
        driverName: t.driver?.driver || "Unassigned",
        destinationCoords: t.destinationCoords,
        originCoords: t.originCoords,
      }));

    res.json(live);
  } catch (err) {
    res.json([]);
  }
});

// ===================================================================================
// API ROUTES
// ===================================================================================
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/stats", statsRoutes);

app.get("/api/geocode", async (req, res) => {
  try {
    const place = req.query.place;
    if (!place) return res.status(400).json({ message: "place is required" });

    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${encodeURIComponent(
      place
    )}`;
    const geo = await fetch(url).then((r) => r.json());

    if (!geo.length)
      return res.status(404).json({ message: "Location not found" });

    res.json({
      lat: Number(geo[0].lat),
      lng: Number(geo[0].lon),
    });
  } catch {
    res.status(500).json({ message: "Geocode failed" });
  }
});

// ===================================================================================
// START SERVER
// ===================================================================================
const PORT = 5000;
server.listen(PORT, () =>
  console.log(`🚀 CLEAN BACKEND RUNNING → http://localhost:${PORT}`)
);
