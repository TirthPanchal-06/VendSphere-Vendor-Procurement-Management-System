import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';
import { verifySmtpConnection, sendEmailNotification, wrapHtmlEmail } from '../services/emailService.js';

const router = express.Router();

// GET /api/notifications - List notifications for active user
router.get('/', auth, async (req, res) => {
  try {
    const result = await req.db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

// GET /api/notifications/smtp-status - Check SMTP server configuration and connection
router.get('/smtp-status', auth, async (req, res) => {
  try {
    const status = await verifySmtpConnection();
    res.json({
      ...status,
      host: process.env.SMTP_HOST || 'Not Configured',
      port: process.env.SMTP_PORT || '587',
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}***` : 'None',
      from: process.env.SMTP_FROM || 'notifications@vendsphere.com'
    });
  } catch (error) {
    console.error('Failed to check SMTP status:', error);
    res.status(500).json({ error: 'Failed to verify SMTP connectivity.' });
  }
});

// POST /api/notifications/test-smtp - Send a test email via SMTP
router.post('/test-smtp', auth, authorize('Admin', 'Company Admin', 'ProcurementManager'), async (req, res) => {
  const { toEmail } = req.body;
  const recipient = toEmail || req.user.email;

  if (!recipient) {
    return res.status(400).json({ error: 'Recipient email address is required.' });
  }

  try {
    const subject = '[VendSphere] SMTP Email Delivery Test';
    const textBody = `Hello ${req.user.name},\n\nThis is a test notification confirming that SMTP email transport is active and operational in your VendSphere tenant workspace.\n\nSent at: ${new Date().toLocaleString()}\nHost: ${process.env.SMTP_HOST || 'Simulated'}\n\nRegards,\nVendSphere Engineering`;

    const htmlBody = wrapHtmlEmail({
      title: 'SMTP Connection Verified',
      subtitle: 'VendSphere Email Dispatcher Test',
      badgeText: 'Test Successful',
      badgeType: 'success',
      contentHtml: `
        <p>Hello <strong>${req.user.name}</strong>,</p>
        <p>This is a test notification confirming that your <strong>SMTP email transport</strong> has been successfully configured and is operational inside your VendSphere workspace.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 13px;" cellpadding="4">
            <tr><td style="color: #64748b; width: 140px;">SMTP Host:</td><td><strong>${process.env.SMTP_HOST || 'Simulated Mode'}</strong></td></tr>
            <tr><td style="color: #64748b;">SMTP Port:</td><td><strong>${process.env.SMTP_PORT || '587'}</strong></td></tr>
            <tr><td style="color: #64748b;">Sender Address:</td><td><strong>${process.env.SMTP_FROM || 'notifications@vendsphere.com'}</strong></td></tr>
            <tr><td style="color: #64748b;">Recipient:</td><td><strong>${recipient}</strong></td></tr>
            <tr><td style="color: #64748b;">Timestamp:</td><td>${new Date().toLocaleString()}</td></tr>
          </table>
        </div>
        <p style="margin-bottom: 0;">You will receive automated emails whenever purchases are completed, goods are delivered, warranty periods are certified, and item returns are requested or approved.</p>
      `
    });

    const sendResult = await sendEmailNotification({
      dbClient: req.db,
      emailType: 'TEST_SMTP',
      toEmail: recipient,
      subject,
      body: textBody,
      html: htmlBody
    });

    res.json({
      message: sendResult.smtpSent
        ? `Live test email successfully dispatched via SMTP to ${recipient}.`
        : `Email successfully stored in simulated log (configure live SMTP_HOST & SMTP_USER in .env to deliver to real inbox).`,
      result: sendResult
    });

  } catch (error) {
    console.error('Failed to send test SMTP email:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch test email.' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await req.db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification state.' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await req.db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

export default router;
