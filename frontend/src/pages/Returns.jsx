import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Package,
  FileText,
  Mail,
  Search,
  Filter,
  Check,
  X,
  ChevronRight,
  Eye,
  Calendar,
  Building2,
  Receipt,
  ArrowUpRight,
  ShieldAlert,
  Send,
  RefreshCw
} from 'lucide-react';

export const Returns = () => {
  const { user, api } = useAuth();

  const [returnsList, setReturnsList] = useState([]);
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [warrantyFilter, setWarrantyFilter] = useState('ALL');

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [detailsTab, setDetailsTab] = useState('flow'); // 'flow' | 'warranty' | 'emails' | 'timeline'
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Form State for New Return Request
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedItemName, setSelectedItemName] = useState('');
  const [quantityReturned, setQuantityReturned] = useState(1);
  const [returnReason, setReturnReason] = useState('Defective / Malfunctioning');
  const [itemCondition, setItemCondition] = useState('Brand New (Opened Box)');
  const [reasonDescription, setReasonDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Action State for Approval / Pickup
  const [approvalResolution, setApprovalResolution] = useState('Refund');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [pickupCarrier, setPickupCarrier] = useState('VendSphere Express Logistics');
  const [pickupTracking, setPickupTracking] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isManagerOrAdmin = ['Admin', 'Company Admin', 'ProcurementManager', 'Manager'].includes(user.role);

  // Load all returns and eligible POs
  const loadData = async () => {
    try {
      setLoading(true);
      const [returnsRes, ordersRes] = await Promise.all([
        api.get('/api/returns'),
        api.get('/api/returns/eligible-orders')
      ]);
      setReturnsList(returnsRes.data);
      setEligibleOrders(ordersRes.data);
    } catch (err) {
      console.error('Failed to load returns data:', err);
      setError('Failed to load item return records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // View Return Details and full workflow
  const handleViewDetails = async (returnId) => {
    try {
      const res = await api.get(`/api/returns/${returnId}`);
      setSelectedReturn(res.data);
      setDetailsTab('flow');
      setApprovalResolution(res.data.resolution_type || 'Refund');
      setShowDetailsModal(true);
    } catch (err) {
      console.error('Failed to load return details:', err);
      alert('Could not retrieve return details.');
    }
  };

  // Submit New Return Request
  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (!selectedPoId || !selectedItemName || !quantityReturned) {
      alert('Please fill out all required fields.');
      return;
    }

    const order = eligibleOrders.find(o => o.id === selectedPoId);
    if (!order) return;

    const items = Array.isArray(order.pr_items) ? order.pr_items : [];
    const chosenItem = items.find(i => i.name === selectedItemName);

    setSubmitting(true);
    try {
      await api.post('/api/returns', {
        purchaseOrderId: selectedPoId,
        itemName: selectedItemName,
        itemCategory: chosenItem?.category || 'General Goods',
        quantityReturned: parseInt(quantityReturned, 10),
        unitPrice: parseFloat(chosenItem?.estimated_cost || 0),
        returnReason,
        itemCondition,
        reasonDescription,
        warrantyPeriodDays: 180
      });

      // Reset form
      setSelectedPoId('');
      setSelectedItemName('');
      setQuantityReturned(1);
      setReasonDescription('');
      setShowRequestModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to submit return:', err);
      alert(err.response?.data?.error || 'Failed to submit return request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Manager Approve Return Request
  const handleApproveReturn = async () => {
    if (!selectedReturn) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/returns/${selectedReturn.id}/approve`, {
        resolutionType: approvalResolution,
        approvalNotes
      });
      setSelectedReturn(prev => ({ ...prev, ...res.data, status: 'Approved' }));
      setApprovalNotes('');
      loadData();
      alert(`Return request ${selectedReturn.rma_number} has been approved.`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to approve return.');
    } finally {
      setActionLoading(false);
    }
  };

  // Manager Reject Return Request
  const handleRejectReturn = async () => {
    if (!selectedReturn || !rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/api/returns/${selectedReturn.id}/reject`, {
        rejectionReason
      });
      setSelectedReturn(prev => ({ ...prev, ...res.data, status: 'Rejected' }));
      setRejectionReason('');
      loadData();
      alert(`Return request ${selectedReturn.rma_number} has been rejected.`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to reject return.');
    } finally {
      setActionLoading(false);
    }
  };

  // Schedule Pickup
  const handleSchedulePickup = async () => {
    if (!selectedReturn) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/returns/${selectedReturn.id}/schedule-pickup`, {
        carrier: pickupCarrier,
        trackingNumber: pickupTracking
      });
      setSelectedReturn(prev => ({ ...prev, ...res.data, status: 'Pickup Scheduled' }));
      loadData();
      alert(`Logistics pickup scheduled for ${selectedReturn.rma_number}.`);
    } catch (err) {
      console.error(err);
      alert('Failed to schedule pickup.');
    } finally {
      setActionLoading(false);
    }
  };

  // Finalize & Complete Return
  const handleCompleteReturn = async () => {
    if (!selectedReturn) return;
    if (!window.confirm('Confirm that returned items have been received, restocked, and the resolution executed?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/api/returns/${selectedReturn.id}/complete`, {
        resolutionNotes: 'Return settled and closed.'
      });
      setSelectedReturn(prev => ({ ...prev, ...res.data, status: 'Completed' }));
      loadData();
      alert(`Return ${selectedReturn.rma_number} marked as Completed.`);
    } catch (err) {
      console.error(err);
      alert('Failed to finalize return.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter returns
  const filteredReturns = returnsList.filter(item => {
    const matchesSearch =
      item.rma_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.return_reason.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ? true : item.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesWarranty =
      warrantyFilter === 'ALL'
        ? true
        : warrantyFilter === 'VALID'
          ? item.isWarrantyValid
          : !item.isWarrantyValid;

    return matchesSearch && matchesStatus && matchesWarranty;
  });

  // Calculate live summary stats
  const totalReturnsCount = returnsList.length;
  const pendingReviewCount = returnsList.filter(r => r.status === 'Requested' || r.status === 'Warranty Verified').length;
  const approvedCount = returnsList.filter(r => r.status === 'Approved' || r.status === 'Pickup Scheduled').length;
  const completedCount = returnsList.filter(r => r.status === 'Completed').length;
  const warrantyValidCount = returnsList.filter(r => r.isWarrantyValid).length;

  // Selected order details for new request modal
  const activeSelectedOrder = eligibleOrders.find(o => o.id === selectedPoId);
  const activeOrderItems = activeSelectedOrder && Array.isArray(activeSelectedOrder.pr_items)
    ? activeSelectedOrder.pr_items
    : [];

  // Live warranty calculation for the new return form
  const orderPurchaseDate = activeSelectedOrder ? new Date(activeSelectedOrder.created_at) : null;
  const calculatedWarrantyExpiry = orderPurchaseDate
    ? new Date(orderPurchaseDate.getTime() + 180 * 24 * 60 * 60 * 1000)
    : null;
  const isFormWarrantyValid = calculatedWarrantyExpiry ? new Date() <= calculatedWarrantyExpiry : true;

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Item Returns & Warranty Management</h1>
          <p className="page-subtitle">
            Lodge return requests, inspect automated warranty validity checks, and track lifecycle approvals.
          </p>
        </div>

        {/* Action Button */}
        {user.role !== 'Vendor' && (
          <button
            onClick={() => {
              if (eligibleOrders.length === 0) {
                alert('No completed purchase orders available for returns.');
                return;
              }
              setSelectedPoId(eligibleOrders[0].id);
              const items = Array.isArray(eligibleOrders[0].pr_items) ? eligibleOrders[0].pr_items : [];
              if (items.length > 0) setSelectedItemName(items[0].name);
              setShowRequestModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={16} />
            <span>Request Item Return</span>
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="glass-card-grid">
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Total Return Requests</span>
            <h3 className="kpi-value">{totalReturnsCount}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)' }}>
            <RotateCcw size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Pending Approval</span>
            <h3 className="kpi-value">{pendingReviewCount}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px', display: 'block' }}>
              Requires manager decision
            </span>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
            <Clock size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Warranty Validated Items</span>
            <h3 className="kpi-value">{warrantyValidCount}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', display: 'block' }}>
              Within coverage period
            </span>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}>
            <ShieldCheck size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Completed & Settled</span>
            <h3 className="kpi-value">{completedCount}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '4px', display: 'block' }}>
              {approvedCount} currently in-transit
            </span>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(2, 132, 199, 0.1)' }}>
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by RMA #, Item, PO #, Vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
              style={{ height: '38px', fontSize: '0.85rem', minWidth: '150px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="REQUESTED">Requested</option>
              <option value="WARRANTY VERIFIED">Warranty Verified</option>
              <option value="APPROVED">Approved</option>
              <option value="PICKUP SCHEDULED">Pickup Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value)}
              className="form-select"
              style={{ height: '38px', fontSize: '0.85rem', minWidth: '150px' }}
            >
              <option value="ALL">All Warranty States</option>
              <option value="VALID">Within Warranty</option>
              <option value="EXPIRED">Warranty Expired</option>
            </select>

            <button
              onClick={loadData}
              className="btn btn-secondary"
              title="Refresh"
              style={{ height: '38px', padding: '0 0.75rem' }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="glass-panel" style={{ marginTop: '1.5rem', padding: 0 }}>
        <div className="table-container" style={{ margin: 0 }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>RMA Number</th>
                <th>Order Reference</th>
                <th>Returned Item</th>
                <th>Return Reason</th>
                <th>Warranty Validity</th>
                <th>Return Stage</th>
                <th>Resolution</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading item return records...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {returnsList.length === 0
                      ? 'No return requests recorded yet. Items from completed orders can be returned here.'
                      : 'No returns match your current filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id}>
                    <td>
                      <span style={{ fontWeight: '700', fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.85rem' }}>
                        {ret.rma_number}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(ret.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{ret.po_number}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {ret.vendor_name}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {ret.item_name}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Qty: {ret.quantity_returned} • ₹{parseFloat(ret.total_return_amount).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', display: 'block', fontWeight: '500' }}>
                        {ret.return_reason}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {ret.item_condition}
                      </span>
                    </td>
                    <td>
                      {ret.isWarrantyValid ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                            <ShieldCheck size={12} style={{ marginRight: '3px' }} />
                            Valid ({ret.warrantyDaysRemaining}d left)
                          </span>
                        </div>
                      ) : (
                        <span className="badge badge-rejected" style={{ fontSize: '0.7rem' }}>
                          <ShieldAlert size={12} style={{ marginRight: '3px' }} />
                          Expired
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        ret.status === 'Completed' ? 'badge-completed' :
                        ret.status === 'Approved' ? 'badge-approved' :
                        ret.status === 'Pickup Scheduled' ? 'badge-in-progress' :
                        ret.status === 'Rejected' ? 'badge-rejected' :
                        ret.status === 'Warranty Verified' ? 'badge-open' : 'badge-pending'
                      }`} style={{ fontSize: '0.72rem' }}>
                        {ret.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent)' }}>
                        {ret.resolution_type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleViewDetails(ret.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={14} />
                        <span>Inspect Flow</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: LODGE NEW RETURN REQUEST (WITH WARRANTY CHECK)
      ───────────────────────────────────────────────────────────── */}
      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Request Item Return (RMA)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Submit goods for validity check, warranty verification, and manager approval
                </span>
              </div>
              <button onClick={() => setShowRequestModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn}>
              <div className="modal-body">
                {/* 1. Select Purchase Order */}
                <div className="form-group">
                  <label className="form-label">Delivered Purchase Order *</label>
                  <select
                    value={selectedPoId}
                    onChange={(e) => {
                      const newPoId = e.target.value;
                      setSelectedPoId(newPoId);
                      const ord = eligibleOrders.find(o => o.id === newPoId);
                      const items = ord && Array.isArray(ord.pr_items) ? ord.pr_items : [];
                      if (items.length > 0) setSelectedItemName(items[0].name);
                    }}
                    className="form-select"
                    required
                  >
                    {eligibleOrders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.po_number} — {ord.pr_title} (Supplier: {ord.vendor_name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Line Item from this Order */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Item to Return *</label>
                    <select
                      value={selectedItemName}
                      onChange={(e) => setSelectedItemName(e.target.value)}
                      className="form-select"
                      required
                    >
                      {activeOrderItems.map((item, idx) => (
                        <option key={idx} value={item.name}>
                          {item.name} ({item.quantity} purchased @ ₹{item.estimated_cost})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Return Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={quantityReturned}
                      onChange={(e) => setQuantityReturned(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                {/* 3. LIVE WARRANTY ELIGIBILITY INSPECTOR */}
                <div style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isFormWarrantyValid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${isFormWarrantyValid ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={18} style={{ color: isFormWarrantyValid ? 'var(--success)' : 'var(--danger)' }} />
                      <strong style={{ fontSize: '0.85rem', color: isFormWarrantyValid ? 'var(--success)' : 'var(--danger)' }}>
                        Warranty Validity Check: {isFormWarrantyValid ? 'VERIFIED (Within Active Warranty)' : 'WARRANTY EXPIRED'}
                      </strong>
                    </div>
                    <span className={`badge ${isFormWarrantyValid ? 'badge-active' : 'badge-rejected'}`} style={{ fontSize: '0.7rem' }}>
                      180 Days Protection
                    </span>
                  </div>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {orderPurchaseDate ? (
                      <>
                        Order Purchase Date: <strong>{orderPurchaseDate.toLocaleDateString()}</strong> •
                        Coverage Expires: <strong>{calculatedWarrantyExpiry?.toLocaleDateString()}</strong>.
                        {isFormWarrantyValid
                          ? ' Item is eligible for manufacturer warranty replacement or full credit refund.'
                          : ' Return is outside standard 180-day window; manager exception review will be triggered.'}
                      </>
                    ) : 'Select a purchase order to compute warranty coverage.'}
                  </p>
                </div>

                {/* 4. Return Reason & Condition */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Reason for Return *</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="Defective / Malfunctioning">Defective / Malfunctioning</option>
                      <option value="Damaged in Transit">Damaged in Transit</option>
                      <option value="Incorrect Specification Delivered">Incorrect Specification Delivered</option>
                      <option value="Quality Substandard / Failed Inspection">Quality Substandard / Failed Inspection</option>
                      <option value="Missing Parts / Accessories">Missing Parts / Accessories</option>
                      <option value="Other / Commercial Adjustment">Other / Commercial Adjustment</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Item Physical Condition *</label>
                    <select
                      value={itemCondition}
                      onChange={(e) => setItemCondition(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="Brand New (Opened Box)">Brand New (Opened Box)</option>
                      <option value="Used / Defective Condition">Used / Defective Condition</option>
                      <option value="Damaged Physical Exterior">Damaged Physical Exterior</option>
                      <option value="Original Sealed Packaging">Original Sealed Packaging</option>
                    </select>
                  </div>
                </div>

                {/* 5. Detailed Description */}
                <div className="form-group">
                  <label className="form-label">Problem Description & Defect Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Provide specific details about the issue, serial numbers, or defect observations..."
                    value={reasonDescription}
                    onChange={(e) => setReasonDescription(e.target.value)}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowRequestModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Lodge Return Request...' : 'Submit Return & Run Warranty Check'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: RETURN WORKFLOW COCKPIT & WARRANTY VALIDITY VIEWER
      ───────────────────────────────────────────────────────────── */}
      {showDetailsModal && selectedReturn && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Return Flow: {selectedReturn.rma_number}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Linked to Purchase Order {selectedReturn.po_number} • Supplier: {selectedReturn.vendor_name}
                  </span>
                </div>
              </div>

              <button onClick={() => setShowDetailsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Sub-tab Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--card-item-bg)' }}>
              <button
                onClick={() => setDetailsTab('flow')}
                className={`btn ${detailsTab === 'flow' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
              >
                Workflow Flow & Actions
              </button>
              <button
                onClick={() => setDetailsTab('warranty')}
                className={`btn ${detailsTab === 'warranty' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
              >
                Warranty Certificate
              </button>
              <button
                onClick={() => setDetailsTab('emails')}
                className={`btn ${detailsTab === 'emails' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
              >
                Email Notifications ({selectedReturn.emails?.length || 0})
              </button>
              <button
                onClick={() => setDetailsTab('timeline')}
                className={`btn ${detailsTab === 'timeline' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
              >
                Audit Timeline
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '68vh' }}>
              {/* ──────────────────────────────────────────────────
                  SUB-TAB: FLOW & ACTIONS
              ────────────────────────────────────────────────── */}
              {detailsTab === 'flow' && (
                <div>
                  {/* VISUAL WORKFLOW STEPPER */}
                  <div style={{
                    padding: '1.25rem',
                    background: 'var(--card-item-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      Item Return Lifecycle Stepper
                    </h4>

                    {/* Horizontal 4-Stage Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {/* Step 1: Return Requested */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '140px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'var(--success)', color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 'bold'
                        }}>
                          <Check size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-primary)' }}>1. Return Requested</strong>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lodged by {selectedReturn.requester_name}</span>
                        </div>
                      </div>

                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />

                      {/* Step 2: Checks Validity (Warranty) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '150px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: selectedReturn.isWarrantyValid ? 'var(--success)' : 'var(--warning)',
                          color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 'bold'
                        }}>
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-primary)' }}>2. Warranty Check</strong>
                          <span style={{ fontSize: '0.68rem', color: selectedReturn.isWarrantyValid ? 'var(--success)' : 'var(--warning)' }}>
                            {selectedReturn.isWarrantyValid ? 'Passed (Within Warranty)' : 'Expired (Review Needed)'}
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />

                      {/* Step 3: Approve Returning Request */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '150px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: ['Approved', 'Pickup Scheduled', 'Completed'].includes(selectedReturn.status)
                            ? 'var(--success)'
                            : selectedReturn.status === 'Rejected'
                              ? 'var(--danger)'
                              : 'var(--card-item-border)',
                          color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 'bold'
                        }}>
                          {selectedReturn.status === 'Rejected' ? <X size={16} /> : <CheckCircle2 size={16} />}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-primary)' }}>3. Manager Approval</strong>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {['Approved', 'Pickup Scheduled', 'Completed'].includes(selectedReturn.status)
                              ? `Approved (${selectedReturn.resolution_type})`
                              : selectedReturn.status === 'Rejected'
                                ? 'Declined'
                                : 'Pending Decision'}
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />

                      {/* Step 4: Pickup & Completed */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '140px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: selectedReturn.status === 'Completed'
                            ? 'var(--success)'
                            : selectedReturn.status === 'Pickup Scheduled'
                              ? 'var(--accent)'
                              : 'var(--card-item-border)',
                          color: '#ffffff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 'bold'
                        }}>
                          <Truck size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-primary)' }}>4. Pickup & Settle</strong>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {selectedReturn.status === 'Completed' ? 'Closed & Refunded' : 'In Logistics'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Return Item Card */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Item Details</span>
                      <h4 style={{ margin: '4px 0', fontSize: '0.95rem' }}>{selectedReturn.item_name}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Quantity: <strong>{selectedReturn.quantity_returned} units</strong> • Total: <strong>₹{parseFloat(selectedReturn.total_return_amount).toLocaleString()}</strong>
                      </p>
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reason & Physical State</span>
                      <h4 style={{ margin: '4px 0', fontSize: '0.95rem' }}>{selectedReturn.return_reason}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Condition: <strong>{selectedReturn.item_condition}</strong>
                      </p>
                    </div>
                  </div>

                  {selectedReturn.reason_description && (
                    <div style={{ padding: '0.85rem 1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Requester Problem Notes:</span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        "{selectedReturn.reason_description}"
                      </p>
                    </div>
                  )}

                  {/* ──────────────────────────────────────────────────
                      ACTION SECTION (FOR MANAGER / ADMIN)
                  ────────────────────────────────────────────────── */}
                  {isManagerOrAdmin && (
                    <div style={{
                      padding: '1.25rem',
                      background: 'var(--card-item-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem' }}>Manager Approval & Action Deck</h4>

                      {/* If in review state: Show Approve & Reject */}
                      {['Requested', 'Warranty Verified'].includes(selectedReturn.status) && (
                        <div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            Warranty validity check has been calculated as <strong>{selectedReturn.isWarrantyValid ? 'Within Warranty' : 'Expired'}</strong>. Choose a resolution to authorize this RMA:
                          </p>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                              <label className="form-label">Authorized Resolution *</label>
                              <select
                                value={approvalResolution}
                                onChange={(e) => setApprovalResolution(e.target.value)}
                                className="form-select"
                              >
                                <option value="Refund">Full Refund (₹{parseFloat(selectedReturn.total_return_amount).toLocaleString()})</option>
                                <option value="Replacement">Send Replacement Item</option>
                                <option value="Vendor Credit">Issue Vendor Credit Note</option>
                              </select>
                            </div>

                            <div>
                              <label className="form-label">Manager Approval Notes</label>
                              <input
                                type="text"
                                placeholder="e.g. Return authorized; packaging verified by receiving dock."
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value)}
                                className="form-input"
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '400px' }}>
                              <input
                                type="text"
                                placeholder="Rejection reason..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="form-input"
                                style={{ height: '36px', fontSize: '0.8rem' }}
                              />
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleRejectReturn}
                                className="btn btn-secondary"
                                style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                              >
                                Reject Return
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={handleApproveReturn}
                              className="btn btn-primary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                            >
                              <CheckCircle2 size={16} />
                              <span>Approve Return Request</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* If Approved: Schedule Logistics */}
                      {selectedReturn.status === 'Approved' && (
                        <div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            RMA authorized. Schedule logistics pickup or carrier dispatch:
                          </p>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                              <label className="form-label">Carrier Logistics Partner</label>
                              <input
                                type="text"
                                value={pickupCarrier}
                                onChange={(e) => setPickupCarrier(e.target.value)}
                                className="form-input"
                              />
                            </div>
                            <div>
                              <label className="form-label">Tracking / AWB Number</label>
                              <input
                                type="text"
                                placeholder="e.g. TRK-RET-94827"
                                value={pickupTracking}
                                onChange={(e) => setPickupTracking(e.target.value)}
                                className="form-input"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleSchedulePickup}
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Truck size={16} />
                            <span>Schedule Logistics Pickup</span>
                          </button>
                        </div>
                      )}

                      {/* If Pickup Scheduled: Complete Return */}
                      {selectedReturn.status === 'Pickup Scheduled' && (
                        <div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            Carrier: <strong>{selectedReturn.pickup_carrier}</strong> • Tracking: <strong>{selectedReturn.pickup_tracking_number}</strong>.
                            Once goods have been verified and restocked, complete the settlement:
                          </p>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleCompleteReturn}
                            className="btn btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <CheckCircle2 size={16} />
                            <span>Mark Return Completed & Settled</span>
                          </button>
                        </div>
                      )}

                      {/* Completed State */}
                      {selectedReturn.status === 'Completed' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                          <CheckCircle2 size={20} />
                          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                            This return lifecycle is fully closed and the resolution ({selectedReturn.resolution_type}) was processed.
                          </span>
                        </div>
                      )}

                      {/* Rejected State */}
                      {selectedReturn.status === 'Rejected' && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                          <strong>Return Declined:</strong> {selectedReturn.rejection_reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────────────────────────────────────────
                  SUB-TAB: WARRANTY CERTIFICATE
              ────────────────────────────────────────────────── */}
              {detailsTab === 'warranty' && (
                <div style={{
                  padding: '1.5rem',
                  background: 'var(--card-item-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={22} style={{ color: selectedReturn.isWarrantyValid ? 'var(--success)' : 'var(--danger)' }} />
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Warranty & Validity Certificate</h3>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Certificate Ref: WRT-{selectedReturn.rma_number.replace('RMA-', '')}
                      </span>
                    </div>

                    <span className={`badge ${selectedReturn.isWarrantyValid ? 'badge-active' : 'badge-rejected'}`} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                      {selectedReturn.isWarrantyValid ? 'Coverage Active' : 'Coverage Expired'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Purchase Date</span>
                      <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>
                        {new Date(selectedReturn.purchase_date).toLocaleDateString()}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Warranty Expiration</span>
                      <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>
                        {new Date(selectedReturn.warranty_expiry_date).toLocaleDateString()}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Standard Coverage Window</span>
                      <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px' }}>
                        {selectedReturn.warranty_period_days || 180} Days Standard Protection
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Validity Status</span>
                      <strong style={{ display: 'block', fontSize: '0.95rem', marginTop: '2px', color: selectedReturn.isWarrantyValid ? 'var(--success)' : 'var(--danger)' }}>
                        {selectedReturn.isWarrantyValid
                          ? `Valid (${selectedReturn.warrantyDaysRemaining} days remaining)`
                          : `Expired (${Math.abs(selectedReturn.warrantyDaysRemaining)} days ago)`}
                      </strong>
                    </div>
                  </div>

                  <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <h5 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: 'var(--text-primary)' }}>Warranty Policy Terms:</h5>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Under VendSphere Supplier Agreement clauses, items returned within the coverage period for verified manufacturing defects, transit damage, or specification mismatch are entitled to 100% full credit refund or direct manufacturer replacement.
                    </p>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────
                  SUB-TAB: SIMULATED EMAILS
              ────────────────────────────────────────────────── */}
              {detailsTab === 'emails' && (
                <div>
                  {(selectedReturn.emails || []).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                      No email notifications sent for this return yet.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {selectedReturn.emails.map((mail) => (
                        <div
                          key={mail.id}
                          style={{
                            padding: '1rem',
                            background: 'var(--card-item-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                                {mail.subject}
                              </strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                To: <strong>{mail.to_email}</strong> • {new Date(mail.sent_at).toLocaleString()}
                              </span>
                            </div>
                            <span className="badge badge-sent" style={{ fontSize: '0.68rem' }}>
                              {mail.email_type || 'DISPATCHED'}
                            </span>
                          </div>

                          <pre style={{
                            margin: '8px 0 0 0',
                            padding: '0.85rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace'
                          }}>
                            {mail.body}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────────────────────────────────────────
                  SUB-TAB: TIMELINE
              ────────────────────────────────────────────────── */}
              {detailsTab === 'timeline' && (
                <div>
                  {(selectedReturn.activities || []).map((act, i) => (
                    <div
                      key={act.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        paddingBottom: '1rem',
                        marginBottom: '1rem',
                        borderBottom: i < selectedReturn.activities.length - 1 ? '1px solid var(--border-color)' : 'none'
                      }}
                    >
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 'bold'
                      }}>
                        {i + 1}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {act.action_type.replace('_', ' ')}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(act.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {act.notes}
                        </p>
                        {act.user_name && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                            By {act.user_name} ({act.user_role})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setShowDetailsModal(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;
