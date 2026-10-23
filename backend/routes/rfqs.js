import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';
import { evaluateVendorBids } from '../services/aiEngine.js';
import { checkRfqLimit, checkAiFeatureAccess } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

// List RFQs
router.get('/', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let result;

    if (role === 'Vendor') {
      // Vendors only see their invited RFQs with bid status
      result = await req.db.query(
        `SELECT r.*, q.id as bid_id, q.status as bid_status, q.total_cost as bid_total_cost
         FROM rfqs r
         JOIN rfq_invitations ri ON r.id = ri.rfq_id
         JOIN vendors v ON ri.vendor_id = v.id
         LEFT JOIN quotations q ON r.id = q.rfq_id AND q.vendor_id = v.id
         WHERE v.user_id = $1
         ORDER BY r.deadline ASC`,
        [userId]
      );
    } else {
      result = await req.db.query('SELECT * FROM rfqs ORDER BY created_at DESC');
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list RFQs:', error);
    res.status(500).json({ error: 'Failed to retrieve RFQs.' });
  }
});

// Get single RFQ with details
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  try {
    const rfqRes = await req.db.query('SELECT * FROM rfqs WHERE id = $1', [id]);
    if (rfqRes.rows.length === 0) {
      return res.status(404).json({ error: 'RFQ not found.' });
    }
    const rfq = rfqRes.rows[0];

    // Vendor access check
    if (role === 'Vendor') {
      const inviteCheck = await req.db.query(
        `SELECT ri.id, v.id as vendor_id
         FROM rfq_invitations ri
         JOIN vendors v ON ri.vendor_id = v.id
         WHERE ri.rfq_id = $1 AND v.user_id = $2`,
        [id, userId]
      );
      if (inviteCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not invited to bid on this RFQ.' });
      }

      const vendorId = inviteCheck.rows[0].vendor_id;
      const quotationRes = await req.db.query(
        'SELECT * FROM quotations WHERE rfq_id = $1 AND vendor_id = $2',
        [id, vendorId]
      );

      return res.json({
        ...rfq,
        myQuotation: quotationRes.rows.length > 0 ? quotationRes.rows[0] : null
      });
    }

    // Internal user — include invited vendor list
    const vendorsRes = await req.db.query(
      `SELECT v.id, v.name, v.contact_name, v.email 
       FROM rfq_invitations ri
       JOIN vendors v ON ri.vendor_id = v.id
       WHERE ri.rfq_id = $1`,
      [id]
    );

    res.json({
      ...rfq,
      invitedVendors: vendorsRes.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve RFQ details.' });
  }
});

