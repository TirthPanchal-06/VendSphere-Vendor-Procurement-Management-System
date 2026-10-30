import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';
import { sendEmailNotification, wrapHtmlEmail } from '../services/emailService.js';

const router = express.Router();

/**
 * Helper to generate sequential RMA Number (e.g. RMA-2026-0001)
 */
const generateRmaNumber = async (db) => {
  const countRes = await db.query('SELECT COUNT(*) as count FROM item_returns');
  const count = parseInt(countRes.rows[0]?.count || 0, 10) + 1;
  const year = new Date().getFullYear();
  return `RMA-${year}-${count.toString().padStart(4, '0')}`;
};

/**
 * GET /api/returns - List returns with role-based filtering
 */
router.get('/', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let queryText = `
      SELECT r.*,
             po.po_number, po.total_amount as po_total_amount, po.created_at as po_created_at,
             v.name as vendor_name, v.email as vendor_email,
             requester.name as requester_name, requester.email as requester_email,
             reviewer.name as reviewer_name
      FROM item_returns r
      JOIN purchase_orders po ON r.purchase_order_id = po.id
      JOIN vendors v ON r.vendor_id = v.id
      JOIN users requester ON r.requester_id = requester.id
      LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
    `;
    const queryParams = [];

    if (role === 'Vendor') {
      const vendorUserCheck = await req.db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
      if (vendorUserCheck.rows.length === 0) {
        return res.json([]);
      }
      queryText += ' WHERE r.vendor_id = $1';
      queryParams.push(vendorUserCheck.rows[0].id);
    } else if (role === 'Employee') {
      queryText += ' WHERE r.requester_id = $1';
      queryParams.push(userId);
    }

    queryText += ' ORDER BY r.created_at DESC';

    const result = await req.db.query(queryText, queryParams);

    // Compute live warranty validity days remaining on the fly
    const now = new Date();
    const enriched = result.rows.map(item => {
      const expiry = new Date(item.warranty_expiry_date);
      const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      return {
        ...item,
        warrantyDaysRemaining: daysRemaining,
        isWarrantyValid: daysRemaining >= 0
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Failed to list returns:', error);
    res.status(500).json({ error: 'Failed to retrieve item return records.' });
  }
});

/**
 * GET /api/returns/eligible-orders - Orders eligible for return (Completed POs)
 */
router.get('/eligible-orders', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let queryText = `
      SELECT po.id, po.po_number, po.total_amount, po.created_at, po.delivery_notes,
             v.id as vendor_id, v.name as vendor_name, v.email as vendor_email,
             pr.pr_number, pr.title as pr_title, pr.items as pr_items,
             u.id as requester_id, u.name as requester_name, u.email as requester_email
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.id
      JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      JOIN users u ON pr.requester_id = u.id
      WHERE po.status = 'Completed'
    `;
    const queryParams = [];

    if (role === 'Employee') {
      queryText += ' AND pr.requester_id = $1';
      queryParams.push(userId);
    } else if (role === 'Vendor') {
      const vendorUserCheck = await req.db.query('SELECT id FROM vendors WHERE user_id = $1', [userId]);
      if (vendorUserCheck.rows.length === 0) return res.json([]);
      queryText += ' AND po.vendor_id = $1';
      queryParams.push(vendorUserCheck.rows[0].id);
    }

    queryText += ' ORDER BY po.created_at DESC';

    const result = await req.db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to retrieve return-eligible orders:', error);
    res.status(500).json({ error: 'Failed to retrieve eligible purchase orders.' });
  }
});

