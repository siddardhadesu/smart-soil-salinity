
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Local development uses backend/.env.
// In production, Render supplies environment variables directly.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const useSSL = process.env.DB_SSL === 'true';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Enable SSL for hosted PostgreSQL when DB_SSL=true.
  ssl: useSSL ? { rejectUnauthorized: false } : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection established successfully');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

export default pool;
