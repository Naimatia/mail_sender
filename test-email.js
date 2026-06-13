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
    logger: true,
    debug: true,
  });

  try {
    await transporter.verify();
    console.log("SMTP OK");
  } catch (err) {
    console.error(err);
  }
}

test();