/**
 * GET /api/returns/:id - Retrieve specific return details, timeline, and email logs
 */
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  try {
    const result = await req.db.query(
      `SELECT r.*,
              po.po_number, po.total_amount as po_total_amount, po.created_at as po_created_at,
              po.delivery_notes as po_delivery_notes,
              v.name as vendor_name, v.email as vendor_email, v.phone as vendor_phone,
              requester.name as requester_name, requester.email as requester_email, requester.department as requester_dept,
              reviewer.name as reviewer_name, reviewer.role as reviewer_role
       FROM item_returns r
       JOIN purchase_orders po ON r.purchase_order_id = po.id
       JOIN vendors v ON r.vendor_id = v.id
       JOIN users requester ON r.requester_id = requester.id
       LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Return record not found.' });
    }

    const returnRecord = result.rows[0];

    // Access guard for Vendor / Employee
    if (role === 'Vendor') {
      const vendorCheck = await req.db.query('SELECT user_id FROM vendors WHERE id = $1', [returnRecord.vendor_id]);
      if (vendorCheck.rows.length === 0 || vendorCheck.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Access denied to this return record.' });
      }
    } else if (role === 'Employee' && returnRecord.requester_id !== userId) {
      return res.status(403).json({ error: 'Access denied to this return record.' });
    }

    // Fetch chronological activities
    const activitiesRes = await req.db.query(
      `SELECT ra.*, u.name as user_name, u.role as user_role
       FROM return_activities ra
       LEFT JOIN users u ON ra.user_id = u.id
       WHERE ra.return_id = $1
       ORDER BY ra.created_at ASC`,
      [id]
    );

    // Fetch related simulated emails
    const emailsRes = await req.db.query(
      `SELECT * FROM simulated_emails
       WHERE return_id = $1 OR (po_id = $2 AND email_type LIKE 'RETURN%')
       ORDER BY sent_at DESC`,
      [id, returnRecord.purchase_order_id]
    );

    const now = new Date();
    const expiry = new Date(returnRecord.warranty_expiry_date);
    const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    res.json({
      ...returnRecord,
      warrantyDaysRemaining: daysRemaining,
      isWarrantyValid: daysRemaining >= 0,
      activities: activitiesRes.rows,
      emails: emailsRes.rows
    });

  } catch (error) {
    console.error('Failed to retrieve return record:', error);
    res.status(500).json({ error: 'Failed to retrieve return record details.' });
  }
});

/**
 * POST /api/returns - Initiate a Return Request with Warranty Check & Notifications
 */
router.post('/', auth, async (req, res) => {
  const {
    purchaseOrderId,
    itemName,
    itemCategory,
    quantityReturned,
    unitPrice,
    returnReason,
    itemCondition,
    reasonDescription,
    warrantyPeriodDays = 180
  } = req.body;

  if (!purchaseOrderId || !itemName || !quantityReturned || !returnReason || !itemCondition) {
    return res.status(400).json({
      error: 'Purchase Order ID, item name, quantity returned, return reason, and item condition are required.'
    });
  }

  const parsedQty = parseInt(quantityReturned, 10);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    return res.status(400).json({ error: 'Quantity returned must be a positive integer.' });
  }

  const client = await req.db.getTransaction();

  try {
    // 1. Fetch and validate Purchase Order
    const poRes = await client.query(
      `SELECT po.*, v.id as vendor_id, v.name as vendor_name, v.email as vendor_email, v.user_id as vendor_user_id,
              pr.requester_id, pr.items as pr_items,
              reqUser.name as requester_name, reqUser.email as requester_email
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       JOIN purchase_requests pr ON po.purchase_request_id = pr.id
       JOIN users reqUser ON pr.requester_id = reqUser.id
       WHERE po.id = $1`,
      [purchaseOrderId]
    );

    if (poRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const po = poRes.rows[0];

    if (po.status !== 'Completed') {
      client.release();
      return res.status(400).json({ error: 'Returns can only be requested for Completed/Delivered Purchase Orders.' });
    }

    // Role verification: If Employee, must be the requester
    if (req.user.role === 'Employee' && po.requester_id !== req.user.id) {
      client.release();
      return res.status(403).json({ error: 'You can only request returns for items you originally requested.' });
    }

    // 2. Compute pricing and totals
    const itemPrice = parseFloat(unitPrice) || (parseFloat(po.total_amount) / (parsedQty || 1));
    const totalReturnAmount = itemPrice * parsedQty;

    // 3. STEP 2 OF FLOW: WARRANTY & VALIDITY CHECK
    const purchaseDate = new Date(po.created_at);
    const warrantyDays = parseInt(warrantyPeriodDays, 10) || 180;
    const warrantyExpiryDate = new Date(purchaseDate.getTime() + warrantyDays * 24 * 60 * 60 * 1000);
    const currentDate = new Date();

    const isWithinWarranty = currentDate <= warrantyExpiryDate;
    const warrantyStatus = isWithinWarranty ? 'Valid' : 'Expired';
    const warrantyNotes = isWithinWarranty
      ? `Automated validity verification passed: Item is within the standard ${warrantyDays}-day warranty window (expires ${warrantyExpiryDate.toLocaleDateString()}). Eligible for replacement or refund.`
      : `Warranty expired on ${warrantyExpiryDate.toLocaleDateString()}. Management override may be required for RMA authorization.`;

    // 4. Generate sequential RMA Number
    const rmaNumber = await generateRmaNumber(client);

    // Initial lifecycle status: If within warranty, marked as 'Warranty Verified'; otherwise 'Requested'
    const initialStatus = isWithinWarranty ? 'Warranty Verified' : 'Requested';

    // 5. Insert Item Return Record
    const returnInsertRes = await client.query(
      `INSERT INTO item_returns (
         rma_number, purchase_order_id, requester_id, vendor_id,
         item_name, item_category, quantity_returned, unit_price, total_return_amount,
         return_reason, item_condition, reason_description,
         warranty_period_days, purchase_date, warranty_expiry_date,
         warranty_status, warranty_verified_at, warranty_notes,
         status, resolution_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, $17, $18, $19)
       RETURNING *`,
      [
        rmaNumber,
        po.id,
        req.user.id,
        po.vendor_id,
        itemName,
        itemCategory || 'General Goods',
        parsedQty,
        itemPrice,
        totalReturnAmount,
        returnReason,
        itemCondition,
        reasonDescription || '',
        warrantyDays,
        purchaseDate,
        warrantyExpiryDate,
        warrantyStatus,
        warrantyNotes,
        initialStatus,
        'Refund' // Default resolution
      ]
    );

    const newReturn = returnInsertRes.rows[0];

    // 6. Log Initial Timeline Activities (Step 1: Requested, Step 2: Warranty Verified)
    await client.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        newReturn.id,
        req.user.id,
        'REQUEST_CREATED',
        `Return request lodged for ${parsedQty} unit(s) of "${itemName}". Reason: ${returnReason}. Condition: ${itemCondition}.`,
        null,
        'Requested'
      ]
    );

    await client.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        newReturn.id,
        req.user.id,
        'WARRANTY_VERIFIED',
        warrantyNotes,
        'Requested',
        initialStatus
      ]
    );

    // 7. IN-APP NOTIFICATIONS
    // Requester confirmation
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.id,
        'Return Request Submitted',
        `Your return request ${rmaNumber} for "${itemName}" has been lodged. Warranty Status: ${warrantyStatus}.`,
        'PR_PENDING'
      ]
    );

    // Vendor notification
    if (po.vendor_user_id) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          po.vendor_user_id,
          'Item Return Request Lodged',
          `A customer has submitted return request ${rmaNumber} for order ${po.po_number} (${parsedQty}x ${itemName}).`,
          'PO_SENT'
        ]
      );
    }

    // Procurement Managers notification
    const pmsRes = await client.query("SELECT id, name, email FROM users WHERE role = 'ProcurementManager' AND status = 'Active'");
    for (const pm of pmsRes.rows) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          pm.id,
          'Return Approval Required',
          `Return request ${rmaNumber} submitted for PO ${po.po_number} (${parsedQty}x ${itemName}). Warranty: ${warrantyStatus}.`,
          'PR_PENDING'
        ]
      );
    }

    // 8. SEND EMAIL NOTIFICATIONS (SMTP + PERSISTENT DATABASE LOG)
    const requesterHtml = wrapHtmlEmail({
      title: `Return Request Submitted: ${rmaNumber}`,
      subtitle: `Associated Order: ${po.po_number}`,
      badgeText: 'Return Lodged',
      badgeType: 'warning',
      contentHtml: `
        <p>Dear <strong>${req.user.name || po.requester_name}</strong>,</p>
        <p>Your item return request has been successfully registered in the VendSphere Procurement System.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 13px;" cellpadding="4">
            <tr><td style="color: #64748b; width: 140px;">RMA Number:</td><td><strong style="color: #2563eb;">${rmaNumber}</strong></td></tr>
            <tr><td style="color: #64748b;">Order Number:</td><td><strong>${po.po_number}</strong></td></tr>
            <tr><td style="color: #64748b;">Item Name:</td><td><strong>${itemName}</strong></td></tr>
            <tr><td style="color: #64748b;">Return Quantity:</td><td>${parsedQty} unit(s)</td></tr>
            <tr><td style="color: #64748b;">Estimated Value:</td><td><strong>INR ${totalReturnAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td></tr>
            <tr><td style="color: #64748b;">Stated Reason:</td><td>${returnReason}</td></tr>
            <tr><td style="color: #64748b;">Condition:</td><td>${itemCondition}</td></tr>
          </table>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <strong style="color: #166534; font-size: 13px;">Warranty Verification Status:</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #15803d;">
            ${warrantyStatus === 'Valid' ? 'VERIFIED (Within Active 180-Day Warranty)' : 'WARRANTY EXPIRED'} &bull; Expires: ${warrantyExpiryDate.toLocaleDateString()}
          </p>
        </div>

        <p style="font-size: 13px; color: #475569;">
          <strong>Next Step:</strong> Corporate procurement management is reviewing your RMA ticket. You will receive an automated approval notification with pickup/replacement instructions once reviewed.
        </p>
      `
    });

    await sendEmailNotification({
      dbClient: client,
      poId: po.id,
      returnId: newReturn.id,
      emailType: 'RETURN_REQUESTED',
      toEmail: req.user.email || po.requester_email || 'employee@example.com',
      subject: emailSubjectRequester,
      body: emailBodyRequester,
      html: requesterHtml
    });

    // Email to Vendor
    const emailSubjectVendor = `[VendSphere] Return Request Notification: ${rmaNumber} for Order ${po.po_number}`;
    const emailBodyVendor = `
Dear ${po.vendor_name},

A return request has been submitted for goods delivered under Purchase Order ${po.po_number}.

Return Details:
- RMA Number: ${rmaNumber}
- Item: ${itemName} (Quantity: ${parsedQty})
- Stated Return Reason: ${returnReason}
- Item Physical Condition: ${itemCondition}
- Customer Comments: ${reasonDescription || 'None provided'}
- Warranty Coverage Status: ${warrantyStatus}

Please prepare for return authorization and potential restocking/replacement as soon as corporate procurement completes review.

Regards,
Corporate Sourcing & Procurement Office
    `.trim();

    const vendorHtml = wrapHtmlEmail({
      title: `Return Request Notice: ${rmaNumber}`,
      subtitle: `Goods delivered under Order ${po.po_number}`,
      badgeText: 'RMA Lodged',
      badgeType: 'warning',
      contentHtml: `
        <p>Dear <strong>${po.vendor_name}</strong>,</p>
        <p>A customer return request has been registered for items delivered under Purchase Order <strong>${po.po_number}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>RMA Number:</strong> ${rmaNumber}</p>
          <p style="margin: 0 0 6px 0;"><strong>Item:</strong> ${itemName} (${parsedQty} units)</p>
          <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> ${returnReason}</p>
          <p style="margin: 0 0 6px 0;"><strong>Physical Condition:</strong> ${itemCondition}</p>
          <p style="margin: 0;"><strong>Customer Notes:</strong> ${reasonDescription || 'None provided'}</p>
        </div>
        <p>Please prepare for return authorization and potential restocking/replacement as soon as corporate procurement completes review.</p>
      `
    });

    await sendEmailNotification({
      dbClient: client,
      poId: po.id,
      returnId: newReturn.id,
      emailType: 'RETURN_VENDOR_NOTICE',
      toEmail: po.vendor_email || 'vendor@example.com',
      subject: emailSubjectVendor,
      body: emailBodyVendor,
      html: vendorHtml
    });

    await client.commit();
    res.status(201).json(newReturn);

  } catch (error) {
    await client.rollback();
    console.error('Failed to submit return request:', error);
    res.status(500).json({ error: 'Failed to lodge return request.' });
  }
});

/**
 * POST /api/returns/:id/verify-warranty - Manual or Re-verification of item warranty
 */
router.post('/:id/verify-warranty', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { warrantyStatus, notes } = req.body;

  try {
    const returnRes = await req.db.query('SELECT * FROM item_returns WHERE id = $1', [id]);
    if (returnRes.rows.length === 0) {
      return res.status(404).json({ error: 'Return record not found.' });
    }
    const currentReturn = returnRes.rows[0];

    const updated = await req.db.query(
      `UPDATE item_returns
       SET warranty_status = COALESCE($1, warranty_status),
           warranty_notes = COALESCE($2, warranty_notes),
           warranty_verified_at = CURRENT_TIMESTAMP,
           status = CASE WHEN status = 'Requested' THEN 'Warranty Verified' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [warrantyStatus || 'Valid', notes || 'Warranty validity manually certified by quality inspector.', id]
    );

    await req.db.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        req.user.id,
        'WARRANTY_VERIFIED',
        notes || `Warranty certified as "${warrantyStatus || 'Valid'}" by ${req.user.name}.`,
        currentReturn.status,
        updated.rows[0].status
      ]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Failed to verify warranty:', error);
    res.status(500).json({ error: 'Failed to update warranty verification status.' });
  }
});

