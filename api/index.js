const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDF, and DOC files are allowed'));
    }
  }
});

// Email transporter - FIXED with correct Spacemail settings
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.spacemail.com",  // Changed from mail.privateemail.com
  port: Number(process.env.SMTP_PORT) || 465,          // Changed to 465
  secure: process.env.SMTP_SECURE === "true" || true,  // Changed to true for port 465
  auth: {
    user: process.env.SMTP_USER || "manager@bardawil-luxury-properties.com",
    pass: process.env.SMTP_PASS || "Bardawil@2026",
  },
  tls: {
    rejectUnauthorized: false,  // Set to false for testing, change to true in production
    minVersion: "TLSv1.2"
  },
  // Add connection timeout settings
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP verification failed:", error);
  } else {
    console.log("✅ SMTP connection ready - Authenticated as:", process.env.SMTP_USER || "manager@bardawil-luxury-properties.com");
  }
});

// Single endpoint for sending inquiry with files in same email
app.post("/send-inquiry", upload.array("files", 5), async (req, res) => {
  const { name, email, phone, message } = req.body;
  const files = req.files || [];

  console.log("📬 Received inquiry from:", name);
  console.log("📎 Files count:", files.length);

  // Validate required fields
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Name is required"
    });
  }

  try {
    // Prepare attachments if files exist
    const attachments = files.map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }));

    // Create file list for email body
    const fileListHtml = files.length > 0 ? `
      <div style="background: #e8f0fe; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #2563eb;">📎 Attached Files (${files.length})</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${files.map(file => `
            <li style="margin: 5px 0;">
              <strong>${escapeHtml(file.originalname)}</strong> (${(file.size / 1024 / 1024).toFixed(2)} MB)
            </li>
          `).join('')}
        </ul>
        <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">
          These files are attached to this email.
        </p>
      </div>
    ` : '';

    // Email content
    const emailContent = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
          📬 New Inquiry Received
        </h2>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2563eb;">Contact Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 120px;">Name:</td>
              <td style="padding: 8px 0;">${escapeHtml(name)}</td>
            </tr>
            ${email ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Email:</td>
              <td style="padding: 8px 0;">
                <a href="mailto:${email}" style="color: #2563eb;">${email}</a>
              </td>
            </tr>
            ` : ''}
            ${phone ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
              <td style="padding: 8px 0;">
                <a href="tel:${phone}" style="color: #2563eb;">${phone}</a>
              </td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        ${message ? `
        <div style="margin: 20px 0;">
          <h3 style="color: #2563eb;">Message:</h3>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
            ${escapeHtml(message).replace(/\n/g, "<br>")}
          </div>
        </div>
        ` : ''}
        
        ${fileListHtml}
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
          <p>This inquiry was sent from the Bardawil Luxury Properties website contact form.</p>
          <p>Reply directly to this email to respond to the customer.</p>
        </div>
      </div>
    `;

    // Send single email with all data and attachments
    const mailOptions = {
      from: `"Bardawil Luxury Properties" <${process.env.SMTP_USER || "manager@bardawil-luxury-properties.com"}>`,
      to: "manager@bardawil-luxury-properties.com",
      replyTo: email || process.env.SMTP_USER || "manager@bardawil-luxury-properties.com",
      subject: `New Inquiry from ${name}${files.length > 0 ? ` (with ${files.length} attachment${files.length > 1 ? 's' : ''})` : ''}`,
      html: emailContent,
      attachments: attachments
    };

    console.log("📧 Sending email to manager@bardawil-luxury-properties.com");
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);

    res.status(200).json({ 
      success: true, 
      message: "Inquiry sent successfully with files" 
    });
  } catch (err) {
    console.error("❌ Email send error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send inquiry. Please try again later.",
      error: err.message
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    smtp_host: process.env.SMTP_HOST || "mail.spacemail.com",
    smtp_port: process.env.SMTP_PORT || 465,
    smtp_user: process.env.SMTP_USER || "manager@bardawil-luxury-properties.com"
  });
});

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = app;