import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    title: String,
    message: String,
    type: {
      type: String,
      enum: ["Critical", "Warning", "Info"],
    },
    vehicle: String,
    driver: String,
    status: {
      type: String,
      enum: ["Resolved", "Unresolved"],
      default: "Unresolved",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Alert", alertSchema);
