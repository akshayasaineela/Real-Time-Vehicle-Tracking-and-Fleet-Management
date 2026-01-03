import express from "express";
import Setting from "../models/Setting.js";

const router = express.Router();

/* ============================
   GET SETTINGS
============================= */
router.get("/", async (req, res) => {
  try {
    let setting = await Setting.findOne();

    // Create default settings if none exist
    if (!setting) {
      setting = await Setting.create({});
    }

    res.json(setting);
  } catch (err) {
    console.error("GET SETTINGS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

/* ============================
   UPDATE SETTINGS
============================= */
router.put("/", async (req, res) => {
  try {
    let setting = await Setting.findOne();

    if (!setting) {
      // If no settings exist, create a new one
      setting = await Setting.create(req.body);
    } else {
      // Update existing settings
      setting = await Setting.findByIdAndUpdate(
        setting._id,
        req.body,
        { new: true }
      );
    }

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings: setting
    });
  } catch (err) {
    console.error("UPDATE SETTINGS ERROR:", err);
    res.status(400).json({ error: "Failed to update settings" });
  }
});

export default router;
