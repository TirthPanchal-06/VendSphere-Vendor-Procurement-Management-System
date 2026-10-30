import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';
import { assessProcurementRisks } from '../services/riskEngine.js';
import { sendEmailNotification, wrapHtmlEmail } from '../services/emailService.js';

const router = express.Router();

/**
 * GET /api/risks/overview - Aggregated risk telemetry and scores
 */
router.get('/overview', auth, async (req, res) => {
  try {
    const assessment = await assessProcurementRisks(req.db);

    // Also fetch persisted database records with user resolution info
    const persistedRisksRes = await req.db.query(
      `SELECT pr.*, u.name as mitigated_by_name
       FROM procurement_risks pr
       LEFT JOIN users u ON pr.mitigated_by = u.id
       ORDER BY 
         CASE pr.severity
           WHEN 'Critical' THEN 1
           WHEN 'High' THEN 2
           WHEN 'Medium' THEN 3
           ELSE 4
         END,
         pr.created_at DESC
       LIMIT 30`
    );

    res.json({
      ...assessment,
      persistedRisks: persistedRisksRes.rows
    });
  } catch (error) {
    console.error('Failed to retrieve risk overview:', error);
    res.status(500).json({ error: 'Failed to compute procurement risk metrics.' });
  }
});

/**
 * GET /api/risks - List all tracked risk records with filtering
 */
router.get('/', auth, async (req, res) => {
  const { type, severity, status = 'Active' } = req.query;

  try {
    let queryText = `
      SELECT pr.*, u.name as mitigated_by_name
      FROM procurement_risks pr
      LEFT JOIN users u ON pr.mitigated_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type && type !== 'ALL') {
      params.push(type);
      queryText += ` AND pr.risk_type = $${params.length}`;
    }

    if (severity && severity !== 'ALL') {
      params.push(severity);
      queryText += ` AND pr.severity = $${params.length}`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      queryText += ` AND pr.status = $${params.length}`;
    }

    queryText += ` ORDER BY 
      CASE pr.severity
        WHEN 'Critical' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        ELSE 4
      END,
      pr.created_at DESC`;

    const result = await req.db.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list procurement risks:', error);
    res.status(500).json({ error: 'Failed to retrieve procurement risks.' });
  }
});

/**
 * POST /api/risks/assess - Trigger an on-demand fresh risk assessment
 */
router.post('/assess', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  try {
    const assessment = await assessProcurementRisks(req.db);
    res.json({
      message: 'On-demand risk assessment completed successfully.',
      ...assessment
    });
  } catch (error) {
    console.error('Failed to trigger risk assessment:', error);
    res.status(500).json({ error: 'Failed to execute risk analysis scan.' });
  }
});

/**
 * POST /api/risks/:id/mitigate - Take and assign a mitigation action
 */
router.post('/:id/mitigate', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { mitigationPlan, notifyTeam = true } = req.body;

  if (!mitigationPlan) {
    return res.status(400).json({ error: 'Mitigation plan description is required.' });
  }

  try {
    const updated = await req.db.query(
      `UPDATE procurement_risks
       SET status = 'Mitigating',
           mitigation_plan = $1,
           mitigated_by = $2,
           mitigated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [mitigationPlan, req.user.id, id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Risk record not found.' });
    }

    const risk = updated.rows[0];

    // Dispatch real-time email notification to tirthpanchal65@gmail.com
    if (notifyTeam) {
      const subject = `[VendSphere Risk Alert] Mitigation Activated: ${risk.title}`;
      const textBody = `Hello,\n\nA procurement risk mitigation action has been recorded by ${req.user.name} (${req.user.role}).\n\nRisk: ${risk.title}\nSeverity: ${risk.severity}\nType: ${risk.risk_type.replace('_', ' ')}\nFinancial Exposure: INR ${parseFloat(risk.financial_exposure || 0).toLocaleString()}\n\nMitigation Strategy:\n${mitigationPlan}\n\nTimestamp: ${new Date().toLocaleString()}\n\nVendSphere Risk Management Operations`;

      const htmlBody = wrapHtmlEmail({
        title: `Risk Mitigation Activated: ${risk.severity} Severity`,
        subtitle: risk.title,
        badgeText: `${risk.severity} Risk`,
        badgeType: risk.severity === 'Critical' ? 'danger' : risk.severity === 'High' ? 'warning' : 'primary',
        contentHtml: `
          <p>Hello,</p>
          <p>A procurement risk mitigation plan has been authorized by <strong>${req.user.name}</strong> (${req.user.role}).</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 6px 0;"><strong>Risk Category:</strong> ${risk.risk_type.replace('_', ' ')}</p>
            <p style="margin: 0 0 6px 0;"><strong>Risk Title:</strong> ${risk.title}</p>
            <p style="margin: 0 0 6px 0;"><strong>Severity Level:</strong> <span style="font-weight: bold; color: ${risk.severity === 'Critical' ? '#b91c1c' : '#d97706'};">${risk.severity}</span></p>
            <p style="margin: 0;"><strong>Financial Exposure:</strong> INR ${parseFloat(risk.financial_exposure || 0).toLocaleString()}</p>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
            <strong style="color: #166534; font-size: 13px;">Mitigation Action Plan:</strong>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #15803d;">${mitigationPlan}</p>
          </div>
          <p style="font-size: 12px; color: #64748b;">The risk status has been updated to <strong>Mitigating</strong>.</p>
        `
      });

      await sendEmailNotification({
        dbClient: req.db,
        emailType: 'RISK_MITIGATION_ALERT',
        toEmail: process.env.NOTIFICATION_RECIPIENT_OVERRIDE || 'tirthpanchal65@gmail.com',
        subject,
        body: textBody,
        html: htmlBody
      });
    }

    res.json(risk);
  } catch (error) {
    console.error('Failed to apply mitigation plan:', error);
    res.status(500).json({ error: 'Failed to record risk mitigation.' });
  }
});

/**
 * POST /api/risks/:id/resolve - Mark risk as resolved
 */
router.post('/:id/resolve', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body;

  try {
    const updated = await req.db.query(
      `UPDATE procurement_risks
       SET status = 'Resolved',
           resolution_notes = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [resolutionNotes || 'Risk successfully mitigated and neutralized.', id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Risk record not found.' });
    }

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Failed to resolve risk:', error);
    res.status(500).json({ error: 'Failed to mark risk as resolved.' });
  }
});

/**
 * POST /api/risks/:id/dismiss - Dismiss a risk ticket
 */
router.post('/:id/dismiss', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await req.db.query(
      `UPDATE procurement_risks
       SET status = 'Dismissed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Risk record not found.' });
    }

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Failed to dismiss risk:', error);
    res.status(500).json({ error: 'Failed to dismiss risk record.' });
  }
});

export default router;

