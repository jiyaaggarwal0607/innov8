import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'safevoice',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const connectDB = async () => { 
  try {
    const connection = await pool.getConnection();
    console.log("Database connected successfully");
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS testimonies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        case_ref VARCHAR(255) NOT NULL,
        story_text TEXT,
        emotions TEXT,
        certainty INT,
        timeline TEXT,
        summary_html TEXT,
        offender_desc TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Testimonies table verified.");
    connection.release();
  } catch (err) {
    console.error("Database connection failed. Please ensure MySQL is running and the database exists.", err.message);
  }
};

export { pool };
export default connectDB;