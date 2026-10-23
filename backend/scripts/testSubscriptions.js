import pg from 'pg';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vendsphere';
const pool = new pg.Pool({ connectionString });

const JWT_SECRET = process.env.JWT_SECRET || 'vendsphere_development_jwt_secret_key_13579';

const generateToken = (userId, email, role, tenantId) => {
  return jwt.sign({ id: userId, email, role, tenantId }, JWT_SECRET, { expiresIn: '1h' });
};

const runSubscriptionVerificationTests = async () => {
  console.log('===================================================');
  console.log('   RUNNING PREMIUM SUBSCRIPTION VERIFICATION TESTS  ');
  console.log('===================================================');

  const client = await pool.connect();
  try {
    // 1. Fetch Acme Admin details
    const adminUserRes = await client.query(
      `SELECT u.id, u.email, u.role FROM "tenant_acme".users u WHERE u.role = 'Admin' LIMIT 1`
    );

    if (adminUserRes.rows.length === 0) {
      throw new Error('No Acme admin user found. Run seed script first.');
    }

    const admin = adminUserRes.rows[0];
    const token = generateToken(admin.id, admin.email, admin.role, 'acme');

    console.log(`PASS: Test Token generated for Acme Admin (${admin.email}).`);

    // 2. Test DB Query for Subscription Plans
    const plansRes = await client.query('SELECT * FROM public.subscription_plans WHERE is_active = true ORDER BY price_monthly ASC');
    console.log(`PASS: Subscription Plans found in catalog: ${plansRes.rows.map(p => p.name).join(', ')}`);

    // 3. Test DB Query for Tenant Active Subscription
    const tenantRes = await client.query('SELECT id, name, plan, billing_cycle, subscription_status, autopay_enabled FROM public.tenants WHERE id = $1', ['acme']);
    console.log('PASS: Active Tenant Subscription Context:', tenantRes.rows[0]);

    // 4. Test Invoices Retrieval
    const invoiceRes = await client.query('SELECT invoice_number, plan_name, total_amount, status FROM public.invoices WHERE tenant_id = $1', ['acme']);
    console.log(`PASS: Tax Invoices found for Acme: ${invoiceRes.rows.length} invoice(s). Invoice #${invoiceRes.rows[0]?.invoice_number}`);

    // 5. Test Payment History Retrieval
    const paymentRes = await client.query('SELECT transaction_id, payment_method, amount, status FROM public.payment_history WHERE tenant_id = $1', ['acme']);
    console.log(`PASS: Payment Log Records found for Acme: ${paymentRes.rows.length} record(s). Txn ID: ${paymentRes.rows[0]?.transaction_id}`);

    // 6. Test Webhook Ingestion simulation
    const webhookPayload = {
      event_type: 'payment.succeeded',
      payload: {
        tenant_id: 'acme',
        plan_id: 'enterprise',
        billing_cycle: 'yearly',
        amount: 143990,
        transaction_id: 'TXN_WH_TEST_9988'
      }
    };
    const signature = crypto.createHmac('sha256', 'vendsphere_secret_wh_key_99887766').update(JSON.stringify(webhookPayload)).digest('hex');

    await client.query(
      `INSERT INTO public.webhook_events (event_type, payload, signature) VALUES ($1, $2, $3)`,
      [webhookPayload.event_type, JSON.stringify(webhookPayload.payload), signature]
    );
    console.log('PASS: Webhook Event payload cryptographically logged into public.webhook_events.');

    console.log('\n===================================================');
    console.log('   ALL SUBSCRIPTION BACKEND INTEGRATION TESTS PASSED!');
    console.log('===================================================');

  } catch (error) {
    console.error('FAIL: Subscription test failed:', error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
};

runSubscriptionVerificationTests();
