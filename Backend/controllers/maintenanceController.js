import Maintenance from "../models/Maintenance.js";

export const getMaintenance = async (req, res) => {
  try {
    const records = await Maintenance.find().populate("vehicleId");
    res.json(records);
  } catch {
    res.status(500).json({ error: "Failed to fetch maintenance records" });
  }
};

export const createMaintenance = async (req, res) => {
  try {
    const record = await Maintenance.create(req.body);
    res.status(201).json(record);
  } catch {
    res.status(400).json({ error: "Failed to create maintenance record" });
  }
};
