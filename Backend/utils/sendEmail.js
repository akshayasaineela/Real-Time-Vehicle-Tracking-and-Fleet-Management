import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

export const sendEmail = async (to, subject, text) => {
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;

    // Safety check (prevents undefined errors)
    if (!EMAIL_USER || !EMAIL_PASS) {
        console.error("❌ EMAIL_USER or EMAIL_PASS missing in .env");
        throw new Error("Email configuration missing");
    }

    // Create email transporter
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false   // 🔥 FIX: Prevents certificate chain error
        }
    });

    try {
        const info = await transporter.sendMail({
            from: `"FleetTrack" <${EMAIL_USER}>`,
            to,
            subject,
            text
        });

        console.log("📧 Mail sent successfully →", info.accepted);
        return true;

    } catch (err) {
        console.error("❌ ERROR SENDING EMAIL:", err.message);
        throw new Error("Mail send failed. Check EMAIL_USER, EMAIL_PASS or internet.");
    }
};
