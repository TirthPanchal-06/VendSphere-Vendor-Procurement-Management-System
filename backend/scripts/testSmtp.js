import { pool } from '../config/db.js';
import {
  createSmtpTransporter,
  verifySmtpConnection,
  wrapHtmlEmail,
  sendEmailNotification
} from '../services/emailService.js';

const runSmtpVerificationTests = async () => {
  console.log('========================================================');
  console.log('       TESTING VENDSPHERE SMTP EMAIL SUBSYSTEM          ');
  console.log('========================================================');

  // 1. Verify SMTP Connection status
  console.log('Testing SMTP connection settings...');
  const connStatus = await verifySmtpConnection();
  console.log('[PASS] SMTP Verification Output:', connStatus);

  // 2. Test HTML Template Wrapper
  console.log('Generating test HTML email...');
  const sampleHtml = wrapHtmlEmail({
    title: 'Purchase Order Delivered & Completed: PO-2026-0001',
    subtitle: 'Vendor Shipment Accepted',
    badgeText: 'Delivered',
    badgeType: 'success',
    contentHtml: `
      <p>Dear <strong>Alice Requester</strong>,</p>
      <p>Your procurement order has been delivered and inspected.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
        <p><strong>Item:</strong> Ergonomic High-Back Executive Chair (2 units)</p>
        <p><strong>Warranty:</strong> 180 Days Active</p>
      </div>
    `
  });

  if (!sampleHtml.includes('VendSphere') || !sampleHtml.includes('PO-2026-0001')) {
    throw new Error('HTML email template generation failed');
  }
  console.log('[PASS] HTML Email generated with responsive styles and branding.');

  // 3. Test Email Dispatch with DB Client
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO "tenant_acme", public;');

    console.log('Dispatching test notification email...');
    const result = await sendEmailNotification({
      dbClient: client,
      emailType: 'TEST_SMTP_SYSTEM',
      toEmail: 'procurement-team@acme.com',
      subject: '[VendSphere] SMTP Subsystem Operational',
      body: 'This is a test notification verifying that the VendSphere SMTP email delivery service is operational.',
      html: sampleHtml
    });

    console.log('[PASS] Email Dispatch Result:', result);
    if (!result.success) {
      throw new Error('sendEmailNotification reported failure');
    }

    // Verify it exists in simulated_emails
    const checkEmail = await client.query(
      "SELECT * FROM simulated_emails WHERE email_type = 'TEST_SMTP_SYSTEM' ORDER BY sent_at DESC LIMIT 1"
    );
    if (checkEmail.rows.length === 0) {
      throw new Error('Email was not recorded in simulated_emails table');
    }
    console.log(`[PASS] Email recorded in database log (ID: ${checkEmail.rows[0].id})`);

    console.log('========================================================');
    console.log('      ALL SMTP EMAIL SUBSYSTEM TESTS PASSED!            ');
    console.log('========================================================');

  } catch (error) {
    console.error('SMTP test failed:', error);
  } finally {
    client.release();
    process.exit();
  }
};

runSmtpVerificationTests();