// Create RFQ from approved purchase request (with subscription limit check)
router.post('/', auth, authorize('Admin', 'ProcurementManager'), checkRfqLimit, async (req, res) => {
  const { purchaseRequestId, title, description, deadline, items, vendorIds } = req.body;

  if (!purchaseRequestId || !title || !deadline || !items || !Array.isArray(items) || !vendorIds || !Array.isArray(vendorIds)) {
    return res.status(400).json({ error: 'PR ID, Title, Deadline, Items, and Vendor list are required.' });
  }

  const client = await req.db.getTransaction();

  try {
    // Validate PR status
    const prRes = await client.query('SELECT status, pr_number FROM purchase_requests WHERE id = $1', [purchaseRequestId]);
    if (prRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Purchase request not found.' });
    }
    if (prRes.rows[0].status !== 'Approved') {
      client.release();
      return res.status(400).json({ error: 'Purchase request must be fully approved to initiate an RFQ.' });
    }

    // Generate RFQ number
    const countRes = await client.query('SELECT COUNT(*) FROM rfqs');
    const seq = parseInt(countRes.rows[0].count) + 1;
    const rfqNumber = `RFQ-${new Date().getFullYear()}-${seq.toString().padStart(4, '0')}`;

    // Insert RFQ record
    const rfqRes = await client.query(
      `INSERT INTO rfqs (rfq_number, purchase_request_id, title, description, deadline, items, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [rfqNumber, purchaseRequestId, title, description || '', deadline, JSON.stringify(items), 'Open']
    );
    const rfqId = rfqRes.rows[0].id;

    // Invite vendors and notify them
    for (const vendorId of vendorIds) {
      await client.query(
        'INSERT INTO rfq_invitations (rfq_id, vendor_id) VALUES ($1, $2)',
        [rfqId, vendorId]
      );

      const vendorUserRes = await client.query('SELECT user_id, name FROM vendors WHERE id = $1', [vendorId]);
      if (vendorUserRes.rows.length > 0 && vendorUserRes.rows[0].user_id) {
        await client.query(
          'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
          [
            vendorUserRes.rows[0].user_id,
            'New Sourcing Bid Invitation',
            `You are invited to bid on ${rfqNumber}: "${title}". Deadline: ${new Date(deadline).toLocaleDateString()}.`,
            'RFQ_RECEIVED'
          ]
        );
      }
    }

    // Lock PR from creating another RFQ
    await client.query(
      'UPDATE purchase_requests SET status = \'RFQ Created\' WHERE id = $1',
      [purchaseRequestId]
    );

    // Activity log
    await client.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_RFQ', `Generated RFQ ${rfqNumber} for PR ${prRes.rows[0].pr_number}`]
    );

    await client.commit();
    res.status(201).json(rfqRes.rows[0]);

  } catch (error) {
    await client.rollback();
    console.error('Failed to create RFQ:', error);
    res.status(500).json({ error: 'Failed to create RFQ.' });
  }
});

// Vendor submits a quotation bid
router.post('/:id/quotations', auth, authorize('Vendor'), async (req, res) => {
  const { id } = req.params;
  const { items, totalCost, deliveryDays, remarks } = req.body;

  if (!items || !Array.isArray(items) || !totalCost || !deliveryDays) {
    return res.status(400).json({ error: 'Quotation items, total cost, and delivery lead time are required.' });
  }

  try {
    // Resolve vendor profile
    const vendorRes = await req.db.query('SELECT id, name FROM vendors WHERE user_id = $1', [req.user.id]);
    if (vendorRes.rows.length === 0) {
      return res.status(403).json({ error: 'User is not mapped to any active vendor profile.' });
    }
    const vendor = vendorRes.rows[0];

    // Confirm RFQ is open
    const rfqRes = await req.db.query('SELECT status, rfq_number FROM rfqs WHERE id = $1', [id]);
    if (rfqRes.rows.length === 0) {
      return res.status(404).json({ error: 'RFQ not found.' });
    }
    if (rfqRes.rows[0].status !== 'Open') {
      return res.status(400).json({ error: 'Bidding is closed for this RFQ.' });
    }

    // Confirm vendor was invited
    const inviteCheck = await req.db.query(
      'SELECT id FROM rfq_invitations WHERE rfq_id = $1 AND vendor_id = $2',
      [id, vendor.id]
    );
    if (inviteCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not authorized to bid on this RFQ.' });
    }

    // Prevent duplicate bids
    const bidCheck = await req.db.query(
      'SELECT id FROM quotations WHERE rfq_id = $1 AND vendor_id = $2',
      [id, vendor.id]
    );
    if (bidCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You have already submitted a bid for this RFQ.' });
    }

    // Save quotation
    const quotationRes = await req.db.query(
      `INSERT INTO quotations (rfq_id, vendor_id, items, total_cost, delivery_days, remarks, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [id, vendor.id, JSON.stringify(items), totalCost, deliveryDays, remarks || '', 'Submitted']
    );

    // Notify procurement managers
    const managers = await req.db.query('SELECT id FROM users WHERE role = \'ProcurementManager\' AND status = \'Active\'');
    for (const pm of managers.rows) {
      await req.db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          pm.id,
          'Quotation Bid Submitted',
          `Vendor "${vendor.name}" submitted a bid for ${rfqRes.rows[0].rfq_number} (₹${totalCost}).`,
          'BID_SUBMITTED'
        ]
      );
    }

    res.status(201).json(quotationRes.rows[0]);

  } catch (error) {
    console.error('Failed to submit quotation:', error);
    res.status(500).json({ error: 'Failed to submit quotation bid.' });
  }
});

