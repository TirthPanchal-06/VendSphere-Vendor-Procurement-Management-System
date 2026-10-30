import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  GitPullRequest,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Truck,
  DollarSign,
  Layers,
  ArrowUpRight,
  Filter,
  Send,
  Eye,
  Sliders,
  Building2,
  FileText,
  X
} from 'lucide-react';

export const RiskManagement = () => {
  const { user, api } = useAuth();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'delays' | 'prices' | 'bottlenecks'

  // Table Filters
  const [filterType, setFilterType] = useState('ALL');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [searchTerm, setSearchTerm] = useState('');

  // Mitigation Modal
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [showMitigateModal, setShowMitigateModal] = useState(false);
  const [mitigationPlan, setMitigationPlan] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Load Risk Assessment Data
  const loadRiskData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/risks/overview');
      setOverview(res.data);
    } catch (err) {
      console.error('Failed to load risk telemetry:', err);
      setError('Failed to compute procurement risk metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiskData();
  }, []);

  // Trigger Fresh Assessment
  const handleScanRisks = async () => {
    try {
      setScanning(true);
      const res = await api.post('/api/risks/assess');
      setOverview(prev => ({
        ...prev,
        ...res.data
      }));
      await loadRiskData();
    } catch (err) {
      console.error(err);
      alert('Failed to execute risk analysis scan.');
    } finally {
      setScanning(false);
    }
  };

  // Open Mitigation Modal
  const handleOpenMitigate = (risk) => {
    setSelectedRisk(risk);
    // Pre-populate recommended strategy based on type
    if (risk.risk_type === 'VENDOR_DELAY') {
      setMitigationPlan(`Dispatch expedited logistics notice to ${risk.metadata?.vendorName || 'supplier'} and invoke contractual SLA delivery clause.`);
    } else if (risk.risk_type === 'PRICE_FLUCTUATION') {
      setMitigationPlan(`Initiate commercial price renegotiation on ${risk.metadata?.itemName || 'item'} or source quote from secondary approved vendor.`);
    } else {
      setMitigationPlan(`Escalate approval SLA reminder to ${risk.metadata?.approverName || 'department lead'} for expedited requisition sign-off.`);
    }
    setShowMitigateModal(true);
  };

  // Submit Mitigation Action
  const handleSubmitMitigation = async (e) => {
    e.preventDefault();
    if (!selectedRisk || !mitigationPlan.trim()) return;

    setSubmittingAction(true);
    try {
      await api.post(`/api/risks/${selectedRisk.id}/mitigate`, {
        mitigationPlan,
        notifyTeam: notifyEmail
      });
      setShowMitigateModal(false);
      setSelectedRisk(null);
      await loadRiskData();
      alert('Mitigation plan recorded. Real-time email alert dispatched.');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit mitigation action.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Mark Risk as Resolved
  const handleResolveRisk = async (riskId) => {
    if (!window.confirm('Mark this procurement risk as resolved and neutralized?')) return;
    try {
      await api.post(`/api/risks/${riskId}/resolve`, {
        resolutionNotes: `Resolved by ${user.name} (${user.role}). Condition normalized.`
      });
      await loadRiskData();
    } catch (err) {
      console.error(err);
      alert('Failed to resolve risk.');
    }
  };

  // Dismiss Risk
  const handleDismissRisk = async (riskId) => {
    if (!window.confirm('Dismiss this risk alert?')) return;
    try {
      await api.post(`/api/risks/${riskId}/dismiss`);
      await loadRiskData();
    } catch (err) {
      console.error(err);
      alert('Failed to dismiss risk.');
    }
  };

  if (loading && !overview) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Analyzing vendor delays, price volatility & approval bottlenecks...</p>
      </div>
    );
  }

  const persistedRisks = overview?.persistedRisks || [];
  const vendorDelays = overview?.vendorDelayRisks || [];
  const priceSurges = overview?.priceFluctuationRisks || [];
  const bottlenecks = overview?.bottleneckRisks || [];

  // Filter persisted risks list
  const filteredRisks = persistedRisks.filter(r => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.risk_type.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'ALL' || r.risk_type === filterType;
    const matchesSeverity = filterSeverity === 'ALL' || r.severity === filterSeverity;
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;

    return matchesSearch && matchesType && matchesSeverity && matchesStatus;
  });

  const getSeverityBadgeClass = (sev) => {
    switch (sev) {
      case 'Critical': return 'badge-priority-urgent';
      case 'High': return 'badge-rejected';
      case 'Medium': return 'badge-pending';
      default: return 'badge-open';
    }
  };

  return (
    <div>
      {/* Page Header & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={28} style={{ color: overview?.overallRiskScore >= 60 ? 'var(--danger)' : 'var(--warning)' }} />
            <span>Procurement Risk Management</span>
          </h1>
          <p className="page-subtitle">
            Early warning detection for supplier delivery delays, item price volatility, and approval flow bottlenecks.
          </p>
        </div>

        <button
          onClick={handleScanRisks}
          disabled={scanning}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={16} className={scanning ? 'spin' : ''} />
          <span>{scanning ? 'Scanning Pipeline...' : 'Run Risk Assessment Scan'}</span>
        </button>
      </div>

      {/* TOP KPI CARDS */}
      <div className="glass-card-grid">
        {/* Overall Risk Score */}
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Enterprise Risk Index</span>
            <h3 className="kpi-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{overview?.overallRiskScore || 24}</span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 'bold',
              color: overview?.overallRiskScore >= 60 ? 'var(--danger)' : overview?.overallRiskScore >= 35 ? 'var(--warning)' : 'var(--success)'
            }}>
              {overview?.riskLevel} Risk Profile
            </span>
          </div>
          <div className="kpi-icon" style={{
            color: overview?.overallRiskScore >= 60 ? 'var(--danger)' : 'var(--warning)',
            background: overview?.overallRiskScore >= 60 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'
          }}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Vendor Delays */}
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Vendor Delivery Delays</span>
            <h3 className="kpi-value">{overview?.counts?.vendorDelays || 0}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>
              Risk Score: {overview?.scores?.vendorDelayScore || 0}/100
            </span>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(2, 132, 199, 0.1)' }}>
            <Truck size={24} />
          </div>
        </div>

        {/* Price Fluctuation */}
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Price Volatility Surge</span>
            <h3 className="kpi-value">{overview?.counts?.priceFluctuations || 0} items</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>
              Volatility Index: {overview?.scores?.priceVolatilityScore || 0}/100
            </span>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Procurement Bottlenecks */}
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Approval Bottlenecks</span>
            <h3 className="kpi-value">{overview?.counts?.bottlenecks || 0}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
              Bottleneck Index: {overview?.scores?.bottleneckScore || 0}/100
            </span>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)' }}>
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.5rem',
        marginTop: '1.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--glass-border)',
        paddingBottom: '0.75rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card-item-bg)', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
          >
            <ShieldAlert size={16} />
            <span>Command Center ({overview?.counts?.total || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('delays')}
            className={`btn ${activeTab === 'delays' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
          >
            <Truck size={16} />
            <span>Vendor Delays ({vendorDelays.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`btn ${activeTab === 'prices' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
          >
            <TrendingUp size={16} />
            <span>Price Fluctuation ({priceSurges.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('bottlenecks')}
            className={`btn ${activeTab === 'bottlenecks' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
          >
            <Clock size={16} />
            <span>Procurement Bottlenecks ({bottlenecks.length})</span>
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Total Budget Exposure: <strong style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>₹{parseFloat(overview?.totalBudgetAtRisk || 0).toLocaleString()}</strong>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: COMMAND CENTER (ALL ACTIVE RISKS)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div>
          {/* Severity & Domain Split Progress Bars */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Risk Severity Breakdown</h4>
              <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                <div style={{ width: `${(overview?.counts?.critical / (overview?.counts?.total || 1)) * 100}%`, background: '#ef4444' }} title={`Critical: ${overview?.counts?.critical}`} />
                <div style={{ width: `${(overview?.counts?.high / (overview?.counts?.total || 1)) * 100}%`, background: '#f97316' }} title={`High: ${overview?.counts?.high}`} />
                <div style={{ width: `${(overview?.counts?.medium / (overview?.counts?.total || 1)) * 100}%`, background: '#f59e0b' }} title={`Medium: ${overview?.counts?.medium}`} />
                <div style={{ width: `${(overview?.counts?.low / (overview?.counts?.total || 1)) * 100}%`, background: '#3b82f6' }} title={`Low: ${overview?.counts?.low}`} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span><span style={{ color: '#ef4444' }}>&bull;</span> {overview?.counts?.critical || 0} Critical</span>
                <span><span style={{ color: '#f97316' }}>&bull;</span> {overview?.counts?.high || 0} High</span>
                <span><span style={{ color: '#f59e0b' }}>&bull;</span> {overview?.counts?.medium || 0} Medium</span>
                <span><span style={{ color: '#3b82f6' }}>&bull;</span> {overview?.counts?.low || 0} Low</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Risk Distribution by Domain</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Vendor Supply Chain Delays</span>
                  <strong>{overview?.counts?.vendorDelays || 0} alerts</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Price Fluctuation & Cost Surges</span>
                  <strong>{overview?.counts?.priceFluctuations || 0} items</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Requisition & Approval Bottlenecks</span>
                  <strong>{overview?.counts?.bottlenecks || 0} stalled</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter risk title, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '34px', height: '36px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="form-select"
                  style={{ height: '36px', fontSize: '0.8rem' }}
                >
                  <option value="ALL">All Risk Domains</option>
                  <option value="VENDOR_DELAY">Vendor Delays</option>
                  <option value="PRICE_FLUCTUATION">Price Fluctuation</option>
                  <option value="PROCUREMENT_BOTTLENECK">Procurement Bottlenecks</option>
                </select>

                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="form-select"
                  style={{ height: '36px', fontSize: '0.8rem' }}
                >
                  <option value="ALL">All Severities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="form-select"
                  style={{ height: '36px', fontSize: '0.8rem' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Mitigating">Mitigating</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>
          </div>

          {/* Master Risks Table */}
          <div className="glass-panel" style={{ padding: 0 }}>
            <div className="table-container" style={{ margin: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Risk Domain</th>
                    <th>Risk Subject & Context</th>
                    <th>Impact Score</th>
                    <th>Exposure (₹)</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Mitigation Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No risks currently match the active filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRisks.map((risk) => (
                      <tr key={risk.id}>
                        <td>
                          <span className={`badge ${getSeverityBadgeClass(risk.severity)}`} style={{ fontSize: '0.72rem' }}>
                            {risk.severity}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                            {risk.risk_type === 'VENDOR_DELAY' ? 'Vendor Delay' :
                             risk.risk_type === 'PRICE_FLUCTUATION' ? 'Price Fluctuation' : 'Approval Bottleneck'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '320px' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                            {risk.title}
                          </strong>
                          <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {risk.description}
                          </p>
                          {risk.mitigation_plan && (
                            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--success)' }}>
                              Plan: {risk.mitigation_plan} ({risk.mitigated_by_name || 'Assigned'})
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '48px', height: '6px', background: 'var(--card-item-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${risk.impact_score}%`, height: '100%', background: risk.impact_score >= 75 ? 'var(--danger)' : 'var(--warning)' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{Math.round(risk.impact_score)}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--accent)' }}>
                            ₹{parseFloat(risk.financial_exposure || 0).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${risk.status === 'Resolved' ? 'badge-completed' : risk.status === 'Mitigating' ? 'badge-in-progress' : 'badge-pending'}`} style={{ fontSize: '0.7rem' }}>
                            {risk.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            {risk.status !== 'Resolved' && (
                              <button
                                onClick={() => handleOpenMitigate(risk)}
                                className="btn btn-primary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                                title="Assign Mitigation Plan"
                              >
                                <span>Mitigate</span>
                              </button>
                            )}

                            {risk.status === 'Mitigating' && (
                              <button
                                onClick={() => handleResolveRisk(risk.id)}
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--success)' }}
                                title="Resolve Risk"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}

                            {risk.status === 'Active' && (
                              <button
                                onClick={() => handleDismissRisk(risk.id)}
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                                title="Dismiss"
                              >
                                <X size={14} />
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: VENDOR DELAYS & LOGISTICS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'delays' && (
        <div>
          <div className="glass-panel" style={{ padding: 0, marginBottom: '1.5rem' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Active Supplier Delay Tracker</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Purchase orders exceeding agreed quotation lead days or flagged by vendor scorecard
                </span>
              </div>
              <span className="badge badge-rejected">{vendorDelays.length} Overdue Orders</span>
            </div>

            <div className="table-container" style={{ margin: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Promised Lead Time</th>
                    <th>Days Elapsed</th>
                    <th>Overdue Severity</th>
                    <th>Order Valuation</th>
                    <th style={{ textAlign: 'right' }}>Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorDelays.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No delivery delays detected. All active vendor shipments are on schedule.
                      </td>
                    </tr>
                  ) : (
                    vendorDelays.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.metadata?.poNumber}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: '600' }}>{item.metadata?.vendorName}</span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Scorecard: {item.metadata?.performanceScore}/100
                          </span>
                        </td>
                        <td>{item.metadata?.promisedDays} Days</td>
                        <td>{item.metadata?.daysElapsed} Days</td>
                        <td>
                          <span className={`badge ${getSeverityBadgeClass(item.severity)}`} style={{ fontSize: '0.72rem' }}>
                            {item.metadata?.overdueDays > 0 ? `+${item.metadata?.overdueDays}d Late` : 'Impending Delay'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                          ₹{parseFloat(item.financial_exposure).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenMitigate(item)}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            Expedite Notice
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: PRICE FLUCTUATION & COST VOLATILITY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'prices' && (
        <div>
          <div className="glass-panel" style={{ padding: 0, marginBottom: '1.5rem' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Line Item Price Volatility Radar</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Items with supplier quoted pricing exceeding approved baseline budget estimates
                </span>
              </div>
              <span className="badge badge-priority-urgent">{priceSurges.length} Surging Items</span>
            </div>

            <div className="table-container" style={{ margin: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Baseline Budget (₹)</th>
                    <th>Quoted Unit Price (₹)</th>
                    <th>Price Surge (%)</th>
                    <th>Budget Exposure (₹)</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {priceSurges.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No price volatility alerts detected. Sourced items are within target cost parameters.
                      </td>
                    </tr>
                  ) : (
                    priceSurges.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.metadata?.itemName}</strong>
                        </td>
                        <td>{item.metadata?.category}</td>
                        <td>{item.metadata?.vendorName}</td>
                        <td>₹{parseFloat(item.metadata?.baselineUnitPrice).toFixed(2)}</td>
                        <td style={{ fontWeight: 'bold' }}>₹{parseFloat(item.metadata?.quotedUnitPrice).toFixed(2)}</td>
                        <td>
                          <span className={`badge ${getSeverityBadgeClass(item.severity)}`} style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                            +{item.metadata?.priceDeltaPct}% Surge
                          </span>
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--danger)' }}>
                          ₹{parseFloat(item.financial_exposure).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenMitigate(item)}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            Renegotiate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: PROCUREMENT BOTTLENECKS & APPROVAL LAG
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bottlenecks' && (
        <div>
          <div className="glass-panel" style={{ padding: 0, marginBottom: '1.5rem' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Requisition Aging & Bottleneck Queue</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Requisitions and sourcing workflows stalled in approval queues exceeding 48 hours
                </span>
              </div>
              <span className="badge badge-in-progress">{bottlenecks.length} Stalled Workflows</span>
            </div>

            <div className="table-container" style={{ margin: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Requisition / RFQ</th>
                    <th>Requester & Department</th>
                    <th>Pending Duration</th>
                    <th>Stalled Approver Queue</th>
                    <th>Estimated Cost</th>
                    <th>Severity</th>
                    <th style={{ textAlign: 'right' }}>Escalation</th>
                  </tr>
                </thead>
                <tbody>
                  {bottlenecks.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No approval bottlenecks identified. Workflow approvals are progressing on SLA.
                      </td>
                    </tr>
                  ) : (
                    bottlenecks.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.metadata?.prNumber || item.metadata?.rfqNumber}</strong>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {item.metadata?.title}
                          </span>
                        </td>
                        <td>
                          <span>{item.metadata?.requesterName || 'Sourcing Team'}</span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {item.metadata?.department || 'Procurement'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>
                            {item.metadata?.daysElapsed ? `${item.metadata?.daysElapsed} Days (${item.metadata?.hoursElapsed}h)` : `${item.metadata?.hoursToDeadline}h to deadline`}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-draft">{item.metadata?.approverName || 'Bidding Window'}</span>
                        </td>
                        <td style={{ fontWeight: 'bold' }}>
                          ₹{parseFloat(item.financial_exposure || 0).toLocaleString()}
                        </td>
                        <td>
                          <span className={`badge ${getSeverityBadgeClass(item.severity)}`}>
                            {item.severity}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenMitigate(item)}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            Escalate SLA
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MITIGATION ACTION MODAL
      ───────────────────────────────────────────────────────────── */}
      {showMitigateModal && selectedRisk && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Authorize Risk Mitigation Plan</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Action item for: {selectedRisk.title}
                </span>
              </div>
              <button onClick={() => setShowMitigateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitMitigation}>
              <div className="modal-body">
                <div style={{ padding: '1rem', background: 'var(--card-item-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Risk Domain: <strong>{selectedRisk.risk_type}</strong>
                    </span>
                    <span className={`badge ${getSeverityBadgeClass(selectedRisk.severity)}`}>
                      {selectedRisk.severity}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {selectedRisk.description}
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Mitigation Strategy / Action Plan *</label>
                  <textarea
                    rows={3}
                    value={mitigationPlan}
                    onChange={(e) => setMitigationPlan(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem' }}>
                  <input
                    type="checkbox"
                    id="notifyEmail"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                  />
                  <label htmlFor="notifyEmail" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Send real-time email notification alert to <strong>tirthpanchal65@gmail.com</strong>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowMitigateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingAction} className="btn btn-primary">
                  {submittingAction ? 'Recording Action...' : 'Confirm Mitigation Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskManagement;

