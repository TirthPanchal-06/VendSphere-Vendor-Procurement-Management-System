import express from 'express';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/dashboard - Get dashboard KPI and analytics report based on user role
 */
router.get('/', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    const stats = {};

    if (role === 'Vendor') {
      // ==========================================
      // 1. VENDOR ANALYTICS
      // ==========================================
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
      stats.bidsCount = parseInt(bidsRes.rows[0].total, 10) || 0;
      stats.bidsWon = parseInt(bidsRes.rows[0].accepted, 10) || 0;

      // Invited RFQs
      const rfqsRes = await req.db.query(
        'SELECT COUNT(*) as count FROM rfq_invitations WHERE vendor_id = $1',
        [vendorId]
      );
      stats.invitedRfqs = parseInt(rfqsRes.rows[0].count, 10) || 0;

      // Active PO revenue
      const revenueRes = await req.db.query(
        'SELECT SUM(total_amount) as total, COUNT(*) as count FROM purchase_orders WHERE vendor_id = $1 AND status != \'Cancelled\'',
        [vendorId]
      );
      stats.poRevenue = parseFloat(revenueRes.rows[0].total) || 0.0;
      stats.poCount = parseInt(revenueRes.rows[0].count, 10) || 0;

      // Vendor Profile Info
      const profileRes = await req.db.query(
        'SELECT rating, performance_score, status FROM vendors WHERE id = $1',
        [vendorId]
      );
      stats.rating = parseFloat(profileRes.rows[0].rating) || 5.0;
      stats.performanceScore = parseInt(profileRes.rows[0].performance_score, 10) || 100;
      stats.vendorStatus = profileRes.rows[0].status;

    } else if (role === 'Employee') {
      // ==========================================
      // 2. EMPLOYEE (REQUESTER) ANALYTICS
      // ==========================================
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
      stats.totalRequests = parseInt(prsRes.rows[0].total, 10) || 0;
      stats.statusCounts = {
        draft: parseInt(prsRes.rows[0].draft, 10) || 0,
        pending: parseInt(prsRes.rows[0].pending, 10) || 0,
        approved: parseInt(prsRes.rows[0].approved, 10) || 0,
        rejected: parseInt(prsRes.rows[0].rejected, 10) || 0
      };

      // Total personal estimated spend
      const spendRes = await req.db.query(
        'SELECT SUM(total_estimated_cost) as total FROM purchase_requests WHERE requester_id = $1 AND status != \'Rejected\'',
        [userId]
      );
      stats.estimatedSpend = parseFloat(spendRes.rows[0].total) || 0.0;

    } else {
      // ==========================================
      // 3. ADMIN / PROCUREMENT MANAGER / MANAGER ANALYTICS
      // ==========================================

      // --- A. SPEND & FINANCIAL STATS ---
      const spendRes = await req.db.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN total_amount ELSE 0 END), 0) as monthly_spend,
           COALESCE(SUM(total_amount), 0) as total_spend,
           COALESCE(AVG(total_amount), 0) as avg_order_value,
           COUNT(*) as completed_count
         FROM purchase_orders 
         WHERE status = 'Completed'`
      );

      const pendingSpendRes = await req.db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as pending_spend, COUNT(*) as pending_count 
         FROM purchase_orders 
         WHERE status IN ('Sent', 'Accepted')`
      );

      stats.monthlySpend = parseFloat(spendRes.rows[0].monthly_spend) || 0.0;
      stats.totalSpend = parseFloat(spendRes.rows[0].total_spend) || 0.0;
      stats.avgOrderValue = parseFloat(spendRes.rows[0].avg_order_value) || 0.0;
      stats.completedOrdersCount = parseInt(spendRes.rows[0].completed_count, 10) || 0;
      stats.pendingSpend = parseFloat(pendingSpendRes.rows[0].pending_spend) || 0.0;
      stats.pendingOrdersCount = parseInt(pendingSpendRes.rows[0].pending_count, 10) || 0;

      // Monthly Spend Trend (last 6 months)
      const trendRes = await req.db.query(
        `SELECT 
           TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month_label,
           DATE_TRUNC('month', created_at) as sort_month,
           COALESCE(SUM(total_amount), 0) as spend,
           COUNT(*) as order_count
         FROM purchase_orders
         WHERE status = 'Completed' AND created_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY')
         ORDER BY sort_month ASC`
      );
      stats.monthlySpendTrend = trendRes.rows.map(r => ({
        month: r.month_label,
        spend: parseFloat(r.spend) || 0,
        ordersCount: parseInt(r.order_count, 10) || 0
      }));

      // --- B. VENDOR PERFORMANCE STATS ---
      const vendorsRes = await req.db.query(
        `SELECT 
           COUNT(*) as total,
           COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) as active,
           COALESCE(SUM(CASE WHEN status = 'Pending Approval' THEN 1 ELSE 0 END), 0) as pending,
           COALESCE(SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END), 0) as blocked,
           COALESCE(AVG(CASE WHEN status = 'Active' THEN rating ELSE NULL END), 5.0) as avg_rating,
           COALESCE(AVG(CASE WHEN status = 'Active' THEN performance_score ELSE NULL END), 100) as avg_score,
           COALESCE(SUM(CASE WHEN status = 'Active' AND performance_score >= 90 THEN 1 ELSE 0 END), 0) as tier_excellent,
           COALESCE(SUM(CASE WHEN status = 'Active' AND performance_score >= 75 AND performance_score < 90 THEN 1 ELSE 0 END), 0) as tier_good,
           COALESCE(SUM(CASE WHEN status = 'Active' AND performance_score < 75 THEN 1 ELSE 0 END), 0) as tier_needs_review
         FROM vendors`
      );

      const vRow = vendorsRes.rows[0];
      stats.vendorCounts = {
        total: parseInt(vRow.total, 10) || 0,
        active: parseInt(vRow.active, 10) || 0,
        pending: parseInt(vRow.pending, 10) || 0,
        blocked: parseInt(vRow.blocked, 10) || 0
      };
      stats.vendorAvgRating = parseFloat(vRow.avg_rating) || 5.0;
      stats.vendorAvgScore = Math.round(parseFloat(vRow.avg_score) || 100);
      stats.vendorTiers = {
        excellent: parseInt(vRow.tier_excellent, 10) || 0,
        good: parseInt(vRow.tier_good, 10) || 0,
        needsReview: parseInt(vRow.tier_needs_review, 10) || 0
      };

      // Top Vendors by performance rating
      const topVendorsRes = await req.db.query(
        `SELECT id, name, category, rating, performance_score, status 
         FROM vendors 
         WHERE status = 'Active' 
         ORDER BY performance_score DESC, rating DESC 
         LIMIT 5`
      );
      stats.topVendors = topVendorsRes.rows;

      // Vendor Revenue & Volume Table
      const vendorVolumeRes = await req.db.query(
        `SELECT 
           v.id, v.name, v.category, v.rating, v.performance_score, v.status,
           COUNT(po.id) as orders_count,
           COALESCE(SUM(po.total_amount), 0) as total_revenue
         FROM vendors v
         LEFT JOIN purchase_orders po ON v.id = po.vendor_id AND po.status != 'Cancelled'
         WHERE v.status = 'Active'
         GROUP BY v.id, v.name, v.category, v.rating, v.performance_score, v.status
         ORDER BY total_revenue DESC, v.performance_score DESC
         LIMIT 6`
      );
      stats.vendorVolume = vendorVolumeRes.rows.map(r => ({
        ...r,
        orders_count: parseInt(r.orders_count, 10) || 0,
        total_revenue: parseFloat(r.total_revenue) || 0.0
      }));

      // Vendor Category Breakdown
      const vendorCatRes = await req.db.query(
        `SELECT COALESCE(category, 'General') as category, COUNT(*) as count 
         FROM vendors 
         WHERE status = 'Active' 
         GROUP BY category 
         ORDER BY count DESC`
      );
      stats.vendorCategories = vendorCatRes.rows;

      // --- C. PURCHASING & ITEMS STATS ---
      const prsRes = await req.db.query(
        `SELECT 
           COUNT(*) as total,
           COALESCE(SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END), 0) as draft,
           COALESCE(SUM(CASE WHEN status = 'Pending Approval' THEN 1 ELSE 0 END), 0) as pending,
           COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved,
           COALESCE(SUM(CASE WHEN status = 'RFQ Created' THEN 1 ELSE 0 END), 0) as rfq,
           COALESCE(SUM(CASE WHEN status = 'PO Created' THEN 1 ELSE 0 END), 0) as po,
           COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected
         FROM purchase_requests`
      );
      const prRow = prsRes.rows[0];
      stats.prCounts = {
        total: parseInt(prRow.total, 10) || 0,
        draft: parseInt(prRow.draft, 10) || 0,
        pending: parseInt(prRow.pending, 10) || 0,
        approved: parseInt(prRow.approved, 10) || 0,
        rfq: parseInt(prRow.rfq, 10) || 0,
        po: parseInt(prRow.po, 10) || 0,
        rejected: parseInt(prRow.rejected, 10) || 0
      };

      // PO Status breakdown
      const poStatusRes = await req.db.query(
        `SELECT 
           COUNT(*) as total,
           COALESCE(SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END), 0) as draft,
           COALESCE(SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END), 0) as sent,
           COALESCE(SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END), 0) as accepted,
           COALESCE(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) as completed
         FROM purchase_orders`
      );
      const poRow = poStatusRes.rows[0];
      stats.poCounts = {
        total: parseInt(poRow.total, 10) || 0,
        draft: parseInt(poRow.draft, 10) || 0,
        sent: parseInt(poRow.sent, 10) || 0,
        accepted: parseInt(poRow.accepted, 10) || 0,
        completed: parseInt(poRow.completed, 10) || 0
      };

      // RFQ summary
      const rfqsRes = await req.db.query(
        `SELECT 
           COUNT(*) as total, 
           COALESCE(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END), 0) as open,
           COALESCE(SUM(CASE WHEN status = 'Awarded' THEN 1 ELSE 0 END), 0) as awarded
         FROM rfqs`
      );
      stats.rfqCounts = {
        total: parseInt(rfqsRes.rows[0].total, 10) || 0,
        open: parseInt(rfqsRes.rows[0].open, 10) || 0,
        awarded: parseInt(rfqsRes.rows[0].awarded, 10) || 0
      };

      // Top Purchased / Sourced Items (extracted from PR JSON items)
      try {
        const topItemsRes = await req.db.query(
          `SELECT 
             item->>'name' as name,
             COALESCE(item->>'category', 'General') as category,
             SUM((item->>'quantity')::numeric) as total_quantity,
             SUM(((item->>'quantity')::numeric) * ((item->>'estimated_cost')::numeric)) as total_cost,
             COUNT(*) as request_count
           FROM purchase_requests pr,
           jsonb_array_elements(CASE WHEN jsonb_typeof(pr.items) = 'array' THEN pr.items ELSE '[]'::jsonb END) as item
           WHERE pr.status != 'Rejected'
           GROUP BY item->>'name', item->>'category'
           ORDER BY total_cost DESC
           LIMIT 8`
        );
        stats.topItems = topItemsRes.rows.map(r => ({
          name: r.name,
          category: r.category,
          totalQuantity: parseInt(r.total_quantity, 10) || 0,
          totalCost: parseFloat(r.total_cost) || 0.0,
          requestCount: parseInt(r.request_count, 10) || 0
        }));
      } catch (err) {
        console.warn('Could not extract JSONB items:', err.message);
        stats.topItems = [];
      }

      // Spend by Category
      try {
        const catSpendRes = await req.db.query(
          `SELECT 
             COALESCE(item->>'category', 'General') as category,
             SUM(((item->>'quantity')::numeric) * ((item->>'estimated_cost')::numeric)) as total_spend,
             SUM((item->>'quantity')::numeric) as total_quantity
           FROM purchase_requests pr,
           jsonb_array_elements(CASE WHEN jsonb_typeof(pr.items) = 'array' THEN pr.items ELSE '[]'::jsonb END) as item
           WHERE pr.status IN ('Approved', 'PO Created', 'Completed')
           GROUP BY item->>'category'
           ORDER BY total_spend DESC`
        );
        stats.categorySpend = catSpendRes.rows.map(r => ({
          category: r.category,
          totalSpend: parseFloat(r.total_spend) || 0.0,
          totalQuantity: parseInt(r.total_quantity, 10) || 0
        }));
      } catch (err) {
        stats.categorySpend = [];
      }

      // Department Spend
      const deptSpendRes = await req.db.query(
        `SELECT 
           COALESCE(u.department, 'General') as department,
           COALESCE(SUM(pr.total_estimated_cost), 0) as total_spend,
           COUNT(pr.id) as request_count
         FROM purchase_requests pr
         JOIN users u ON pr.requester_id = u.id
         WHERE pr.status != 'Rejected'
         GROUP BY u.department
         ORDER BY total_spend DESC`
      );
      stats.departmentSpend = deptSpendRes.rows.map(r => ({
        department: r.department,
        totalSpend: parseFloat(r.total_spend) || 0.0,
        requestCount: parseInt(r.request_count, 10) || 0
      }));

      // --- D. QUALITY & COMPLAINT REPORTS ---
      try {
        const queryMetricsRes = await req.db.query(
          `SELECT 
             COUNT(*) as total,
             COALESCE(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END), 0) as open,
             COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END), 0) as in_progress,
             COALESCE(SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END), 0) as resolved,
             COALESCE(AVG(rating), 5.0) as avg_rating
           FROM order_feedback_queries`
        );
        const qm = queryMetricsRes.rows[0];
        const totalQ = parseInt(qm.total, 10) || 0;
        const resolvedQ = parseInt(qm.resolved, 10) || 0;
        stats.qualityReports = {
          totalQueries: totalQ,
          openQueries: parseInt(qm.open, 10) || 0,
          inProgressQueries: parseInt(qm.in_progress, 10) || 0,
          resolvedQueries: resolvedQ,
          resolutionRate: totalQ > 0 ? Math.round((resolvedQ / totalQ) * 100) : 100,
          avgDeliveryRating: parseFloat(qm.avg_rating) || 5.0
        };
      } catch (err) {
        stats.qualityReports = {
          totalQueries: 0,
          openQueries: 0,
          inProgressQueries: 0,
          resolvedQueries: 0,
          resolutionRate: 100,
          avgDeliveryRating: 5.0
        };
      }

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
    stats.unreadNotificationsCount = parseInt(unreadNotifications.rows[0].count, 10) || 0;

    res.json(stats);

  } catch (error) {
    console.error('Failed to retrieve dashboard stats:', error);
    res.status(500).json({ error: 'Failed to compile dashboard metrics.' });
  }
});

export default router;
