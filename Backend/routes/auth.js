import express from "express";
import {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword
} from "../controllers/authcontroller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset", resetPassword);

export default router;
