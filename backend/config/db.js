import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Connection URI format: postgresql://username:password@host:port/database
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vendsphere';

console.log('Initializing PostgreSQL Pool connection to:', connectionString.replace(/:([^:@]+)@/, ':****@'));

export const pool = new Pool({
  connectionString,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Helper to query global (public schema) tables directly without setting search_path
export const queryGlobal = (text, params) => {
  return pool.query(text, params);
};

// Main dynamic tenant database utility
export const getTenantDb = (tenantId) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required for database operations');
  }

  const schemaName = `tenant_${tenantId}`;

  return {
    // Isolated query helper
    query: async (text, params) => {
      const client = await pool.connect();
      try {
        // Set search path so all dynamic table references fallback to this tenant first, then public
        await client.query(`SET search_path TO "${schemaName}", public;`);
        const result = await client.query(text, params);
        return result;
      } catch (error) {
        console.error(`Database query error inside schema ${schemaName}:`, error);
        throw error;
      } finally {
        client.release();
      }
    },

    // Transaction client helper
    getTransaction: async () => {
      const client = await pool.connect();
      try {
        await client.query(`SET search_path TO "${schemaName}", public;`);
        await client.query('BEGIN');

        return {
          query: (text, params) => client.query(text, params),
          commit: async () => {
            await client.query('COMMIT');
            client.release();
          },
          rollback: async () => {
            await client.query('ROLLBACK');
            client.release();
          },
          release: () => {
            client.release();
          }
        };
      } catch (error) {
        client.release();
        throw error;
      }
    }
  };
};

// Check DB Connection
export const checkConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL pool connected successfully.');
    const res = await client.query('SELECT NOW()');
    client.release();
    return res.rows[0];
  } catch (error) {
    console.error('Failed to connect to PostgreSQL database:', error);
    throw error;
  }
};
