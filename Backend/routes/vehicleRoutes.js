import express from "express";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import DriverPerformance from "../models/DriverPerformance.js";
import { getChannel } from "../config/rabbit.js";

// ==================== RabbitMQ Safe Producer ====================
function sendToQueue(queue, data) {
  const ch = getChannel();
  if (!ch) return;

  try {
    ch.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
  } catch (err) {
    console.log("RabbitMQ send error:", err.message);
  }
}

const router = express.Router();

// ==================== REDIS HELPERS ====================
import redis from "../config/redisClient.js";

async function redisGet(key) {
  try { return await redis.get(key); } catch { return null; }
}
async function redisSet(key, value, ttl = 10) {
  try { await redis.set(key, value, { EX: ttl }); } catch {}
}
async function redisDel(key) {
  try { await redis.del(key); } catch {}
}

/* ============================================================
   GET ALL VEHICLES  (REDIS CACHED + lean + projection)
============================================================ */
router.get("/", async (req, res) => {
  try {
    const cacheKey = "vehicles:list";

    // Redis cache
    const cached = await redisGet(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // DB Query (projection + lean)
    const vehicles = await Vehicle.find(
      {},
      "vehicleNumber model status lat lng speed lastUpdated fuel driver"
    )
      .populate("driver", "driver phone")
      .lean(); // 🔥 faster, lighter

    // Cache
    await redisSet(cacheKey, JSON.stringify(vehicles), 10);

    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicles" });
  }
});

/* ============================================================
   ADD VEHICLE  (NO lean, because we modify DB)
============================================================ */
router.post("/", async (req, res) => {
  try {
    const vehicle = await Vehicle.create(req.body);

    sendToQueue("vehicle_events", {
      type: "vehicle_created",
      vehicleId: vehicle._id,
      vehicleNumber: vehicle.vehicleNumber,
    });

    await redisDel("vehicles:list");

    res.json({ success: true, vehicle });
  } catch (err) {
    res.status(400).json({ error: "Failed to add vehicle", details: err });
  }
});

/* ============================================================
   GET VEHICLE TRIP HISTORY (CACHED + lean + projection)
============================================================ */
router.get("/:id/history", async (req, res) => {
  try {
    const key = `vehicle:history:${req.params.id}`;

    const cached = await redisGet(key);
    if (cached) return res.json(JSON.parse(cached));

    // Projection + lean
    const vehicle = await Vehicle.findById(
      req.params.id,
      "tripHistory"
    )
      .populate("tripHistory.tripId")
      .lean();

    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const history = vehicle.tripHistory || [];

    await redisSet(key, JSON.stringify(history), 20);

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trip history" });
  }
});

/* ============================================================
   ASSIGN DRIVER (NO lean — we modify)
============================================================ */
router.post("/assign-driver", async (req, res) => {
  try {
    const { vehicleId, driverId } = req.body;

    await Vehicle.findByIdAndUpdate(vehicleId, { driver: driverId });

    await Driver.findByIdAndUpdate(driverId, {
      assignedVehicle: vehicleId,
      status: "reserved"
    });

    sendToQueue("vehicle_events", {
      type: "driver_assigned",
      vehicleId,
      driverId,
    });

    await redisDel("vehicles:list");
    await redisDel("drivers:list");

    res.json({ success: true, message: "Driver assigned successfully" });
  } catch (err) {
    res.status(500).json({ error: "Driver assignment failed" });
  }
});

/* ============================================================
   LIVE LOCATION UPDATE (NO lean — updates happen)
============================================================ */
router.post("/update-location/:id", async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const { lat, lng, speed, fuelLevel, status, driverId } = req.body;

    if (!global.lastStates) global.lastStates = {};
    if (!global.lastStates[vehicleId]) {
      global.lastStates[vehicleId] = {
        lastSpeed: speed,
        lastFuel: fuelLevel,
        idleStart: null,
        driveStart: null
      };
    }

    const state = global.lastStates[vehicleId];

    const perf = await DriverPerformance.findOne({ driver: driverId });
    if (!perf)
      return res.json({ success: false, message: "Performance record missing" });

    const SPEED_LIMIT = 80;
    const speedDiff = speed - state.lastSpeed;
    const now = Date.now();

    if (speed > SPEED_LIMIT) perf.overspeedCount++;
    if (speedDiff <= -12) perf.harshBrakingCount++;
    if (speedDiff >= 14) perf.harshAccelerationCount++;

    if (speed <= 5) {
      if (!state.idleStart) state.idleStart = now;
    } else {
      if (state.idleStart) {
        const idleMinutes = (now - state.idleStart) / 60000;
        if (idleMinutes >= 2) perf.idleTimeMinutes += idleMinutes;
        state.idleStart = null;
      }
    }

    if (speed > 5) {
      if (!state.driveStart) state.driveStart = now;
    } else {
      if (state.driveStart) {
        const driveMinutes = (now - state.driveStart) / 60000;
        perf.drivingMinutesToday += driveMinutes;

        if (perf.drivingMinutesToday >= 240) {
          perf.fatigueAlerts++;
        }

        state.driveStart = null;
      }
    }

    await perf.save();

    state.lastSpeed = speed;
    state.lastFuel = fuelLevel;

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      {
        lat,
        lng,
        speed,
        status,
        lastUpdated: new Date(),
        $push: { tripHistory: { lat, lng, time: new Date() } }
      },
      { new: true }
    );

    sendToQueue("vehicle_events", {
      type: "location_update",
      vehicleId,
      lat,
      lng,
      speed,
      status,
    });

    if (speed > SPEED_LIMIT) sendToQueue("alerts", { type: "overspeed", vehicleId, driverId });
    if (speedDiff <= -12) sendToQueue("alerts", { type: "harsh_brake", vehicleId, driverId });
    if (speedDiff >= 14) sendToQueue("alerts", { type: "harsh_accel", vehicleId, driverId });
    if (perf.fatigueAlerts > 0) sendToQueue("alerts", { type: "fatigue", vehicleId, driverId });

    await redisDel("vehicles:list");
    await redisDel(`vehicle:${vehicleId}`);
    await redisDel(`vehicle:history:${vehicleId}`);

    res.json({ success: true, vehicle: updatedVehicle });

  } catch (err) {
    res.status(500).json({ error: "Failed to update location", details: err });
  }
});

