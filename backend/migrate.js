import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tnt_pulse',
      port: 3306
    });
    
    // Check if column exists
    const [cols] = await conn.execute("SHOW COLUMNS FROM project_members LIKE 'project_role'");
    if (cols.length === 0) {
      console.log("Column project_role does not exist, adding it...");
      await conn.execute("ALTER TABLE project_members ADD COLUMN project_role VARCHAR(255) NULL");
      console.log("Migration successful");
    } else {
      console.log("Column already exists");
    }
    await conn.end();
  } catch (err) {
    console.error("Migration error:", err.message);
  }
}

migrate();
