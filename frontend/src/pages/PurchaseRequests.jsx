import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  X,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Crown
} from 'lucide-react';
import UpgradeModal from '../components/UpgradeModal';

/**
 * Purchase Requests (PR) Management Page
 * Handles creation, routing, multi-stage approval, and audit trails for requisitions.
 */
export const PurchaseRequests = () => {
  const { api, user } = useAuth();

  // Component state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Subscription metadata & upgrade modal state
  const [subData, setSubData] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    featureName: '',
    maxLimit: 0,
    currentCount: 0
  });

  // Tab control: 'all' or 'pending' (approvals assigned to the active manager/admin)
  const [activeTab, setActiveTab] = useState('all');

  // Modal controls
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPr, setSelectedPr] = useState(null);

  // New Request form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([{ name: '', category: 'Hardware', quantity: 1, estimated_cost: 0.0 }]);
  const [totalCost, setTotalCost] = useState(0.0);

  // Approval / Rejection remarks
  const [comments, setComments] = useState('');

  // Fetch subscription quotas for the tenant
  const fetchSubData = async () => {
    if (user.role === 'Vendor') return;
    try {
      const res = await api.get('/api/subscriptions/current');
      setSubData(res.data);
    } catch (err) {
      console.error('Failed fetching subscription data:', err);
    }
  };

  // Fetch purchase requisitions
  const fetchRequests = async () => {
    try {
      const res = await api.get('/api/purchase-requests');
      setRequests(res.data);
    } catch (err) {
      setError('Failed to retrieve purchase requests.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchSubData();
  }, []);

  // Recalculate total estimated cost when line items change
  useEffect(() => {
    const cost = items.reduce(
      (sum, item) => sum + (item.quantity * parseFloat(item.estimated_cost || 0)),
      0
    );
    setTotalCost(cost);
  }, [items]);

  // Line item handlers
  const handleAddItemRow = () => {
    setItems([...items, { name: '', category: 'Hardware', quantity: 1, estimated_cost: 0.0 }]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Create new purchase request (saved initially in Draft status)
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/api/purchase-requests', {
        title,
        description,
        items,
        totalEstimatedCost: totalCost
      });

      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setItems([{ name: '', category: 'Hardware', quantity: 1, estimated_cost: 0.0 }]);
      fetchRequests();
      fetchSubData();
    } catch (err) {
      if (err.response?.status === 403 && (err.response?.data?.quotaReached || err.response?.data?.upgradeRequired)) {
        setShowCreateModal(false);
        setUpgradeModal({
          isOpen: true,
          title: err.response.data.error || 'PR Quota Limit Reached',
          message: err.response.data.message || 'You have reached your monthly Purchase Request limit. Upgrade to a Premium plan for higher limits.',
          featureName: 'Purchase Requisitions',
          maxLimit: err.response.data.maxPr,
          currentCount: err.response.data.currentCount
        });
      } else {
        setError(err.response?.data?.error || 'Failed to submit purchase request.');
      }
    }
  };

  // Submit draft PR for approval routing
  const handleSubmittingPR = async (prId) => {
    try {
      await api.post(`/api/purchase-requests/${prId}/submit`);
      fetchRequests();
      if (showDetailsModal && selectedPr?.id === prId) {
        handleViewDetails(prId);
      }
    } catch (err) {
      console.error('Submission failed:', err);
    }
  };

  // View details and approval audit history
  const handleViewDetails = async (prId) => {
    try {
      const res = await api.get(`/api/purchase-requests/${prId}`);
      setSelectedPr(res.data);
      setShowDetailsModal(true);
    } catch (err) {
      console.error('Failed to load PR details:', err);
    }
  };

  // Manager/Admin approves the PR
  const handleApprove = async (prId) => {
    try {
      await api.post(`/api/purchase-requests/${prId}/approve`, { comments });
      setComments('');
      setShowDetailsModal(false);
      fetchRequests();
    } catch (err) {
      console.error('Approval failed:', err);
    }
  };

  // Manager/Admin rejects the PR
  const handleReject = async (prId) => {
    if (!comments) {
      alert('Please add rejection comments.');
      return;
    }
    try {
      await api.post(`/api/purchase-requests/${prId}/reject`, { comments });
      setComments('');
      setShowDetailsModal(false);
      fetchRequests();
    } catch (err) {
      console.error('Rejection failed:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading requisitions...</div>;
  }

  return (
    <div>
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER & QUOTA USAGE BADGE
      ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Purchase Requisitions</h1>
            {user.role !== 'Vendor' && subData && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--card-item-bg)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem'
              }}>
                <Crown size={14} style={{ color: subData.plan === 'Starter' ? 'var(--primary)' : 'var(--warning)' }} />
                <span>
                  <strong>{subData.planName} Quota:</strong> {subData.usage?.prsThisMonth} / {subData.usage?.maxPr === -1 ? '∞' : subData.usage?.maxPr} PRs used
                </span>
                {subData.plan === 'Starter' && (
                  <Link to="/subscriptions" style={{ color: 'var(--primary)', fontWeight: '600', marginLeft: '0.25rem', textDecoration: 'none' }}>
                    Upgrade
                  </Link>
                )}
              </div>
            )}
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
            Track, approve, and route purchase requests across corporate departments.
          </p>
        </div>

        {user.role !== 'Vendor' && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Create Requisition</span>
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger">
          {error}
        </div>
      )}

      {/* Tab controls for Managers / Admins */}
      {(user.role === 'Manager' || user.role === 'Admin') && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('all')} 
            className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            All Requisitions
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('pending')} 
            className={`btn ${activeTab === 'pending' ? 'btn-accent' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Pending My Approval</span>
            {requests.filter(pr => pr.status === 'Pending Approval' && pr.current_approver_id === user.id).length > 0 && (
              <span style={{ 
                background: 'var(--danger)', 
                color: '#fff', 
                borderRadius: '10px', 
                padding: '2px 6px', 
                fontSize: '0.7rem', 
                fontWeight: 'bold',
                lineHeight: '1'
              }}>
                {requests.filter(pr => pr.status === 'Pending Approval' && pr.current_approver_id === user.id).length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PURCHASE REQUESTS TABLE
      ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>PR Number</th>
                <th>Request Details</th>
                <th>Requester</th>
                <th>Estimated cost</th>
                <th>Status</th>
                <th>Current Owner</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filteredRequests = requests.filter(pr => {
                  if (activeTab === 'pending') {
                    return pr.status === 'Pending Approval' && pr.current_approver_id === user.id;
                  }
                  return true;
                });

                if (filteredRequests.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No purchase requisitions found.
                      </td>
                    </tr>
                  );
                }

                return filteredRequests.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{pr.pr_number}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '700' }}>{pr.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                        {pr.description}
                      </div>
                    </td>
                    <td>{pr.requester_name || 'System User'}</td>
                    <td style={{ fontWeight: '700' }}>
                      ₹{parseFloat(pr.total_estimated_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`badge badge-${pr.status?.replace(' ', '-').toLowerCase()}`}>
                        {pr.status}
                      </span>
                    </td>
                    <td>
                      {pr.status === 'Pending Approval' ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--warning)', fontWeight: '500' }}>
                          Under Review
                        </span>
                      ) : pr.status === 'Approved' || pr.status === 'PO Created' || pr.status === 'RFQ Created' ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>Completed</span>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleViewDetails(pr.id)}
                          className="btn btn-secondary" 
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>

                        {pr.status === 'Draft' && pr.requester_id === user.id && (
                          <button 
                            onClick={() => handleSubmittingPR(pr.id)}
                            className="btn btn-primary" 
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            <ArrowUpRight size={12} />
                            <span>Submit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: CREATE REQUISITION
      ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Create Purchase Requisition</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateRequest}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Requisition Title</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Office Hardware Refresh Q3" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Brief Description</label>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Provide details about the procurement purpose..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)' }}>Purchase Items List</h4>
                  <button type="button" onClick={handleAddItemRow} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                    Add Line Item
                  </button>
                </div>

                {/* Line Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '5px' }}>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.8fr 1.2fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Item name"
                        value={item.name} 
                        onChange={e => handleItemChange(idx, 'name', e.target.value)} 
                        required 
                      />
                      <select 
                        className="form-select" 
                        value={item.category} 
                        onChange={e => handleItemChange(idx, 'category', e.target.value)}
                      >
                        <option value="Hardware">Hardware</option>
                        <option value="Software">Software</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Services">Services</option>
                        <option value="Marketing">Marketing</option>
                      </select>
                      <input 
                        type="number" 
                        min="1"
                        className="form-input" 
                        placeholder="Qty" 
                        value={item.quantity} 
                        onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)} 
                        required 
                      />
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        className="form-input" 
                        placeholder="Est. Cost" 
                        value={item.estimated_cost} 
                        onChange={e => handleItemChange(idx, 'estimated_cost', parseFloat(e.target.value) || 0)} 
                        required 
                      />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItemRow(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '5px' }}
                        disabled={items.length === 1}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1.5rem', textAlign: 'right', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: '1rem' }}>Estimated Total:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent)' }}>
                    ₹{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: PR DETAILS, AUDIT LOGS & APPROVAL ACTION
      ───────────────────────────────────────────────────────────── */}
      {showDetailsModal && selectedPr && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>{selectedPr.pr_number}</span>
                <h3 style={{ margin: '2px 0 0 0' }}>{selectedPr.title}</h3>
              </div>
              <button onClick={() => setShowDetailsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{selectedPr.description}</p>
              
              <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Line Items Requested</h4>
              <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Est. Unit Cost</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(selectedPr.items) ? selectedPr.items : []).map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.name}</td>
                        <td>{item.category}</td>
                        <td>{item.quantity}</td>
                        <td>₹{parseFloat(item.estimated_cost).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          ₹{(item.quantity * parseFloat(item.estimated_cost)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--card-item-bg)', fontWeight: '800' }}>
                      <td colSpan={4} style={{ textAlign: 'right' }}>Total Estimated Budget:</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent)' }}>
                        ₹{parseFloat(selectedPr.total_estimated_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Approval History Logs */}
              <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Approval Flow & Audit Logs</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {selectedPr.logs?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No approval logs recorded. (Requisition is in Draft or awaiting submission).</p>
                ) : (
                  selectedPr.logs?.map((log) => (
                    <div 
                      key={log.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.75rem',
                        padding: '0.75rem',
                        background: 'var(--card-item-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      {log.action === 'Approved' ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--success)', marginTop: '2px' }} />
                      ) : (
                        <XCircle size={18} style={{ color: 'var(--danger)', marginTop: '2px' }} />
                      )}
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{log.approver_name}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>({log.approver_role})</span>
                          <span style={{ fontSize: '0.75rem', color: log.action === 'Approved' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                            {log.action}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{log.comments}</p>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Action Form for the Current Approver */}
              {selectedPr.status === 'Pending Approval' && selectedPr.current_approver_id === user.id && (
                <div style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-sm)' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
                    <span>Review Decision Required</span>
                  </h4>
                  <div className="form-group">
                    <label className="form-label">Approval/Rejection Comments</label>
                    <textarea 
                      className="form-input" 
                      placeholder="Add logic remarks (required for rejection)..."
                      value={comments}
                      onChange={e => setComments(e.target.value)}
                      style={{ minHeight: '80px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => handleReject(selectedPr.id)} className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
                      Reject Requisition
                    </button>
                    <button type="button" onClick={() => handleApprove(selectedPr.id)} className="btn btn-primary">
                      Approve Requisition
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Quota Modal */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal(prev => ({ ...prev, isOpen: false }))}
        title={upgradeModal.title}
        message={upgradeModal.message}
        featureName={upgradeModal.featureName}
        maxLimit={upgradeModal.maxLimit}
        currentCount={upgradeModal.currentCount}
      />
    </div>
  );
};

export default PurchaseRequests;
