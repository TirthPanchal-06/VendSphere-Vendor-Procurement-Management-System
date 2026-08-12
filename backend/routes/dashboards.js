import express from 'express';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/dashboard - Get dashboard KPI and analytics report based on user role
router.get('/', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    const stats = {};

    if (role === 'Vendor') {
      // 1. VENDOR ANALYTICS
      // Get vendor ID
      const vendorRes = await req.db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
      if (vendorRes.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found.' });
      }
      const vendorId = vendorRes.rows[0].id;

      // Bid stats
      const bidsRes = await req.db.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = \'Accepted\' THEN 1 ELSE 0 END) as accepted FROM quotations WHERE vendor_id = $1',
        [vendorId]
      );
      stats.bidsCount = parseInt(bidsRes.rows[0].total) || 0;
      stats.bidsWon = parseInt(bidsRes.rows[0].accepted) || 0;

      // Invited RFQs
      const rfqsRes = await req.db.query(
        'SELECT COUNT(*) as count FROM rfq_invitations WHERE vendor_id = $1',
        [vendorId]
      );
      stats.invitedRfqs = parseInt(rfqsRes.rows[0].count) || 0;

      // Active PO revenue
      const revenueRes = await req.db.query(
        'SELECT SUM(total_amount) as total, COUNT(*) as count FROM purchase_orders WHERE vendor_id = $1 AND status != \'Cancelled\'',
        [vendorId]
      );
      stats.poRevenue = parseFloat(revenueRes.rows[0].total) || 0.0;
      stats.poCount = parseInt(revenueRes.rows[0].count) || 0;

      // Vendor Profile Info
      const profileRes = await req.db.query(
        'SELECT rating, performance_score, status FROM vendors WHERE id = $1',
        [vendorId]
      );
      stats.rating = parseFloat(profileRes.rows[0].rating) || 5.0;
      stats.performanceScore = parseInt(profileRes.rows[0].performance_score) || 100;
      stats.vendorStatus = profileRes.rows[0].status;

    } else if (role === 'Employee') {
      // 2. EMPLOYEE (REQUESTER) ANALYTICS
      const prsRes = await req.db.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft,
          SUM(CASE WHEN status = 'Pending Approval' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'Approved' OR status = 'PO Created' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
         FROM purchase_requests 
         WHERE requester_id = $1`,
        [userId]
      );
      stats.totalRequests = parseInt(prsRes.rows[0].total) || 0;
      stats.statusCounts = {
        draft: parseInt(prsRes.rows[0].draft) || 0,
        pending: parseInt(prsRes.rows[0].pending) || 0,
        approved: parseInt(prsRes.rows[0].approved) || 0,
        rejected: parseInt(prsRes.rows[0].rejected) || 0
      };

      // Total personal estimated spend
      const spendRes = await req.db.query(
        'SELECT SUM(total_estimated_cost) as total FROM purchase_requests WHERE requester_id = $1 AND status != \'Rejected\'',
        [userId]
      );
      stats.estimatedSpend = parseFloat(spendRes.rows[0].total) || 0.0;

    } else {
      // 3. PROCUREMENT MANAGER / ADMIN ANALYTICS
      // Total monthly spend (completed POs)
      const spendRes = await req.db.query(
        `SELECT SUM(total_amount) as total 
         FROM purchase_orders 
         WHERE status = 'Completed' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`
      );
      stats.monthlySpend = parseFloat(spendRes.rows[0].total) || 0.0;

      // PR Status summary
      const prsRes = await req.db.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'Pending Approval' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'RFQ Created' THEN 1 ELSE 0 END) as rfq,
          SUM(CASE WHEN status = 'PO Created' THEN 1 ELSE 0 END) as po,
          SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
         FROM purchase_requests`
      );
      stats.prCounts = {
        total: parseInt(prsRes.rows[0].total) || 0,
        pending: parseInt(prsRes.rows[0].pending) || 0,
        approved: parseInt(prsRes.rows[0].approved) || 0,
        rfq: parseInt(prsRes.rows[0].rfq) || 0,
        po: parseInt(prsRes.rows[0].po) || 0,
        rejected: parseInt(prsRes.rows[0].rejected) || 0
      };

      // Vendors summary
      const vendorsRes = await req.db.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = \'Active\' THEN 1 ELSE 0 END) as active FROM vendors'
      );
      stats.vendorCounts = {
        total: parseInt(vendorsRes.rows[0].total) || 0,
        active: parseInt(vendorsRes.rows[0].active) || 0
      };

      // Top Vendors by performance rating
      const topVendorsRes = await req.db.query(
        'SELECT id, name, category, rating, performance_score FROM vendors WHERE status = \'Active\' ORDER BY performance_score DESC, rating DESC LIMIT 5'
      );
      stats.topVendors = topVendorsRes.rows;

      // RFQ summary
      const rfqsRes = await req.db.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = \'Open\' THEN 1 ELSE 0 END) as open FROM rfqs'
      );
      stats.rfqCounts = {
        total: parseInt(rfqsRes.rows[0].total) || 0,
        open: parseInt(rfqsRes.rows[0].open) || 0
      };

      // Recent Activity Logs (audit log)
      const logsRes = await req.db.query(
        `SELECT al.*, u.name as user_name, u.role as user_role 
         FROM activity_logs al 
         LEFT JOIN users u ON al.user_id = u.id 
         ORDER BY al.created_at DESC 
         LIMIT 10`
      );
      stats.recentActivities = logsRes.rows;
    }

    // In-app unread notifications count (shared across all roles)
    const unreadNotifications = await req.db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    stats.unreadNotificationsCount = parseInt(unreadNotifications.rows[0].count) || 0;

    res.json(stats);

  } catch (error) {
    console.error('Failed to retrieve dashboard stats:', error);
    res.status(500).json({ error: 'Failed to compile dashboard metrics.' });
  }
});

export default router;