/* ============================================================
   GET VEHICLE BY ID (lean + projection + cache)
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const key = `vehicle:${req.params.id}`;

    const cached = await redisGet(key);
    if (cached) return res.json(JSON.parse(cached));

    const vehicle = await Vehicle.findById(
      req.params.id,
      "vehicleNumber model status lat lng speed lastUpdated fuel driver"
    )
      .populate("driver", "driver phone")
      .lean(); // 🔥 faster

    if (!vehicle)
      return res.status(404).json({ error: "Vehicle not found" });

    await redisSet(key, JSON.stringify(vehicle), 10);

    res.json(vehicle);
  } catch (err) {
    res.status(400).json({ error: "Invalid vehicle ID" });
  }
});

/* ============================================================
   UPDATE VEHICLE (NO lean)
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    sendToQueue("vehicle_events", {
      type: "vehicle_updated",
      vehicleId: updatedVehicle._id,
    });

    if (!updatedVehicle)
      return res.status(404).json({ error: "Vehicle not found" });

    await redisDel("vehicles:list");
    await redisDel(`vehicle:${req.params.id}`);

    res.json({ success: true, vehicle: updatedVehicle });

  } catch (err) {
    res.status(400).json({ error: "Failed to update vehicle", details: err });
  }
});

/* ============================================================
   DELETE VEHICLE (NO lean)
============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    await Vehicle.findByIdAndDelete(req.params.id);

    sendToQueue("vehicle_events", {
      type: "vehicle_deleted",
      vehicleId: req.params.id,
    });

    await redisDel("vehicles:list");
    await redisDel(`vehicle:${req.params.id}`);

    res.json({ success: true, message: "Vehicle deleted" });

  } catch (err) {
    res.status(400).json({ error: "Failed to delete vehicle" });
  }
});

export default router;
