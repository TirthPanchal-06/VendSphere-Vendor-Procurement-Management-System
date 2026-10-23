import express from 'express';
import { auth, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper to notify a specific user
const createNotification = async (db, userId, title, message, type) => {
  if (!userId) return;
  try {
    await db.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [userId, title, message, type]
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

// Helper to notify active managers and admins
const notifyManagersAndAdmins = async (db, title, message, type, excludeUserId = null) => {
  try {
    let query = "SELECT id FROM users WHERE role IN ('Admin', 'ProcurementManager', 'Manager') AND status = 'Active'";
    const params = [];
    if (excludeUserId) {
      params.push(excludeUserId);
      query += ' AND id != $1';
    }
    const res = await db.query(query, params);
    for (const row of res.rows) {
      await createNotification(db, row.id, title, message, type);
    }
  } catch (err) {
    console.error('Failed to notify managers/admins:', err);
  }
};

// GET /api/queries/delivered-orders - Eligible delivered POs for feedback
router.get('/delivered-orders', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let queryText = `
      SELECT po.id, po.po_number, po.total_amount, po.status as po_status, po.delivery_notes, po.created_at,
             v.name as vendor_name, v.email as vendor_email,
             pr.id as pr_id, pr.pr_number, pr.title as pr_title, pr.items as pr_items, pr.requester_id,
             u.name as requester_name,
             (SELECT COUNT(*) FROM order_feedback_queries q WHERE q.purchase_order_id = po.id) as feedback_count,
             (SELECT q.id FROM order_feedback_queries q WHERE q.purchase_order_id = po.id AND q.employee_id = $1 LIMIT 1) as my_feedback_id
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      LEFT JOIN users u ON pr.requester_id = u.id
      WHERE po.status = 'Completed'
    `;

    const queryParams = [userId];

    // If Employee, prioritize orders they requested
    if (role === 'Employee') {
      // Return completed orders
      queryText += ' ORDER BY (pr.requester_id = $1) DESC, po.created_at DESC';
    } else {
      queryText += ' ORDER BY po.created_at DESC';
    }

    const result = await req.db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch delivered orders:', error);
    res.status(500).json({ error: 'Failed to retrieve delivered purchase orders.' });
  }
});

// GET /api/queries/assignees - Staff members eligible for query assignment
router.get('/assignees', auth, authorize('Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT id, name, email, role, department 
       FROM users 
       WHERE role IN ('Admin', 'ProcurementManager', 'Manager') AND status = 'Active' 
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to retrieve assignees:', error);
    res.status(500).json({ error: 'Failed to retrieve eligible staff members.' });
  }
});

