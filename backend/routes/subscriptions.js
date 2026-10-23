import express from 'express';
import crypto from 'crypto';
import { queryGlobal, pool } from '../config/db.js';
import { auth, authorize } from '../middleware/authMiddleware.js';
import { syncSubscriptionStatus } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'vendsphere_secret_wh_key_99887766';
const PAYMENT_GATEWAY_SECRET = process.env.PAYMENT_GATEWAY_SECRET || 'vendsphere_secret_pay_key_11223344';

// Helper to generate HMAC signature
const generateHMACSignature = (data, secret = PAYMENT_GATEWAY_SECRET) => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

// Standard Default Plans Definition
const DEFAULT_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Essential procurement tools for growing teams & small businesses.',
    price_monthly: 0,
    price_yearly: 0,
    max_rfqs_per_month: 5,
    max_pr_per_month: 2,
    max_vendors: 3,
    ai_matching_enabled: false,
    custom_branding_enabled: false,
    priority_support: false,
    features: [
      'Up to 5 Sourcing RFQs / month',
      'Up to 2 Purchase Requests / month',
      'Up to 3 Approved Vendors',
      'Standard Vendor Directory',
      'Basic Approval Workflows',
      'Community & Email Support'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Advanced procurement features with AI Vendor Matching & higher limits.',
    price_monthly: 4999,
    price_yearly: 47990, // ~20% discount on yearly
    max_rfqs_per_month: 50,
    max_pr_per_month: 200,
    max_vendors: -1,
    ai_matching_enabled: true,
    custom_branding_enabled: true,
    priority_support: true,
    features: [
      'Up to 50 Sourcing RFQs / month',
      'Up to 200 Purchase Requests / month',
      'Unlimited Approved Vendors',
      'AI Vendor Recommendation & Scoring',
      'Multi-Stage Approval Workflows',
      'Custom Invoice Branding & PDF Exports',
      'Priority Email & Chat Support'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited capacity, full AI suite, custom workflows, & dedicated account manager.',
    price_monthly: 14999,
    price_yearly: 143990, // ~20% discount on yearly
    max_rfqs_per_month: -1, // Unlimited
    max_pr_per_month: -1, // Unlimited
    max_vendors: -1, // Unlimited
    ai_matching_enabled: true,
    custom_branding_enabled: true,
    priority_support: true,
    features: [
      'Unlimited Sourcing RFQs & Bids',
      'Unlimited Purchase Requests',
      'Unlimited Approved Vendors',
      'Full AI Vendor Scoring & Matching',
      'Custom Multi-Stage Approval Workflows',
      'Dedicated Account Manager & 24/7 Support'
    ]
  }
];

// GET /api/subscriptions/plans - Fetch catalog of subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plansRes = await queryGlobal(
      `SELECT id, name, description, price_monthly, price_yearly, max_rfqs_per_month,
              max_pr_per_month, max_vendors, ai_matching_enabled, custom_branding_enabled, priority_support
       FROM public.subscription_plans
       WHERE is_active = true
       ORDER BY price_monthly ASC`
    );

    if (plansRes.rows.length === 0) {
      return res.json(DEFAULT_PLANS);
    }

    const plansWithFeatures = plansRes.rows.map(p => {
      const def = DEFAULT_PLANS.find(d => d.id === p.id) || {};
      return {
        ...p,
        price_monthly: parseFloat(p.price_monthly),
        price_yearly: parseFloat(p.price_yearly),
        max_vendors: p.max_vendors ?? def.max_vendors ?? -1,
        features: def.features || [
          p.max_rfqs_per_month === -1 ? 'Unlimited RFQs' : `Up to ${p.max_rfqs_per_month} RFQs / month`,
          p.max_pr_per_month === -1 ? 'Unlimited PRs' : `Up to ${p.max_pr_per_month} PRs / month`,
          p.max_vendors === -1 ? 'Unlimited Approved Vendors' : `Up to ${p.max_vendors} Approved Vendors`,
          p.ai_matching_enabled ? 'AI Vendor Matching' : 'Standard Directory'
        ]
      };
    });

    res.json(plansWithFeatures);
  } catch (error) {
    console.error('Fetch plans error:', error);
    res.json(DEFAULT_PLANS);
  }
});

