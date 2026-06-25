import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5433,
  user: process.env.DB_USER || 'botilleria',
  password: process.env.DB_PASSWORD || 'botilleria123',
  database: process.env.DB_NAME || 'botilleria',
});
