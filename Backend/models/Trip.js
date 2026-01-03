import mongoose from "mongoose";

const TripSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true
  },

  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    required: true
  },

  origin: String,
  destination: String,

  originCoords: {
    lat: Number,
    lng: Number
  },

  destinationCoords: {
    lat: Number,
    lng: Number
  },

  distance: Number,

  startTime: {
    type: Date,
    required: true
  },

  duration: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["scheduled", "ongoing", "completed"],
    default: "scheduled"
  },

  // ✅ REAL ROAD ROUTE POINTS (FROM OSRM)
  route: [
    {
      lat: Number,
      lng: Number
    }
  ],

  // ✅ ✅ ✅ THIS IS THE MISSING FIX
  routeIndex: {
    type: Number,
    default: 0
  }

},{ versionKey: false });

export default mongoose.model("Trip", TripSchema);