// GET /api/queries/stats/summary - Metrics summary
router.get('/stats/summary', auth, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    let whereClause = '';
    const params = [];

    if (role === 'Employee') {
      params.push(userId);
      whereClause = ' WHERE employee_id = $1';
    }

    const statsRes = await req.db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Open' THEN 1 END) as open,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'Resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed,
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0) as average_rating
       FROM order_feedback_queries
       ${whereClause}`,
      params
    );

    res.json(statsRes.rows[0]);
  } catch (error) {
    console.error('Failed to fetch query statistics:', error);
    res.status(500).json({ error: 'Failed to retrieve feedback statistics.' });
  }
});

// GET /api/queries - List all feedback and queries
router.get('/', auth, async (req, res) => {
  const { role, id: userId } = req.user;
  const { status, priority, category, poId, search } = req.query;

  try {
    let queryText = `
      SELECT q.*,
             po.po_number, po.delivery_notes, po.total_amount as po_total_amount, po.status as po_status,
             pr.pr_number, pr.title as pr_title,
             v.name as vendor_name,
             emp.name as employee_name, emp.email as employee_email, emp.department as employee_dept,
             assignee.name as assignee_name, assignee.email as assignee_email, assignee.role as assignee_role,
             resolver.name as resolver_name, resolver.email as resolver_email
      FROM order_feedback_queries q
      JOIN purchase_orders po ON q.purchase_order_id = po.id
      LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
      LEFT JOIN vendors v ON po.vendor_id = v.id
      JOIN users emp ON q.employee_id = emp.id
      LEFT JOIN users assignee ON q.assigned_to = assignee.id
      LEFT JOIN users resolver ON q.resolved_by = resolver.id
      WHERE 1=1
    `;

    const queryParams = [];

    // Role-based visibility
    if (role === 'Employee') {
      queryParams.push(userId);
      queryText += ` AND q.employee_id = $${queryParams.length}`;
    }

    if (status && status !== 'All') {
      queryParams.push(status);
      queryText += ` AND q.status = $${queryParams.length}`;
    }

    if (priority && priority !== 'All') {
      queryParams.push(priority);
      queryText += ` AND q.query_priority = $${queryParams.length}`;
    }

    if (category && category !== 'All') {
      queryParams.push(category);
      queryText += ` AND q.query_category = $${queryParams.length}`;
    }

    if (poId) {
      queryParams.push(poId);
      queryText += ` AND q.purchase_order_id = $${queryParams.length}`;
    }

    if (search && search.trim()) {
      queryParams.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = queryParams.length;
      queryText += ` AND (
        LOWER(q.query_subject) LIKE $${pIdx} OR 
        LOWER(q.query_description) LIKE $${pIdx} OR 
        LOWER(po.po_number) LIKE $${pIdx} OR 
        LOWER(v.name) LIKE $${pIdx} OR 
        LOWER(emp.name) LIKE $${pIdx}
      )`;
    }

    queryText += ' ORDER BY q.created_at DESC';

    const result = await req.db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list feedback & queries:', error);
    res.status(500).json({ error: 'Failed to retrieve queries and feedback.' });
  }
});

// GET /api/queries/:id - Retrieve specific query with timeline activities
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  try {
    const result = await req.db.query(
      `SELECT q.*,
              po.po_number, po.delivery_notes, po.total_amount as po_total_amount, po.status as po_status, po.created_at as po_created_at,
              pr.pr_number, pr.title as pr_title, pr.items as pr_items,
              v.name as vendor_name, v.email as vendor_email, v.phone as vendor_phone,
              emp.name as employee_name, emp.email as employee_email, emp.department as employee_dept,
              assignee.name as assignee_name, assignee.email as assignee_email, assignee.role as assignee_role,
              resolver.name as resolver_name, resolver.email as resolver_email, resolver.role as resolver_role
       FROM order_feedback_queries q
       JOIN purchase_orders po ON q.purchase_order_id = po.id
       LEFT JOIN purchase_requests pr ON po.purchase_request_id = pr.id
       LEFT JOIN vendors v ON po.vendor_id = v.id
       JOIN users emp ON q.employee_id = emp.id
       LEFT JOIN users assignee ON q.assigned_to = assignee.id
       LEFT JOIN users resolver ON q.resolved_by = resolver.id
       WHERE q.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Query or feedback record not found.' });
    }

    const query = result.rows[0];

    // Assert employee security boundary
    if (role === 'Employee' && query.employee_id !== userId) {
      return res.status(403).json({ error: 'Access denied to this query record.' });
    }

    // Retrieve activity timeline and responses
    const activitiesRes = await req.db.query(
      `SELECT a.*, u.name as user_name, u.role as user_role, u.email as user_email
       FROM query_activities a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.query_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      ...query,
      activities: activitiesRes.rows
    });
  } catch (error) {
    console.error('Failed to retrieve query details:', error);
    res.status(500).json({ error: 'Failed to retrieve query details.' });
  }
});

// POST /api/queries - Submit new feedback & query linked to a delivered PO
router.post('/', auth, async (req, res) => {
  const {
    purchaseOrderId,
    rating,
    feedback,
    querySubject,
    queryCategory,
    queryPriority = 'Medium',
    queryDescription
  } = req.body;

  if (!purchaseOrderId || !rating || !feedback || !querySubject || !queryCategory || !queryDescription) {
    return res.status(400).json({ error: 'Purchase Order, Rating, Feedback, Subject, Category, and Description are required.' });
  }

  const numRating = parseInt(rating, 10);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }

  const client = await req.db.getTransaction();

  try {
    // 1. Verify PO exists and is Completed (delivered)
    const poRes = await client.query(
      'SELECT id, po_number, status, vendor_id FROM purchase_orders WHERE id = $1',
      [purchaseOrderId]
    );

    if (poRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const po = poRes.rows[0];
    if (po.status !== 'Completed') {
      client.release();
      return res.status(400).json({
        error: `Feedback can only be submitted for delivered Purchase Orders (Current status: ${po.status}).`
      });
    }

    // 2. Insert into order_feedback_queries
    const insertRes = await client.query(
      `INSERT INTO order_feedback_queries
       (purchase_order_id, employee_id, rating, feedback, query_subject, query_category, query_priority, query_description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open')
       RETURNING *`,
      [purchaseOrderId, req.user.id, numRating, feedback.trim(), querySubject.trim(), queryCategory.trim(), queryPriority, queryDescription.trim()]
    );

    const newQuery = insertRes.rows[0];

    // 3. Record creation event in query_activities
    await client.query(
      `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, 'CREATED', $3, NULL, 'Open')`,
      [newQuery.id, req.user.id, `Submitted post-delivery feedback (Rating: ${numRating}/5) and query: ${querySubject.trim()}`]
    );

    // 4. Log in activity_logs
    await client.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'SUBMIT_FEEDBACK_QUERY', `Submitted feedback and query on order ${po.po_number}`]
    );

    await client.commit();

    // 5. Notify managers & admins in background
    notifyManagersAndAdmins(
      req.db,
      'New Delivery Feedback & Query',
      `${req.user.name || 'An employee'} submitted feedback (Rating: ${numRating}/5) and query "${querySubject.trim()}" for ${po.po_number}.`,
      'QUERY_CREATED',
      req.user.id
    );

    res.status(201).json(newQuery);
  } catch (error) {
    await client.rollback();
    console.error('Failed to submit query:', error);
    res.status(500).json({ error: 'Failed to submit feedback and query.' });
  }
});

// PUT /api/queries/:id/assign - Assign query to Manager / Admin
router.put('/:id/assign', auth, authorize('Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return res.status(400).json({ error: 'Target assignee user ID is required.' });
  }

  const client = await req.db.getTransaction();

  try {
    const qRes = await client.query(
      `SELECT q.*, po.po_number, emp.name as employee_name, emp.id as employee_id 
       FROM order_feedback_queries q
       JOIN purchase_orders po ON q.purchase_order_id = po.id
       JOIN users emp ON q.employee_id = emp.id
       WHERE q.id = $1`,
      [id]
    );

    if (qRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Query record not found.' });
    }

    const currentQuery = qRes.rows[0];

    // Verify assignee exists
    const userRes = await client.query('SELECT id, name, email, role FROM users WHERE id = $1', [assignedTo]);
    if (userRes.rows.length === 0) {
      client.release();
      return res.status(400).json({ error: 'Selected assignee user does not exist.' });
    }
    const assignee = userRes.rows[0];

    // If query is 'Open', transition to 'In Progress' automatically
    let nextStatus = currentQuery.status;
    if (currentQuery.status === 'Open') {
      nextStatus = 'In Progress';
    }

    const updateRes = await client.query(
      `UPDATE order_feedback_queries 
       SET assigned_to = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING *`,
      [assignedTo, nextStatus, id]
    );

    // Record activity
    await client.query(
      `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, 'ASSIGNED', $3, $4, $5)`,
      [id, req.user.id, `Query assigned to ${assignee.name} (${assignee.role}).`, currentQuery.status, nextStatus]
    );

    await client.commit();

    // Send notifications
    createNotification(
      req.db,
      assignee.id,
      'Query Assigned to You',
      `Query "${currentQuery.query_subject}" for ${currentQuery.po_number} has been assigned to you for investigation.`,
      'QUERY_ASSIGNED'
    );

    createNotification(
      req.db,
      currentQuery.employee_id,
      'Query In Review',
      `Your query "${currentQuery.query_subject}" for order ${currentQuery.po_number} has been assigned to ${assignee.name} for review.`,
      'QUERY_IN_PROGRESS'
    );

    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.rollback();
    console.error('Failed to assign query:', error);
    res.status(500).json({ error: 'Failed to assign query.' });
  }
});

// PUT /api/queries/:id/status - Update query status (Open, In Progress, Resolved, Closed)
router.put('/:id/status', auth, authorize('Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const client = await req.db.getTransaction();

  try {
    const qRes = await client.query(
      `SELECT q.*, po.po_number 
       FROM order_feedback_queries q 
       JOIN purchase_orders po ON q.purchase_order_id = po.id 
       WHERE q.id = $1`,
      [id]
    );

    if (qRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Query record not found.' });
    }

    const currentQuery = qRes.rows[0];
    const prevStatus = currentQuery.status;

    let resolvedBy = currentQuery.resolved_by;
    let resolvedAt = currentQuery.resolved_at;

    if (status === 'Resolved' || status === 'Closed') {
      if (!resolvedBy) {
        resolvedBy = req.user.id;
        resolvedAt = new Date();
      }
    } else {
      // If reopening to Open or In Progress, reset resolution info
      resolvedBy = null;
      resolvedAt = null;
    }

    const updateRes = await client.query(
      `UPDATE order_feedback_queries 
       SET status = $1, resolved_by = $2, resolved_at = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [status, resolvedBy, resolvedAt, id]
    );

    await client.query(
      `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, 'STATUS_CHANGE', $3, $4, $5)`,
      [id, req.user.id, notes || `Status changed from ${prevStatus} to ${status}.`, prevStatus, status]
    );

    await client.commit();

    // Notify employee of status update
    createNotification(
      req.db,
      currentQuery.employee_id,
      `Query Status: ${status}`,
      `Your query "${currentQuery.query_subject}" for ${currentQuery.po_number} is now marked as ${status}.`,
      'QUERY_STATUS_UPDATE'
    );

    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.rollback();
    console.error('Failed to update query status:', error);
    res.status(500).json({ error: 'Failed to update query status.' });
  }
});