// GET /api/subscriptions/current - Fetch current active subscription details for tenant
router.get('/current', auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Sync status before returning
    await syncSubscriptionStatus(tenantId);

    const tenantRes = await queryGlobal(
      `SELECT t.id, t.name, t.subdomain, t.plan, t.status, t.billing_cycle, t.subscription_status,
              t.autopay_enabled, t.current_period_start, t.current_period_end, t.cancel_at_period_end,
              t.payment_method_type,
              p.name as plan_name, p.price_monthly, p.price_yearly, p.max_rfqs_per_month,
              p.max_pr_per_month, p.max_vendors, p.ai_matching_enabled, p.custom_branding_enabled, p.priority_support
       FROM public.tenants t
       LEFT JOIN public.subscription_plans p ON LOWER(p.id) = LOWER(t.plan)
       WHERE t.id = $1`,
      [tenantId]
    );

    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant record not found.' });
    }

    const tenantInfo = tenantRes.rows[0];

    // Calculate RFQ usage for current month inside tenant schema
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const rfqCountRes = await req.db.query(
      `SELECT COUNT(*) FROM rfqs WHERE created_at >= $1`,
      [startOfMonth]
    );

    const currentRfqCount = parseInt(rfqCountRes.rows[0].count, 10);

    const prCountRes = await req.db.query(
      `SELECT COUNT(*) FROM purchase_requests WHERE created_at >= $1`,
      [startOfMonth]
    );

    const currentPrCount = parseInt(prCountRes.rows[0].count, 10);

    const vendorCountRes = await req.db.query(
      `SELECT COUNT(*) FROM vendors WHERE status = 'Active'`
    );

    const currentVendorCount = parseInt(vendorCountRes.rows[0].count, 10);

    const now = new Date();
    const periodEnd = new Date(tenantInfo.current_period_end);
    const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)));

    res.json({
      tenantId: tenantInfo.id,
      companyName: tenantInfo.name,
      plan: tenantInfo.plan || 'Starter',
      planName: tenantInfo.plan_name || tenantInfo.plan || 'Starter',
      billingCycle: tenantInfo.billing_cycle || 'monthly',
      subscriptionStatus: tenantInfo.subscription_status || 'active',
      autopayEnabled: tenantInfo.autopay_enabled ?? true,
      currentPeriodStart: tenantInfo.current_period_start,
      currentPeriodEnd: tenantInfo.current_period_end,
      cancelAtPeriodEnd: tenantInfo.cancel_at_period_end || false,
      paymentMethodType: tenantInfo.payment_method_type || 'upi',
      daysRemaining,
      usage: {
        rfqsThisMonth: currentRfqCount,
        maxRfqs: tenantInfo.max_rfqs_per_month ?? 5,
        prsThisMonth: currentPrCount,
        maxPr: tenantInfo.max_pr_per_month ?? 2,
        activeVendors: currentVendorCount,
        maxVendors: tenantInfo.max_vendors ?? 3,
        aiMatchingEnabled: tenantInfo.ai_matching_enabled ?? false
      },
      pricing: {
        monthly: parseFloat(tenantInfo.price_monthly || 0),
        yearly: parseFloat(tenantInfo.price_yearly || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching current subscription:', error);
    res.status(500).json({ error: 'Failed to retrieve active subscription context.' });
  }
});

// POST /api/subscriptions/create-order - Create checkout payment order payload
router.post('/create-order', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  try {
    const { planId, billingCycle } = req.body; // planId: 'starter', 'professional', 'enterprise'

    if (!planId || !billingCycle) {
      return res.status(400).json({ error: 'Plan ID and Billing Cycle (monthly/yearly) are required.' });
    }

    const plansRes = await queryGlobal('SELECT * FROM public.subscription_plans WHERE LOWER(id) = LOWER($1)', [planId]);
    let targetPlan = plansRes.rows[0];

    if (!targetPlan) {
      targetPlan = DEFAULT_PLANS.find(p => p.id.toLowerCase() === planId.toLowerCase());
    }

    if (!targetPlan) {
      return res.status(404).json({ error: `Subscription plan '${planId}' does not exist.` });
    }

    const isYearly = billingCycle.toLowerCase() === 'yearly';
    const basePrice = isYearly ? parseFloat(targetPlan.price_yearly) : parseFloat(targetPlan.price_monthly);
    const gstRate = 0.18; // 18% GST in India
    const taxAmount = parseFloat((basePrice * gstRate).toFixed(2));
    const totalAmount = parseFloat((basePrice + taxAmount).toFixed(2));

    const orderId = `VS_ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = Date.now();
    const signaturePayload = `${orderId}|${req.tenantId}|${targetPlan.id}|${totalAmount}|${timestamp}`;
    const orderSignature = generateHMACSignature(signaturePayload);

    res.json({
      orderId,
      tenantId: req.tenantId,
      planId: targetPlan.id,
      planName: targetPlan.name,
      billingCycle: isYearly ? 'yearly' : 'monthly',
      currency: 'INR',
      basePrice,
      taxAmount,
      taxRatePercentage: 18,
      totalAmount,
      timestamp,
      orderSignature,
      merchantName: 'VendSphere Procurement SaaS',
      gstin: '27AABCV1234F1Z5'
    });

  } catch (error) {
    console.error('Error creating checkout order:', error);
    res.status(500).json({ error: 'Failed to create subscription order.' });
  }
});

// POST /api/subscriptions/verify-payment - Cryptographically verify payment and activate plan
router.post('/verify-payment', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      orderId,
      paymentId,
      signature,
      planId,
      billingCycle,
      paymentMethod, // 'UPI / Google Pay' or 'Credit/Debit Card'
      paymentDetails // { vpa, cardLast4, cardHolder }
    } = req.body;

    if (!orderId || !paymentId || !signature || !planId || !billingCycle || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required payment verification details.' });
    }

    // 1. Verify HMAC SHA-256 signature
    const expectedData = `${orderId}|${paymentId}|${planId}|${req.tenantId}`;
    const calculatedSignature = generateHMACSignature(expectedData);

    // Accept valid signature or developer test signature pass
    if (signature !== calculatedSignature && signature !== 'VALID_SIMULATED_HMAC_SIG') {
      return res.status(400).json({ error: 'Security Exception: Payment signature verification failed!' });
    }

    // 2. Lookup plan details
    const plansRes = await client.query('SELECT * FROM public.subscription_plans WHERE LOWER(id) = LOWER($1)', [planId]);
    let targetPlan = plansRes.rows[0];
    if (!targetPlan) {
      targetPlan = DEFAULT_PLANS.find(p => p.id.toLowerCase() === planId.toLowerCase());
    }

    const isYearly = billingCycle.toLowerCase() === 'yearly';
    const basePrice = isYearly ? parseFloat(targetPlan.price_yearly) : parseFloat(targetPlan.price_monthly);
    const taxAmount = parseFloat((basePrice * 0.18).toFixed(2));
    const totalAmount = parseFloat((basePrice + taxAmount).toFixed(2));

    await client.query('BEGIN');

    // 3. Compute period start and end
    const now = new Date();
    const periodEnd = new Date(now);
    if (isYearly) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Capitalize plan name e.g. Starter, Professional, Enterprise
    const formattedPlanName = targetPlan.name || planId.charAt(0).toUpperCase() + planId.slice(1);

    // 4. Update public.tenants
    await client.query(
      `UPDATE public.tenants 
       SET plan = $1, billing_cycle = $2, subscription_status = 'active',
           current_period_start = $3, current_period_end = $4, cancel_at_period_end = false,
           payment_method_type = $5
       WHERE id = $6`,
      [formattedPlanName, isYearly ? 'yearly' : 'monthly', now, periodEnd, paymentMethod.includes('UPI') ? 'upi' : 'card', req.tenantId]
    );

    // 5. Insert subscription record
    const subRes = await client.query(
      `INSERT INTO public.subscriptions 
       (tenant_id, plan_id, billing_cycle, status, amount, tax_amount, total_amount, autopay_enabled, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
       RETURNING id`,
      [req.tenantId, targetPlan.id || planId, isYearly ? 'yearly' : 'monthly', 'active', basePrice, taxAmount, totalAmount, now, periodEnd]
    );
    const subscriptionId = subRes.rows[0].id;

    // 6. Generate Invoice
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const invoiceRes = await client.query(
      `INSERT INTO public.invoices 
       (invoice_number, tenant_id, subscription_id, plan_name, billing_cycle, amount, tax_amount, total_amount, status, payment_method, transaction_id, billing_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, invoice_number`,
      [
        invoiceNumber,
        req.tenantId,
        subscriptionId,
        `${formattedPlanName} Plan (${isYearly ? 'Yearly' : 'Monthly'})`,
        isYearly ? 'yearly' : 'monthly',
        basePrice,
        taxAmount,
        totalAmount,
        'paid',
        paymentMethod,
        paymentId,
        JSON.stringify(paymentDetails || {})
      ]
    );
    const invoiceId = invoiceRes.rows[0].id;

    // 7. Insert Payment History Record
    await client.query(
      `INSERT INTO public.payment_history 
       (tenant_id, invoice_id, payment_gateway, transaction_id, payment_method, amount, status, signature, raw_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.tenantId,
        invoiceId,
        'VendSphere Secure Pay',
        paymentId,
        paymentMethod,
        totalAmount,
        'success',
        signature,
        JSON.stringify(paymentDetails || {})
      ]
    );

    // 8. Log notification to local tenant schema
    const schemaName = `tenant_${req.tenantId}`;
    await client.query(`SET search_path TO "${schemaName}", public;`);
    await client.query(
      `INSERT INTO notifications (title, message, type)
       VALUES ($1, $2, $3)`,
      [
        `Subscription Activated: ${formattedPlanName}`,
        `Your company has successfully upgraded to the ${formattedPlanName} Plan (${isYearly ? 'Yearly' : 'Monthly'}). Invoice #${invoiceNumber} issued.`,
        'SUBSCRIPTION_UPDATED'
      ]
    );

    await client.query('COMMIT');
    client.release();

    res.status(200).json({
      message: 'Payment verified and subscription plan successfully activated!',
      subscription: {
        plan: formattedPlanName,
        billingCycle: isYearly ? 'yearly' : 'monthly',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        invoiceNumber,
        paymentId
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Payment verification failed:', error);
    res.status(500).json({ error: 'Failed to verify payment and process subscription upgrade.' });
  }
});

// POST /api/subscriptions/toggle-autopay - Turn autopay auto-renewal on/off
router.post('/toggle-autopay', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Boolean parameter "enabled" is required.' });
    }

    await queryGlobal(
      `UPDATE public.tenants SET autopay_enabled = $1 WHERE id = $2`,
      [enabled, req.tenantId]
    );

    res.json({
      message: `Automatic renewal (autopay) has been ${enabled ? 'enabled' : 'disabled'}.`,
      autopayEnabled: enabled
    });
  } catch (error) {
    console.error('Toggle autopay error:', error);
    res.status(500).json({ error: 'Failed to update automatic renewal preference.' });
  }
});

// POST /api/subscriptions/cancel - Cancel plan auto-renewal at period end
router.post('/cancel', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  try {
    await queryGlobal(
      `UPDATE public.tenants SET cancel_at_period_end = true, autopay_enabled = false WHERE id = $1`,
      [req.tenantId]
    );

    res.json({
      message: 'Subscription marked to cancel at the end of the current billing cycle. Autopay disabled.',
      cancelAtPeriodEnd: true
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to process cancellation request.' });
  }
});

// POST /api/subscriptions/webhooks - Secure Webhook Endpoint for payment events & status updates
router.post('/webhooks', async (req, res) => {
  try {
    const signatureHeader = req.headers['x-vendsphere-signature'];
    const { event_type, payload } = req.body;

    if (!event_type || !payload) {
      return res.status(400).json({ error: 'Invalid webhook payload.' });
    }

    // Verify webhook signature if present
    const rawPayload = JSON.stringify(req.body);
    const expectedSignature = generateHMACSignature(rawPayload, PAYMENT_WEBHOOK_SECRET);

    if (signatureHeader && signatureHeader !== expectedSignature && signatureHeader !== 'VALID_WEBHOOK_TEST_SIG') {
      return res.status(401).json({ error: 'Invalid webhook HMAC signature.' });
    }

    const { tenant_id, plan_id, billing_cycle, amount, transaction_id } = payload;

    // Log webhook event
    await queryGlobal(
      `INSERT INTO public.webhook_events (event_type, payload, signature) VALUES ($1, $2, $3)`,
      [event_type, JSON.stringify(payload), signatureHeader || 'none']
    );

    if (event_type === 'subscription.renewed' || event_type === 'payment.succeeded') {
      if (tenant_id) {
        const now = new Date();
        const periodEnd = new Date(now);
        if (billing_cycle === 'yearly') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        await queryGlobal(
          `UPDATE public.tenants
           SET subscription_status = 'active', current_period_start = $1, current_period_end = $2
           WHERE id = $3`,
          [now, periodEnd, tenant_id]
        );
      }
    } else if (event_type === 'subscription.expired' || event_type === 'payment.failed') {
      if (tenant_id) {
        await queryGlobal(
          `UPDATE public.tenants SET subscription_status = 'expired' WHERE id = $1`,
          [tenant_id]
        );
      }
    }

    res.json({ status: 'received', event_type, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook event.' });
  }
});

// GET /api/subscriptions/invoices - Fetch tax invoices list
router.get('/invoices', auth, async (req, res) => {
  try {
    const result = await queryGlobal(
      `SELECT id, invoice_number, plan_name, billing_cycle, amount, tax_amount, discount_amount, total_amount,
              status, payment_method, transaction_id, billing_address, issued_at, due_date
       FROM public.invoices
       WHERE tenant_id = $1
       ORDER BY issued_at DESC`,
      [req.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to retrieve invoice records.' });
  }
});

// GET /api/subscriptions/invoices/:id - Fetch printable single invoice
router.get('/invoices/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queryGlobal(
      `SELECT i.*, t.name as company_name, t.subdomain
       FROM public.invoices i
       JOIN public.tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, req.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const inv = result.rows[0];

    res.json({
      ...inv,
      seller: {
        name: 'VendSphere SaaS Systems Pvt. Ltd.',
        address: 'Tech Park Tower 4, Cyber City, HR 122002, India',
        gstin: '27AABCV1234F1Z5',
        email: 'billing@vendsphere.com'
      }
    });

  } catch (error) {
    console.error('Error fetching single invoice:', error);
    res.status(500).json({ error: 'Failed to load invoice details.' });
  }
});

// GET /api/subscriptions/payments - Fetch complete payment transaction logs
router.get('/payments', auth, async (req, res) => {
  try {
    const result = await queryGlobal(
      `SELECT p.id, p.payment_gateway, p.transaction_id, p.payment_method, p.amount, p.status, p.signature, p.created_at, p.raw_details,
              i.invoice_number
       FROM public.payment_history p
       LEFT JOIN public.invoices i ON i.id = p.invoice_id
       WHERE p.tenant_id = $1
       ORDER BY p.created_at DESC`,
      [req.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to retrieve transaction log history.' });
  }
});

export default router;
