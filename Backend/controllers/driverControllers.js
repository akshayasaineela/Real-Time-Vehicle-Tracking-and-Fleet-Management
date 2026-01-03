import Driver from "../models/Driver.js";

export const getDrivers = async (req, res) => {
  const drivers = await Driver.find();
  res.json(drivers);
};

export const getDriverById = async (req, res) => {
  const driver = await Driver.findById(req.params.id);
  res.json(driver);
};

export const addDriver = async (req, res) => {
  const driver = new Driver(req.body);
  await driver.save();
  res.json(driver);
};

export const updateDriver = async (req, res) => {
  const updated = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

export const deleteDriver = async (req, res) => {
  await Driver.findByIdAndDelete(req.params.id);
  res.json({ success: true });
};
