const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();

// ============================================
// FIXED CORS CONFIGURATION - Must be FIRST
// ============================================

// Disable x-powered-by for security
app.disable('x-powered-by');

// Custom CORS middleware that handles everything
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    console.log('🔄 OPTIONS request received for:', req.path);
    return res.status(200).end();
  }
  
  next();
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// LOGGING MIDDLEWARE
// ============================================
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    cors_enabled: true,
    node_version: process.version
  });
});

// ============================================
// TEST CORS ENDPOINT
// ============================================
app.get("/test-cors", (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: "CORS is working!", 
    origin: req.headers.origin || 'no origin',
    method: req.method,
    headers: req.headers
  });
});

// ============================================
// Configure multer for file uploads
// ============================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024
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

// ============================================
// Email transporter - Configured for Spacemail
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.spacemail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "contact@bardawil-luxury-properties.com",
    pass: process.env.SMTP_PASS || "Bardawil@2026",
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3',
    minVersion: 'TLSv1'
  },
  requireTLS: true,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP verification failed:", error);
  } else {
    console.log("✅ SMTP connection ready - Sending from: contact@bardawil-luxury-properties.com");
  }
});

// ============================================
// MEETING NOTIFICATION ENDPOINTS
// ============================================

/**
 * Send meeting notification to participants (supports multiple agents)
 */
app.post("/send-meeting-notification", async (req, res) => {
  const { meeting, recipients, action = 'created' } = req.body;

  console.log("📅 Sending meeting notification:", meeting.Title);
  console.log("📧 Recipients:", recipients.length);
  console.log("📌 Action:", action);
  console.log("👥 Agents assigned:", meeting.assignedAgents || []);

  try {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const emailContent = generateMeetingEmail(meeting, recipient, action);
        
        const mailOptions = {
          from: `"Bardawil Luxury Properties" <contact@bardawil-luxury-properties.com>`,
          to: recipient.email,
          replyTo: "contact@bardawil-luxury-properties.com",
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        };

        console.log(`📧 Sending to: ${recipient.email}`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${recipient.email}:`, info.messageId);
        
        results.push({
          email: recipient.email,
          success: true,
          messageId: info.messageId
        });
      } catch (error) {
        console.error(`❌ Failed to send to ${recipient.email}:`, error.message);
        results.push({
          email: recipient.email,
          success: false,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Meeting notifications sent to ${results.filter(r => r.success).length} recipients`,
      results: results
    });
  } catch (err) {
    console.error("❌ Error sending meeting notifications:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send meeting notifications",
      error: err.message
    });
  }
});

// ============================================
// EMAIL GENERATION FUNCTION - With Logo and Professional Template
// ============================================

/**
 * Generate meeting email content with logo and professional design
 */
