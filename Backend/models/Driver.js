import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema({
    driver: String,
    phone: String,
    license: String,
    licenseExpiry: String,
    rating: Number,
    trips: Number,
    violations: {
  type: Number,
  default: 0
},

    photo: String,
    avgDistance: String,

    // 🔹 OLD tripHistory still kept (not breaking your UI)
tripHistory: [
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    date: Date,
    origin: String,
    destination: String,
    distanceKm: Number,
    durationMin: Number,
    vehicle: String,
    status: String
  }
],

    // --------------------------------------
    // 🔥 NEW FIELDS FOR AVAILABILITY SYSTEM
    // --------------------------------------

    // Driver working/booking status
    status: {
        type: String,
        enum: ["available", "reserved", "on-trip", "off-duty"],
        default: "available"
    },

    // Currently assigned trip (if any)
    currentTripId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        default: null
    },

    // Important: Future feature — assign driver to vehicle
   assignedVehicle: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Vehicle",
  default: null
}

});

export default mongoose.model("Driver", DriverSchema);
