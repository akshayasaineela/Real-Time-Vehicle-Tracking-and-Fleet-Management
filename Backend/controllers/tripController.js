import Trip from "../models/Trip.js";

export const getTrips = async (req, res) => {
  try {
    const trips = await Trip.find();
    res.json(trips);
  } catch {
    res.status(500).json({ error: "Failed to fetch trips" });
  }
};

export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    res.json(trip);
  } catch {
    res.status(400).json({ error: "Invalid ID format" });
  }
};

export const addTrip = async (req, res) => {
  try {
    const trip = new Trip(req.body);
    await trip.save();
    res.json({ success: true, message: "Trip added", trip });
  } catch {
    res.status(400).json({ error: "Failed to add trip" });
  }
};

export const updateTrip = async (req, res) => {
  try {
    const updatedTrip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, message: "Trip updated", updatedTrip });
  } catch {
    res.status(400).json({ error: "Failed to update trip" });
  }
};

export const deleteTrip = async (req, res) => {
  try {
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Trip deleted" });
  } catch {
    res.status(400).json({ error: "Failed to delete trip" });
  }
};