function generateMeetingEmail(meeting, recipient, action = 'created') {
  const meetingDate = new Date(meeting.DateTime);
  const formattedDate = meetingDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai'
  });

  const endTime = new Date(meetingDate.getTime() + (meeting.Duration || 60) * 60000);
  const formattedEndTime = endTime.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai'
  });

  const actionMessages = {
    created: 'has been scheduled',
    updated: 'has been updated',
    deleted: 'has been cancelled',
    reminder: 'is starting in 30 minutes'
  };

  const actionEmojis = {
    created: '📅',
    updated: '🔄',
    deleted: '❌',
    reminder: '⏰'
  };

  const actionColors = {
    created: '#1a365d',
    updated: '#2b6cb0',
    deleted: '#e53e3e',
    reminder: '#d69e2e'
  };

  const subject = `${actionEmojis[action] || '📅'} ${meeting.Title} - ${actionMessages[action]}`;

  // Get other participants (excluding the recipient)
  const otherParticipants = (recipient.otherParticipants || [])
    .filter(p => p !== recipient.name);

  // Get assigned agents
  const assignedAgents = meeting.assignedAgents || [];

  // Logo as base64 or URL - Using a professional placeholder
  // Replace with your actual logo URL or base64
  const logoUrl = meeting.logoUrl || 'https://res.cloudinary.com/danzhiaqf/image/upload/v1772995834/obrex365/companies/k9SquTLadNkzlBOHfPkb/FINAL_BARDAWIL_APPROVED_LOGO_nynva6.png';
  
  // If you have a base64 logo, use this format:
  // const logoBase64 = 'data:image/png;base64,<your-base64-here>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Meeting Notification</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #2d3748;
          background: #f7fafc;
          margin: 0;
          padding: 20px;
        }
        .container { 
          max-width: 650px; 
          margin: 0 auto; 
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
        }
        .header { 
          background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 50%, #2c5282 100%);
          padding: 30px 40px 25px;
          text-align: center;
          position: relative;
        }
        .header-logo {
          max-width: 180px;
          height: auto;
          margin-bottom: 10px;
        }
        .header h1 { 
          color: #ffffff;
          font-size: 22px;
          font-weight: 600;
          margin: 5px 0 0;
          letter-spacing: 0.5px;
        }
        .header .subtitle {
          color: rgba(255,255,255,0.85);
          font-size: 14px;
          margin-top: 4px;
          font-weight: 300;
        }
        .header-decoration {
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #ed8936, #ecc94b, #ed8936);
        }
        .content { 
          padding: 35px 40px 30px;
        }
        .greeting {
          font-size: 16px;
          color: #2d3748;
          margin-bottom: 4px;
        }
        .greeting-name {
          font-weight: 600;
          color: #1a365d;
        }
        .meeting-title-section {
          background: #ebf8ff;
          padding: 20px 24px;
          border-radius: 12px;
          margin: 16px 0 20px;
          border-left: 4px solid #2b6cb0;
        }
        .meeting-title-section h2 {
          color: #1a365d;
          font-size: 20px;
          margin: 0;
          font-weight: 600;
        }
        .meeting-title-section .action-tag {
          display: inline-block;
          background: ${actionColors[action] || '#2b6cb0'};
          color: white;
          padding: 2px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .meeting-details {
          background: #f7fafc;
          padding: 24px;
          border-radius: 12px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid #edf2f7;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-icon {
          width: 28px;
          color: #4a5568;
          font-size: 16px;
        }
        .detail-label {
          width: 100px;
          font-weight: 600;
          color: #4a5568;
          font-size: 14px;
        }
        .detail-value {
          flex: 1;
          color: #2d3748;
          font-size: 14px;
        }
        .detail-value a {
          color: #2b6cb0;
          text-decoration: none;
        }
        .detail-value a:hover {
          text-decoration: underline;
        }
        .badge {
          display: inline-block;
          padding: 2px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .badge-pending { background: #fefcbf; color: #975a16; }
        .badge-confirmed { background: #c6f6d5; color: #22543d; }
        .badge-cancelled { background: #fed7d7; color: #9b2c2c; }
        .badge-completed { background: #bee3f8; color: #2a4365; }
        
        .participants-section {
          margin: 20px 0;
        }
        .participants-section h4 {
          color: #1a365d;
          font-size: 15px;
          margin-bottom: 8px;
        }
        .participants-list {
          background: #f7fafc;
          padding: 12px 16px;
          border-radius: 8px;
        }
        .participant-item {
          padding: 4px 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .participant-item.highlight {
          background: #ebf8ff;
          padding: 6px 12px;
          border-radius: 6px;
          margin: 2px 0;
        }
        .participant-item .role-tag {
          background: #e2e8f0;
          padding: 0 8px;
          border-radius: 4px;
          font-size: 11px;
          color: #4a5568;
        }
        .agents-section {
          margin: 16px 0 20px;
          padding: 16px 20px;
          background: #f0fff4;
          border-radius: 8px;
          border: 1px solid #c6f6d5;
        }
        .agents-section h4 {
          color: #22543d;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .agents-section .agent-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 12px;
        }
        .agents-section .agent-tag {
          background: #e6fffa;
          padding: 2px 12px;
          border-radius: 12px;
          font-size: 13px;
          color: #234e52;
        }
        .meeting-link-btn {
          display: inline-block;
          background: #2b6cb0;
          color: white !important;
          padding: 12px 36px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          margin: 16px 0 8px;
          transition: background 0.3s;
        }
        .meeting-link-btn:hover {
          background: #1a365d;
        }
        .note-box {
          background: #fffbeb;
          padding: 14px 20px;
          border-radius: 8px;
          border-left: 4px solid #d69e2e;
          margin-top: 20px;
        }
        .note-box p {
          margin: 0;
          font-size: 14px;
          color: #744210;
        }
        .description-box {
          background: white;
          padding: 16px 20px;
          border-radius: 8px;
          margin: 16px 0;
          border: 1px solid #e2e8f0;
        }
        .description-box p {
          margin: 0;
          color: #4a5568;
          font-size: 14px;
          white-space: pre-wrap;
        }
        .footer { 
          background: #f7fafc;
          padding: 25px 40px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        .footer .company-name {
          font-size: 16px;
          font-weight: 700;
          color: #1a365d;
        }
        .footer .company-details {
          color: #718096;
          font-size: 13px;
          margin: 4px 0;
        }
        .footer .company-details a {
          color: #2b6cb0;
          text-decoration: none;
        }
        .footer .disclaimer {
          color: #a0aec0;
          font-size: 11px;
          margin-top: 8px;
        }
        .footer .social-links {
          margin-top: 10px;
        }
        .footer .social-links a {
          color: #4a5568;
          text-decoration: none;
          margin: 0 8px;
          font-size: 14px;
        }
        @media (max-width: 480px) {
          .header { padding: 20px; }
          .content { padding: 20px; }
          .footer { padding: 20px; }
          .detail-row { flex-wrap: wrap; }
          .detail-label { width: 100%; margin-bottom: 2px; }
          .detail-value { width: 100%; }
          .meeting-title-section h2 { font-size: 17px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- HEADER WITH LOGO -->
        <div class="header">
          <!-- Replace the src with your actual logo URL or base64 -->
          <img src="${logoUrl}" alt="Bardawil Luxury Properties" class="header-logo" style="max-width:180px;height:auto;background:white;padding:8px 16px;border-radius:8px;" onerror="this.style.display='none'">
          <h1>Bardawil Luxury Properties</h1>
          <div class="header-decoration"></div>
        </div>
        
        <!-- CONTENT -->
        <div class="content">
          <p class="greeting">Dear <span class="greeting-name">${escapeHtml(recipient.name)}</span>,</p>
          
          <div class="meeting-title-section">
            <h2>${escapeHtml(meeting.Title)}</h2>
            <span class="action-tag">${action.toUpperCase()}</span>
          </div>
          
          <p style="margin-bottom: 8px;">
            A meeting <strong>"${escapeHtml(meeting.Title)}"</strong> ${actionMessages[action]}.
          </p>
          
          <!-- MEETING DETAILS -->
          <div class="meeting-details">
            <div class="detail-row">
              <span class="detail-icon">📅</span>
              <span class="detail-label">Date & Time</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-icon">⏱️</span>
              <span class="detail-label">Duration</span>
              <span class="detail-value">${meeting.Duration || 60} minutes (until ${formattedEndTime})</span>
            </div>
            <div class="detail-row">
              <span class="detail-icon">📌</span>
              <span class="detail-label">Status</span>
              <span class="detail-value">
                <span class="badge badge-${(meeting.Status || 'Pending').toLowerCase()}">${meeting.Status || 'Pending'}</span>
              </span>
            </div>
            ${meeting.Type === 'online' ? `
              <div class="detail-row">
                <span class="detail-icon">🔗</span>
                <span class="detail-label">Meeting Link</span>
                <span class="detail-value">
                  <a href="${escapeHtml(meeting.MeetLink)}" target="_blank">${escapeHtml(meeting.MeetLink)}</a>
                </span>
              </div>
            ` : `
              <div class="detail-row">
                <span class="detail-icon">📍</span>
                <span class="detail-label">Location</span>
                <span class="detail-value">Bardawil Luxury Properties Office, Dubai</span>
              </div>
            `}
          </div>
          
          <!-- ASSIGNED AGENTS SECTION -->
          ${assignedAgents.length > 0 ? `
            <div class="agents-section">
              <h4>🏅 Assigned Agents</h4>
              <div class="agent-list">
                ${assignedAgents.map(agent => `
                  <span class="agent-tag">${escapeHtml(agent)}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- DESCRIPTION -->
          ${meeting.Description ? `
            <div class="description-box">
              <p>${escapeHtml(meeting.Description).replace(/\n/g, "<br>")}</p>
            </div>
          ` : ''}
          
          <!-- PARTICIPANTS -->
          <div class="participants-section">
            <h4>👥 Participants</h4>
            <div class="participants-list">
              <div class="participant-item highlight">
                <strong>${escapeHtml(recipient.name)}</strong> <span class="role-tag">You</span>
              </div>
              ${otherParticipants.length > 0 ? otherParticipants.map(p => `
                <div class="participant-item">${escapeHtml(p)}</div>
              `).join('') : ''}
            </div>
          </div>
          
          <!-- MEETING LINK BUTTON -->
          ${meeting.Type === 'online' && meeting.MeetLink ? `
            <div style="text-align: center;">
              <a href="${escapeHtml(meeting.MeetLink)}" class="meeting-link-btn" target="_blank">
                🚀 Join Meeting
              </a>
            </div>
          ` : ''}
          
          <!-- NOTE BOX -->
          <div class="note-box">
            <p>💡 Please ensure you are available at the scheduled time. If you have any conflicts, please contact the meeting organizer.</p>
          </div>
        </div>
        
        <!-- FOOTER -->
        <div class="footer">
          <div class="company-name">🏢 Bardawil Luxury Properties</div>
          <div class="company-details">
            📞 +971 4 123 4567 &nbsp;|&nbsp; 
            📧 <a href="mailto:contact@bardawil-luxury-properties.com">contact@bardawil-luxury-properties.com</a>
          </div>
          <div class="disclaimer">
            This is an automated notification, please do not reply to this email.
            <br>
            © ${new Date().getFullYear()} Bardawil Luxury Properties. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain text version
  const text = `
Bardawil Luxury Properties - Meeting Notification
==================================================

Dear ${recipient.name},

A meeting "${meeting.Title}" ${actionMessages[action]}.

Meeting Details:
- Date & Time: ${formattedDate}
- Duration: ${meeting.Duration || 60} minutes (until ${formattedEndTime})
- Status: ${meeting.Status || 'Pending'}
${meeting.Type === 'online' ? `- Meeting Link: ${meeting.MeetLink}` : '- Location: Bardawil Luxury Properties Office, Dubai'}
${assignedAgents.length > 0 ? `\nAssigned Agents: ${assignedAgents.join(', ')}` : ''}
${meeting.Description ? `\nDescription:\n${meeting.Description}` : ''}

Participants:
- ${recipient.name} (You)
${otherParticipants.length > 0 ? otherParticipants.map(p => `- ${p}`).join('\n') : ''}

${meeting.Type === 'online' && meeting.MeetLink ? `\nJoin the meeting: ${meeting.MeetLink}` : ''}

---
Bardawil Luxury Properties
Dubai, United Arab Emirates
contact@bardawil-luxury-properties.com
© ${new Date().getFullYear()} Bardawil Luxury Properties. All rights reserved.
  `;

  return { subject, html, text };
}

/**
 * Escape HTML characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
// EXISTING ENDPOINT - Send Inquiry
// ============================================

app.post("/send-inquiry", upload.array("files", 5), async (req, res) => {
  const { name, email, phone, message } = req.body;
  const files = req.files || [];

  console.log("📬 Received inquiry from:", name);
  console.log("📎 Files count:", files.length);

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Name is required"
    });
  }

  try {
    const attachments = files.map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    }));

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

    const mailOptions = {
      from: `"Bardawil Luxury Properties" <contact@bardawil-luxury-properties.com>`,
      to: "contact@bardawil-luxury-properties.com",
      replyTo: email || "contact@bardawil-luxury-properties.com",
      subject: `New Inquiry from ${name}${files.length > 0 ? ` (with ${files.length} attachment${files.length > 1 ? 's' : ''})` : ''}`,
      html: emailContent,
      attachments: attachments
    };

    console.log("📧 Sending inquiry email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Inquiry email sent:", info.messageId);

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;