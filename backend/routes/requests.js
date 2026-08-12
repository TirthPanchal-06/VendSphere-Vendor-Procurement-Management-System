import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/purchase-requests - List purchase requests
router.get('/', auth, async (req, res) => {
  const { status } = req.query;
  const { role, id: userId } = req.user;

  let queryText = `
    SELECT pr.*, u.name as requester_name 
    FROM purchase_requests pr
    LEFT JOIN users u ON pr.requester_id = u.id
  `;
  const queryParams = [];

  // Filter: Employees can only see their own requests.
  // Managers, Procurement Managers, and Admins can see all.
  if (role === 'Employee' || role === 'Vendor') {
    queryParams.push(userId);
    queryText += ` WHERE pr.requester_id = $${queryParams.length}`;
  }

  // Filter by status if provided
  if (status) {
    if (queryParams.length > 0) {
      queryParams.push(status);
      queryText += ` AND pr.status = $${queryParams.length}`;
    } else {
      queryParams.push(status);
      queryText += ` WHERE pr.status = $${queryParams.length}`;
    }
  }

  // If the user is an Approver/Manager, highlight requests pending their action
  if (role === 'Manager' || role === 'Admin' || role === 'ProcurementManager') {
    // If the path includes a pending filter, show what needs their attention
    if (req.query.pendingOnly === 'true') {
      if (queryParams.length > 0) {
        queryParams.push(userId);
        queryText += ` AND pr.current_approver_id = $${queryParams.length}`;
      } else {
        queryParams.push(userId);
        queryText += ` WHERE pr.current_approver_id = $${queryParams.length}`;
      }
    }
  }

  queryText += ' ORDER BY pr.created_at DESC';

  try {
    const result = await req.db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to query purchase requests:', error);
    res.status(500).json({ error: 'Failed to retrieve purchase requests.' });
  }
});

// GET /api/purchase-requests/:id - Detailed view with logs
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const prRes = await req.db.query(
      `SELECT pr.*, u.name as requester_name 
       FROM purchase_requests pr 
       LEFT JOIN users u ON pr.requester_id = u.id 
       WHERE pr.id = $1`,
      [id]
    );

    if (prRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase request not found.' });
    }

    const pr = prRes.rows[0];

    // Fetch approval logs
    const logsRes = await req.db.query(
      `SELECT al.*, u.name as approver_name, u.role as approver_role 
       FROM approval_logs al
       LEFT JOIN users u ON al.approver_id = u.id
       WHERE al.request_id = $1
       ORDER BY al.created_at ASC`,
      [id]
    );

    res.json({
      ...pr,
      logs: logsRes.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve purchase request details.' });
  }
});

