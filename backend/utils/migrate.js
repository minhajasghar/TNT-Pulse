import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '..', '..', 'database', 'migrations');

export async function runMigrations() {
  console.log('Checking pending migrations...');

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const [applied] = await pool.execute('SELECT name FROM _migrations');
  const appliedNames = new Set(applied.map((r) => r.name));

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`  ✓ ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`  Applying ${file}...`);

    for (const stmt of statements) {
      try {
        await pool.execute(stmt);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`    Skipped (already exists): ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    await pool.execute('INSERT INTO _migrations (name) VALUES (?)', [file]);
    console.log(`  ✓ ${file} applied`);
  }

  console.log('Migrations complete.');
}
