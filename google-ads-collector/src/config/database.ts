import { Pool, PoolConfig } from 'pg';
import { env } from './environment';
import { logger } from '../utils/logger.util';

const poolConfig: PoolConfig = {
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: env.db.maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
  client_encoding: 'UTF8',
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Error inesperado en cliente PostgreSQL inactivo', { message: err.message, stack: err.stack });
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const getClient = () => pool.connect();