// POST /api/purchase-requests - Create a new request in Draft mode
router.post('/', auth, authorize('Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee'), async (req, res) => {
  const { title, description, items, totalEstimatedCost } = req.body;

  if (!title || !items || !Array.isArray(items) || items.length === 0 || !totalEstimatedCost) {
    return res.status(400).json({ error: 'Title, items array, and total cost are required.' });
  }

  try {
    // Generate sequential PR number (e.g. PR-2026-0001)
    const countRes = await req.db.query('SELECT COUNT(*) FROM purchase_requests');
    const seq = parseInt(countRes.rows[0].count) + 1;
    const prNumber = `PR-${new Date().getFullYear()}-${seq.toString().padStart(4, '0')}`;

    const result = await req.db.query(
      `INSERT INTO purchase_requests (pr_number, title, description, requester_id, items, total_estimated_cost, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [prNumber, title, description || '', req.user.id, JSON.stringify(items), totalEstimatedCost, 'Draft']
    );

    // Write Activity Log
    await req.db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_PR', `Created PR ${prNumber} - Cost: ${totalEstimatedCost}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to create PR:', error);
    res.status(500).json({ error: 'Failed to create purchase request.' });
  }
});

// POST /api/purchase-requests/:id/submit - Submit purchase request to active approval workflow
router.post('/:id/submit', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Find the PR
    const prRes = await req.db.query('SELECT * FROM purchase_requests WHERE id = $1', [id]);
    if (prRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase request not found.' });
    }

    const pr = prRes.rows[0];
    
    // Check if requester is matching
    if (pr.requester_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You can only submit your own requests.' });
    }

    if (pr.status !== 'Draft' && pr.status !== 'Rejected') {
      return res.status(400).json({ error: 'Only Draft or Rejected requests can be submitted.' });
    }

    // 2. Query approval workflows to find matching threshold rule
    const cost = parseFloat(pr.total_estimated_cost);
    const workflowRes = await req.db.query(
      'SELECT * FROM approval_workflows WHERE threshold_amount <= $1 ORDER BY threshold_amount DESC LIMIT 1',
      [cost]
    );

    let nextStatus = 'Approved'; // Default to approved if no rules exist
    let currentApproverId = null;

    if (workflowRes.rows.length > 0) {
      const workflow = workflowRes.rows[0];
      const steps = workflow.steps; // Array e.g. [{step_number: 1, role: 'Manager'}]

      if (steps && steps.length > 0) {
        nextStatus = 'Pending Approval';
        
        // Find user with that role in this tenant
        const targetRole = steps[0].role;
        const approverUserRes = await req.db.query(
          'SELECT id FROM users WHERE role = $1 AND status = \'Active\' LIMIT 1',
          [targetRole]
        );

        if (approverUserRes.rows.length > 0) {
          currentApproverId = approverUserRes.rows[0].id;
        } else {
          // Fallback: If no user found with that role, assign to Admin
          const adminUserRes = await req.db.query(
            'SELECT id FROM users WHERE role = \'Admin\' AND status = \'Active\' LIMIT 1'
          );
          currentApproverId = adminUserRes.rows[0].id;
        }
      }
    }

    // 3. Update PR status
    const updatedPr = await req.db.query(
      `UPDATE purchase_requests 
       SET status = $1, current_approver_id = $2 
       WHERE id = $3 
       RETURNING *`,
      [nextStatus, currentApproverId, id]
    );

    // 4. Create Notification
    if (currentApproverId) {
      await req.db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          currentApproverId, 
          'Approval Action Required', 
          `Purchase request ${pr.pr_number} (₹${cost}) requires your review.`, 
          'PR_PENDING'
        ]
      );
    } else {
      // Auto approved
      await req.db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          pr.requester_id, 
          'Purchase Request Approved', 
          `Your purchase request ${pr.pr_number} has been auto-approved (no workflow threshold triggered).`, 
          'PR_APPROVED'
        ]
      );
    }

    // Write Activity Log
    await req.db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'SUBMIT_PR', `Submitted PR ${pr.pr_number} for approvals.`]
    );

    res.json(updatedPr.rows[0]);

  } catch (error) {
    console.error('Failed to submit PR:', error);
    res.status(500).json({ error: 'Failed to submit purchase request.' });
  }
});

// POST /api/purchase-requests/:id/approve - Approve purchase request
router.post('/:id/approve', auth, authorize('Admin', 'Company Admin', 'Manager', 'ProcurementManager'), async (req, res) => {
  const { id } = req.params;
  const { comments } = req.body;

  try {
    const prRes = await req.db.query('SELECT * FROM purchase_requests WHERE id = $1', [id]);
    if (prRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase request not found.' });
    }

    const pr = prRes.rows[0];

    if (pr.status !== 'Pending Approval') {
      return res.status(400).json({ error: 'This purchase request is not pending approval.' });
    }

    if (pr.current_approver_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You are not authorized to approve this request.' });
    }

    // 1. Insert approval log
    await req.db.query(
      'INSERT INTO approval_logs (request_id, approver_id, action, comments) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, 'Approved', comments || 'Approved.']
    );

    // 2. Determine if there is a next level in the workflow
    const cost = parseFloat(pr.total_estimated_cost);
    const workflowRes = await req.db.query(
      'SELECT * FROM approval_workflows WHERE threshold_amount <= $1 ORDER BY threshold_amount DESC LIMIT 1',
      [cost]
    );

    let nextStatus = 'Approved';
    let nextApproverId = null;

    if (workflowRes.rows.length > 0) {
      const workflow = workflowRes.rows[0];
      const steps = workflow.steps; // [{step_number: 1, role: 'Manager'}, {step_number: 2, role: 'Admin'}]

      // Find current step number based on log counts
      const countRes = await req.db.query(
        'SELECT COUNT(*) FROM approval_logs WHERE request_id = $1 AND action = \'Approved\'',
        [id]
      );
      const approvedCount = parseInt(countRes.rows[0].count); // e.g. 1 approved count

      if (approvedCount < steps.length) {
        nextStatus = 'Pending Approval';
        const nextStep = steps[approvedCount]; // gets index [1] which is step 2
        
        // Find next approver user
        const targetRole = nextStep.role;
        const approverUserRes = await req.db.query(
          'SELECT id FROM users WHERE role = $1 AND status = \'Active\' LIMIT 1',
          [targetRole]
        );

        if (approverUserRes.rows.length > 0) {
          nextApproverId = approverUserRes.rows[0].id;
        } else {
          // Fallback to Admin
          const adminUserRes = await req.db.query(
            'SELECT id FROM users WHERE role = \'Admin\' AND status = \'Active\' LIMIT 1'
          );
          nextApproverId = adminUserRes.rows[0].id;
        }
      }
    }

    // 3. Update PR status
    const updatedPr = await req.db.query(
      `UPDATE purchase_requests 
       SET status = $1, current_approver_id = $2 
       WHERE id = $3 
       RETURNING *`,
      [nextStatus, nextApproverId, id]
    );

    // 4. Send notifications
    if (nextStatus === 'Approved') {
      // Notify requester
      await req.db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          pr.requester_id, 
          'Purchase Request Approved', 
          `Your request ${pr.pr_number} has been fully approved. Ready for quotation sourcing.`, 
          'PR_APPROVED'
        ]
      );
      // Notify all Procurement Managers
      const PMs = await req.db.query('SELECT id FROM users WHERE role = \'ProcurementManager\' AND status = \'Active\'');
      for (const pm of PMs.rows) {
        await req.db.query(
          'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
          [
            pm.id, 
            'Approved Purchase Request Pending Sourcing', 
            `Request ${pr.pr_number} has been approved. You can now generate an RFQ.`, 
            'PR_APPROVED'
          ]
        );
      }
    } else if (nextApproverId) {
      // Notify next approver
      await req.db.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          nextApproverId, 
          'Escalated Approval Required', 
          `Escalated: Purchase request ${pr.pr_number} requires your level approval.`, 
          'PR_PENDING'
        ]
      );
    }

    // Write Activity Log
    await req.db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'APPROVE_PR', `Approved PR ${pr.pr_number}. Stage: ${nextStatus}`]
    );

    res.json(updatedPr.rows[0]);

  } catch (error) {
    console.error('PR approval failed:', error);
    res.status(500).json({ error: 'Failed to approve purchase request.' });
  }
});

