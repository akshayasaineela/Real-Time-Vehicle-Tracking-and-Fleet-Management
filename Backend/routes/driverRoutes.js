import express from "express";
import redis from "../config/redisClient.js";
import { getChannel } from "../config/rabbit.js";
import Driver from "../models/Driver.js";
import DriverPerformance from "../models/DriverPerformance.js";
import elastic from "../config/elasticsearch.js";   // ⭐ ADD ELASTICSEARCH

const router = express.Router();

/* ============================================================
   SAFE QUEUE PRODUCER
============================================================ */
function sendToQueue(queue, data) {
  const ch = getChannel();
  if (!ch) return;

  try {
    ch.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
  } catch (err) {
    console.log("RabbitMQ send error:", err.message);
  }
}

/* ============================================================
   SAFE REDIS HELPERS
============================================================ */
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
   ⭐ ELASTICSEARCH INDEX NAME
============================================================ */
const ES_INDEX = "drivers";

/* ============================================================
   ⭐ SAFE ES INDEX FUNCTION
============================================================ */
async function indexDriverToES(driver) {
  try {
    await elastic.index({
      index: ES_INDEX,
      id: driver._id.toString(),
      document: {
        name: driver.driver,
        phone: driver.phone || "",
        license: driver.license || "",
        status: driver.status || "",
        assignedVehicle: driver.assignedVehicle || null
      }
    });
  } catch (err) {
    console.log("⚠️ ES index failed:", err.message);
  }
}

/* ============================================================
   ⭐ UPDATE ES DOCUMENT
============================================================ */
async function updateDriverInES(driver) {
  try {
    await elastic.update({
      index: ES_INDEX,
      id: driver._id.toString(),
      doc: {
        name: driver.driver,
        phone: driver.phone || "",
        license: driver.license || "",
        status: driver.status || "",
        assignedVehicle: driver.assignedVehicle || null
      }
    });
  } catch (err) {
    console.log("⚠️ ES update failed:", err.message);
  }
}

/* ============================================================
   ⭐ DELETE FROM ES
============================================================ */
async function deleteDriverFromES(id) {
  try {
    await elastic.delete({
      index: ES_INDEX,
      id
    });
  } catch (err) {
    console.log("⚠️ ES delete failed:", err.message);
  }
}

/* ============================================================
   ⭐ SEARCH DRIVER IN ES
============================================================ */
router.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    const results = await elastic.search({
      index: ES_INDEX,
      query: {
        multi_match: {
          query: q,
          fields: ["name", "phone", "license", "status"]
        }
      }
    });

    const hits = results.hits.hits.map(h => ({
      id: h._id,
      score: h._score,
      ...h._source
    }));

    res.json({ success: true, results: hits });
  } catch (err) {
    console.log("⚠️ ES search failed:", err.message);
    res.json({ success: false, results: [] });
  }
});


/* ============================================================
   GET ALL DRIVERS (CACHED)
============================================================ */
router.get("/", async (req, res) => {
  try {
    const cacheKey = "drivers:list";

    const cached = await redisGet(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const drivers = await Driver.find()
      .populate("assignedVehicle", "vehicleNumber")
      .lean();

    await redisSet(cacheKey, JSON.stringify(drivers), 10);

    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

/* ============================================================
   ADD DRIVER (ES + REDIS)
============================================================ */
router.post("/", async (req, res) => {
  try {
    const driver = await Driver.create(req.body);

    await DriverPerformance.create({ driver: driver._id });
    await redisDel("drivers:list");

    sendToQueue("driver_events", {
      type: "driver_added",
      driverId: driver._id,
      name: driver.driver,
    });

    // ⭐ ES INDEX
    indexDriverToES(driver);

    res.json({ success: true, message: "Driver added", driver });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ============================================================
   GET DRIVER BY ID
============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const cacheKey = `driver:${req.params.id}`;

    const cached = await redisGet(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const driver = await Driver.findById(req.params.id)
      .populate("assignedVehicle", "vehicleNumber")
      .lean();

    if (!driver)
      return res.status(404).json({ error: "Driver not found" });

    await redisSet(cacheKey, JSON.stringify(driver), 20);

    res.json(driver);

  } catch (err) {
    res.status(400).json({ error: "Invalid driver ID" });
  }
});


/* ============================================================
   UPDATE DRIVER (ES + CACHE)
============================================================ */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ error: "Driver not found" });

    await redisDel("drivers:list");

    sendToQueue("driver_events", {
      type: "driver_updated",
      driverId: updated._id,
    });

    // ⭐ ES UPDATE
    updateDriverInES(updated);

    res.json({ success: true, message: "Driver updated", updated });

  } catch (err) {
    res.status(400).json({ error: "Failed to update driver" });
  }
});

/* ============================================================
   DELETE DRIVER (ES + CACHE)
============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Driver.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ error: "Driver not found" });

    await redisDel("drivers:list");

    sendToQueue("driver_events", {
      type: "driver_deleted",
      driverId: deleted._id,
    });

    // ⭐ ES DELETE
    deleteDriverFromES(req.params.id);

    res.json({ success: true, message: "Driver deleted" });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete driver" });
  }
});

export default router;
