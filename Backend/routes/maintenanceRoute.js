import express from "express";
import Maintenance from "../models/Maintenance.js";

const router = express.Router();

/* ============================
   GET ALL MAINTENANCE RECORDS
============================= */
router.get("/", async (req, res) => {
  try {
    const records = await Maintenance.find()
      .populate("vehicleId", "vehicleNumber model");

    res.json(records);
  } catch (err) {
    console.error("GET MAINTENANCE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch maintenance records" });
  }
});

/* ============================
   ADD MAINTENANCE RECORD
============================= */
router.post("/", async (req, res) => {
  try {
    const record = await Maintenance.create(req.body);

    res.json({
      success: true,
      message: "Maintenance record added successfully",
      record
    });
  } catch (err) {
    console.error("ADD MAINTENANCE ERROR:", err);
    res.status(400).json({ error: "Failed to create maintenance record" });
  }
});

/* ============================
   UPDATE MAINTENANCE RECORD
============================= */
router.put("/:id", async (req, res) => {
  try {
    const updatedRecord = await Maintenance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedRecord)
      return res.status(404).json({ error: "Maintenance record not found" });

    res.json({
      success: true,
      message: "Maintenance record updated",
      record: updatedRecord
    });
  } catch (err) {
    console.error("UPDATE MAINTENANCE ERROR:", err);
    res.status(400).json({ error: "Failed to update maintenance record" });
  }
});

/* ============================
   DELETE MAINTENANCE RECORD
============================= */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Maintenance.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ error: "Maintenance record not found" });

    res.json({
      success: true,
      message: "Maintenance record deleted"
    });
  } catch (err) {
    console.error("DELETE MAINTENANCE ERROR:", err);
    res.status(400).json({ error: "Failed to delete maintenance record" });
  }
});

export default router;