// List all quotations with ML evaluation scores
router.get('/:id/quotations', auth, authorize('Admin', 'ProcurementManager'), checkAiFeatureAccess, async (req, res) => {
  const { id } = req.params;

  try {
    const rfqRes = await req.db.query('SELECT * FROM rfqs WHERE id = $1', [id]);
    const rfq = rfqRes.rows[0] || {};

    const result = await req.db.query(
      `SELECT q.*, v.name as vendor_name, v.rating as vendor_rating, v.performance_score 
       FROM quotations q
       JOIN vendors v ON q.vendor_id = v.id
       WHERE q.rfq_id = $1
       ORDER BY q.total_cost ASC`,
      [id]
    );

    const evaluation = evaluateVendorBids(rfq, result.rows);

    // Attach ML evaluation to the array for frontend access
    const responseData = evaluation.enhancedQuotations;
    responseData.aiEvaluation = evaluation;

    res.json(responseData);
  } catch (error) {
    console.error('Failed to retrieve quotations:', error);
    res.status(500).json({ error: 'Failed to retrieve quotation list.' });
  }
});

// Award contract to a selected quotation
router.post('/:id/award', auth, authorize('Admin', 'ProcurementManager'), async (req, res) => {
  const { id } = req.params;
  const { quotationId } = req.body;

  if (!quotationId) {
    return res.status(400).json({ error: 'Quotation ID to award is required.' });
  }

  const client = await req.db.getTransaction();

  try {
    // Validate RFQ
    const rfqRes = await client.query('SELECT status, rfq_number, purchase_request_id FROM rfqs WHERE id = $1', [id]);
    if (rfqRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'RFQ not found.' });
    }
    if (rfqRes.rows[0].status !== 'Open') {
      client.release();
      return res.status(400).json({ error: 'This RFQ is already awarded or closed.' });
    }

    // Validate quotation
    const quoteRes = await client.query('SELECT vendor_id, total_cost FROM quotations WHERE id = $1 AND rfq_id = $2', [quotationId, id]);
    if (quoteRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Quotation not found under this RFQ.' });
    }

    const { vendor_id, total_cost } = quoteRes.rows[0];

    // Update quotation statuses
    await client.query('UPDATE quotations SET status = \'Accepted\' WHERE id = $1', [quotationId]);
    await client.query('UPDATE quotations SET status = \'Rejected\' WHERE rfq_id = $1 AND id != $2', [id, quotationId]);

    // Close RFQ
    await client.query('UPDATE rfqs SET status = \'Awarded\' WHERE id = $1', [id]);

    // Notify winning vendor
    const winnerRes = await client.query('SELECT user_id, name FROM vendors WHERE id = $1', [vendor_id]);
    if (winnerRes.rows.length > 0 && winnerRes.rows[0].user_id) {
      await client.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          winnerRes.rows[0].user_id,
          'Quotation Awarded',
          `Your bid for ${rfqRes.rows[0].rfq_number} has been accepted. A Purchase Order is being prepared.`,
          'BID_SUBMITTED'
        ]
      );
    }

    // Notify losing vendors
    const losers = await client.query('SELECT id, vendor_id FROM quotations WHERE rfq_id = $1 AND id != $2', [id, quotationId]);
    for (const quote of losers.rows) {
      const loserRes = await client.query('SELECT user_id FROM vendors WHERE id = $1', [quote.vendor_id]);
      if (loserRes.rows.length > 0 && loserRes.rows[0].user_id) {
        await client.query(
          'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
          [
            loserRes.rows[0].user_id,
            'Bid Outcome',
            `Thank you for participating in ${rfqRes.rows[0].rfq_number}. Another bid was selected.`,
            'BID_SUBMITTED'
          ]
        );
      }
    }

    // Activity log
    await client.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'AWARD_RFQ', `Awarded ${rfqRes.rows[0].rfq_number} to quotation ${quotationId} (₹${total_cost}).`]
    );

    await client.commit();
    res.json({ message: 'RFQ awarded successfully.', awardedQuotationId: quotationId });

  } catch (error) {
    await client.rollback();
    console.error('Failed to award RFQ:', error);
    res.status(500).json({ error: 'Failed to award RFQ contract.' });
  }
});

export default router;
