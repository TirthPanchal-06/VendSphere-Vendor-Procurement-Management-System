import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';
import { sendEmailNotification, wrapHtmlEmail } from '../services/emailService.js';

const router = express.Router();

// GET /api/purchase-orders - List purchase orders
router.get('/', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let queryText = `
      SELECT po.*, v.name as vendor_name, pr.pr_number, pr.title as pr_title,
             (SELECT COUNT(*) FROM order_feedback_queries q WHERE q.purchase_order_id = po.id) as feedback_count,
             (SELECT q.rating FROM order_feedback_queries q WHERE q.purchase_order_id = po.id ORDER BY q.created_at DESC LIMIT 1) as feedback_rating,
             (SELECT q.status FROM order_feedback_queries q WHERE q.purchase_order_id = po.id ORDER BY q.created_at DESC LIMIT 1) as feedback_status,
             (SELECT q.id FROM order_feedback_queries q WHERE q.purchase_order_id = po.id AND q.employee_id = $1 LIMIT 1) as my_feedback_id
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
    `;
    const queryParams = [userId];

    if (role === 'Vendor') {
      // Vendors only see POs assigned to them
      queryText += ' WHERE v.user_id = $1';
    } else if (role === 'Employee') {
      // Employees see orders linked to their PRs or completed deliveries
      queryText += ' WHERE (pr.requester_id = $1 OR po.status = \'Completed\')';
    }

    queryText += ' ORDER BY po.created_at DESC';

    const result = await req.db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list POs:', error);
    res.status(500).json({ error: 'Failed to retrieve Purchase Orders.' });
  }
});

// GET /api/purchase-orders/:id - Retrieve specific PO
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  try {
    const result = await req.db.query(
      `SELECT po.*, v.name as vendor_name, v.email as vendor_email, v.phone as vendor_phone, 
              pr.pr_number, pr.title as pr_title, pr.items as pr_items, u.name as requester_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
       LEFT JOIN users u ON pr.requester_id = u.id
       WHERE po.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const po = result.rows[0];

    // Assert vendor security boundary
    if (role === 'Vendor') {
      const vendorUserCheck = await req.db.query('SELECT user_id FROM vendors WHERE id = $1', [po.vendor_id]);
      if (vendorUserCheck.rows.length === 0 || vendorUserCheck.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Access denied to this Purchase Order.' });
      }
    }

    // Also fetch associated feedback & queries
    const feedbackRes = await req.db.query(
      `SELECT q.*, emp.name as employee_name, emp.department as employee_dept,
              assignee.name as assignee_name, resolver.name as resolver_name
       FROM order_feedback_queries q
       JOIN users emp ON q.employee_id = emp.id
       LEFT JOIN users assignee ON q.assigned_to = assignee.id
       LEFT JOIN users resolver ON q.resolved_by = resolver.id
       WHERE q.purchase_order_id = $1
       ORDER BY q.created_at DESC`,
      [id]
    );

    po.feedbackQueries = feedbackRes.rows;

    // Fetch associated item returns
    const returnsRes = await req.db.query(
      `SELECT r.*, u.name as requester_name, rev.name as reviewer_name
       FROM item_returns r
       JOIN users u ON r.requester_id = u.id
       LEFT JOIN users rev ON r.reviewed_by = rev.id
       WHERE r.purchase_order_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    po.itemReturns = returnsRes.rows;

    res.json(po);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve Purchase Order details.' });
  }
});


