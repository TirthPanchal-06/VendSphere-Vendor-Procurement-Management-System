import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Star, Award, UserCheck, UserX, Plus, Edit3, X, AlertCircle, Crown } from 'lucide-react';
import UpgradeModal from '../components/UpgradeModal';

export const Vendors = () => {
  const { api, user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Subscription state & Upgrade modal
  const [subData, setSubData] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    featureName: '',
    maxLimit: 0,
    currentCount: 0
  });

  // Modals Toggles
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Add Vendor States
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');

  // Evaluation States
  const [evalScore, setEvalScore] = useState(100);
  const [evalRating, setEvalRating] = useState(5.0);

  const fetchSubData = async () => {
    if (user.role === 'Vendor') return;
    try {
      const res = await api.get('/api/subscriptions/current');
      setSubData(res.data);
    } catch (err) {
      console.error('Failed fetching subscription data:', err);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get('/api/vendors');
      setVendors(res.data);
    } catch (err) {
      setError('Failed to fetch vendors.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchSubData();
  }, []);

  const handleAddVendor = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/api/vendors', {
        name,
        contactName,
        email,
        phone,
        category,
        paymentTerms
      });

      setShowAddModal(false);
      setName('');
      setContactName('');
      setEmail('');
      setPhone('');
      setCategory('');
      setPaymentTerms('Net 30');
      fetchVendors();
      fetchSubData();
    } catch (err) {
      if (err.response?.status === 403 && (err.response?.data?.quotaReached || err.response?.data?.upgradeRequired)) {
        setShowAddModal(false);
        setUpgradeModal({
          isOpen: true,
          title: err.response.data.error || 'Approved Vendor Limit Reached',
          message: err.response.data.message || 'You have reached your active vendor limit. Upgrade to a Premium plan to approve more vendors.',
          featureName: 'Approved Vendors',
          maxLimit: err.response.data.maxVendors,
          currentCount: err.response.data.currentCount
        });
      } else {
        setError(err.response?.data?.error || 'Failed to onboard vendor.');
      }
    }
  };

  const handleStatusChange = async (vendorId, status) => {
    try {
      await api.put(`/api/vendors/${vendorId}`, { status });
      fetchVendors();
      fetchSubData();
    } catch (err) {
      if (err.response?.status === 403 && (err.response?.data?.quotaReached || err.response?.data?.upgradeRequired)) {
        setUpgradeModal({
          isOpen: true,
          title: err.response.data.error || 'Approved Vendor Limit Reached',
          message: err.response.data.message || 'Your plan allows up to 3 active/approved vendors. Upgrade to a Premium plan to approve more vendors.',
          featureName: 'Approved Vendors',
          maxLimit: err.response.data.maxVendors,
          currentCount: err.response.data.currentCount
        });
      } else {
        console.error('Failed to change status:', err);
      }
    }
  };

  const handleEvaluation = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/vendors/${selectedVendor.id}/evaluate`, {
        performanceScore: parseInt(evalScore),
        rating: parseFloat(evalRating)
      });
      setShowEvalModal(false);
      setSelectedVendor(null);
      fetchVendors();
    } catch (err) {
      console.error('Failed to submit evaluation:', err);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading suppliers...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Supplier Directory</h1>
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
                <span><strong>{subData.planName} Quota:</strong> {subData.usage?.activeVendors} / {subData.usage?.maxVendors === -1 ? '∞' : subData.usage?.maxVendors} Approved Vendors</span>
                {subData.plan === 'Starter' && (
                  <Link to="/subscriptions" style={{ color: 'var(--primary)', fontWeight: '600', marginLeft: '0.25rem', textDecoration: 'none' }}>
                    Upgrade
                  </Link>
                )}
              </div>
            )}
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>Manage onboarded corporate suppliers, track metrics, and run scorecard audits.</p>
        </div>

        {user.role !== 'Employee' && (
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Onboard Supplier</span>
          </button>
        )}
      </div>

      {error && (
        <div className="alert-danger">
          {error}
        </div>
      )}

      {/* Vendors Table */}
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Category</th>
                <th>Contact info</th>
                <th>Payment terms</th>
                <th>Performance Score</th>
                <th>Rating</th>
                <th>Status</th>
                {user.role !== 'Employee' && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={user.role !== 'Employee' ? 8 : 7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No registered vendors found.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <div style={{ fontWeight: '700' }}>{vendor.name}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {vendor.id.slice(0, 8)}</span>
                    </td>
                    <td>{vendor.category}</td>
                    <td>
                      <div style={{ fontSize: '0.9rem' }}>{vendor.contact_name}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{vendor.email}</span>
                    </td>
                    <td>{vendor.payment_terms}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Award size={16} style={{ color: vendor.performance_score >= 80 ? 'var(--success)' : 'var(--warning)' }} />
                        <span style={{ fontWeight: 'bold' }}>{vendor.performance_score}/100</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}>
                        <span>{parseFloat(vendor.rating).toFixed(1)}</span>
                        <Star size={12} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${vendor.status?.replace(' ', '-').toLowerCase()}`}>
                        {vendor.status}
                      </span>
                    </td>
                    {user.role !== 'Employee' && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setEvalScore(vendor.performance_score);
                              setEvalRating(vendor.rating);
                              setShowEvalModal(true);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                            title="Evaluate Performance"
                          >
                            <Edit3 size={12} />
                          </button>

                          {vendor.status === 'Pending Approval' && (
                            <button
                              onClick={() => handleStatusChange(vendor.id, 'Active')}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                              title="Approve Status"
                            >
                              <UserCheck size={12} />
                            </button>
                          )}

                          {vendor.status === 'Active' && (
                            <button
                              onClick={() => handleStatusChange(vendor.id, 'Blocked')}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                              title="Block Vendor"
                            >
                              <UserX size={12} />
                            </button>
                          )}

                          {vendor.status === 'Blocked' && (
                            <button
                              onClick={() => handleStatusChange(vendor.id, 'Active')}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                              title="Unblock Vendor"
                            >
                              <UserCheck size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Onboard New Supplier</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddVendor}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor Company Name</label>
                  <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Person Name</label>
                  <input type="text" className="form-input" value={contactName} onChange={e => setContactName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input type="text" className="form-input" placeholder="e.g. Office Supplies" value={category} onChange={e => setCategory(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Terms</label>
                    <select className="form-select" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluate Vendor Modal */}
      {showEvalModal && selectedVendor && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Evaluate Vendor Scorecard</h3>
              <button onClick={() => setShowEvalModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEvaluation}>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                  Updating performance stats for <strong>{selectedVendor.name}</strong>.
                </p>
                <div className="form-group">
                  <label className="form-label">Performance Score (0 - 100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-input"
                    value={evalScore}
                    onChange={e => setEvalScore(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quality Rating (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    className="form-input"
                    value={evalRating}
                    onChange={e => setEvalRating(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowEvalModal(false); setSelectedVendor(null); }} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Scorecard</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default Vendors;
