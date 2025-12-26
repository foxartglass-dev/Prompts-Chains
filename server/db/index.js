// Database connection using Neon's serverless driver
import { neon } from '@neondatabase/serverless';

// Use DATABASE_URL from environment variables (set in Railway)
const connectionString = process.env.DATABASE_URL;

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