// PUT /api/queries/:id/resolve - Resolve query with official resolution notes
router.put('/:id/resolve', auth, authorize('Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;
  const { resolutionNotes, targetStatus = 'Resolved' } = req.body;

  if (!resolutionNotes || !resolutionNotes.trim()) {
    return res.status(400).json({ error: 'Resolution response notes are required.' });
  }

  const client = await req.db.getTransaction();

  try {
    const qRes = await client.query(
      `SELECT q.*, po.po_number 
       FROM order_feedback_queries q 
       JOIN purchase_orders po ON q.purchase_order_id = po.id 
       WHERE q.id = $1`,
      [id]
    );

    if (qRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Query record not found.' });
    }

    const currentQuery = qRes.rows[0];

    const updateRes = await client.query(
      `UPDATE order_feedback_queries 
       SET status = $1, resolution_notes = $2, resolved_by = $3, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [targetStatus, resolutionNotes.trim(), req.user.id, id]
    );

    await client.query(
      `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, 'RESOLVED', $3, $4, $5)`,
      [id, req.user.id, `Resolution response provided: ${resolutionNotes.trim()}`, currentQuery.status, targetStatus]
    );

    await client.commit();

    // Notify employee
    createNotification(
      req.db,
      currentQuery.employee_id,
      'Query Resolved',
      `Your query "${currentQuery.query_subject}" has been resolved. Resolution: ${resolutionNotes.trim().slice(0, 100)}...`,
      'QUERY_RESOLVED'
    );

    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.rollback();
    console.error('Failed to resolve query:', error);
    res.status(500).json({ error: 'Failed to resolve query.' });
  }
});

// PUT /api/queries/:id - Edit query details
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;
  const {
    querySubject,
    queryCategory,
    queryPriority,
    queryDescription,
    feedback,
    rating
  } = req.body;

  try {
    const qRes = await req.db.query('SELECT * FROM order_feedback_queries WHERE id = $1', [id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ error: 'Query record not found.' });
    }

    const currentQuery = qRes.rows[0];

    // Security: Employee can only edit their own query if it is still Open
    if (role === 'Employee') {
      if (currentQuery.employee_id !== userId) {
        return res.status(403).json({ error: 'Access denied.' });
      }
      if (currentQuery.status !== 'Open') {
        return res.status(400).json({ error: 'Cannot edit query after review or resolution has started.' });
      }
    }

    const newSubject = querySubject !== undefined ? querySubject.trim() : currentQuery.query_subject;
    const newCategory = queryCategory !== undefined ? queryCategory.trim() : currentQuery.query_category;
    const newPriority = queryPriority !== undefined ? queryPriority : currentQuery.query_priority;
    const newDescription = queryDescription !== undefined ? queryDescription.trim() : currentQuery.query_description;
    const newFeedback = feedback !== undefined ? feedback.trim() : currentQuery.feedback;
    const newRating = rating !== undefined ? parseInt(rating, 10) : currentQuery.rating;

    const updateRes = await req.db.query(
      `UPDATE order_feedback_queries 
       SET query_subject = $1, query_category = $2, query_priority = $3, 
           query_description = $4, feedback = $5, rating = $6, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 
       RETURNING *`,
      [newSubject, newCategory, newPriority, newDescription, newFeedback, newRating, id]
    );

    await req.db.query(
      `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, 'EDITED', 'Query ticket details updated.', $3, $3)`,
      [id, userId, currentQuery.status]
    );

    res.json(updateRes.rows[0]);
  } catch (error) {
    console.error('Failed to edit query:', error);
    res.status(500).json({ error: 'Failed to update query details.' });
  }
});

// POST /api/queries/:id/response - Add a discussion message / response to timeline
router.post('/:id/response', auth, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const { role, id: userId, name: userName } = req.user;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Response message text is required.' });
  }

  try {
    const qRes = await req.db.query(
      `SELECT q.*, po.po_number 
       FROM order_feedback_queries q 
       JOIN purchase_orders po ON q.purchase_order_id = po.id 
       WHERE q.id = $1`,
      [id]
    );

    if (qRes.rows.length === 0) {
      return res.status(404).json({ error: 'Query record not found.' });
    }

    const currentQuery = qRes.rows[0];

    // Security: Employee can only respond to their own query
    if (role === 'Employee' && currentQuery.employee_id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const actRes = await req.db.query(
      `INSERT INTO query_activities (query_id, user_id, action_type, notes, previous_status, new_status)
       VALUES ($1, $2, 'RESPONSE', $3, $4, $4)
       RETURNING *`,
      [id, userId, message.trim(), currentQuery.status]
    );

    // Notify other party
    if (role === 'Employee') {
      if (currentQuery.assigned_to) {
        createNotification(
          req.db,
          currentQuery.assigned_to,
          'Employee Reply on Query',
          `${userName || 'Employee'} posted a reply on query "${currentQuery.query_subject}".`,
          'QUERY_REPLY'
        );
      } else {
        notifyManagersAndAdmins(
          req.db,
          'Employee Reply on Query',
          `${userName || 'Employee'} posted a reply on query "${currentQuery.query_subject}".`,
          'QUERY_REPLY',
          userId
        );
      }
    } else {
      createNotification(
        req.db,
        currentQuery.employee_id,
        'Staff Response on Your Query',
        `${userName || 'Management'} posted a response on your query "${currentQuery.query_subject}".`,
        'QUERY_REPLY'
      );
    }

    res.status(201).json(actRes.rows[0]);
  } catch (error) {
    console.error('Failed to post query response:', error);
    res.status(500).json({ error: 'Failed to post response.' });
  }
});

// DELETE /api/queries/:id - Delete query
router.delete('/:id', auth, authorize('Admin', 'ProcurementManager', 'Manager'), async (req, res) => {
  const { id } = req.params;

  try {
    const qRes = await req.db.query(
      `SELECT q.*, po.po_number 
       FROM order_feedback_queries q 
       JOIN purchase_orders po ON q.purchase_order_id = po.id 
       WHERE q.id = $1`,
      [id]
    );

    if (qRes.rows.length === 0) {
      return res.status(404).json({ error: 'Query record not found.' });
    }

    const currentQuery = qRes.rows[0];

    // Delete query (cascades to activities)
    await req.db.query('DELETE FROM order_feedback_queries WHERE id = $1', [id]);

    await req.db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'DELETE_FEEDBACK_QUERY', `Deleted query #${id} for order ${currentQuery.po_number}`]
    );

    res.json({ message: 'Query deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete query:', error);
    res.status(500).json({ error: 'Failed to delete query record.' });
  }
});

export default router;
