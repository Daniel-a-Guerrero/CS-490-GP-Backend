const admin =require("firebase-admin");
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const mysql = require('mysql2/promise');
const helmet = require('helmet'); //Enhances security by setting various HTTP response headers
const morgan = require('morgan'); //Middleware for logging details about incoming HTTP requests
const port = process.env.PORT || 3000;
const db = require('./config/database');
//const salonRoutes = require("./routes/salonRoutes");
const authRoutes = require("./modules/auth/routes");
const staffRoutes= require("./modules/staff/routes")
const { db, testConnection } = require("./config/database");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/staff",staffRoutes)

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

const startServer=async()=>{
  try{
    /*const dbCon=await db.testConnection()
    if(!dbCon){
      console.error("Failed to connect. Now exiting")
      process.exit()
    }*/
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

//app.use("/api/films", salonRoutes);
