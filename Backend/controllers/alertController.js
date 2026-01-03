import Alert from "../models/Alert.js";

export const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().populate("vehicleId");
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
};

export const addAlert = async (req, res) => {
  try {
    const alert = new Alert(req.body);
    await alert.save();
    res.json({ success: true, message: "Alert added", alert });
  } catch (err) {
    res.status(400).json({ error: "Failed to add alert" });
  }
};

export const updateAlert = async (req, res) => {
  try {
    const updatedAlert = await Alert.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, message: "Alert updated", updatedAlert });
  } catch (err) {
    res.status(400).json({ error: "Failed to update alert" });
  }
};

export const deleteAlert = async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Alert deleted" });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete alert" });
  }
};
