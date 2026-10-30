import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Star,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  Trash2,
  Edit3,
  Search,
  Plus,
  X,
  Eye,
  Send,
  AlertTriangle,
  Check,
  PackageCheck
} from 'lucide-react';

export const Queries = () => {
  const { api, user } = useAuth();

  // Queries list and stats state
  const [queries, setQueries] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    average_rating: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delivered Orders (for submission dropdown)
  const [deliveredOrders, setDeliveredOrders] = useState([]);

  // Eligible Assignees (Managers & Admins)
  const [assignees, setAssignees] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState(null);

  // Create Form State
  const [selectedPoId, setSelectedPoId] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [querySubject, setQuerySubject] = useState('');
  const [queryCategory, setQueryCategory] = useState('Damaged Goods');
  const [queryPriority, setQueryPriority] = useState('Medium');
  const [queryDescription, setQueryDescription] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Detail Modal Actions State
  const [resolutionText, setResolutionText] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [newResponseNote, setNewResponseNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Edit Modal State
  const [editSubject, setEditSubject] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFeedback, setEditFeedback] = useState('');
  const [editRating, setEditRating] = useState(5);

  const isManagement = ['Admin', 'Company Admin', 'ProcurementManager', 'Manager'].includes(user?.role);

  // Fetch all queries
  const fetchQueries = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (priorityFilter !== 'All') params.priority = priorityFilter;
      if (categoryFilter !== 'All') params.category = categoryFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await api.get('/api/queries', { params });
      setQueries(res.data);
    } catch (err) {
      console.error('Failed to load queries:', err);
      setError('Failed to retrieve feedback and queries.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch summary stats
  const fetchStats = async () => {
    try {
      const res = await api.get('/api/queries/stats/summary');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load query stats:', err);
    }
  };

  // Fetch delivered purchase orders for creating feedback
  const fetchDeliveredOrders = async () => {
    try {
      const res = await api.get('/api/queries/delivered-orders');
      setDeliveredOrders(res.data);
      if (res.data.length > 0 && !selectedPoId) {
        setSelectedPoId(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch delivered orders:', err);
    }
  };

  // Fetch eligible assignees
  const fetchAssignees = async () => {
    if (!isManagement) return;
    try {
      const res = await api.get('/api/queries/assignees');
      setAssignees(res.data);
    } catch (err) {
      console.error('Failed to fetch assignees:', err);
    }
  };

  useEffect(() => {
    fetchQueries();
    fetchStats();
    fetchDeliveredOrders();
    fetchAssignees();
  }, [statusFilter, priorityFilter, categoryFilter, searchTerm]);

  // Open detail modal and load complete query data with timeline
  const handleOpenDetail = async (queryId) => {
    try {
      const res = await api.get(`/api/queries/${queryId}`);
      setSelectedQuery(res.data);
      setSelectedAssignee(res.data.assigned_to || '');
      setResolutionText(res.data.resolution_notes || '');
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to fetch query details:', err);
      setError('Failed to load query details.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (query) => {
    setSelectedQuery(query);
    setEditSubject(query.query_subject);
    setEditCategory(query.query_category);
    setEditPriority(query.query_priority);
    setEditDescription(query.query_description);
    setEditFeedback(query.feedback);
    setEditRating(query.rating);
    setShowEditModal(true);
  };

  // Submit new feedback & query
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPoId) {
      setError('Please select a delivered Purchase Order.');
      return;
    }
    setError('');
    setFormSubmitting(true);

    try {
      await api.post('/api/queries', {
        purchaseOrderId: selectedPoId,
        rating,
        feedback,
        querySubject,
        queryCategory,
        queryPriority,
        queryDescription
      });

      setSuccessMsg('Feedback and query submitted successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);

      setShowCreateModal(false);
      // Reset form
      setFeedback('');
      setQuerySubject('');
      setQueryDescription('');
      setRating(5);
      setQueryCategory('Damaged Goods');
      setQueryPriority('Medium');

      fetchQueries();
      fetchStats();
      fetchDeliveredOrders();
    } catch (err) {
      console.error('Failed to submit query:', err);
      setError(err.response?.data?.error || 'Failed to submit feedback and query.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Assign Query
  const handleAssignSubmit = async () => {
    if (!selectedAssignee || !selectedQuery) return;
    setSubmittingAction(true);
    try {
      await api.put(`/api/queries/${selectedQuery.id}/assign`, {
        assignedTo: selectedAssignee
      });
      setSuccessMsg(`Query assigned successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      handleOpenDetail(selectedQuery.id);
      fetchQueries();
      fetchStats();
    } catch (err) {
      console.error('Failed to assign query:', err);
      setError(err.response?.data?.error || 'Failed to assign query.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Update Status
  const handleStatusChange = async (nextStatus) => {
    if (!selectedQuery) return;
    setSubmittingAction(true);
    try {
      await api.put(`/api/queries/${selectedQuery.id}/status`, {
        status: nextStatus
      });
      setSuccessMsg(`Status updated to ${nextStatus}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      handleOpenDetail(selectedQuery.id);
      fetchQueries();
      fetchStats();
    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Resolve Query
  const handleResolveSubmit = async (targetStatus = 'Resolved') => {
    if (!resolutionText.trim() || !selectedQuery) {
      setError('Please enter official resolution notes.');
      return;
    }
    setSubmittingAction(true);
    try {
      await api.put(`/api/queries/${selectedQuery.id}/resolve`, {
        resolutionNotes: resolutionText.trim(),
        targetStatus
      });
      setSuccessMsg('Query resolved and employee notified.');
      setTimeout(() => setSuccessMsg(''), 3000);
      handleOpenDetail(selectedQuery.id);
      fetchQueries();
      fetchStats();
    } catch (err) {
      console.error('Failed to resolve query:', err);
      setError(err.response?.data?.error || 'Failed to resolve query.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Post Discussion Response Note
  const handlePostResponse = async (e) => {
    e.preventDefault();
    if (!newResponseNote.trim() || !selectedQuery) return;
    setSubmittingAction(true);
    try {
      await api.post(`/api/queries/${selectedQuery.id}/response`, {
        message: newResponseNote.trim()
      });
      setNewResponseNote('');
      handleOpenDetail(selectedQuery.id);
    } catch (err) {
      console.error('Failed to post response:', err);
      setError(err.response?.data?.error || 'Failed to post message.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Save Edit Query
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedQuery) return;
    setFormSubmitting(true);
    try {
      await api.put(`/api/queries/${selectedQuery.id}`, {
        querySubject: editSubject,
        queryCategory: editCategory,
        queryPriority: editPriority,
        queryDescription: editDescription,
        feedback: editFeedback,
        rating: editRating
      });
      setSuccessMsg('Query updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowEditModal(false);
      if (showDetailModal) {
        handleOpenDetail(selectedQuery.id);
      }
      fetchQueries();
      fetchStats();
    } catch (err) {
      console.error('Failed to edit query:', err);
      setError(err.response?.data?.error || 'Failed to update query.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Query
  const handleDeleteSubmit = async () => {
    if (!selectedQuery) return;
    setSubmittingAction(true);
    try {
      await api.delete(`/api/queries/${selectedQuery.id}`);
      setSuccessMsg('Query deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      setShowDeleteModal(false);
      setShowDetailModal(false);
      setSelectedQuery(null);
      fetchQueries();
      fetchStats();
    } catch (err) {
      console.error('Failed to delete query:', err);
      setError(err.response?.data?.error || 'Failed to delete query.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Star Rating Helper
  const renderStars = (value, size = 16) => {
    return (
      <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            style={{
              color: star <= value ? '#f59e0b' : 'var(--text-muted)',
              fill: star <= value ? '#f59e0b' : 'none'
            }}
          />
        ))}
        <span style={{ fontSize: '0.8rem', fontWeight: '700', marginLeft: '6px', color: 'var(--text-primary)' }}>
          {value}/5
        </span>
      </div>
    );
  };

  const getRatingLabel = (val) => {
    switch (val) {
      case 1: return '1 - Poor (Critical defects or substandard)';
      case 2: return '2 - Fair (Subpar quality or noticeable delays)';
      case 3: return '3 - Good (Acceptable standard delivery)';
      case 4: return '4 - Very Good (High quality & compliant)';
      case 5: return '5 - Excellent (Exceeded contract expectations)';
      default: return '';
    }
  };

  const selectedPoData = deliveredOrders.find((po) => po.id === selectedPoId);

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Employee Feedback & Queries</h1>
          <p className="page-subtitle">
            Submit delivery evaluations, report item discrepancies, and track query resolutions.
          </p>
        </div>
        <button
          onClick={() => {
            fetchDeliveredOrders();
            setShowCreateModal(true);
          }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} />
          <span>Submit Feedback & Query</span>
        </button>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span style={{ fontSize: '0.85rem' }}>{successMsg}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Total Submissions</div>
            <div className="kpi-value">{stats.total || 0}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
            <MessageSquare size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Open Inquiries</div>
            <div className="kpi-value" style={{ color: 'var(--accent)' }}>{stats.open || 0}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: 'var(--accent)' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">In Progress</div>
            <div className="kpi-value" style={{ color: 'var(--warning)' }}>{stats.in_progress || 0}</div>
          </div>
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <UserCheck size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Resolved & Closed</div>
            <div className="kpi-value" style={{ color: 'var(--success)' }}>
              {(parseInt(stats.resolved || 0) + parseInt(stats.closed || 0))}
            </div>
          </div>
          <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Avg Delivery Rating</div>
            <div className="kpi-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{parseFloat(stats.average_rating || 0).toFixed(1)}</span>
              <Star size={18} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            </div>
          </div>
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <PackageCheck size={20} />
          </div>
        </div>
      </div>

      {/* Main Glass Panel */}
      <div className="glass-panel">
        {/* Filter and Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`btn ${statusFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search & Select Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="form-select"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', width: 'auto' }}
            >
              <option value="All">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-select"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', width: 'auto' }}
            >
              <option value="All">All Categories</option>
              <option value="Damaged Goods">Damaged Goods</option>
              <option value="Missing Items">Missing Items</option>
              <option value="Wrong Specification">Wrong Specification</option>
              <option value="Packaging Issue">Packaging Issue</option>
              <option value="Delivery Delay">Delivery Delay</option>
              <option value="Invoice / Billing Discrepancy">Invoice Discrepancy</option>
              <option value="General Inquiry">General Inquiry</option>
            </select>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search PO, subject, employee..."
                className="form-input"
                style={{ paddingLeft: '2rem', paddingRight: '0.75rem', paddingBlock: '0.45rem', fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Employee / Requester</th>
                <th>Delivery Rating</th>
                <th>Subject & Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned Staff</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Loading feedback and queries...
                  </td>
                </tr>
              ) : queries.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={32} style={{ opacity: 0.4 }} />
                      <p style={{ fontSize: '0.9rem' }}>No feedback or queries found matching current filters.</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-secondary"
                        style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                      >
                        Submit Delivery Feedback
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                queries.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{q.po_number}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {q.pr_title || q.vendor_name}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '600' }}>{q.employee_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {q.employee_dept || q.employee_email}
                      </div>
                    </td>

                    <td>{renderStars(q.rating)}</td>

                    <td>
                      <div style={{ fontWeight: '600', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {q.query_subject}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {q.query_category}
                      </div>
                    </td>

                    <td>
                      <span className={`badge badge-priority-${q.query_priority.toLowerCase()}`}>
                        {q.query_priority}
                      </span>
                    </td>

                    <td>
                      <span className={`badge badge-${q.status.replace(/ /g, '-').toLowerCase()}`}>
                        {q.status}
                      </span>
                    </td>

                    <td>
                      {q.assignee_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserCheck size={14} style={{ color: 'var(--accent)' }} />
                          <span style={{ fontSize: '0.85rem' }}>{q.assignee_name}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(q.created_at).toLocaleDateString()}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleOpenDetail(q.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="View Details & Progress"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>

                        {(isManagement || (user?.role === 'Employee' && q.status === 'Open')) && (
                          <button
                            onClick={() => handleOpenEdit(q)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem' }}
                            title="Edit Query"
                          >
                            <Edit3 size={12} />
                          </button>
                        )}

                        {isManagement && (
                          <button
                            onClick={() => {
                              setSelectedQuery(q);
                              setShowDeleteModal(true);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem', color: 'var(--danger)' }}
                            title="Delete Query"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: SUBMIT FEEDBACK & QUERY
      ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Submit Delivery Feedback & Query</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Record quality evaluation and report any discrepancies for delivered purchase orders.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. PO Selector */}
                <div>
                  <label className="form-label">Linked Delivered Purchase Order</label>
                  {deliveredOrders.length === 0 ? (
                    <div style={{ padding: '0.85rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      No delivered orders currently available for evaluation. Orders must be marked Completed first.
                    </div>
                  ) : (
                    <select
                      value={selectedPoId}
                      onChange={(e) => setSelectedPoId(e.target.value)}
                      className="form-select"
                      required
                    >
                      {deliveredOrders.map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.po_number} - {po.pr_title || 'Purchase Order'} (Supplier: {po.vendor_name || 'Assigned'})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Summary of selected PO */}
                  {selectedPoData && (
                    <div style={{ marginTop: '0.65rem', padding: '0.75rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Vendor: </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{selectedPoData.vendor_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Authorized Amount: </span>
                        <strong style={{ color: 'var(--success)' }}>
                          ₹{parseFloat(selectedPoData.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      {selectedPoData.delivery_notes && (
                        <div style={{ gridColumn: 'span 2', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Receipt Note: </span>
                          {selectedPoData.delivery_notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Rating Selector */}
                <div>
                  <label className="form-label">Delivery & Goods Quality Rating</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0.35rem 0' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Star
                          size={28}
                          style={{
                            color: star <= (hoverRating || rating) ? '#f59e0b' : 'var(--text-muted)',
                            fill: star <= (hoverRating || rating) ? '#f59e0b' : 'none',
                            transition: 'color var(--transition-fast)'
                          }}
                        />
                      </button>
                    ))}
                    <span style={{ marginLeft: '10px', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {getRatingLabel(hoverRating || rating)}
                    </span>
                  </div>
                </div>

                {/* 3. Feedback Textarea */}
                <div>
                  <label className="form-label">Evaluation & Delivery Feedback</label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide details regarding delivery timeliness, packaging integrity, and overall supplier service..."
                    className="form-textarea"
                    rows="3"
                    required
                  />
                </div>

                {/* 4. Query & Ticket Section */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Inquiry / Issue Report Details</h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem', marginBottom: '0.85rem' }}>
                    <div>
                      <label className="form-label">Query Subject</label>
                      <input
                        type="text"
                        value={querySubject}
                        onChange={(e) => setQuerySubject(e.target.value)}
                        placeholder="e.g. Missing peripheral cable, Packaging damage..."
                        className="form-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Category</label>
                      <select
                        value={queryCategory}
                        onChange={(e) => setQueryCategory(e.target.value)}
                        className="form-select"
                        required
                      >
                        <option value="Damaged Goods">Damaged Goods</option>
                        <option value="Missing Items">Missing Items</option>
                        <option value="Wrong Specification">Wrong Specification</option>
                        <option value="Packaging Issue">Packaging Issue</option>
                        <option value="Delivery Delay">Delivery Delay</option>
                        <option value="Invoice / Billing Discrepancy">Invoice Discrepancy</option>
                        <option value="General Inquiry">General Inquiry</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label className="form-label">Priority</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setQueryPriority(p)}
                          className={`btn ${queryPriority === p ? 'btn-primary' : 'btn-secondary'}`}
                          style={{
                            flex: 1,
                            padding: '0.45rem',
                            fontSize: '0.8rem',
                            borderColor: queryPriority === p ? 'var(--primary)' : 'var(--border-color)'
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Detailed Description of Issue or Question</label>
                    <textarea
                      value={queryDescription}
                      onChange={(e) => setQueryDescription(e.target.value)}
                      placeholder="Specify affected line items, serial numbers, exact quantities, or instructions for management review..."
                      className="form-textarea"
                      rows="4"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting || deliveredOrders.length === 0}
                >
                  {formSubmitting ? 'Submitting...' : 'Submit Feedback & Query'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: QUERY DETAILS, PROGRESS TRACKER & RESOLUTION
      ───────────────────────────────────────────────────────────── */}
      {showDetailModal && selectedQuery && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '0.9rem' }}>
                    {selectedQuery.po_number}
                  </span>
                  <span className={`badge badge-${selectedQuery.status.replace(/ /g, '-').toLowerCase()}`}>
                    {selectedQuery.status}
                  </span>
                  <span className={`badge badge-priority-${selectedQuery.query_priority.toLowerCase()}`}>
                    {selectedQuery.query_priority}
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem' }}>
                  {selectedQuery.query_subject}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Progress Stepper */}
              <div style={{ padding: '0.5rem 1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div className="query-stepper">
                  {['Open', 'In Progress', 'Resolved', 'Closed'].map((step, idx) => {
                    const statusOrder = ['Open', 'In Progress', 'Resolved', 'Closed'];
                    const currentIdx = statusOrder.indexOf(selectedQuery.status);
                    const isCompleted = currentIdx > idx;
                    const isActive = currentIdx === idx;

                    return (
                      <div
                        key={step}
                        className={`query-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                      >
                        <div className="query-step-circle">
                          {isCompleted ? <Check size={16} /> : idx + 1}
                        </div>
                        <div className="query-step-label">{step}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resolution Response Banner (Prominent if resolved/closed) */}
              {(selectedQuery.status === 'Resolved' || selectedQuery.status === 'Closed' || selectedQuery.resolution_notes) && (
                <div style={{
                  padding: '1.15rem',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: '700', fontSize: '0.9rem' }}>
                      <CheckCircle2 size={18} />
                      <span>Official Resolution Response</span>
                    </div>
                    {selectedQuery.resolved_at && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Resolved on {new Date(selectedQuery.resolved_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {selectedQuery.resolution_notes}
                  </p>
                  {selectedQuery.resolver_name && (
                    <div style={{ marginTop: '0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Resolved by: <strong style={{ color: 'var(--text-secondary)' }}>{selectedQuery.resolver_name}</strong> ({selectedQuery.resolver_role || 'Staff'})
                    </div>
                  )}
                </div>
              )}

              {/* Order & Employee Context Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '0.85rem 1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Purchase Order Details
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{selectedQuery.po_number}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Supplier: {selectedQuery.vendor_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Authorized Cost: ₹{parseFloat(selectedQuery.po_total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  {selectedQuery.delivery_notes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      Delivery Note: {selectedQuery.delivery_notes}
                    </div>
                  )}
                </div>

                <div style={{ padding: '0.85rem 1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Submitted By
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{selectedQuery.employee_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Email: {selectedQuery.employee_email}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Department: {selectedQuery.employee_dept || 'Operations'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Submitted: {new Date(selectedQuery.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Delivery Rating & Feedback */}
              <div style={{ padding: '1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Supplier Delivery Evaluation
                  </span>
                  <div>{renderStars(selectedQuery.rating)}</div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {selectedQuery.feedback}
                </p>
              </div>

              {/* Query Description */}
              <div style={{ padding: '1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Query & Defect Report ({selectedQuery.query_category})
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Priority: <strong style={{ color: 'var(--text-primary)' }}>{selectedQuery.query_priority}</strong>
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {selectedQuery.query_description}
                </p>
              </div>

              {/* Management Controls: Assign & Resolve (Admins and Managers) */}
              {isManagement && (
                <div style={{ padding: '1rem', background: 'rgba(37, 99, 235, 0.05)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)' }}>
                    Management & Resolution Controls
                  </div>

                  {/* Assign to staff */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr auto', gap: '0.75rem', alignItems: 'center' }}>
                    <div>
                      <label className="form-label">Assign Responsible Staff</label>
                      <select
                        value={selectedAssignee}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                        className="form-select"
                        style={{ fontSize: '0.85rem' }}
                      >
                        <option value="">-- Select Assignee --</option>
                        {assignees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.role} - {a.department || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAssignSubmit}
                      disabled={!selectedAssignee || submittingAction}
                      className="btn btn-secondary"
                      style={{ alignSelf: 'flex-end', height: '38px', fontSize: '0.8rem' }}
                    >
                      Update Assignee
                    </button>
                  </div>

                  {/* Status buttons */}
                  <div>
                    <label className="form-label">Quick Status Update</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStatusChange(s)}
                          disabled={submittingAction || selectedQuery.status === s}
                          className={`btn ${selectedQuery.status === s ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resolve Form */}
                  <div>
                    <label className="form-label">Official Resolution Notes (Sent to Employee)</label>
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Explain action taken, vendor compensation, dispatch tracking for replacements, or final closing details..."
                      className="form-textarea"
                      rows="3"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => handleResolveSubmit('Resolved')}
                        disabled={submittingAction || !resolutionText.trim()}
                        className="btn btn-primary"
                        style={{ background: 'var(--success)', borderColor: 'var(--success)', fontSize: '0.8rem' }}
                      >
                        Resolve & Notify Employee
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveSubmit('Closed')}
                        disabled={submittingAction || !resolutionText.trim()}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem' }}
                      >
                        Resolve & Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Timeline / Discussion Thread */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                  <Clock size={16} style={{ color: 'var(--accent)' }} />
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Activity & Communication History</h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {(selectedQuery.activities || []).map((act) => (
                    <div
                      key={act.id}
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'var(--card-item-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {act.user_name || 'System'}
                          </strong>{' '}
                          <span style={{ color: 'var(--text-muted)' }}>
                            ({act.user_role || 'Notification'})
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {new Date(act.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {act.notes}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Reply Note */}
                <form onSubmit={handlePostResponse} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newResponseNote}
                    onChange={(e) => setNewResponseNote(e.target.value)}
                    placeholder="Type an update or reply to this query..."
                    className="form-input"
                    style={{ flex: 1, fontSize: '0.85rem' }}
                    disabled={submittingAction}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingAction || !newResponseNote.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Send size={14} />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: EDIT QUERY DETAILS
      ───────────────────────────────────────────────────────────── */}
      {showEditModal && selectedQuery && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Edit Query Ticket</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Update query subject, priority, or report details.
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Subject</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label className="form-label">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="Damaged Goods">Damaged Goods</option>
                      <option value="Missing Items">Missing Items</option>
                      <option value="Wrong Specification">Wrong Specification</option>
                      <option value="Packaging Issue">Packaging Issue</option>
                      <option value="Delivery Delay">Delivery Delay</option>
                      <option value="Invoice / Billing Discrepancy">Invoice Discrepancy</option>
                      <option value="General Inquiry">General Inquiry</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Query Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="form-textarea"
                    rows="3"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Delivery Feedback Notes</label>
                  <textarea
                    value={editFeedback}
                    onChange={(e) => setEditFeedback(e.target.value)}
                    className="form-textarea"
                    rows="2"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: DELETE CONFIRMATION
      ───────────────────────────────────────────────────────────── */}
      {showDeleteModal && selectedQuery && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={18} />
                <span>Confirm Deletion</span>
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Are you sure you want to permanently delete query{' '}
                <strong style={{ color: 'var(--text-primary)' }}>"{selectedQuery.query_subject}"</strong> on order{' '}
                <strong style={{ color: 'var(--primary)' }}>{selectedQuery.po_number}</strong>?
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                This will delete all resolution records and activity logs linked to this ticket.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
                disabled={submittingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="btn btn-danger"
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
                disabled={submittingAction}
              >
                {submittingAction ? 'Deleting...' : 'Delete Query'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Queries;
