import express from "express";
import redis from "../config/redisClient.js";
import Vehicle from "../models/Vehicle.js";
import Trip from "../models/Trip.js";

const router = express.Router();

// ============================================================
// SAFE REDIS HELPERS
// ============================================================
async function redisGet(key) {
  try { return await redis.get(key); } catch { return null; }
}

async function redisSet(key, value, ttl = 5) {
  try { await redis.set(key, value, { EX: ttl }); } catch {}
}

/* ============================================================
   VEHICLE STATS  (FAST + CACHED)
============================================================ */
router.get("/vehicles", async (req, res) => {
  try {
    const cached = await redisGet("stats:vehicles");

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // ✔ countDocuments is already optimal (no need for lean() here)
    const total = await Vehicle.countDocuments();
    const running = await Vehicle.countDocuments({ status: "running" });
    const idle = await Vehicle.countDocuments({ status: "idle" });

    const data = { total, running, idle };

    await redisSet("stats:vehicles", JSON.stringify(data), 5);

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicle stats" });
  }
});

/* ============================================================
   TRIP STATS (FAST + CACHED)
============================================================ */
router.get("/trips", async (req, res) => {
  try {
    const cached = await redisGet("stats:trips");

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Only counts → extremely fast
    const ongoing = await Trip.countDocuments({ status: "ongoing" });

    const data = { ongoing };

    await redisSet("stats:trips", JSON.stringify(data), 5);

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trip stats" });
  }
});

export default router;
