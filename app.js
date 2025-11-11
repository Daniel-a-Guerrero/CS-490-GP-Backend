const express = require("express");
require("dotenv").config();
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 4000;
const authRoutes = require("./modules/auth/routes");
const staffRoutes = require("./modules/staff/routes");
const userRoutes = require("./modules/users/routes");
const appointmentRoutes = require("./modules/appointments/routes");
const analyticsRoutes = require("./modules/analytics/routes");
const salonRoutes = require("./modules/salons/routes");
const bookingRoutes = require("./modules/bookings/routes");
const paymentRoutes = require("./modules/payments/routes");
const loyaltyRoutes = require("./modules/loyalty/routes");
const reviewRoutes = require("./modules/reviews/routes");
const notificationRoutes = require("./modules/notifications/routes");
const historyRoutes = require("./modules/history/routes");
const photoRoutes = require("./modules/photos/routes");
const adminRoutes = require("./modules/admins/routes");
const shopRoutes = require("./modules/shop/routes");
const { db, testConnection } = require("./config/database");

const app = express();

// Serve uploaded files statically
app.use('/uploads', express.static('public/uploads'));

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(cookieParser());

app.use("/api/salons", salonRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/users", userRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/photos", photoRoutes);
app.use("/api/admin-dashboard", adminRoutes);
app.use("/api/shop", shopRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  //Error handler
  console.error("Error:", err);

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const startServer = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      console.error(" Database connection failed. Exiting...");
      process.exit(1);
    }

    app.listen(port, () => {
      console.log(` Server is running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error(" Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await db.closePool();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await db.closePool();
  process.exit(0);
});

startServer();

module.exports = app;
