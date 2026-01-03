import express from "express";
import Alert from "../models/Alert.js";


const router = express.Router();

/* ============================
   GET ALL ALERTS (Alerts Page)
============================= */
router.get("/", async (req, res) => {
  try {
    const alerts = await Alert.find()
      .populate("vehicleId", "vehicleNumber model")
      .sort({ createdAt: -1 });   // 🔥 newest first

    res.json(alerts);
  } catch (err) {
    console.error("GET ALERT ERROR:", err);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

/* ============================
   GET RECENT ALERTS (Dashboard)
============================= */
router.get("/recent", async (req, res) => {
  try {
    const alerts = await Alert.find()
      .populate("vehicleId", "vehicleNumber model")
      .sort({ createdAt: -1 })
      .limit(6);                  // 🔥 only top 6

    res.json(alerts);
  } catch (err) {
    console.error("RECENT ALERT ERROR:", err);
    res.status(500).json({ error: "Failed to fetch recent alerts" });
  }
});

/* ============================
   ALERT STATISTICS (Dashboard Cards)
============================= */
router.get("/stats", async (req, res) => {
  try {
    const total = await Alert.countDocuments();
    const critical = await Alert.countDocuments({ type: "Critical" });
    const warning = await Alert.countDocuments({ type: "Warning" });
    const resolved = await Alert.countDocuments({ status: "Resolved" });

    res.json({
      total,
      critical,
      warning,
      resolved
    });
  } catch (err) {
    console.error("ALERT STATS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch alert stats" });
  }
});

/* ============================
   ADD NEW ALERT
============================= */
router.post("/", async (req, res) => {
  try {
    const alert = new Alert(req.body);
    await alert.save();

    res.json({
      success: true,
      message: "Alert added successfully",
      alert
    });
  } catch (err) {
    console.error("ADD ALERT ERROR:", err);
    res.status(400).json({ error: "Failed to add alert" });
  }
});

/* ============================
   UPDATE ALERT
============================= */
router.put("/:id", async (req, res) => {
  try {
    const updatedAlert = await Alert.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedAlert)
      return res.status(404).json({ error: "Alert not found" });

    res.json({
      success: true,
      message: "Alert updated successfully",
      alert: updatedAlert
    });
  } catch (err) {
    console.error("UPDATE ALERT ERROR:", err);
    res.status(400).json({ error: "Failed to update alert" });
  }
});

/* ============================
   DELETE ALERT
============================= */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Alert.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ error: "Alert not found" });

    res.json({
      success: true,
      message: "Alert deleted successfully"
    });
  } catch (err) {
    console.error("DELETE ALERT ERROR:", err);
    res.status(400).json({ error: "Failed to delete alert" });
  }
});

export default router;
