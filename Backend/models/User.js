import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    company: String,
    adminName: String,
    email: { type: String, unique: true },
    password: String,

    otp: String,
    otpExpiry: Date
});

export default mongoose.model("User", userSchema);
