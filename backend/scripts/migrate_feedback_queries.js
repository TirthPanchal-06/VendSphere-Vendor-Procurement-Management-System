import { pool } from '../config/db.js';

const DDL = `
CREATE TABLE IF NOT EXISTS order_feedback_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NOT NULL,
  query_subject VARCHAR(255) NOT NULL,
  query_category VARCHAR(100) NOT NULL,
  query_priority VARCHAR(50) DEFAULT 'Medium',
  query_description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Open',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS query_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id UUID NOT NULL REFERENCES order_feedback_queries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
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
    console.log(`Found ${tenantsRes.rows.length} tenants. Running feedback & query migration...`);

    for (const tenant of tenantsRes.rows) {
      const schemaName = `tenant_${tenant.id}`;
      console.log(`Migrating schema: ${schemaName}...`);
      await client.query(`SET search_path TO "${schemaName}", public;`);
      await client.query(DDL);
    }

    // Seed realistic delivered PO and sample queries for Acme Corp
    console.log('Setting up sample delivered PO and queries in tenant_acme...');
    await client.query('SET search_path TO "tenant_acme", public;');

    // Check if PO exists
    const poRes = await client.query('SELECT id, po_number, status FROM purchase_orders LIMIT 2');
    let po1Id;

    if (poRes.rows.length > 0) {
      po1Id = poRes.rows[0].id;
      // Mark as Completed if not already
      await client.query(
        "UPDATE purchase_orders SET status = 'Completed', delivery_notes = 'Shipment inspected and accepted at dock 2.' WHERE id = $1",
        [po1Id]
      );
    }

    // Get users for Acme Corp
    const empRes = await client.query("SELECT id FROM users WHERE role = 'Employee' LIMIT 1");
    const mgrRes = await client.query("SELECT id FROM users WHERE role = 'Manager' LIMIT 1");
    const admRes = await client.query("SELECT id FROM users WHERE role = 'Admin' LIMIT 1");

    if (po1Id && empRes.rows.length > 0 && mgrRes.rows.length > 0) {
      const empId = empRes.rows[0].id;
      const mgrId = mgrRes.rows[0].id;
      const admId = admRes.rows[0].id;

      // Check if queries already exist
      const existingQueries = await client.query('SELECT id FROM order_feedback_queries');
      if (existingQueries.rows.length === 0) {
        // Query 1: Resolved query
        const q1 = await client.query(
          `INSERT INTO order_feedback_queries 
           (purchase_order_id, employee_id, rating, feedback, query_subject, query_category, query_priority, query_description, status, assigned_to, resolution_notes, resolved_by, resolved_at)
           VALUES ($1, $2, 4, $3, $4, $5, 'Medium', $6, 'Resolved', $7, $8, $9, NOW() - INTERVAL '1 day')
           RETURNING id`,
          [
            po1Id,
            empId,
            'Good build quality overall. Packaging was secure, and delivery arrived within 3 business days of confirmation.',
            'Display port cable missing from peripheral bundle',
            'Missing Items',
            'The workstation unit arrived in good condition, but the 2m DisplayPort 1.4 cable specified in line item #3 was missing from the accessory box.',
            mgrId,
            'Contacted supplier rep Alice Smith. Vendor confirmed packaging omission and dispatched the replacement cable via priority courier (Tracking #EXP-9923841). Delivery verified on site.',
            mgrId
          ]
        );

        // Add activity logs for Q1
        await client.query(
          `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status, created_at)
           VALUES ($1, $2, 'CREATED', 'Submitted post-delivery feedback and query ticket.', NULL, 'Open', NOW() - INTERVAL '3 days')`,
          [q1.rows[0].id, empId]
        );
        await client.query(
          `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status, created_at)
           VALUES ($1, $2, 'ASSIGNED', 'Assigned query ticket to Manager for resolution review.', 'Open', 'In Progress', NOW() - INTERVAL '2 days')`,
          [q1.rows[0].id, admId]
        );
        await client.query(
          `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status, created_at)
           VALUES ($1, $2, 'RESPONSE', 'We reached out to the supplier logistics lead. A replacement cable has been dispatched.', 'In Progress', 'In Progress', NOW() - INTERVAL '36 hours')`,
          [q1.rows[0].id, mgrId]
        );
        await client.query(
          `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status, created_at)
           VALUES ($1, $2, 'RESOLVED', 'Contacted supplier rep Alice Smith. Replacement cable delivered and verified.', 'In Progress', 'Resolved', NOW() - INTERVAL '1 day')`,
          [q1.rows[0].id, mgrId]
        );

        // Query 2: In Progress query
        const q2 = await client.query(
          `INSERT INTO order_feedback_queries 
           (purchase_order_id, employee_id, rating, feedback, query_subject, query_category, query_priority, query_description, status, assigned_to)
           VALUES ($1, $2, 3, $3, $4, $5, 'High', $6, 'In Progress', $7)
           RETURNING id`,
          [
            po1Id,
            empId,
            'Delivery completed on time, but outer cardboard showed crush marks on corner 2.',
            'Slight casing indentation on unit #2 during transit',
            'Damaged Goods',
            'Upon unboxing, workstation unit #2 shows a minor indentation on the bottom front bezel. Internal hardware diagnostics pass, but documenting for warranty records.',
            mgrId
          ]
        );

        await client.query(
          `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status, created_at)
           VALUES ($1, $2, 'CREATED', 'Submitted delivery feedback and hardware damage report.', NULL, 'Open', NOW() - INTERVAL '8 hours')`,
          [q2.rows[0].id, empId]
        );
        await client.query(
          `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status, created_at)
           VALUES ($1, $2, 'ASSIGNED', 'Query assigned to Manager for vendor warranty claim review.', 'Open', 'In Progress', NOW() - INTERVAL '5 hours')`,
          [q2.rows[0].id, admId]
        );

        console.log('Successfully seeded sample feedback & queries in Acme Corp!');
      }
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
};

runMigration();
