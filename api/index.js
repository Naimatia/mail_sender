// server.js - Complete fixed file with proper CORS

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
  // Get the origin from the request
  const origin = req.headers.origin || '*';
  
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests immediately
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
// HEALTH CHECK ENDPOINT - MUST BE BEFORE ANY REDIRECT
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
// TEST CORS ENDPOINT - MUST BE BEFORE ANY REDIRECT
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

// ============================================
// Email transporter - Configured for Spacemail
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.spacemail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // false for 587 (STARTTLS)
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
 * Send meeting notification to participants
 */
app.post("/send-meeting-notification", async (req, res) => {
  const { meeting, recipients, action = 'created' } = req.body;

  console.log("📅 Sending meeting notification:", meeting.Title);
  console.log("📧 Recipients:", recipients.length);
  console.log("📌 Action:", action);

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

/**
 * Send meeting reminder notifications
 */
app.post("/send-meeting-reminders", async (req, res) => {
  const { meetings } = req.body;

  console.log("⏰ Sending meeting reminders for", meetings.length, "meetings");

  try {
    const allResults = [];
    
    for (const meeting of meetings) {
      const recipients = meeting.recipients || [];
      
      for (const recipient of recipients) {
        try {
          const emailContent = generateMeetingEmail(meeting, recipient, 'reminder');
          
          const mailOptions = {
            from: `"Bardawil Luxury Properties" <contact@bardawil-luxury-properties.com>`,
            to: recipient.email,
            replyTo: "contact@bardawil-luxury-properties.com",
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
          };

          console.log(`⏰ Sending reminder to: ${recipient.email}`);
          const info = await transporter.sendMail(mailOptions);
          allResults.push({
            meetingId: meeting.id,
            email: recipient.email,
            success: true,
            messageId: info.messageId
          });
        } catch (error) {
          allResults.push({
            meetingId: meeting.id,
            email: recipient.email,
            success: false,
            error: error.message
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Reminders sent to ${allResults.filter(r => r.success).length} recipients`,
      results: allResults
    });
  } catch (err) {
    console.error("❌ Error sending meeting reminders:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send meeting reminders",
      error: err.message
    });
  }
});

/**
 * Send bulk meeting notifications (for multiple meetings)
 */
app.post("/send-bulk-meeting-notifications", async (req, res) => {
  const { notifications } = req.body;

  console.log("📨 Sending bulk meeting notifications:", notifications.length);

  try {
    const allResults = [];
    
    for (const notification of notifications) {
      const { meeting, recipients, action = 'created' } = notification;
      
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

          console.log(`📨 Sending bulk to: ${recipient.email}`);
          const info = await transporter.sendMail(mailOptions);
          allResults.push({
            meetingId: meeting.id,
            email: recipient.email,
            success: true,
            messageId: info.messageId
          });
        } catch (error) {
          allResults.push({
            meetingId: meeting.id,
            email: recipient.email,
            success: false,
            error: error.message
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk notifications sent to ${allResults.filter(r => r.success).length} recipients`,
      results: allResults
    });
  } catch (err) {
    console.error("❌ Error sending bulk notifications:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send bulk notifications",
      error: err.message
    });
  }
});

/**
 * Send test email to verify configuration
 */
app.post("/send-test-email", async (req, res) => {
  const { to } = req.body;

  console.log("🧪 Sending test email to:", to);

  try {
    const mailOptions = {
      from: `"Bardawil Luxury Properties" <contact@bardawil-luxury-properties.com>`,
      to: to || "atianaim@gmail.com",
      replyTo: "contact@bardawil-luxury-properties.com",
      subject: "✅ Test Email - Bardawil Luxury Properties",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0;">🏢 Bardawil Luxury Properties</h1>
            <p style="margin: 5px 0 0; opacity: 0.9;">Meeting Notification System</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">✅ Test Email Successful!</h2>
            <p>This is a test email to verify that the meeting notification system is working properly.</p>
            
            <div style="background: #e8f0fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #2563eb;">
                <strong>📧 From:</strong> contact@bardawil-luxury-properties.com<br>
                <strong>📧 To:</strong> ${to || "atianaim@gmail.com"}<br>
                <strong>🕐 Time:</strong> ${new Date().toLocaleString()}
              </p>
            </div>
            
            <p style="color: #666;">The meeting notification system is ready to send meeting invitations, updates, and reminders to your team.</p>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-top: 20px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                💡 Next steps: Create a meeting to send notifications to all participants.
              </p>
            </div>
          </div>
          
          <div style="margin-top: 20px; text-align: center; color: #999; font-size: 12px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Bardawil Luxury Properties</p>
            <p style="margin: 0;">contact@bardawil-luxury-properties.com</p>
          </div>
        </div>
      `,
      text: `
Test Email - Bardawil Luxury Properties

This is a test email to verify that the meeting notification system is working properly.

From: contact@bardawil-luxury-properties.com
To: ${to || "atianaim@gmail.com"}
Time: ${new Date().toLocaleString()}

The meeting notification system is ready to send meeting invitations, updates, and reminders to your team.

---
Bardawil Luxury Properties
contact@bardawil-luxury-properties.com
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Test email sent:", info.messageId);

    res.status(200).json({
      success: true,
      message: "Test email sent successfully",
      messageId: info.messageId,
      to: to || "atianaim@gmail.com"
    });
  } catch (err) {
    console.error("❌ Error sending test email:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: err.message
    });
  }
});

// ============================================
// EMAIL GENERATION FUNCTIONS
// ============================================

/**
 * Generate meeting email content
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
    created: '#52c41a',
    updated: '#1890ff',
    deleted: '#ff4d4f',
    reminder: '#faad14'
  };

  const subject = `${actionEmojis[action] || '📅'} ${meeting.Title} - ${actionMessages[action]}`;

  // Get other participants (excluding the recipient)
  const otherParticipants = (recipient.otherParticipants || [])
    .filter(p => p !== recipient.name);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { 
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
          padding: 30px;
          border-radius: 12px 12px 0 0;
          text-align: center;
        }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
        .content { 
          background: #f8f9fa;
          padding: 30px;
          border-radius: 0 0 12px 12px;
        }
        .meeting-details {
          background: white;
          padding: 25px;
          border-radius: 10px;
          margin: 20px 0;
          border-left: 4px solid ${actionColors[action] || '#1890ff'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .meeting-details h2 { 
          margin: 0 0 15px; 
          color: #1a1a2e;
          font-size: 20px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 12px 8px;
        }
        .detail-label { 
          font-weight: 600; 
          color: #666;
          font-size: 14px;
        }
        .detail-value { 
          color: #1a1a2e;
          font-size: 14px;
        }
        .detail-value a { color: #1890ff; text-decoration: none; }
        .detail-value a:hover { text-decoration: underline; }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: white;
          background: ${actionColors[action] || '#1890ff'};
        }
        .participants-section {
          margin: 20px 0;
        }
        .participants-list {
          background: #f5f5f5;
          padding: 15px 20px;
          border-radius: 8px;
        }
        .participant-item {
          padding: 6px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .participant-item:before {
          content: "👤";
        }
        .participant-item.highlight {
          background: #e6f7ff;
          padding: 6px 12px;
          border-radius: 6px;
          margin: 4px 0;
        }
        .participant-item.highlight:before {
          content: "⭐";
        }
        .button {
          display: inline-block;
          background: #1890ff;
          color: white !important;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
          transition: background 0.3s;
        }
        .button:hover { background: #096dd9; }
        .footer { 
          margin-top: 30px;
          text-align: center;
          color: #999;
          font-size: 12px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .company-logo {
          font-size: 16px;
          font-weight: 700;
          color: #1a1a2e;
        }
        .action-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          color: white;
          background: ${actionColors[action] || '#1890ff'};
          margin-left: 10px;
        }
        @media (max-width: 480px) {
          .detail-grid {
            grid-template-columns: 1fr;
            gap: 4px;
          }
          .detail-label {
            font-weight: 700;
            margin-top: 8px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏢 Bardawil Luxury Properties</h1>
          <p>Meeting Notification</p>
        </div>
        
        <div class="content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h2 style="margin: 0;">${escapeHtml(meeting.Title)}</h2>
            <span class="action-badge">${action.toUpperCase()}</span>
          </div>
          
          <p style="color: #666; margin-top: 0;">
            Dear ${escapeHtml(recipient.name)},
          </p>
          <p>
            A meeting <strong>"${escapeHtml(meeting.Title)}"</strong> ${actionMessages[action]}.
          </p>
          
          <div class="meeting-details">
            <div class="detail-grid">
              <div class="detail-label">📅 Date & Time</div>
              <div class="detail-value">${formattedDate}</div>
              
              <div class="detail-label">⏱️ Duration</div>
              <div class="detail-value">${meeting.Duration || 60} minutes (until ${formattedEndTime})</div>
              
              <div class="detail-label">📌 Status</div>
              <div class="detail-value"><span class="badge">${meeting.Status || 'Pending'}</span></div>
              
              ${meeting.Type === 'online' ? `
                <div class="detail-label">🔗 Meeting Link</div>
                <div class="detail-value">
                  <a href="${escapeHtml(meeting.MeetLink)}" target="_blank">${escapeHtml(meeting.MeetLink)}</a>
                </div>
              ` : `
                <div class="detail-label">📍 Location</div>
                <div class="detail-value">Bardawil Luxury Properties Office</div>
              `}
            </div>
          </div>
          
          ${meeting.Description ? `
            <div style="margin: 20px 0;">
              <strong style="color: #1a1a2e;">📋 Description:</strong>
              <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 8px; color: #555;">
                ${escapeHtml(meeting.Description).replace(/\n/g, "<br>")}
              </div>
            </div>
          ` : ''}
          
          <div class="participants-section">
            <strong style="color: #1a1a2e;">👥 Participants:</strong>
            <div class="participants-list">
              <div class="participant-item highlight">
                <strong>${escapeHtml(recipient.name)}</strong> (You)
              </div>
              ${otherParticipants.length > 0 ? otherParticipants.map(p => `
                <div class="participant-item">${escapeHtml(p)}</div>
              `).join('') : ''}
            </div>
          </div>
          
          ${meeting.Type === 'online' && meeting.MeetLink ? `
            <div style="text-align: center; margin: 25px 0;">
              <a href="${escapeHtml(meeting.MeetLink)}" class="button" target="_blank">
                🚀 Join Meeting
              </a>
            </div>
          ` : ''}
          
          <div style="background: #fff3cd; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px; color: #856404;">
              💡 Please ensure you are available at the scheduled time. 
              If you have any conflicts, please contact the meeting organizer.
            </p>
          </div>
        </div>
        
        <div class="footer">
          <div class="company-logo">🏢 Bardawil Luxury Properties</div>
          <p style="margin: 5px 0;">
            Contact: <a href="mailto:contact@bardawil-luxury-properties.com" style="color: #1890ff;">contact@bardawil-luxury-properties.com</a>
          </p>
          <p style="margin: 5px 0; font-size: 11px; color: #bbb;">
            This is an automated notification, please do not reply to this email.
          </p>
          <p style="margin: 5px 0; font-size: 11px; color: #bbb;">
            © ${new Date().getFullYear()} Bardawil Luxury Properties. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain text version
  const text = `
Meeting Notification: ${meeting.Title}

Dear ${recipient.name},

A meeting "${meeting.Title}" ${actionMessages[action]}.

Meeting Details:
- Date & Time: ${formattedDate}
- Duration: ${meeting.Duration || 60} minutes (until ${formattedEndTime})
- Status: ${meeting.Status || 'Pending'}
${meeting.Type === 'online' ? `- Meeting Link: ${meeting.MeetLink}` : '- Location: Bardawil Luxury Properties Office'}
${meeting.Description ? `\nDescription:\n${meeting.Description}` : ''}

Participants:
- ${recipient.name} (You)
${otherParticipants.length > 0 ? otherParticipants.map(p => `- ${p}`).join('\n') : ''}

${meeting.Type === 'online' && meeting.MeetLink ? `\nJoin the meeting: ${meeting.MeetLink}` : ''}

---
Bardawil Luxury Properties
contact@bardawil-luxury-properties.com
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