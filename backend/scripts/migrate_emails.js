import { pool } from '../config/db.js';

const runMigration = async () => {
  console.log('Running simulated_emails migration on active database...');
  const client = await pool.connect();

  try {
    const schemas = ['tenant_acme', 'tenant_beta'];

    for (const schema of schemas) {
      console.log(`Creating simulated_emails table in schema: ${schema}...`);
      await client.query(`SET search_path TO "${schema}", public;`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS simulated_emails (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
          to_email VARCHAR(255) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          body TEXT NOT NULL,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log(`Table created successfully for ${schema}.`);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Failed to run migration:', error);
  } finally {
    client.release();
    process.exit();
  }
};

runMigration();