// POST /api/purchase-orders - Generate Purchase Order from awarded quotation
router.post('/', auth, authorize('Admin', 'ProcurementManager'), async (req, res) => {
  const { purchaseRequestId, quotationId, vendorId, totalAmount } = req.body;

  if (!purchaseRequestId || !quotationId || !vendorId || !totalAmount) {
    return res.status(400).json({ error: 'PR ID, Quotation ID, Vendor ID, and total amount are required.' });
  }

  const client = await req.db.getTransaction();

  try {
    // 1. Double check if PO already exists for this PR
    const checkPo = await client.query('SELECT id FROM purchase_orders WHERE purchase_request_id = $1', [purchaseRequestId]);
    if (checkPo.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'A Purchase Order already exists for this Purchase Request.' });
    }

    // 2. Generate sequential PO number
    const countRes = await client.query('SELECT COUNT(*) FROM purchase_orders');
    const seq = parseInt(countRes.rows[0].count) + 1;
    const poNumber = `PO-${new Date().getFullYear()}-${seq.toString().padStart(4, '0')}`;

    // 3. Create PO
    const poRes = await client.query(
      `INSERT INTO purchase_orders (po_number, purchase_request_id, quotation_id, vendor_id, total_amount, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [poNumber, purchaseRequestId, quotationId, vendorId, totalAmount, 'Draft']
    );

    // 4. Update PR status to 'PO Created'
    await client.query('UPDATE purchase_requests SET status = \'PO Created\' WHERE id = $1', [purchaseRequestId]);

    // Write Activity Log
    await client.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_PO', `Generated PO ${poNumber} for Vendor ID ${vendorId}`]
    );

    await client.commit();
    res.status(201).json(poRes.rows[0]);

  } catch (error) {
    await client.rollback();
    console.error('Failed to generate PO:', error);
    res.status(500).json({ error: 'Failed to generate Purchase Order.' });
  }
});

// POST /api/purchase-orders/:id/send - Dispatch PO to vendor
router.post('/:id/send', auth, authorize('Admin', 'ProcurementManager'), async (req, res) => {
  const { id } = req.params;

  try {
    // Update PO status
    const result = await req.db.query(
      'UPDATE purchase_orders SET status = \'Sent to Vendor\' WHERE id = $1 AND status = \'Draft\' RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Only Draft Purchase Orders can be dispatched.' });
    }

    const po = result.rows[0];

    // Notify vendor
    const vendorRes = await req.db.query('SELECT user_id, name, email FROM vendors WHERE id = $1', [po.vendor_id]);
    if (vendorRes.rows.length > 0) {
      const vendor = vendorRes.rows[0];
      
      if (vendor.user_id) {
        await req.db.query(
          'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
          [
            vendor.user_id,
            'Purchase Order Received',
            `You have received ${po.po_number} from company procurement. Please review and accept/sign.`,
            'PO_SENT'
          ]
        );
      }

      // Generate simulated email log
      const emailSubject = `[VendSphere] Purchase Order Dispatched: ${po.po_number}`;
      const emailBody = `
Dear ${vendor.name},

An official Purchase Order (${po.po_number}) has been dispatched to your portal for review and signing.

Order Details:
- PO Number: ${po.po_number}
- Total Amount: INR ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}

Please log into the VendSphere Supplier Portal to review and confirm acceptance of this contract.

Regards,
Procurement Operations Team
      `.trim();

      await sendEmailNotification({
        dbClient: req.db,
        poId: po.id,
        emailType: 'PO_SENT',
        toEmail: vendor.email || 'vendor@example.com',
        subject: emailSubject,
        body: emailBody,
        html: wrapHtmlEmail({
          title: `Purchase Order Dispatched: ${po.po_number}`,
          subtitle: `Official procurement order for ${vendor.name}`,
          badgeText: 'Dispatched',
          badgeType: 'primary',
          contentHtml: `
            <p>Dear <strong>${vendor.name}</strong>,</p>
            <p>An official Purchase Order (<strong>${po.po_number}</strong>) has been dispatched to your portal for review and signing.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 6px 0;"><strong>PO Number:</strong> ${po.po_number}</p>
              <p style="margin: 0;"><strong>Total Valuation:</strong> INR ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <p>Please log into the VendSphere Supplier Portal to review and confirm acceptance of this contract.</p>
          `
        })
      });
    }

    res.json({ message: 'Purchase Order sent to vendor.', purchaseOrder: po });

  } catch (error) {
    console.error('Failed to send PO:', error);
    res.status(500).json({ error: 'Failed to send Purchase Order.' });
  }
});

// POST /api/purchase-orders/:id/accept - Vendor accepts PO
router.post('/:id/accept', auth, authorize('Vendor'), async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch vendor and verify PO matches
    const vendorRes = await req.db.query('SELECT id, name, email FROM vendors WHERE user_id = $1', [req.user.id]);
    if (vendorRes.rows.length === 0) {
      return res.status(403).json({ error: 'User is not linked to any vendor.' });
    }
    const vendor = vendorRes.rows[0];

    const poRes = await req.db.query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
    if (poRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }
    const po = poRes.rows[0];

    if (po.vendor_id !== vendor.id) {
      return res.status(403).json({ error: 'This Purchase Order is not assigned to you.' });
    }

    if (po.status !== 'Sent to Vendor') {
      return res.status(400).json({ error: 'Purchase Order must be in "Sent to Vendor" state.' });
    }

    const updated = await req.db.query(
      'UPDATE purchase_orders SET status = \'Accepted\' WHERE id = $1 RETURNING *',
      [id]
    );

    // Send confirmation email to vendor
    const emailSubjectVendor = `[VendSphere] Purchase Order Confirmed: ${po.po_number}`;
    const emailBodyVendor = `
Dear ${vendor.name},

This email confirms that you have signed and accepted Purchase Order ${po.po_number}.

Our procurement operations team has been notified. Please begin preparing the shipment as per agreed terms.

Regards,
VendSphere Portal Systems
    `.trim();

    await sendEmailNotification({
      dbClient: req.db,
      poId: po.id,
      emailType: 'PO_ACCEPTED_VENDOR',
      toEmail: vendor.email || 'vendor@example.com',
      subject: emailSubjectVendor,
      body: emailBodyVendor,
      html: wrapHtmlEmail({
        title: `Purchase Order Confirmed: ${po.po_number}`,
        subtitle: `Agreement signed by ${vendor.name}`,
        badgeText: 'Contract Signed',
        badgeType: 'success',
        contentHtml: `
          <p>Dear <strong>${vendor.name}</strong>,</p>
          <p>This email confirms that you have signed and accepted Purchase Order <strong>${po.po_number}</strong>.</p>
          <p>Our procurement operations team has been notified. Please begin preparing the shipment as per agreed terms.</p>
        `
      })
    });

    // Notify all active Procurement Managers and send emails
    const PMs = await req.db.query('SELECT id, name, email FROM users WHERE role = \'ProcurementManager\' AND status = \'Active\'');
    for (const pm of PMs.rows) {
      await req.db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          pm.id,
          'Purchase Order Accepted',
          `Vendor "${vendor.name}" has accepted ${po.po_number} and is preparing shipment.`,
          'PO_ACCEPTED'
        ]
      );

      const emailSubjectPm = `[VendSphere] Purchase Order Accepted by Supplier: ${po.po_number}`;
      const emailBodyPm = `
Dear ${pm.name},

Vendor "${vendor.name}" has officially signed and accepted Purchase Order ${po.po_number}.

Contract Status: Accepted
Valuation: INR ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}