/**
 * POST /api/returns/:id/approve - STEP 3: Approve Return Request
 */
router.post('/:id/approve', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { resolutionType = 'Refund', approvalNotes = '' } = req.body;

  const client = await req.db.getTransaction();

  try {
    const returnRes = await client.query(
      `SELECT r.*, po.po_number, v.name as vendor_name, v.email as vendor_email, v.user_id as vendor_user_id,
              u.name as requester_name, u.email as requester_email
       FROM item_returns r
       JOIN purchase_orders po ON r.purchase_order_id = po.id
       JOIN vendors v ON r.vendor_id = v.id
       JOIN users u ON r.requester_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (returnRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Return record not found.' });
    }

    const ret = returnRes.rows[0];

    if (ret.status === 'Approved' || ret.status === 'Completed') {
      client.release();
      return res.status(400).json({ error: `Return is already ${ret.status}.` });
    }

    // 1. Update Return Status to Approved
    const updatedRes = await client.query(
      `UPDATE item_returns
       SET status = 'Approved',
           resolution_type = $1,
           reviewed_by = $2,
           reviewed_at = CURRENT_TIMESTAMP,
           approval_notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [resolutionType, req.user.id, approvalNotes || 'Approved by procurement authority.', id]
    );

    // 2. Log Activity
    await client.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        req.user.id,
        'APPROVED',
        `Return request approved by ${req.user.name}. Resolution assigned: ${resolutionType}. Notes: ${approvalNotes || 'None'}`,
        ret.status,
        'Approved'
      ]
    );

    // 3. Notifications
    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4)`,
      [
        ret.requester_id,
        'Return Request Approved',
        `Your return request ${ret.rma_number} for "${ret.item_name}" has been Approved with resolution: ${resolutionType}.`,
        'PR_APPROVED'
      ]
    );

    if (ret.vendor_user_id) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          ret.vendor_user_id,
          'Return Authorization Approved',
          `RMA ${ret.rma_number} has been approved for order ${ret.po_number}. Resolution: ${resolutionType}.`,
          'PO_ACCEPTED'
        ]
      );
    }

    // 4. SEND EMAIL NOTIFICATIONS (SMTP + PERSISTENT DATABASE LOG)
    const emailSubjectRequester = `[VendSphere] Return Authorized: ${ret.rma_number} Approved`;
    const emailBodyRequester = `
