import pool from './config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    console.log(`Found ${files.length} migration files.`);

    for (const file of files) {
      console.log(`Processing migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Basic statement splitting (split by semicolon, filtering out comments and empty lines)
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          await pool.query(statement);
        } catch (err) {
          // If it's a "table already exists" or "column already exists" warning, we can ignore or log it
          if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.message.includes('already exists')) {
            console.log(`  [Info] Skipping statement: ${err.message}`);
          } else {
            console.error(`  [Error] Failed statement: "${statement.substring(0, 100)}...":`, err.message);
          }
        }
      }
      console.log(`Migration ${file} finished.`);
    }

    console.log('All migrations processed.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
