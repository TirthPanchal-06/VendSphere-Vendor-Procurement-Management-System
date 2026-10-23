import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';
import { checkVendorLimit, syncSubscriptionStatus } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

// GET /api/vendors - List all vendors for the tenant
router.get('/', auth, async (req, res) => {
  const { category, status } = req.query;
  
  let queryText = 'SELECT * FROM vendors';
  const queryParams = [];

  if (category || status) {
    queryText += ' WHERE';
    if (category) {
      queryParams.push(category);
      queryText += ` category = $${queryParams.length}`;
    }
    if (status) {
      if (queryParams.length > 0) queryText += ' AND';
      queryParams.push(status);
      queryText += ` status = $${queryParams.length}`;
    }
  }

  queryText += ' ORDER BY name ASC';

  try {
    const result = await req.db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve vendors list.' });
  }
});

// POST /api/vendors - Add vendor manually (guarded by vendor subscription limit)
router.post('/', auth, authorize('Admin', 'Company Admin', 'Procurement Manager'), checkVendorLimit, async (req, res) => {
  const { name, contactName, email, phone, category, paymentTerms } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Vendor name and email are required.' });
  }

  try {
    const result = await req.db.query(
      `INSERT INTO vendors (name, contact_name, email, phone, category, payment_terms, status, rating, performance_score) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [name, contactName || '', email.toLowerCase(), phone || '', category || 'General', paymentTerms || 'Net 30', 'Active', 5.0, 100]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create vendor manually:', error);
    res.status(500).json({ error: 'Failed to create vendor record.' });
  }
});

// PUT /api/vendors/:id - Update vendor details and status
router.put('/:id', auth, authorize('Admin', 'Company Admin', 'Procurement Manager'), async (req, res) => {
  const { id } = req.params;
  const { name, contactName, email, phone, category, paymentTerms, status } = req.body;

  try {
    // Check if vendor exists
    const checkRes = await req.db.query('SELECT * FROM vendors WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    const currentVendor = checkRes.rows[0];

    // If activating an inactive/pending vendor, enforce max approved vendor limit
    if (status === 'Active' && currentVendor.status !== 'Active') {
      const sub = await syncSubscriptionStatus(req.tenantId);
      if (sub && sub.max_vendors !== -1 && sub.max_vendors !== null) {
        const countRes = await req.db.query("SELECT COUNT(*) FROM vendors WHERE status = 'Active'");
        const activeCount = parseInt(countRes.rows[0].count, 10);
        if (activeCount >= sub.max_vendors) {
          return res.status(403).json({
            error: 'Approved Vendor Limit Reached',
            message: `Your ${sub.plan || 'Free Starter'} plan allows up to ${sub.max_vendors} active/approved vendors. Please upgrade to a Premium plan to approve more vendors.`,
            quotaReached: true,
            upgradeRequired: true,
            maxVendors: sub.max_vendors,
            currentCount: activeCount
          });
        }
      }
    }

    const updated = await req.db.query(
      `UPDATE vendors 
       SET name = COALESCE($1, name),
           contact_name = COALESCE($2, contact_name),
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           category = COALESCE($5, category),
           payment_terms = COALESCE($6, payment_terms),
           status = COALESCE($7, status)
       WHERE id = $8
       RETURNING *`,
      [name, contactName, email ? email.toLowerCase() : null, phone, category, paymentTerms, status, id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Failed to update vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor.' });
  }
});

// PUT /api/vendors/:id/evaluate - Evaluate performance rating and score
router.put('/:id/evaluate', auth, authorize('Admin', 'Procurement Manager'), async (req, res) => {
  const { id } = req.params;
  const { rating, performanceScore } = req.body;

  if (rating === undefined && performanceScore === undefined) {
    return res.status(400).json({ error: 'Please specify rating or performance score.' });
  }

  try {
    const updated = await req.db.query(
      `UPDATE vendors 
       SET rating = COALESCE($1, rating),
           performance_score = COALESCE($2, performance_score)
       WHERE id = $3
       RETURNING *`,
      [rating, performanceScore, id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    // Insert activity log
    await req.db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'VENDOR_EVALUATION', `Evaluated vendor: ${updated.rows[0].name}. Score: ${performanceScore}, Rating: ${rating}`]
    );

    res.json({ message: 'Vendor evaluated successfully.', vendor: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to evaluate vendor.' });
  }
});

// DELETE /api/vendors/:id - Delete vendor
router.delete('/:id', auth, authorize('Admin', 'Company Admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await req.db.query('DELETE FROM vendors WHERE id = $1 RETURNING name', [id]);
    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }
    res.json({ message: `Vendor '${deleted.rows[0].name}' deleted successfully.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vendor. Ensure they do not have active RFQs or POs.' });
  }
});

export default router;