Regards,
VendSphere Portal Systems
      `.trim();

      await sendEmailNotification({
        dbClient: req.db,
        poId: po.id,
        emailType: 'PO_ACCEPTED_PM',
        toEmail: pm.email || 'procurement@example.com',
        subject: emailSubjectPm,
        body: emailBodyPm,
        html: wrapHtmlEmail({
          title: `Supplier Signed Purchase Order: ${po.po_number}`,
          subtitle: `Accepted by ${vendor.name}`,
          badgeText: 'Accepted',
          badgeType: 'success',
          contentHtml: `
            <p>Dear <strong>${pm.name}</strong>,</p>
            <p>Supplier <strong>${vendor.name}</strong> has officially signed and accepted Purchase Order <strong>${po.po_number}</strong>.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 6px 0;"><strong>Contract Status:</strong> Accepted</p>
              <p style="margin: 0;"><strong>Total Valuation:</strong> INR ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          `
        })
      });
    }

    res.json({ message: 'Purchase Order accepted.', purchaseOrder: updated.rows[0] });

  } catch (error) {
    console.error('Failed to accept PO:', error);
    res.status(500).json({ error: 'Failed to accept Purchase Order.' });
  }
});

// POST /api/purchase-orders/:id/complete - Complete PO (Procurement logs receipt)
router.post('/:id/complete', auth, authorize('Admin', 'ProcurementManager'), async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const client = await req.db.getTransaction();

  try {
    const poRes = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
    if (poRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }
    const po = poRes.rows[0];

    if (po.status !== 'Accepted') {
      client.release();
      return res.status(400).json({ error: 'Only Accepted Purchase Orders can be completed/fully received.' });
    }

    // 1. Update PO Status
    const completedPo = await client.query(
      `UPDATE purchase_orders 
       SET status = 'Completed', delivery_notes = $1 
       WHERE id = $2 
       RETURNING *`,
      [notes || 'Delivered successfully.', id]
    );

    // 2. PERFORMANCE SCORING ALGORITHM
    // Get quotation delivery lead days vs actual duration
    const qRes = await client.query('SELECT delivery_days, created_at FROM quotations WHERE id = $1', [po.quotation_id]);
    if (qRes.rows.length > 0) {
      const quotation = qRes.rows[0];
      const promisedDays = quotation.delivery_days;
      
      const orderDate = new Date(po.created_at);
      const deliveryDate = new Date();
      const actualDays = Math.ceil((deliveryDate - orderDate) / (1000 * 60 * 60 * 24));

      const isLate = actualDays > promisedDays;

      // Adjust vendor performance score based on on-time performance
      const vendorRes = await client.query('SELECT performance_score, rating, name FROM vendors WHERE id = $1', [po.vendor_id]);
      if (vendorRes.rows.length > 0) {
        const currentScore = vendorRes.rows[0].performance_score;
        let newScore = currentScore;

        if (isLate) {
          // Late delivery penalty
          newScore = Math.max(40, currentScore - 5);
        } else {
          // On-time bonus
          newScore = Math.min(100, currentScore + 2);
        }

        // Adjust 5-star rating dynamically based on performance score ranges:
        // Score 90-100: 5 stars
        // Score 80-89: 4 stars
        // Score 70-79: 3 stars
        // Score below 70: 2 stars or less
        let newRating = 5.0;
        if (newScore >= 90) newRating = 5.0;
        else if (newScore >= 80) newRating = 4.0;
        else if (newScore >= 70) newRating = 3.0;
        else newRating = 2.0;

        await client.query(
          'UPDATE vendors SET performance_score = $1, rating = $2 WHERE id = $3',
          [newScore, newRating, po.vendor_id]
        );

        // Add evaluation log to audit
        await client.query(
          'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
          [
            req.user.id, 
            'AUTO_VENDOR_EVALUATION', 
            `Auto-evaluated ${vendorRes.rows[0].name} after ${po.po_number} completion. On-time: ${!isLate} (Promised: ${promisedDays}d, Actual: ${actualDays}d). New Score: ${newScore}`
          ]
        );
      }
    }

    // 3. Notify and Send Email Notifications after purchasing items
    const detailsRes = await client.query(
      `SELECT pr.id as pr_id, pr.pr_number, pr.title as pr_title, pr.items as pr_items,
              reqUser.id as requester_id, reqUser.name as requester_name, reqUser.email as requester_email,
              v.name as vendor_name, v.email as vendor_email, v.user_id as vendor_user_id
       FROM purchase_orders po
       JOIN purchase_requests pr ON po.purchase_request_id = pr.id
       JOIN users reqUser ON pr.requester_id = reqUser.id
       JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = $1`,
      [id]
    );

    if (detailsRes.rows.length > 0) {
      const orderInfo = detailsRes.rows[0];
      const itemsList = Array.isArray(orderInfo.pr_items) ? orderInfo.pr_items : [];

      // Format items table for email body
      const formattedItems = itemsList.map((item, idx) => 
        `  ${idx + 1}. ${item.name} (${item.category || 'General'}) — ${item.quantity} units @ INR ${parseFloat(item.estimated_cost).toFixed(2)} (Subtotal: INR ${(item.quantity * parseFloat(item.estimated_cost)).toFixed(2)})`
      ).join('\n');

      const deliveryDate = new Date();
      const warrantyDays = 180;
      const warrantyExpiry = new Date(deliveryDate.getTime() + warrantyDays * 24 * 60 * 60 * 1000);

      // Email to Requester (Employee)
      const requesterEmailSubject = `[VendSphere] Purchase Delivered & Items Received: ${po.po_number}`;
      const requesterEmailBody = `
