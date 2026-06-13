const nodemailer = require("nodemailer");

async function test() {
  const transporter = nodemailer.createTransport({
    host: "mail.spacemail.com",
    port: 465,
    secure: true,
    auth: {
      user: "manager@bardawil-luxury-properties.com",
      pass: "Bardawil@2026",
    },
  });

  try {
    await transporter.sendMail({
      from: '"Bardawil Luxury Properties" <manager@bardawil-luxury-properties.com>',
      to: "manager@bardawil-luxury-properties.com",
      subject: "Test Email",
      html: "<h1>Test Successful!</h1><p>Your email system is working!</p>",
    });
    console.log("✅ Test email sent successfully!");
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}

test();