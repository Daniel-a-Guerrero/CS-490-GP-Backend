// config/database.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "salon_platform",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log("Database connected successfully");
    conn.release();
    return true;
  } catch (err) {
    console.error("Database connection failed:", err.message);
    return false;
  }
}

// Graceful pool close
async function closePool() {
  try {
    await pool.end();
    console.log("Database pool closed.");
  } catch (err) {
    console.error("Error closing pool:", err.message);
  }
}

// Export everything
module.exports = {
  db: pool,
  query,
  testConnection,
  closePool,
};
