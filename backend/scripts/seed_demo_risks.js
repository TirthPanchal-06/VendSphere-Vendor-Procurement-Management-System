import { getTenantDb } from '../config/db.js';

async function seedAcmeRisks() {
  const db = getTenantDb('acme');
  console.log('Seeding realistic risk scenarios in Acme...');

  // 1. Get vendor and user references
  const vendorRes = await db.query('SELECT id, name FROM vendors LIMIT 3');
  const userRes = await db.query("SELECT id, name, role FROM users WHERE role IN ('Admin', 'Manager', 'Employee', 'ProcurementManager')");
  
  const vendor1 = vendorRes.rows[0]; // Custom Printing Services
  const vendor2 = vendorRes.rows[1]; // Nexus Logistics & Supply
  const employee = userRes.rows.find(u => u.role === 'Employee') || userRes.rows[0];
  const manager = userRes.rows.find(u => u.role === 'Manager') || userRes.rows[0];
  const purchaser = userRes.rows.find(u => u.role === 'ProcurementManager') || userRes.rows[0];

  const suffix = Math.floor(1000 + Math.random() * 9000);
  // ----------------------------------------------------
  // Scenario 1: Approval Bottleneck (>48h pending PR)
  // ----------------------------------------------------
  const prOldDate = new Date(Date.now() - (4 * 24 * 60 * 60 * 1000)); // 4 days ago
  const prRes = await db.query(
    `INSERT INTO purchase_requests (
      pr_number, title, description, requester_id, items,
      total_estimated_cost, status, current_approver_id, created_at
    ) VALUES (
      $1,
      'Industrial Server Rack Hardware & Power Distribution Units',
      'Urgent procurement for datacenter rack expansion. Required for Q4 workload scalability.',
      $2,
      $3,
      $4,
      'Pending Approval',
      $5,
      $6
    ) RETURNING id`,
    [
      `PR-2026-${suffix}`,
      employee.id,
      JSON.stringify([
        { item_name: 'APC 42U Server Rack Enclosure', quantity: 4, estimated_unit_price: 65000, estimated_total: 260000 },
        { item_name: 'Tripp Lite 30A Rack PDU', quantity: 8, estimated_unit_price: 15000, estimated_total: 120000 }
      ]),
      '380000.00',
      manager.id,
      prOldDate
    ]
  );
  console.log('Created aging PR for Bottleneck:', prRes.rows[0].id);

  // ----------------------------------------------------
  // Scenario 2: Sourcing Deficit RFQ (<2 bids, closing in 14h)
  // ----------------------------------------------------
  const rfqDeadDate = new Date(Date.now() + (14 * 60 * 60 * 1000)); // 14 hours from now
  const rfqRes = await db.query(
    `INSERT INTO rfqs (
      rfq_number, purchase_request_id, title, description, deadline, items, status, created_at
    ) VALUES (
      $1,
      $2,
      'RFQ - Emergency Precision Cooling Assemblies',
      'High priority sourcing for chilled water cooling distribution unit.',
      $3,
      $4,
      'Open',
      NOW() - INTERVAL '3 days'
    ) RETURNING id`,
    [
      `RFQ-2026-${suffix}`,
      prRes.rows[0].id,
      rfqDeadDate,
      JSON.stringify([
        { item_name: 'Precision Cooling In-Row Unit 20kW', quantity: 2, specifications: 'R410A Refrigerant' }
      ])
    ]
  );
  console.log('Created low-bid RFQ for Bottleneck:', rfqRes.rows[0].id);

  // ----------------------------------------------------
  // Scenario 3: Price Fluctuation (Surge in Quote vs Baseline PR)
  // ----------------------------------------------------
  // Create a PR with baseline budget
  const prBudgetRes = await db.query(
    `INSERT INTO purchase_requests (
      pr_number, title, description, requester_id, items,
      total_estimated_cost, status, current_approver_id, created_at
    ) VALUES (
      $1,
      'Enterprise Solid State Storage Arrays',
      'NVMe High Endurance SSD replacement batches.',
      $2,
      $3,
      '250000.00',
      'Approved',
      $4,
      NOW() - INTERVAL '5 days'
    ) RETURNING id`,
    [
      `PR-2026-${suffix + 1}`,
      employee.id,
      JSON.stringify([
        { item_name: 'Samsung PM1733 7.68TB NVMe SSD', quantity: 10, estimated_unit_price: 25000, estimated_total: 250000 }
      ]),
      manager.id
    ]
  );

  const rfqBudgetRes = await db.query(
    `INSERT INTO rfqs (
      rfq_number, purchase_request_id, title, description, deadline, items, status, created_at
    ) VALUES (
      $1,
      $2,
      'RFQ - NVMe SSD Storage Arrays',
      'Competitive quotes for NVMe enterprise drive arrays.',
      NOW() + INTERVAL '5 days',
      $3,
      'Open',
      NOW() - INTERVAL '4 days'
    ) RETURNING id`,
    [
      `RFQ-2026-${suffix + 1}`,
      prBudgetRes.rows[0].id,
      JSON.stringify([
        { item_name: 'Samsung PM1733 7.68TB NVMe SSD', quantity: 10 }
      ])
    ]
  );

  // Vendor quotation with 36% price surge (₹34,000 vs baseline ₹25,000)
  const quoteRes = await db.query(
    `INSERT INTO quotations (
      rfq_id, vendor_id, items, total_cost, delivery_days, status, created_at
    ) VALUES (
      $1,
      $2,
      $3,
      '340000.00',
      7,
      'Submitted',
      NOW() - INTERVAL '1 day'
    ) RETURNING id`,
    [
      rfqBudgetRes.rows[0].id,
      vendor1.id,
      JSON.stringify([
        { item_name: 'Samsung PM1733 7.68TB NVMe SSD', quantity: 10, unit_price: 34000, total_cost: 340000 }
      ])
    ]
  );
  console.log('Created Quotation with price surge:', quoteRes.rows[0].id);

  // ----------------------------------------------------
  // Scenario 4: Vendor Delivery Delay (PO 9 days past delivery_days)
  // ----------------------------------------------------
  const poOldDate = new Date(Date.now() - (15 * 24 * 60 * 60 * 1000)); // 15 days ago
  const poRes = await db.query(
    `INSERT INTO purchase_orders (
      po_number, purchase_request_id, quotation_id, vendor_id, total_amount, status, delivery_notes, created_at
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      '420000.00',
      'Sent to Vendor',
      'Promised delivery within 6 calendar days. Waybill tracked with shipment delay.',
      $5
    ) RETURNING id`,
    [
      `PO-2026-${suffix}`,
      prBudgetRes.rows[0].id,
      quoteRes.rows[0].id,
      vendor2.id,
      poOldDate
    ]
  );
  console.log('Created delayed PO:', poRes.rows[0].id);

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seedAcmeRisks().catch(err => {
  console.error(err);
  process.exit(1);
});
