// models/Vehicle.js
import mongoose from "mongoose";

const tripSubSchema = new mongoose.Schema({
  date: String,
  route: String,
  distance: String,
  duration: String
}, { _id: false });

const geoPointSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  time: { type: Date, default: Date.now }
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true }, // number plate
  model: { type: String, default: "" },

  // optional real driver relation (if you assign by driverId)
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    default: null
  },

  // friendly stored driver name (frontend uses a text input)
  driverName: { type: String, default: "" },

  lastTrip: { type: String, default: "" },
  lastServiceDate: { type: Date, default: null },

  // human readable location
  location: { type: String, default: "" },

  // latest known gps
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  speed: { type: Number, default: 0 },

    // ✅ CURRENT TRIP DESTINATION (FOR ROAD ROUTING)
  destinationCoords: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },

  // use statuses that match frontend
  status: {
    type: String,
    enum: ["running", "idle", "stopped"],
    default: "idle"
  },

  fuel: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },

  // user-facing trips (route history summary)
  trips: {
    type: [tripSubSchema],
    default: []
  },

  // full trip history with coordinates
 tripHistory: [
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    date: Date,
    origin: String,
    destination: String,
    distanceKm: Number,
    durationMin: Number,
    driver: String,
    status: String
  }
],

}, { timestamps: true });

export default mongoose.model("Vehicle", vehicleSchema);