// POST /api/purchase-requests/:id/reject - Reject purchase request
router.post('/:id/reject', auth, authorize('Admin', 'Company Admin', 'Manager', 'ProcurementManager'), async (req, res) => {
  const { id } = req.params;
  const { comments } = req.body;

  if (!comments) {
    return res.status(400).json({ error: 'Rejection comments are required.' });
  }

  try {
    const prRes = await req.db.query('SELECT * FROM purchase_requests WHERE id = $1', [id]);
    if (prRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase request not found.' });
    }

    const pr = prRes.rows[0];

    if (pr.status !== 'Pending Approval') {
      return res.status(400).json({ error: 'This purchase request is not pending approval.' });
    }

    if (pr.current_approver_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'You are not authorized to reject this request.' });
    }

    // 1. Insert rejection log
    await req.db.query(
      'INSERT INTO approval_logs (request_id, approver_id, action, comments) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, 'Rejected', comments]
    );

    // 2. Set status to Rejected
    const updatedPr = await req.db.query(
      'UPDATE purchase_requests SET status = \'Rejected\', current_approver_id = NULL WHERE id = $1 RETURNING *',
      [id]
    );

    // 3. Notify requester
    await req.db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [
        pr.requester_id, 
        'Purchase Request Rejected', 
        `Your request ${pr.pr_number} was rejected. Reason: ${comments}`, 
        'PR_REJECTED'
      ]
    );

    // Write Activity Log
    await req.db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'REJECT_PR', `Rejected PR ${pr.pr_number}. Reason: ${comments}`]
    );

    res.json(updatedPr.rows[0]);

  } catch (error) {
    console.error('PR rejection failed:', error);
    res.status(500).json({ error: 'Failed to reject purchase request.' });
  }
});

// GET /api/purchase-requests/workflows - List approval workflows
router.get('/workflows/all', auth, async (req, res) => {
  try {
    const result = await req.db.query('SELECT * FROM approval_workflows ORDER BY threshold_amount ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve approval workflows.' });
  }
});

// POST /api/purchase-requests/workflows - Create approval workflow
router.post('/workflows/all', auth, authorize('Admin', 'Company Admin'), async (req, res) => {
  const { name, thresholdAmount, steps } = req.body;

  if (!name || thresholdAmount === undefined || !steps || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Name, thresholdAmount, and steps array are required.' });
  }

  try {
    const result = await req.db.query(
      'INSERT INTO approval_workflows (name, threshold_amount, steps) VALUES ($1, $2, $3) RETURNING *',
      [name, thresholdAmount, JSON.stringify(steps)]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create approval workflow.' });
  }
});

export default router;
