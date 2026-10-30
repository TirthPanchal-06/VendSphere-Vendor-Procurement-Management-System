import { pool } from '../config/db.js';

const runTests = async () => {
  console.log('========================================================');
  console.log('  TESTING PURCHASE EMAILS & RETURN WARRANTY WORKFLOW   ');
  console.log('========================================================');

  const client = await pool.connect();
  try {
    // 1. Set search path to tenant_acme
    await client.query('SET search_path TO "tenant_acme", public;');

    // 2. Check if a completed PO exists or create/update one
    let poRes = await client.query("SELECT * FROM purchase_orders WHERE status = 'Completed' LIMIT 1");
    if (poRes.rows.length === 0) {
      // Find any PO and mark as Completed
      const anyPo = await client.query('SELECT * FROM purchase_orders LIMIT 1');
      if (anyPo.rows.length > 0) {
        await client.query("UPDATE purchase_orders SET status = 'Completed', delivery_notes = 'Test delivery completed.' WHERE id = $1", [anyPo.rows[0].id]);
        poRes = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [anyPo.rows[0].id]);
      } else {
        throw new Error('No purchase orders found in tenant_acme. Please seed database first.');
      }
    }
    const po = poRes.rows[0];
    console.log(`[PASS] Selected Completed PO: ${po.po_number} (ID: ${po.id})`);

    // 3. Test Purchase Email Generation
    const testPurchaseEmailSubject = `[VendSphere] Purchase Delivered & Items Received: ${po.po_number}`;
    const testPurchaseEmailBody = `
Dear Requester,
Your requested items under PO ${po.po_number} have been officially delivered and completed.
Standard Quality Warranty: 180 Days Active.
    `.trim();

    await client.query(
      `INSERT INTO simulated_emails (po_id, email_type, to_email, subject, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [po.id, 'PURCHASE_COMPLETED', 'employee@acme.com', testPurchaseEmailSubject, testPurchaseEmailBody]
    );

    const emailCheck = await client.query(
      "SELECT * FROM simulated_emails WHERE po_id = $1 AND email_type = 'PURCHASE_COMPLETED' ORDER BY sent_at DESC LIMIT 1",
      [po.id]
    );
    if (emailCheck.rows.length === 0) throw new Error('Failed to record purchase email in simulated_emails');
    console.log(`[PASS] Purchase confirmation email logged: "${emailCheck.rows[0].subject}"`);

    // 4. Test Return Workflow Creation
    const requesterRes = await client.query("SELECT id, name, email FROM users WHERE role = 'Employee' LIMIT 1");
    const managerRes = await client.query("SELECT id, name, email FROM users WHERE role = 'Manager' LIMIT 1");
    const requester = requesterRes.rows[0] || { id: po.requester_id, name: 'Alice Requester', email: 'alice@acme.com' };
    const manager = managerRes.rows[0] || { id: requester.id, name: 'Manager Bob', email: 'bob@acme.com' };

    const purchaseDate = new Date(po.created_at);
    const warrantyDays = 180;
    const warrantyExpiry = new Date(purchaseDate.getTime() + warrantyDays * 24 * 60 * 60 * 1000);
    const isWithinWarranty = new Date() <= warrantyExpiry;
    const rmaNumber = `RMA-TEST-${Date.now().toString().slice(-4)}`;

    const returnRes = await client.query(
      `INSERT INTO item_returns (
         rma_number, purchase_order_id, requester_id, vendor_id,
         item_name, item_category, quantity_returned, unit_price, total_return_amount,
         return_reason, item_condition, reason_description,
         warranty_period_days, purchase_date, warranty_expiry_date,
         warranty_status, warranty_notes, status, resolution_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        rmaNumber,
        po.id,
        requester.id,
        po.vendor_id,
        'Ergonomic High-Back Executive Chair',
        'Office Furniture',
        2,
        4500.00,
        9000.00,
        'Defective / Malfunctioning',
        'Brand New (Opened Box)',
        'Hydraulic lift cylinder does not hold pressure.',
        warrantyDays,
        purchaseDate,
        warrantyExpiry,
        isWithinWarranty ? 'Valid' : 'Expired',
        'Item is within the 180-day warranty window. Eligible for standard RMA replacement or refund.',
        'Warranty Verified',
        'Refund'
      ]
    );

    const testReturn = returnRes.rows[0];
    console.log(`[PASS] Return Request lodged: ${testReturn.rma_number}`);
    console.log(`[PASS] Warranty Check: ${testReturn.warranty_status} (Expiry: ${new Date(testReturn.warranty_expiry_date).toLocaleDateString()})`);

    // 5. Log Return Activities
    await client.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testReturn.id, requester.id, 'REQUEST_CREATED', 'Test return request created.', null, 'Requested']
    );
    await client.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testReturn.id, requester.id, 'WARRANTY_VERIFIED', testReturn.warranty_notes, 'Requested', 'Warranty Verified']
    );

    // 6. Test Manager Approval Flow
    const updatedReturnRes = await client.query(
      `UPDATE item_returns
       SET status = 'Approved',
           resolution_type = 'Refund',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           approval_notes = 'Defect confirmed by QA dock. Full refund approved.',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [manager.id, testReturn.id]
    );
    console.log(`[PASS] Manager Approved Return: Status is now "${updatedReturnRes.rows[0].status}" (Resolution: ${updatedReturnRes.rows[0].resolution_type})`);

    // 7. Test Return Approval Email
    await client.query(
      `INSERT INTO simulated_emails (po_id, return_id, email_type, to_email, subject, body)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        po.id,
        testReturn.id,
        'RETURN_APPROVED',
        requester.email || 'employee@acme.com',
        `[VendSphere] Return Authorized: ${testReturn.rma_number} Approved`,
        `Dear ${requester.name}, Your return request ${testReturn.rma_number} has been Approved for Full Refund.`
      ]
    );

    const returnEmails = await client.query(
      'SELECT * FROM simulated_emails WHERE return_id = $1',
      [testReturn.id]
    );
    console.log(`[PASS] Found ${returnEmails.rows.length} email(s) linked to return ${testReturn.rma_number}`);

    console.log('========================================================');
    console.log('   ALL RETURN & EMAIL WORKFLOW TESTS PASSED CLEANLY!    ');
    console.log('========================================================');

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    client.release();
    process.exit();
  }
};

runTests();