Dear ${orderInfo.requester_name},

Your requested items under requisition "${orderInfo.pr_title}" (${orderInfo.pr_number}) have been officially delivered, inspected, and completed under Purchase Order ${po.po_number}.

Purchased Items Breakdown:
${formattedItems}

Order Valuation:
- Total Procurement Spend: INR ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Fulfilled By Supplier: ${orderInfo.vendor_name}
- Delivery Notes: ${notes || 'Verified and accepted at receiving dock.'}

Warranty & Validity Coverage:
- Standard Quality Warranty: ${warrantyDays} Days Active
- Warranty Activation Date: ${deliveryDate.toLocaleDateString()}
- Warranty Expiration Date: ${warrantyExpiry.toLocaleDateString()}
- Return Eligibility: Eligible for return, free replacement, or full credit refund if defective within ${warrantyDays} days.

Need to Return an Item?
If any item delivered has defects, damage, or specification mismatch, you can initiate a return directly from the "Returns & Warranty" portal or the Purchase Orders page.

Regards,
VendSphere Procurement & Asset Management
      `.trim();

      // 1. Send Post-Purchase Email to Requester (Employee) with Warranty activation
      const requesterHtml = wrapHtmlEmail({
        title: `Purchase Delivered & Items Received: ${po.po_number}`,
        subtitle: `Procurement fulfillment for requisition "${orderInfo.pr_title}"`,
        badgeText: 'Items Delivered',
        badgeType: 'success',
        contentHtml: `
          <p>Dear <strong>${orderInfo.requester_name}</strong>,</p>
          <p>Your requested items under requisition "<strong>${orderInfo.pr_title}</strong>" (${orderInfo.pr_number}) have been officially delivered, inspected, and completed under Purchase Order <strong>${po.po_number}</strong>.</p>
          
          <h4 style="margin: 16px 0 8px 0; font-size: 13px; color: #0f172a; text-transform: uppercase;">Purchased Items Breakdown:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 8px; text-align: left;">Item</th>
                <th style="padding: 8px; text-align: center;">Qty</th>
                <th style="padding: 8px; text-align: right;">Unit Price</th>
                <th style="padding: 8px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList.map(item => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px;"><strong>${item.name}</strong> (${item.category || 'General'})</td>
                  <td style="padding: 8px; text-align: center;">${item.quantity}</td>
                  <td style="padding: 8px; text-align: right;">INR ${parseFloat(item.estimated_cost).toFixed(2)}</td>
                  <td style="padding: 8px; text-align: right; font-weight: bold;">INR ${(item.quantity * parseFloat(item.estimated_cost)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <strong style="color: #166534; font-size: 14px;">Warranty & Return Eligibility Coverage</strong>
            </div>
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #15803d;"><strong>Coverage:</strong> ${warrantyDays} Days Quality Warranty Active</p>
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #15803d;"><strong>Active From:</strong> ${deliveryDate.toLocaleDateString()} &bull; <strong>Expires On:</strong> ${warrantyExpiry.toLocaleDateString()}</p>
            <p style="margin: 0; font-size: 12px; color: #166534;">If any item delivered has defects, damage, or specification mismatch, you can initiate a return directly from the <strong>Returns & Warranty</strong> portal.</p>
          </div>
        `
      });

      await sendEmailNotification({
        dbClient: client,
        poId: po.id,
        emailType: 'PURCHASE_COMPLETED',
        toEmail: orderInfo.requester_email || 'employee@example.com',
        subject: requesterEmailSubject,
        body: requesterEmailBody,
        html: requesterHtml
      });

      // In-app notification to Requester
      await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          orderInfo.requester_id,
          'Items Delivered & Received',
          `Items for PO ${po.po_number} have been marked as completed. 180-day warranty coverage is now active.`,
          'PR_APPROVED'
        ]
      );

      // 2. Send Post-Purchase Email to Vendor
      const vendorEmailSubject = `[VendSphere] Order Fulfillment Completed: ${po.po_number}`;
      const vendorEmailBody = `
Dear ${orderInfo.vendor_name},

This official receipt confirms that shipment for Purchase Order ${po.po_number} has been received, inspected, and fully accepted by company procurement.

Details:
- PO Number: ${po.po_number}
- Total Value: INR ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Receipt Date: ${deliveryDate.toLocaleDateString()}
- Inspection Notes: ${notes || 'Goods delivered in good condition.'}

Thank you for your timely partnership and fulfillment.

Regards,
Corporate Procurement Department
      `.trim();

      const vendorHtml = wrapHtmlEmail({
        title: `Order Fulfillment Completed: ${po.po_number}`,
        subtitle: `Receipt confirmed for ${orderInfo.vendor_name}`,
        badgeText: 'Completed',
        badgeType: 'success',
        contentHtml: `
          <p>Dear <strong>${orderInfo.vendor_name}</strong>,</p>
          <p>This official receipt confirms that shipment for Purchase Order <strong>${po.po_number}</strong> has been received, inspected, and fully accepted by company procurement.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 6px 0;"><strong>PO Number:</strong> ${po.po_number}</p>
            <p style="margin: 0 0 6px 0;"><strong>Total Value:</strong> INR ${parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p style="margin: 0;"><strong>Inspection Notes:</strong> ${notes || 'Goods delivered in good condition.'}</p>
          </div>
          <p>Thank you for your timely partnership and fulfillment.</p>
        `
      });

      await sendEmailNotification({
        dbClient: client,
        poId: po.id,
        emailType: 'PURCHASE_COMPLETED_VENDOR',
        toEmail: orderInfo.vendor_email || 'vendor@example.com',
        subject: vendorEmailSubject,
        body: vendorEmailBody,
        html: vendorHtml
      });

      // In-app notification to Vendor
      if (orderInfo.vendor_user_id) {
        await client.query(
          `INSERT INTO notifications (user_id, title, message, type)
           VALUES ($1, $2, $3, $4)`,
          [
            orderInfo.vendor_user_id,
            'Purchase Order Completed',
            `Purchase Order ${po.po_number} has been logged as fully completed/received.`,
            'PO_ACCEPTED'
          ]
        );
      }
    }

    await client.commit();
    res.json(completedPo.rows[0]);

  } catch (error) {
    await client.rollback();
    console.error('Failed to complete PO:', error);
    res.status(500).json({ error: 'Failed to complete Purchase Order.' });
  }
});

// GET /api/purchase-orders/:id/emails - Fetch simulated emails for a PO
router.get('/:id/emails', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await req.db.query(
      'SELECT * FROM simulated_emails WHERE po_id = $1 ORDER BY sent_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to retrieve simulated emails:', error);
    res.status(500).json({ error: 'Failed to retrieve email logs.' });
  }
});

export default router;
