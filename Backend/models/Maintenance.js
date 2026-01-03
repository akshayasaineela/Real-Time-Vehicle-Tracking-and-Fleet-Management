import mongoose from "mongoose";

const maintenanceSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true
  },

  title: { type: String, required: true },
  description: { type: String, default: "" },

  date: { type: String, required: true },
  cost: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["scheduled", "in-progress", "completed"],
    default: "scheduled"
  }

}, { timestamps: true });

export default mongoose.model("Maintenance", maintenanceSchema);