Dear ${ret.requester_name},

Great news! Your item return request (${ret.rma_number}) for Purchase Order ${ret.po_number} has been APPROVED by management.

Approval & Resolution Summary:
- RMA Number: ${ret.rma_number}
- Item: ${ret.quantity_returned}x ${ret.item_name}
- Authorized Resolution: ${resolutionType}
- Approver: ${req.user.name} (${req.user.role})
- Review Comments: ${approvalNotes || 'All return conditions verified.'}

Return Logistics Instructions:
Please pack the item securely in its packaging with RMA Number "${ret.rma_number}" visibly labeled.
Our logistics desk or supplier courier will pick up the package within 2 business days.

Regards,
Procurement & Returns Authority
    `.trim();

    const requesterApprovalHtml = wrapHtmlEmail({
      title: `Return Authorized: ${ret.rma_number} Approved`,
      subtitle: `RMA approval for Order ${ret.po_number}`,
      badgeText: 'Return Approved',
      badgeType: 'success',
      contentHtml: `
        <p>Dear <strong>${ret.requester_name}</strong>,</p>
        <p>Your item return request (<strong>${ret.rma_number}</strong>) has been <span style="color: #166534; font-weight: bold;">APPROVED</span> by corporate management.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <table style="width: 100%; font-size: 13px;" cellpadding="4">
            <tr><td style="color: #64748b; width: 140px;">RMA Number:</td><td><strong>${ret.rma_number}</strong></td></tr>
            <tr><td style="color: #64748b;">Order Number:</td><td><strong>${ret.po_number}</strong></td></tr>
            <tr><td style="color: #64748b;">Returning Item:</td><td>${ret.quantity_returned}x ${ret.item_name}</td></tr>
            <tr><td style="color: #64748b;">Authorized Resolution:</td><td><strong style="color: #16a34a;">${resolutionType}</strong></td></tr>
            <tr><td style="color: #64748b;">Approving Official:</td><td>${req.user.name} (${req.user.role})</td></tr>
            <tr><td style="color: #64748b;">Reviewer Notes:</td><td>${approvalNotes || 'All conditions verified.'}</td></tr>
          </table>
        </div>
        <p style="font-size: 13px;"><strong>Return Logistics Instructions:</strong> Please package the item securely with the RMA number <code>${ret.rma_number}</code> visibly labeled. Logistics pickup will be coordinated shortly.</p>
      `
    });

    await sendEmailNotification({
      dbClient: client,
      poId: ret.purchase_order_id,
      returnId: id,
      emailType: 'RETURN_APPROVED',
      toEmail: ret.requester_email || 'employee@example.com',
      subject: emailSubjectRequester,
      body: emailBodyRequester,
      html: requesterApprovalHtml
    });

    // Email to Vendor
    const emailSubjectVendor = `[VendSphere] RMA Authorization Notice: ${ret.rma_number} Approved`;
    const emailBodyVendor = `
