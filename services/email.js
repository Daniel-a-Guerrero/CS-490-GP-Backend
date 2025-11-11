const nodemailer = require("nodemailer");

const defaultSender = "stygo.notification@gmail.com";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || defaultSender,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

exports.sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || defaultSender,
      to,
      subject,
      html,
    });
    console.log("📧 Email sent successfully to", to);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
};
