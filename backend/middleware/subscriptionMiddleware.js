import { queryGlobal } from '../config/db.js';

/**
 * Keeps tenant subscription status in sync.
 * Checks for plan expiration and handles auto-renewal or downgrade to Starter.
 */
export const syncSubscriptionStatus = async (tenantId) => {
  try {
    const res = await queryGlobal(
      `SELECT t.id, t.plan, t.subscription_status, t.autopay_enabled, t.current_period_end, t.billing_cycle,
              p.max_rfqs_per_month, p.max_pr_per_month, p.max_vendors, p.ai_matching_enabled
       FROM public.tenants t
       LEFT JOIN public.subscription_plans p ON LOWER(p.id) = LOWER(t.plan)
       WHERE t.id = $1`,
      [tenantId]
    );

    if (res.rows.length === 0) return null;

    const tenant = res.rows[0];
    const now = new Date();
    const periodEnd = new Date(tenant.current_period_end);

    // Check if plan expired (excluding free Starter plan)
    if (periodEnd < now && tenant.subscription_status === 'active' && tenant.plan?.toLowerCase() !== 'starter') {
      if (tenant.autopay_enabled) {
        // Auto-renew for the next billing cycle
        const nextEnd = new Date(periodEnd);
        if (tenant.billing_cycle === 'yearly') {
          nextEnd.setFullYear(nextEnd.getFullYear() + 1);
        } else {
          nextEnd.setMonth(nextEnd.getMonth() + 1);
        }

        await queryGlobal(
          `UPDATE public.tenants 
           SET current_period_start = $1, current_period_end = $2, subscription_status = 'active'
           WHERE id = $3`,
          [periodEnd, nextEnd, tenantId]
        );

        tenant.current_period_end = nextEnd;
        tenant.subscription_status = 'active';
      } else {
        // Fall back expired paid subscription to Starter
        await queryGlobal(
          `UPDATE public.tenants 
           SET plan = 'Starter', subscription_status = 'expired'
           WHERE id = $1`,
          [tenantId]
        );
        tenant.plan = 'Starter';
        tenant.subscription_status = 'expired';
      }
    }

    return tenant;
  } catch (err) {
    console.error('Error syncing subscription status:', err);
    return null;
  }
};

// Middleware: Check RFQ Creation Quota Limit
export const checkRfqLimit = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const sub = await syncSubscriptionStatus(tenantId);

    if (!sub) return next();

    const maxRfqs = sub.max_rfqs_per_month;
    if (maxRfqs === -1 || maxRfqs === null) {
      return next(); // Unlimited
    }

    // Count RFQs created in the current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const countRes = await req.db.query(
      `SELECT COUNT(*) FROM rfqs WHERE created_at >= $1`,
      [startOfMonth]
    );

    const currentCount = parseInt(countRes.rows[0].count, 10);
    if (currentCount >= maxRfqs) {
      return res.status(403).json({
        error: 'RFQ Quota Reached',
        message: `Your ${sub.plan || 'Free Starter'} plan allows up to ${maxRfqs} RFQs per month. You have used ${currentCount}. Please upgrade to a Premium plan to unlock higher limits.`,
        quotaReached: true,
        upgradeRequired: true,
        maxRfqs,
        currentCount
      });
    }

    next();
  } catch (error) {
    console.error('Error in checkRfqLimit middleware:', error);
    next();
  }
};

// Middleware: Check Purchase Request (PR) Limit
export const checkPrLimit = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const sub = await syncSubscriptionStatus(tenantId);

    if (!sub) return next();

    const maxPr = sub.max_pr_per_month ?? 2;
    if (maxPr === -1 || maxPr === null) {
      return next(); // Unlimited
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const countRes = await req.db.query(
      `SELECT COUNT(*) FROM purchase_requests WHERE created_at >= $1`,
      [startOfMonth]
    );

    const currentCount = parseInt(countRes.rows[0].count, 10);
    if (currentCount >= maxPr) {
      return res.status(403).json({
        error: 'Purchase Request Quota Reached',
        message: `Your ${sub.plan || 'Free Starter'} plan allows up to ${maxPr} Purchase Requests per month. You have used ${currentCount}. Please upgrade to a Premium plan to unlock higher limits.`,
        quotaReached: true,
        upgradeRequired: true,
        maxPr,
        currentCount
      });
    }

    next();
  } catch (error) {
    console.error('Error in checkPrLimit middleware:', error);
    next();
  }
};

// Middleware: Check Approved Vendor Limit
export const checkVendorLimit = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const sub = await syncSubscriptionStatus(tenantId);

    if (!sub) return next();

    const maxVendors = sub.max_vendors ?? 3;
    if (maxVendors === -1 || maxVendors === null) {
      return next(); // Unlimited
    }

    const countRes = await req.db.query(
      `SELECT COUNT(*) FROM vendors WHERE status = 'Active'`
    );

    const currentCount = parseInt(countRes.rows[0].count, 10);
    if (currentCount >= maxVendors) {
      return res.status(403).json({
        error: 'Approved Vendor Limit Reached',
        message: `Your ${sub.plan || 'Free Starter'} plan allows up to ${maxVendors} active/approved vendors. You currently have ${currentCount}. Please upgrade to a Premium plan to approve more vendors.`,
        quotaReached: true,
        upgradeRequired: true,
        maxVendors,
        currentCount
      });
    }

    next();
  } catch (error) {
    console.error('Error in checkVendorLimit middleware:', error);
    next();
  }
};

// Middleware: Check AI Matching & Advanced Feature Access
export const checkAiFeatureAccess = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const sub = await syncSubscriptionStatus(tenantId);

    if (!sub) return next();

    if (!sub.ai_matching_enabled && sub.plan !== 'Enterprise' && sub.plan !== 'Professional') {
      return res.status(403).json({
        error: 'Premium Feature Locked',
        message: 'AI Vendor Recommendation and Scoring requires a Professional or Enterprise Subscription Plan.',
        upgradeRequired: true
      });
    }

    next();
  } catch (error) {
    console.error('Error in checkAiFeatureAccess middleware:', error);
    next();
  }
};