Dear ${ret.vendor_name},

This official notice confirms that Return Merchandise Authorization ${ret.rma_number} has been approved by company procurement.

Details:
- RMA Number: ${ret.rma_number}
- Associated PO: ${ret.po_number}
- Returning Item: ${ret.quantity_returned}x ${ret.item_name}
- Agreed Resolution: ${resolutionType}
- Total Value: INR ${parseFloat(ret.total_return_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}

Please coordinate return intake and credit/replacement issuance as per master service terms.

Regards,
VendSphere Supply Chain Operations
    `.trim();

    const vendorApprovalHtml = wrapHtmlEmail({
      title: `RMA Authorized: ${ret.rma_number}`,
      subtitle: `Vendor return notice for Order ${ret.po_number}`,
      badgeText: 'RMA Authorized',
      badgeType: 'success',
      contentHtml: `
        <p>Dear <strong>${ret.vendor_name}</strong>,</p>
        <p>This notice confirms that Return Merchandise Authorization <strong>${ret.rma_number}</strong> has been approved by company procurement.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>RMA Number:</strong> ${ret.rma_number}</p>
          <p style="margin: 0 0 6px 0;"><strong>PO Reference:</strong> ${ret.po_number}</p>
          <p style="margin: 0 0 6px 0;"><strong>Returning Item:</strong> ${ret.quantity_returned}x ${ret.item_name}</p>
          <p style="margin: 0 0 6px 0;"><strong>Authorized Resolution:</strong> ${resolutionType}</p>
          <p style="margin: 0;"><strong>Total Valuation:</strong> INR ${parseFloat(ret.total_return_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <p>Please coordinate return intake and credit/replacement processing as per contract terms.</p>
      `
    });

    await sendEmailNotification({
      dbClient: client,
      poId: ret.purchase_order_id,
      returnId: id,
      emailType: 'RETURN_APPROVED_VENDOR',
      toEmail: ret.vendor_email || 'vendor@example.com',
      subject: emailSubjectVendor,
      body: emailBodyVendor,
      html: vendorApprovalHtml
    });

    await client.commit();
    res.json(updatedRes.rows[0]);

  } catch (error) {
    await client.rollback();
    console.error('Failed to approve return request:', error);
    res.status(500).json({ error: 'Failed to approve return request.' });
  }
});

/**
 * POST /api/returns/:id/reject - Reject Return Request
 */
router.post('/:id/reject', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!rejectionReason) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }

  const client = await req.db.getTransaction();

  try {
    const returnRes = await client.query(
      `SELECT r.*, po.po_number, u.name as requester_name, u.email as requester_email
       FROM item_returns r
       JOIN purchase_orders po ON r.purchase_order_id = po.id
       JOIN users u ON r.requester_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (returnRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Return record not found.' });
    }

    const ret = returnRes.rows[0];

    const updatedRes = await client.query(
      `UPDATE item_returns
       SET status = 'Rejected',
           reviewed_by = $1,
           reviewed_at = CURRENT_TIMESTAMP,
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [req.user.id, rejectionReason, id]
    );

    await client.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        req.user.id,
        'REJECTED',
        `Return request rejected by ${req.user.name}. Reason: ${rejectionReason}`,
        ret.status,
        'Rejected'
      ]
    );

    await client.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4)`,
      [
        ret.requester_id,
        'Return Request Declined',
        `Your return request ${ret.rma_number} for "${ret.item_name}" was declined. Reason: ${rejectionReason}`,
        'PR_REJECTED'
      ]
    );

    // Email to Requester
    const emailSubject = `[VendSphere] Return Request ${ret.rma_number} Declined`;
    const emailBody = `
Dear ${ret.requester_name},

Your item return request (${ret.rma_number}) for order ${ret.po_number} could not be approved at this time.

Decision Details:
- RMA Number: ${ret.rma_number}
- Item: ${ret.item_name}
- Reviewer: ${req.user.name} (${req.user.role})
- Reason for Decline: ${rejectionReason}

If you believe this determination was made in error or have additional warranty proof, please contact your procurement administrator.

Regards,
Procurement & Returns Authority
    `.trim();

    const rejectionHtml = wrapHtmlEmail({
      title: `Return Request Declined: ${ret.rma_number}`,
      subtitle: `Decision on Order ${ret.po_number}`,
      badgeText: 'Declined',
      badgeType: 'danger',
      contentHtml: `
        <p>Dear <strong>${ret.requester_name}</strong>,</p>
        <p>Your item return request (<strong>${ret.rma_number}</strong>) for Purchase Order <strong>${ret.po_number}</strong> could not be approved at this time.</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>RMA Number:</strong> ${ret.rma_number}</p>
          <p style="margin: 0 0 6px 0;"><strong>Item:</strong> ${ret.item_name}</p>
          <p style="margin: 0 0 6px 0;"><strong>Reviewed By:</strong> ${req.user.name} (${req.user.role})</p>
          <p style="margin: 0; color: #b91c1c;"><strong>Reason for Decline:</strong> ${rejectionReason}</p>
        </div>
        <p style="font-size: 13px;">If you have additional warranty certificates, serial numbers, or delivery receipt proof, please contact your corporate procurement desk.</p>
      `
    });

    await sendEmailNotification({
      dbClient: client,
      poId: ret.purchase_order_id,
      returnId: id,
      emailType: 'RETURN_REJECTED',
      toEmail: ret.requester_email || 'employee@example.com',
      subject: emailSubject,
      body: emailBody,
      html: rejectionHtml
    });

    await client.commit();
    res.json(updatedRes.rows[0]);

  } catch (error) {
    await client.rollback();
    console.error('Failed to reject return request:', error);
    res.status(500).json({ error: 'Failed to reject return request.' });
  }
});

