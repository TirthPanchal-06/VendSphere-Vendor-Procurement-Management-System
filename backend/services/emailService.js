import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Creates and returns a Nodemailer SMTP transporter based on .env config.
 * Supports Gmail, Outlook/Office365, Amazon SES, SendGrid, Mailtrap, or custom corporate SMTP.
 */
export const createSmtpTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  // If host, user, and pass are provided, configure live SMTP transporter
  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        // Allow self-signed certificates in non-production environments
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
      connectionTimeout: 10000,
    });
  }

  return null;
};

/**
 * Verifies active SMTP connectivity.
 */
export const verifySmtpConnection = async () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return {
      configured: false,
      message: `SMTP password not yet configured for ${user || 'user'}. Add 16-character Gmail App Password to SMTP_PASS in backend/.env for direct inbox delivery.`
    };
  }

  const transporter = createSmtpTransporter();
  try {
    await transporter.verify();
    return {
      configured: true,
      valid: true,
      message: `SMTP connection to ${host}:${process.env.SMTP_PORT || 587} verified successfully for ${user}.`
    };
  } catch (error) {
    console.error('SMTP Connection Verification Error:', error.message);
    return {
      configured: true,
      valid: false,
      error: error.message
    };
  }
};

/**
 * Wraps content in a responsive, styled VendSphere HTML email template.
 */
export const wrapHtmlEmail = ({ title, subtitle, badgeText, badgeType = 'primary', contentHtml }) => {
  const badgeColors = {
    primary: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    success: { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
    warning: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    danger: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
  };

  const badge = badgeColors[badgeType] || badgeColors.primary;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px 12px; color: #1e293b;">
  <table role="presentation" style="width: 100%; max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.15);" cellpadding="0" cellspacing="0">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 28px 32px; color: #ffffff;">
        <table role="presentation" style="width: 100%;" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">VendSphere</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #93c5fd; font-weight: 500;">Procurement & Vendor Operations Cloud</p>
            </td>
            ${badgeText ? `
            <td style="text-align: right;">
              <span style="display: inline-block; padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${badge.bg}; color: ${badge.color}; border: 1px solid ${badge.border};">
                ${badgeText}
              </span>
            </td>
            ` : ''}
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body Title Banner -->
    <tr>
      <td style="padding: 24px 32px 12px 32px; border-bottom: 1px solid #f1f5f9;">
        <h2 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 700;">${title}</h2>
        ${subtitle ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${subtitle}</p>` : ''}
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 24px 32px; font-size: 14px; line-height: 1.6; color: #334155;">
        ${contentHtml}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; text-align: center;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">VendSphere Automated Notifications</p>
        <p style="margin: 0 0 4px 0;">This email was securely dispatched from your organization's VendSphere tenant workspace.</p>
        <p style="margin: 0; color: #94a3b8;">&copy; ${new Date().getFullYear()} VendSphere Technologies. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * Universal email dispatcher:
 * 1. Always persists the notification in the tenant database's `simulated_emails` table.
 * 2. If SMTP is configured, sends a real email over SMTP via Nodemailer.
 * 3. Handles errors gracefully so application operations are never blocked.
 */
export const sendEmailNotification = async ({
  dbClient,
  poId = null,
  returnId = null,
  emailType = 'NOTIFICATION',
  toEmail,
  subject,
  body,
  html = null
}) => {
  if (!toEmail) {
    console.warn('[EmailService] Cannot send email: No recipient email address provided.');
    return { success: false, error: 'Recipient email required' };
  }

  let dbRecordId = null;

  // Target real-time notification recipient (defaults to tirthpanchal65@gmail.com)
  const targetOverride = process.env.NOTIFICATION_RECIPIENT_OVERRIDE || 'tirthpanchal65@gmail.com';
  let targetRecipients = [toEmail];
  if (targetOverride) {
    if (toEmail.includes('@example.com') || toEmail.includes('@acme.com') || toEmail.includes('@beta.com')) {
      targetRecipients = [targetOverride];
    } else if (!targetRecipients.includes(targetOverride)) {
      targetRecipients.push(targetOverride);
    }
  }
  const primaryRecipient = targetRecipients.join(', ');

  // 1. Always record in database table (simulated_emails) for in-app history and audit trail
  if (dbClient) {
    try {
      const dbRes = await dbClient.query(
        `INSERT INTO simulated_emails (po_id, return_id, email_type, to_email, subject, body)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [poId, returnId, emailType, primaryRecipient, subject, body]
      );
      dbRecordId = dbRes.rows[0]?.id;
    } catch (dbErr) {
      console.warn('[EmailService] Warning: Could not record in simulated_emails table:', dbErr.message);
    }
  }

  // 2. Real SMTP Dispatch via Nodemailer
  const transporter = createSmtpTransporter();

  if (!transporter) {
    console.log(`[SMTP Notice] Target recipient is "${primaryRecipient}". Waiting for 16-character Gmail App Password in SMTP_PASS in backend/.env for live delivery.`);
    return {
      success: true,
      dbRecordId,
      recipient: primaryRecipient,
      smtpSent: false,
      mode: 'SIMULATED',
      message: `Notification queued for ${primaryRecipient} (saved in database log). Add 16-character App Password to SMTP_PASS in backend/.env for direct inbox delivery.`
    };
  }

  const fromAddress = process.env.SMTP_FROM || `"VendSphere Procurement" <${process.env.SMTP_USER}>`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: primaryRecipient,
      subject,
      text: body,
      html: html || wrapHtmlEmail({
        title: subject,
        contentHtml: `<pre style="font-family: inherit; white-space: pre-wrap; margin: 0;">${body}</pre>`
      }),
    });

    console.log(`[SMTP Success] Live email dispatched to ${primaryRecipient} [MessageID: ${info.messageId}]`);

    return {
      success: true,
      dbRecordId,
      recipient: primaryRecipient,
      smtpSent: true,
      messageId: info.messageId,
      mode: 'LIVE_SMTP'
    };
  } catch (smtpErr) {
    console.error(`[SMTP Error] Failed to dispatch live email to ${primaryRecipient}:`, smtpErr.message);
    return {
      success: true,
      dbRecordId,
      recipient: primaryRecipient,
      smtpSent: false,
      smtpError: smtpErr.message,
      mode: 'SIMULATED_FALLBACK'
    };
  }
};

export default {
  createSmtpTransporter,
  verifySmtpConnection,
  wrapHtmlEmail,
  sendEmailNotification
};

