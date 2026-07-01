import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'tnt_pulse',
      port: parseInt(process.env.DB_PORT, 10) || 3306
    });
    console.log('Database connected successfully.');
    const [tables] = await conn.execute('SHOW TABLES');
    console.log('Tables:', tables.map(t => Object.values(t)[0]));
    
    // Check documents table structure
    const [columns] = await conn.execute('SHOW COLUMNS FROM documents');
    console.log('Documents table columns:', columns.map(c => `${c.Field} (${c.Type})`));
    
    await conn.end();
  } catch (err) {
    console.error('Database connection or query failed:', err);
  }
}

check();
