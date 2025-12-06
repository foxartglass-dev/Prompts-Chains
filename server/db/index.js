// Database connection using Neon's serverless driver
import { neon } from '@neondatabase/serverless';

// HARDCODED to production database to ensure consistency
// TODO: Remove this hardcode once env variables are sorted out
const connectionString = 'postgresql://neondb_owner:npg_FEAdokp4C1IQ@ep-dark-bar-adgtv25x-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

if (!connectionString) {
  console.warn('DATABASE_URL not set - database features will be disabled');
}

// Create SQL query function (only if connection string exists)
export const sql = connectionString ? neon(connectionString) : null;

// Helper to check if database is available
export const isDatabaseEnabled = () => !!sql;

// Test database connection
export async function testConnection() {
  if (!sql) {
    return { connected: false, message: 'DATABASE_URL not configured' };
  }

  try {
    const result = await sql`SELECT NOW() as time`;
    return { connected: true, time: result[0].time };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}
