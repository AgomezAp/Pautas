import fs from 'fs';
import path from 'path';
import { pool, query } from '../config/database';
import { logger } from '../utils/logger.util';
import bcrypt from 'bcryptjs';

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  logger.info('Running migrations...');

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await query(sql);
      logger.info(`Migration executed: ${file}`);
    } catch (err: any) {
      logger.error(`Migration failed: ${file} - ${err.message}`);
      throw err;
    }
  }

  logger.info('All migrations completed.');
}

async function runSeeds() {
  const seedsDir = path.join(__dirname, 'seeds');
  const files = fs.readdirSync(seedsDir).sort();

  logger.info('Running seeds...');

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    let sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');

    // Replace admin hash placeholder
    if (file.includes('admin_user')) {
      const adminHash = await bcrypt.hash('admin123', 12);
      sql = sql.replace('$ADMIN_HASH$', adminHash);
    }

    try {
      await query(sql);
      logger.info(`Seed executed: ${file}`);
    } catch (err: any) {
      logger.error(`Seed failed: ${file} - ${err.message}`);
      throw err;
    }
  }

  logger.info('All seeds completed.');
}

async function main() {
  try {
    await runMigrations();
    await runSeeds();
    logger.info('Database setup complete.');
  } catch (err) {
    logger.error('Database setup failed.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
