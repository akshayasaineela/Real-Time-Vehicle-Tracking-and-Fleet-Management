import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({

  // Profile
  fullName: { type: String, default: "" },
  role: { type: String, default: "Fleet Manager" },
  adminEmail: { type: String, default: "" },
  avatarColor: { type: String, default: "#000000" },

  // Preferences
  language: { type: String, default: "en" },
  timeZone: { type: String, default: "IST" },
  dateFormat: { type: String, default: "DD/MM/YYYY" },

  // Appearance
  themeMode: { type: String, default: "light" }, // light/dark/auto
  compactMode: { type: Boolean, default: false },

  // Notifications
  emailAlerts: { type: Boolean, default: true },
  smsAlerts: { type: Boolean, default: false },
  pushAlerts: { type: Boolean, default: true },
  maintenanceAlerts: { type: Boolean, default: true },
  tripRouteAlerts: { type: Boolean, default: true },

  // Security
  twoStep: { type: Boolean, default: false },
  newLoginAlerts: { type: Boolean, default: false },

  // Data & Backup
  backupFrequency: { type: String, default: "Daily" },
  autoBackup: { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model("Setting", settingSchema);
