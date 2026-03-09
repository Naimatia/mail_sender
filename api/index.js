const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");
// No dotenv here — Vercel injects env vars automatically

const app = express();

// Middleware (order matters)
app.use(cors());                    // Allows frontend requests
app.use(bodyParser.json());

// Transporter (uses Vercel env vars)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.privateemail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true" || false,  // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: true,
    minVersion: "TLSv1.2"
  }
});

// Optional: log connection status (useful in Vercel logs)
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP verification failed:", error);
  } else {
    console.log("SMTP connection ready");
  }
});

// Your endpoint
app.post("/send-email", async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !phone || !message) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields (name, email, phone, message)"
    });
  }

  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  try {
    await transporter.sendMail({
      from: `"Bardawil Contact Form" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: subject || `New Contact from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <h2 style="color: #1a1a1a;">New Message Received</h2>
          <p>A visitor submitted the following via your website:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td>${name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td><a href="mailto:$$   {email}">   $${email}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td>${phone}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Subject:</td><td>${subject || "—"}</td></tr>
          </table>
          
          <h3 style="margin-top: 24px; color: #444;">Message:</h3>
          <div style="white-space: pre-wrap; background: #f9f9f9; padding: 16px; border-left: 4px solid #2563eb;">
            ${message.replace(/\n/g, "<br>")}
          </div>
          
          <p style="margin-top: 32px; font-size: 14px; color: #666;">
            Reply directly to this email or use the phone number above.
          </p>
        </div>
      `,
    });

    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    console.error("Email send error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to send email. Please try again later."
    });
  }
});

// Important: Export the app for Vercel
module.exports = app;