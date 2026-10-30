import { pool } from '../config/db.js';

const DDL = `
-- 1. Ensure simulated_emails has return_id and email_type
ALTER TABLE simulated_emails ADD COLUMN IF NOT EXISTS return_id UUID;
ALTER TABLE simulated_emails ADD COLUMN IF NOT EXISTS email_type VARCHAR(50) DEFAULT 'PURCHASE_NOTIFICATION';

-- 2. Item Returns & Warranty Management
CREATE TABLE IF NOT EXISTS item_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rma_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  item_name VARCHAR(200) NOT NULL,
  item_category VARCHAR(100),
  quantity_returned INTEGER NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  total_return_amount NUMERIC(12, 2) NOT NULL,
  return_reason VARCHAR(100) NOT NULL,
  item_condition VARCHAR(50) NOT NULL,
  reason_description TEXT,
  
  -- Warranty & Validity Verification Fields
  warranty_period_days INTEGER DEFAULT 180,
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
  warranty_expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  warranty_status VARCHAR(50) DEFAULT 'Valid', -- 'Valid', 'Expired', 'Voided'
  warranty_verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  warranty_notes TEXT,
  
  -- Workflow & Approval Lifecycle
  status VARCHAR(50) DEFAULT 'Requested', -- 'Requested', 'Warranty Verified', 'Approved', 'Rejected', 'Pickup Scheduled', 'Completed'
  resolution_type VARCHAR(50) DEFAULT 'Refund', -- 'Refund', 'Replacement', 'Vendor Credit'
  
  -- Approver Information
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  rejection_reason TEXT,
  
  -- Logistics & Pickup
  pickup_tracking_number VARCHAR(100),
  pickup_carrier VARCHAR(100),
  pickup_scheduled_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Return Activity Timeline & Auditing
CREATE TABLE IF NOT EXISTS return_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES item_returns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL, -- 'REQUEST_CREATED', 'WARRANTY_VERIFIED', 'APPROVED', 'REJECTED', 'PICKUP_SCHEDULED', 'COMPLETED'
  notes TEXT,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const runMigration = async () => {
  const client = await pool.connect();
  try {
    const tenantsRes = await client.query('SELECT id, name FROM public.tenants');
    console.log(`Found ${tenantsRes.rows.length} tenants. Running returns & warranty migration...`);

    for (const tenant of tenantsRes.rows) {
      const schemaName = `tenant_${tenant.id}`;
      console.log(`Migrating schema: ${schemaName}...`);
      await client.query(`SET search_path TO "${schemaName}", public;`);
      await client.query(DDL);
      console.log(`Migrated ${schemaName} successfully.`);
    }

    console.log('Returns & Warranty migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit();
  }
};

runMigration();

