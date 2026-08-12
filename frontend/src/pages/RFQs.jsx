import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layers, Eye, FileSpreadsheet, Gift, Award, Plus, Calendar, X, ShieldAlert, BadgeCheck, Star, Sparkles, TrendingUp, CheckCircle } from 'lucide-react';

// RFQ Sourcing Page
export const RFQs = () => {
  const { api, user } = useAuth();

  // Page data
  const [rfqs, setRfqs] = useState([]);
  const [approvedPrs, setApprovedPrs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal visibility
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Active selection
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [rfqQuotations, setRfqQuotations] = useState([]);

  // RFQ creation form
  const [selectedPrId, setSelectedPrId] = useState('');
  const [rfqTitle, setRfqTitle] = useState('');
  const [rfqDeadline, setRfqDeadline] = useState('');
  const [invitedVendorIds, setInvitedVendorIds] = useState([]);

  // Vendor bid form
  const [bidItems, setBidItems] = useState([]);
  const [bidDeliveryDays, setBidDeliveryDays] = useState(7);
  const [bidRemarks, setBidRemarks] = useState('');
  const [bidTotal, setBidTotal] = useState(0.00);

  // Fetch RFQ list
  const fetchRfqs = async () => {
    try {
      const res = await api.get('/api/rfqs');
      setRfqs(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch RFQs.');
    } finally {
      setLoading(false);
    }
  };

  // Load approved PRs and active vendors
  const loadSourcingDependencies = async () => {
    if (user.role === 'Vendor') return;
    try {
      const prRes = await api.get('/api/purchase-requests?status=Approved');
      setApprovedPrs(prRes.data);

      const vRes = await api.get('/api/vendors?status=Active');
      setVendors(vRes.data);
    } catch (err) {
      console.error('Failed loading dependencies:', err);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchRfqs();
    loadSourcingDependencies();
  }, [user]);

  // Auto-fill title when a PR is selected
  const handlePrSelect = (prId) => {
    setSelectedPrId(prId);
    const targetPr = approvedPrs.find(p => p.id === prId);
    if (targetPr) {
      setRfqTitle(`RFQ Sourcing - ${targetPr.title}`);
    }
  };

  // Create and publish a new RFQ
  const handleCreateRfq = async (e) => {
    e.preventDefault();
    setError('');

    const targetPr = approvedPrs.find(p => p.id === selectedPrId);
    if (!targetPr || invitedVendorIds.length === 0) {
      setError('Please select a purchase request and invite at least one vendor.');
      return;
    }

    try {
      await api.post('/api/rfqs', {
        purchaseRequestId: selectedPrId,
        title: rfqTitle,
        deadline: rfqDeadline,
        items: (Array.isArray(targetPr.items) ? targetPr.items : []),
        vendorIds: invitedVendorIds
      });

      setShowCreateModal(false);
      setSelectedPrId('');
      setRfqTitle('');
      setRfqDeadline('');
      setInvitedVendorIds([]);
      fetchRfqs();
      loadSourcingDependencies();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish RFQ.');
    }
  };

  // Open RFQ details, pre-populate bid form for vendors
  const handleViewRfq = async (rfqId) => {
    try {
      const res = await api.get(`/api/rfqs/${rfqId}`);
      setSelectedRfq(res.data);

      if (user.role === 'Vendor') {
        const items = Array.isArray(res.data.items) ? res.data.items : [];
        setBidItems(items.map(item => ({ ...item, unit_price: 0.00 })));
      }

      setShowDetailsModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Recalculate total when item prices change
  useEffect(() => {
    if (user.role === 'Vendor') {
      const total = bidItems.reduce((sum, item) => sum + (item.quantity * parseFloat(item.unit_price || 0)), 0);
      setBidTotal(total);
    }
  }, [bidItems]);

  // Update unit price for a specific line item
  const handleBidUnitChange = (index, value) => {
    const updated = [...bidItems];
    updated[index].unit_price = parseFloat(value) || 0.00;
    setBidItems(updated);
  };

  // Submit vendor quotation bid
  const handleSubmitBid = async (e) => {
    e.preventDefault();
    try {
      const itemsPayload = bidItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalCost: item.quantity * item.unit_price
      }));

      await api.post(`/api/rfqs/${selectedRfq.id}/quotations`, {
        items: itemsPayload,
        totalCost: bidTotal,
        deliveryDays: parseInt(bidDeliveryDays),
        remarks: bidRemarks
      });

      setShowDetailsModal(false);
      setBidRemarks('');
      setBidDeliveryDays(7);
      fetchRfqs();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit bid.');
    }
  };

  // Open bid comparison with ML scores
  const handleOpenComparison = async (rfq) => {
    try {
      setSelectedRfq(rfq);
      const res = await api.get(`/api/rfqs/${rfq.id}/quotations`);
      setRfqQuotations(res.data);
      setShowCompareModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Award contract to selected quotation
  const handleAwardContract = async (quotationId) => {
    if (!confirm('Are you sure you want to award this contract? All other bids will be rejected.')) return;
    try {
      await api.post(`/api/rfqs/${selectedRfq.id}/award`, { quotationId });
      setShowCompareModal(false);
      fetchRfqs();
    } catch (err) {
      alert('Failed to award contract.');
    }
  };

  // Toggle vendor invite selection
  const toggleVendorInvite = (vendorId) => {
    setInvitedVendorIds(prev =>
      prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
    );
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading RFQs...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Sourcing & Bidding</h1>
          <p className="page-subtitle">Manage supplier requests for quotations (RFQs), gather proposals, and award contracts.</p>
        </div>
        {user.role !== 'Vendor' && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Create RFQ Sourcing</span>
          </button>
        )}
      </div>

      {error && (
        <div className="alert-danger">
          {error}
        </div>
      )}

      {/* RFQ List Grid */}
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>RFQ Number</th>
                <th>RFQ Title</th>
                <th>Submission Deadline</th>
                <th>Status</th>
                <th>Created At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No sourcing RFQs found.
                  </td>
                </tr>
              ) : (
                rfqs.map((rfq) => (
                  <tr key={rfq.id}>
                    <td>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{rfq.rfq_number}</span>
                    </td>
                    <td>{rfq.title}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                        <Calendar size={14} style={{ color: 'var(--danger)' }} />
                        <span>{new Date(rfq.deadline).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`badge badge-${rfq.status?.replace(' ', '-').toLowerCase()}`}>
                          RFQ {rfq.status}
                        </span>
                        {user.role === 'Vendor' && rfq.bid_id && (
                          <span className={`badge badge-${rfq.bid_status?.toLowerCase() === 'accepted' ? 'active' : 'pending'}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                            Bid: {rfq.bid_status} (₹{parseFloat(rfq.bid_total_cost).toLocaleString()})
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(rfq.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button onClick={() => handleViewRfq(rfq.id)} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                          <Eye size={12} />
                          <span>View RFQ</span>
                        </button>

                        {user.role !== 'Vendor' && rfq.status === 'Open' && (
                          <button
                            onClick={() => handleOpenComparison(rfq)}
                            className="btn btn-accent"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            <FileSpreadsheet size={12} />
                            <span>Compare Bids</span>
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

      {/* RFQ Creation Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3>Create Sourcing RFQ</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateRfq}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Approved Purchase Requisition</label>
                  <select
                    className="form-select"
                    value={selectedPrId}
                    onChange={e => handlePrSelect(e.target.value)}
                    required
                  >
                    <option value="">-- Select Approved Request --</option>
                    {approvedPrs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.pr_number} - {p.title} (₹{parseFloat(p.total_estimated_cost).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">RFQ Title</label>
                  <input type="text" className="form-input" value={rfqTitle} onChange={e => setRfqTitle(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Submission Deadline Date</label>
                  <input type="date" className="form-input" value={rfqDeadline} onChange={e => setRfqDeadline(e.target.value)} required />
                </div>

                {/* Vendor invite checklist */}
                <h4 style={{ fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>Invite Active Suppliers</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto', padding: '0.5rem', background: 'var(--card-item-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)' }}>
                  {vendors.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active vendors registered to invite.</p>
                  ) : (
                    vendors.map(v => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                          type="checkbox"
                          checked={invitedVendorIds.includes(v.id)}
                          onChange={() => toggleVendorInvite(v.id)}
                        />
                        <div>
                          <strong>{v.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{v.category} • Score: {v.performance_score}/100</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Publish RFQ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RFQ Details Modal */}
      {showDetailsModal && selectedRfq && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.85rem' }}>{selectedRfq.rfq_number}</span>
                <h3 style={{ margin: '2px 0 0 0' }}>{selectedRfq.title}</h3>
              </div>
              <button onClick={() => setShowDetailsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--card-item-bg)', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Deadline Date</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{new Date(selectedRfq.deadline).toLocaleDateString()}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>RFQ Sourcing Status</span>
                  <span className={`badge badge-${selectedRfq.status?.toLowerCase()}`}>{selectedRfq.status}</span>
                </div>
              </div>

               {user.role === 'Vendor' ? (
                selectedRfq.myQuotation ? (
                  /* Vendor — View submitted bid */
                  <div>
                    <div style={{ 
                      padding: '1rem', 
                      background: 'rgba(16, 185, 129, 0.04)', 
                      border: '1px solid rgba(16, 185, 129, 0.2)', 
                      borderRadius: 'var(--radius-sm)', 
                      marginBottom: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your Quotation Status</span>
                        <h4 style={{ margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <BadgeCheck size={18} style={{ color: 'var(--success)' }} />
                          <span style={{ color: 'var(--success)' }}>{selectedRfq.myQuotation.status}</span>
                        </h4>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Submitted On</span>
                        <span style={{ display: 'block', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {new Date(selectedRfq.myQuotation.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Your Bid Pricing</h4>
                    <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Quantity</th>
                            <th style={{ textAlign: 'right' }}>Quoted Unit Price (₹)</th>
                            <th style={{ textAlign: 'right' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(selectedRfq.myQuotation.items) ? selectedRfq.myQuotation.items : []).map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.name}</td>
                              <td>{item.category}</td>
                              <td>{item.quantity}</td>
                              <td style={{ textAlign: 'right' }}>₹{parseFloat(item.unitPrice || item.unit_price).toFixed(2)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                ₹{parseFloat(item.totalCost || item.total_cost).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: 'var(--card-item-bg)', fontWeight: '800' }}>
                            <td colSpan={4} style={{ textAlign: 'right' }}>Total Bid Valuation:</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>
                              ₹{parseFloat(selectedRfq.myQuotation.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', background: 'var(--card-item-bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Delivery Lead Days</span>
                        <strong style={{ fontSize: '1rem' }}>{selectedRfq.myQuotation.delivery_days} Days</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Bidding Remarks / Terms</span>
                        <span>{selectedRfq.myQuotation.remarks || 'No remarks provided.'}</span>
                      </div>
                    </div>
                  </div>
                ) : selectedRfq.status === 'Open' ? (
                  /* Vendor — submit bid form */
                  <form onSubmit={handleSubmitBid}>
                    <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Submit Quotation Proposal</h4>
                    <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Quantity</th>
                            <th style={{ width: '150px' }}>Bid Unit Price (₹)</th>
                            <th style={{ textAlign: 'right' }}>Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bidItems.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.name}</td>
                              <td>{item.category}</td>
                              <td>{item.quantity}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  className="form-input"
                                  placeholder="0.00"
                                  style={{ padding: '0.4rem 0.6rem' }}
                                  value={item.unit_price}
                                  onChange={e => handleBidUnitChange(idx, e.target.value)}
                                  required
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                ₹{(item.quantity * parseFloat(item.unit_price || 0)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: 'var(--card-item-bg)', fontWeight: '800' }}>
                            <td colSpan={4} style={{ textAlign: 'right' }}>Total Bid Valuation:</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>
                              ₹{bidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Delivery Lead Days</label>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          value={bidDeliveryDays}
                          onChange={e => setBidDeliveryDays(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bidding Remarks</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Price valid for 30 days. High quality grade."
                          value={bidRemarks}
                          onChange={e => setBidRemarks(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button type="button" onClick={() => setShowDetailsModal(false)} className="btn btn-secondary">Cancel</button>
                      <button type="submit" className="btn btn-primary">Submit Quotation Bid</button>
                    </div>
                  </form>
                ) : (
                  /* RFQ closed, no bid submitted */
                  <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <ShieldAlert size={36} style={{ color: 'var(--danger)', marginBottom: '0.5rem' }} />
                    <h4>Bidding Period Ended</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>This RFQ is closed/awarded and no longer accepting quotations.</p>
                  </div>
                )
              ) : (
                /* Internal user — RFQ line items and vendor list */
                <div>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Line Items Sourced</h4>
                  <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th>Required Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(selectedRfq.items) ? selectedRfq.items : []).map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td>{item.category}</td>
                            <td>{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Invited Suppliers Registry</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {selectedRfq.invitedVendors?.map((v) => (
                      <div key={v.id} style={{ padding: '0.75rem', background: 'var(--card-item-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                        <strong>{v.name}</strong> • {v.contact_name} ({v.email})
                      </div>
                    ))}
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

      {/* AI Bid Comparison Modal */}
      {showCompareModal && selectedRfq && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '980px' }}>
            <div className="modal-header">
              <div>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={14} style={{ color: '#a855f7' }} />
                  <span>AI-Powered Sourcing Ledger</span>
                </span>
                <h3 style={{ margin: '2px 0 0 0' }}>RFQ: {selectedRfq.rfq_number}</h3>
              </div>
              <button onClick={() => setShowCompareModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Review and compare all quotation submissions compiled for this sourcing request with real-time ML decision evaluation.
              </p>

              {/* ML recommendation banner */}
              {rfqQuotations.length > 0 && rfqQuotations.aiEvaluation && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  borderRadius: '0.75rem',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#c084fc', marginBottom: '4px', fontSize: '0.9rem' }}>
                      <Sparkles size={16} />
                      <span>AI Multi-Criteria Decision Recommendation</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {rfqQuotations.aiEvaluation.aiSummary}
                    </div>
                  </div>
                  {selectedRfq.status === 'Open' && rfqQuotations.aiEvaluation.recommendedQuotationId && (
                    <button
                      onClick={() => handleAwardContract(rfqQuotations.aiEvaluation.recommendedQuotationId)}
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        color: '#ffffff',
                        fontWeight: '700',
                        padding: '0.6rem 1.1rem',
                        fontSize: '0.82rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Sparkles size={14} />
                      <span>Auto-Select & Award Top Bid</span>
                    </button>
                  )}
                </div>
              )}

              {rfqQuotations.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                  <ShieldAlert size={36} style={{ color: 'var(--warning)', marginBottom: '0.5rem' }} />
                  <h4>No submissions yet</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Invited suppliers have not submitted bid responses yet.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Supplier Info</th>
                        <th>AI Match Score</th>
                        <th>Supplier Rating</th>
                        <th>Delivery Lead</th>
                        <th>Total Quotation Cost</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfqQuotations.map((quote) => {
                        const metrics = quote.aiMetrics || {};
                        const isTop = metrics.isTopMatch;

                        return (
                          <tr key={quote.id} style={{ background: quote.status === 'Accepted' ? 'rgba(16, 185, 129, 0.06)' : isTop ? 'rgba(168, 85, 247, 0.05)' : 'transparent' }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{quote.vendor_name}</div>
                                {isTop && (
                                  <span style={{
                                    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                                    color: '#fff',
                                    fontSize: '0.65rem',
                                    fontWeight: '800',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <Sparkles size={10} /> AI Winner
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Remarks: {quote.remarks || 'None'}</div>
                              {metrics.strengths?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                  {metrics.strengths.map((st, i) => (
                                    <span key={i} style={{ fontSize: '0.68rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                                      + {st}
                                    </span>
                                  ))}
                                  {metrics.risks?.map((rk, i) => (
                                    <span key={i} style={{ fontSize: '0.68rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                                      ! {rk}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {metrics.overallScore !== undefined ? (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: '800', fontSize: '0.95rem', color: isTop ? '#c084fc' : 'var(--text-primary)' }}>
                                      {metrics.overallScore}%
                                    </span>
                                    <div style={{ flex: 1, height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                                      <div style={{
                                        height: '100%',
                                        width: `${metrics.overallScore}%`,
                                        background: isTop ? 'linear-gradient(90deg, #6366f1, #a855f7)' : 'var(--accent)',
                                        borderRadius: '3px'
                                      }} />
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Price: {metrics.priceScore}% | Lead: {metrics.deliveryScore}% | Rel: {metrics.vendorReliability}%
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>N/A</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}>
                                <span>{parseFloat(quote.vendor_rating).toFixed(1)}</span>
                                <Star size={12} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>Score: {quote.performance_score}/100</span>
                            </td>
                            <td>{quote.delivery_days} days</td>
                            <td>
                              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--success)' }}>
                                ₹{parseFloat(quote.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {selectedRfq.status === 'Open' ? (
                                <button
                                  onClick={() => handleAwardContract(quote.id)}
                                  className={isTop ? "btn" : "btn btn-primary"}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.75rem',
                                    background: isTop ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : undefined,
                                    border: isTop ? 'none' : undefined,
                                    color: isTop ? '#fff' : undefined,
                                    fontWeight: isTop ? '700' : 'normal'
                                  }}
                                >
                                  <Award size={12} />
                                  <span>{isTop ? 'Award AI Winner' : 'Award Contract'}</span>
                                </button>
                              ) : quote.status === 'Accepted' ? (
                                <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                  <BadgeCheck size={16} />
                                  <span>Awarded</span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rejected</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCompareModal(false)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RFQs;
