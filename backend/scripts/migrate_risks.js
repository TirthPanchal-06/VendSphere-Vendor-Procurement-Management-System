import { pool } from '../config/db.js';

const DDL = `
CREATE TABLE IF NOT EXISTS procurement_risks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  risk_type VARCHAR(50) NOT NULL, -- 'VENDOR_DELAY', 'PRICE_FLUCTUATION', 'PROCUREMENT_BOTTLENECK'
  severity VARCHAR(20) NOT NULL, -- 'Low', 'Medium', 'High', 'Critical'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  entity_type VARCHAR(50), -- 'VENDOR', 'PURCHASE_ORDER', 'PURCHASE_REQUEST', 'ITEM', 'RFQ'
  entity_id UUID,
  impact_score NUMERIC(5, 2) DEFAULT 50.00,
  financial_exposure NUMERIC(12, 2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Mitigating', 'Resolved', 'Dismissed'
  mitigation_plan TEXT,
  mitigated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  mitigated_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const runMigration = async () => {
  const client = await pool.connect();
  try {
    const tenantsRes = await client.query('SELECT id, name FROM public.tenants');
    console.log(`Found ${tenantsRes.rows.length} tenants. Running procurement_risks migration...`);

    for (const tenant of tenantsRes.rows) {
      const schemaName = `tenant_${tenant.id}`;
      console.log(`Migrating schema: ${schemaName}...`);
      await client.query(`SET search_path TO "${schemaName}", public;`);
      await client.query(DDL);
      console.log(`Migrated ${schemaName} successfully.`);
    }

    console.log('Procurement risks migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit();
  }
};

runMigration();