/**
 * POST /api/returns/:id/schedule-pickup - STEP 4: Logistics & Carrier Pickup
 */
router.post('/:id/schedule-pickup', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Vendor'), async (req, res) => {
  const { id } = req.params;
  const { carrier = 'VendSphere Express Logistics', trackingNumber = '', scheduledDate } = req.body;

  try {
    const generatedTracking = trackingNumber || `TRK-RET-${Date.now().toString().slice(-6)}`;
    const pickupDate = scheduledDate ? new Date(scheduledDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updated = await req.db.query(
      `UPDATE item_returns
       SET status = 'Pickup Scheduled',
           pickup_carrier = $1,
           pickup_tracking_number = $2,
           pickup_scheduled_date = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [carrier, generatedTracking, pickupDate, id]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Return record not found.' });
    }

    await req.db.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        req.user.id,
        'PICKUP_SCHEDULED',
        `Pickup scheduled via ${carrier}. Tracking: ${generatedTracking}. Estimated date: ${pickupDate.toLocaleDateString()}.`,
        'Approved',
        'Pickup Scheduled'
      ]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Failed to schedule pickup:', error);
    res.status(500).json({ error: 'Failed to schedule return pickup.' });
  }
});

/**
 * POST /api/returns/:id/complete - STEP 5: Finalize & Complete Return
 */
router.post('/:id/complete', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { resolutionNotes = '' } = req.body;

  const client = await req.db.getTransaction();

  try {
    const returnRes = await client.query(
      `SELECT r.*, po.po_number, v.name as vendor_name, v.email as vendor_email,
              u.name as requester_name, u.email as requester_email
       FROM item_returns r
       JOIN purchase_orders po ON r.purchase_order_id = po.id
       JOIN vendors v ON r.vendor_id = v.id
       JOIN users u ON r.requester_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (returnRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Return record not found.' });
    }

    const ret = returnRes.rows[0];

    const updated = await client.query(
      `UPDATE item_returns
       SET status = 'Completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query(
      `INSERT INTO return_activities (return_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        req.user.id,
        'COMPLETED',
        `Return flow finalized and closed. Resolution: ${ret.resolution_type}. Notes: ${resolutionNotes || 'Returned items verified and restocked.'}`,
        ret.status,
        'Completed'
      ]
    );

    // Send final completion email
    const emailSubject = `[VendSphere] Return Completed: ${ret.rma_number} Resolved`;
    const emailBody = `
Dear ${ret.requester_name},

This email confirms that Return Request ${ret.rma_number} has been fully completed and closed.

Resolution Summary:
- RMA Number: ${ret.rma_number}
- Item: ${ret.quantity_returned}x ${ret.item_name}
- Resolution Executed: ${ret.resolution_type}
- Final Amount / Credit: INR ${parseFloat(ret.total_return_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Notes: ${resolutionNotes || 'Returned goods inspected, verified, and settled.'}

Thank you for utilizing VendSphere procurement and warranty services.

Regards,
VendSphere Operations
    `.trim();

    const completionHtml = wrapHtmlEmail({
      title: `Return Completed & Closed: ${ret.rma_number}`,
      subtitle: `Resolution processed for Order ${ret.po_number}`,
      badgeText: 'Completed',
      badgeType: 'success',
      contentHtml: `
        <p>Dear <strong>${ret.requester_name}</strong>,</p>
        <p>This email confirms that Return Request <strong>${ret.rma_number}</strong> has been fully completed and closed.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>RMA Number:</strong> ${ret.rma_number}</p>
          <p style="margin: 0 0 6px 0;"><strong>Item:</strong> ${ret.quantity_returned}x ${ret.item_name}</p>
          <p style="margin: 0 0 6px 0;"><strong>Resolution Executed:</strong> <span style="color: #166534; font-weight: bold;">${ret.resolution_type}</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Credit / Refund Amount:</strong> INR ${parseFloat(ret.total_return_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p style="margin: 0;"><strong>Settlement Notes:</strong> ${resolutionNotes || 'Returned goods verified, restocked, and settled.'}</p>
        </div>
        <p>Thank you for using VendSphere procurement and warranty services.</p>
      `
    });

    await sendEmailNotification({
      dbClient: client,
      poId: ret.purchase_order_id,
      returnId: id,
      emailType: 'RETURN_COMPLETED',
      toEmail: ret.requester_email || 'employee@example.com',
      subject: emailSubject,
      body: emailBody,
      html: completionHtml
    });

    await client.commit();
    res.json(updated.rows[0]);

  } catch (error) {
    await client.rollback();
    console.error('Failed to complete return:', error);
    res.status(500).json({ error: 'Failed to complete return record.' });
  }
});

export default router;

