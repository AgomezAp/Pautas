import { Pool, PoolClient, QueryResult } from 'pg';
import { env } from './environment';
import { logger } from '../utils/logger';

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: env.db.maxConnections,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
  options: '-c client_encoding=UTF8',
});

pool.on('error', (err: Error) => {
  logger.error(`Unexpected database pool error: ${err.message}`);
});

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}
