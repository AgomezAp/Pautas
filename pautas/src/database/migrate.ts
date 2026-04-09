import * as fs from 'fs';
import * as path from 'path';
import { pool, query } from '../config/database';

async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    try {
      await query(sql);
      console.log(`  ✓ ${file}`);
    } catch (error: any) {
      console.error(`  ✗ ${file}: ${error.message}`);
      throw error;
    }
  }

  console.log('All migrations completed successfully');
}

async function main(): Promise<void> {
  try {
    console.log('Running database migrations...\n');
    await runMigrations();
  } catch (error: any) {
    console.error(`\nMigration failed: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
