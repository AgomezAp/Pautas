import fs from 'fs';
import path from 'path';
import { pool, query } from '../config/database';
import { logger } from '../utils/logger.util';

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort().filter(f => f.endsWith('.sql'));

  logger.info(`Ejecutando ${files.length} migraciones...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await query(sql);
      logger.info(`  ✓ ${file}`);
    } catch (err: any) {
      logger.error(`  ✗ ${file} — ${err.message}`);
      throw err;
    }
  }

  logger.info('Migraciones completadas.');
}

async function runSeeds() {
  const seedsDir = path.join(__dirname, 'seeds');
  if (!fs.existsSync(seedsDir)) return;

  const files = fs.readdirSync(seedsDir).sort().filter(f => f.endsWith('.sql'));
  if (files.length === 0) return;

  logger.info(`Ejecutando ${files.length} seeds...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
    try {
      await query(sql);
      logger.info(`  ✓ ${file}`);
    } catch (err: any) {
      logger.error(`  ✗ ${file} — ${err.message}`);
      throw err;
    }
  }

  logger.info('Seeds completados. Base de datos lista para el sync.');
}

async function main() {
  try {
    await runMigrations();
    await runSeeds();
  } catch {
    logger.error('Falló la configuración de la base de datos.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
