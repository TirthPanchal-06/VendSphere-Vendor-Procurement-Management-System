import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  FileText,
  Users,
  Layers,
  ClipboardCheck,
  Star,
  Activity,
  Calendar,
  AlertCircle,
  MessageSquare,
  BarChart3,
  PieChart,
  Award,
  Package,
  Download,
  Printer,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  X
} from 'lucide-react';

/**
 * Enterprise Dashboard & Analytics Cockpit
 * Features role-based views with a statistical analytics suite for Admins and Managers.
 */
export const Dashboard = () => {
  const { user, api } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Analytics navigation tab for Admin / Manager
  const [analyticsTab, setAnalyticsTab] = useState('overview'); // 'overview' | 'vendors' | 'items' | 'reports'

  // Executive Report Print / Preview Modal
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const res = await api.get('/api/dashboard');
        setStats(res.data);
      } catch (err) {
        setError('Failed to load dashboard metrics.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Compiling enterprise analytics & KPI metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ borderColor: 'var(--danger)', padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h3>Error loading Dashboard</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{error}</p>
      </div>
    );
  }

  // ==========================================
  // 1. VENDOR ROLE DASHBOARD
  // ==========================================
  const renderVendorDashboard = () => (
    <div>
      <div className="glass-card-grid">
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Active Bids / Quotations</span>
            <h3 className="kpi-value">{stats.bidsCount}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)' }}>
            <Layers size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Contracts Awarded (Won)</span>
            <h3 className="kpi-value">{stats.bidsWon}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}>
            <ClipboardCheck size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Total PO Revenue</span>
            <h3 className="kpi-value">₹{stats.poRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)' }}>
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Performance Score</span>
            <h3 className="kpi-value" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>{stats.performanceScore}</span>
              <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>/100</span>
            </h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
            <Star size={24} />
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ marginTop: '2rem' }}>
        <h3>Vendor Profile Status</h3>
        <div style={{ display: 'flex', gap: '2.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block' }}>Portal Onboarding State</span>
            <span className={`badge badge-${stats.vendorStatus?.toLowerCase() === 'active' ? 'active' : 'pending'}`} style={{ marginTop: '0.5rem', padding: '0.4rem 1rem' }}>
              {stats.vendorStatus}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block' }}>Evaluation Rating</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
              <span>{stats.rating}</span>
              <Star size={16} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block' }}>Dispatched Purchase Orders</span>
            <span style={{ display: 'block', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
              {stats.poCount} Orders
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // 2. EMPLOYEE ROLE DASHBOARD
  // ==========================================
  const renderEmployeeDashboard = () => (
    <div>
      <div className="glass-card-grid">
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Total Purchase Requests</span>
            <h3 className="kpi-value">{stats.totalRequests}</h3>
          </div>
          <div className="kpi-icon">
            <FileText size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Pending Approval</span>
            <h3 className="kpi-value">{stats.statusCounts?.pending}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
            <Calendar size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Approved Requisitions</span>
            <h3 className="kpi-value">{stats.statusCounts?.approved}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}>
            <ClipboardCheck size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Estimated Sourced Spend</span>
            <h3 className="kpi-value">₹{stats.estimatedSpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)' }}>
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        <div className="glass-panel">
          <h3>Sourcing Status Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Draft Requisitions</span>
              <span style={{ fontWeight: 'bold' }}>{stats.statusCounts?.draft}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Under Active Review</span>
              <span style={{ fontWeight: 'bold' }}>{stats.statusCounts?.pending}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Approved & Processing</span>
              <span style={{ fontWeight: 'bold' }}>{stats.statusCounts?.approved}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Returned / Rejected</span>
              <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{stats.statusCounts?.rejected}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1.75rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <MessageSquare size={24} />
          </div>
          <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem 0' }}>Post-Delivery Feedback & Queries</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', maxWidth: '320px' }}>
            Have goods arrived? Submit vendor performance evaluations, 5-star ratings, and track issue tickets.
          </p>
          <Link to="/queries" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}>
            Manage Feedback & Queries
          </Link>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // 3. ADMIN & MANAGER ANALYTICS DASHBOARD
  // ==========================================
  const renderAnalyticsDashboard = () => {
    const monthlyTrend = stats.monthlySpendTrend || [];
    const maxMonthlySpend = Math.max(...monthlyTrend.map(m => m.spend), 1);

    const vendorTiers = stats.vendorTiers || { excellent: 0, good: 0, needsReview: 0 };
    const totalActiveVendors = stats.vendorCounts?.active || 1;
    const excellentPct = Math.round((vendorTiers.excellent / totalActiveVendors) * 100);
    const goodPct = Math.round((vendorTiers.good / totalActiveVendors) * 100);
    const reviewPct = Math.round((vendorTiers.needsReview / totalActiveVendors) * 100);

    const categorySpendList = stats.categorySpend || [];
    const maxCatSpend = Math.max(...categorySpendList.map(c => c.totalSpend), 1);

    const qualityReports = stats.qualityReports || {
      totalQueries: 0,
      openQueries: 0,
      inProgressQueries: 0,
      resolvedQueries: 0,
      resolutionRate: 100,
      avgDeliveryRating: 5.0
    };

    return (
      <div>
        {/* Navigation Tabs & Executive Action Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--glass-border)',
          paddingBottom: '1rem'
        }}>
          {/* Sub-tab navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card-item-bg)', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            <button
              onClick={() => setAnalyticsTab('overview')}
              className={`btn ${analyticsTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <BarChart3 size={16} />
              <span>Executive Overview</span>
            </button>
            <button
              onClick={() => setAnalyticsTab('vendors')}
              className={`btn ${analyticsTab === 'vendors' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <Award size={16} />
              <span>Vendor Performance</span>
            </button>
            <button
              onClick={() => setAnalyticsTab('items')}
              className={`btn ${analyticsTab === 'items' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <Package size={16} />
              <span>Purchasing & Items</span>
            </button>
            <button
              onClick={() => setAnalyticsTab('reports')}
              className={`btn ${analyticsTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <PieChart size={16} />
              <span>Procurement Reports</span>
            </button>
          </div>

          {/* Quick Report Print/Export Trigger */}
          <button
            onClick={() => setShowReportModal(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={16} />
            <span>Generate Executive Report</span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SUB-TAB 1: EXECUTIVE OVERVIEW
        ───────────────────────────────────────────────────────────── */}
        {analyticsTab === 'overview' && (
          <div>
            {/* Top 4 KPI Cards */}
            <div className="glass-card-grid" style={{ marginTop: 0 }}>
              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Completed Spend (This Month)</span>
                  <h3 className="kpi-value">₹{stats.monthlySpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    All-time: ₹{stats.totalSpend?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}>
                  <TrendingUp size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Committed / Pending Spend</span>
                  <h3 className="kpi-value">₹{stats.pendingSpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '4px', display: 'block' }}>
                    Across {stats.pendingOrdersCount || 0} Open Purchase Orders
                  </span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(2, 132, 199, 0.1)' }}>
                  <ClipboardCheck size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Supplier Health Index</span>
                  <h3 className="kpi-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>{stats.vendorAvgScore || 100}</span>
                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={12} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                    <span>Avg Rating: {parseFloat(stats.vendorAvgRating || 5.0).toFixed(1)} / 5.0</span>
                  </span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
                  <Award size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Requisitions Lifecycle</span>
                  <h3 className="kpi-value">{stats.prCounts?.total || 0}</h3>
                  <span style={{ fontSize: '0.75rem', color: stats.prCounts?.pending > 0 ? 'var(--warning)' : 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    {stats.prCounts?.pending || 0} Pending Decision • {stats.prCounts?.approved || 0} Approved
                  </span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)' }}>
                  <FileText size={24} />
                </div>
              </div>
            </div>

            {/* Spend Trend Bar Chart & Sourcing Category Split */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {/* Monthly Spend Bar Visualization */}
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Monthly Spend Trajectory</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completed PO procurement volume over recent periods</span>
                  </div>
                  <span className="badge badge-active">Actuals</span>
                </div>

                {monthlyTrend.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
                    No completed order transactions recorded in current period.
                  </p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', height: '180px', paddingTop: '20px' }}>
                    {monthlyTrend.map((item, idx) => {
                      const heightPct = Math.max(12, Math.round((item.spend / maxMonthlySpend) * 100));
                      return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            ₹{item.spend > 1000 ? `${(item.spend / 1000).toFixed(0)}k` : item.spend}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '48px',
                              height: `${heightPct}%`,
                              background: 'linear-gradient(180deg, var(--primary) 0%, rgba(37, 99, 235, 0.3) 100%)',
                              borderRadius: '4px 4px 0 0',
                              border: '1px solid var(--primary)',
                              transition: 'height var(--transition-normal)'
                            }}
                            title={`Month: ${item.month} | Spend: ₹${item.spend.toLocaleString()} | Orders: ${item.ordersCount}`}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {item.month}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sourced Category Breakdown */}
              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Spend by Category</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Proportional expenditure distribution</span>
                  </div>
                  <PieChart size={18} style={{ color: 'var(--accent)' }} />
                </div>

                {categorySpendList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
                    No categorised procurement data available.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {categorySpendList.map((cat, idx) => {
                      const pct = Math.round((cat.totalSpend / maxCatSpend) * 100);
                      return (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{cat.category}</strong>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              ₹{cat.totalSpend.toLocaleString()} ({cat.totalQuantity} items)
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--card-item-bg)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sourcing Conversion Funnel & Audit Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {/* Conversion Pipeline */}
              <div className="glass-panel">
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Procurement Conversion Pipeline</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.85rem' }}>1. Requisitions Created</span>
                    </div>
                    <strong style={{ fontSize: '0.95rem' }}>{stats.prCounts?.total || 0}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                      <span style={{ fontSize: '0.85rem' }}>2. Management Approved</span>
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--success)' }}>
                      {(stats.prCounts?.approved || 0) + (stats.prCounts?.po || 0) + (stats.prCounts?.rfq || 0)}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={16} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: '0.85rem' }}>3. RFQ Sourced & Bidding</span>
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--primary)' }}>{stats.rfqCounts?.total || 0}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={16} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: '0.85rem' }}>4. Purchase Orders Awarded</span>
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--accent)' }}>{stats.poCounts?.total || 0}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ClipboardCheck size={16} style={{ color: '#10b981' }} />
                      <span style={{ fontSize: '0.85rem' }}>5. Delivered & Completed</span>
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: '#10b981' }}>{stats.completedOrdersCount || 0}</strong>
                  </div>
                </div>
              </div>

              {/* Audit Activities Stream */}
              <div className="glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <Activity size={20} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Recent Operations Stream</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '280px', overflowY: 'auto' }}>
                  {stats.recentActivities?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent activities logged.</p>
                  ) : (
                    stats.recentActivities?.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          paddingBottom: '0.65rem',
                          borderBottom: '1px solid var(--table-border)'
                        }}
                      >
                        <div style={{
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                          background: act.action.includes('CREATE') ? 'rgba(56, 189, 248, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                          color: act.action.includes('CREATE') ? 'var(--accent)' : 'var(--primary)',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap'
                        }}>
                          {act.action.replace('_', ' ')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '500' }}>{act.details}</p>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {act.user_name} ({act.user_role}) • {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            SUB-TAB 2: VENDOR PERFORMANCE
        ───────────────────────────────────────────────────────────── */}
        {analyticsTab === 'vendors' && (
          <div>
            {/* Vendor Statistics Summary Cards */}
            <div className="glass-card-grid" style={{ marginTop: 0 }}>
              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Registered Suppliers</span>
                  <h3 className="kpi-value">{stats.vendorCounts?.total || 0}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                    {stats.vendorCounts?.active || 0} Active / Approved
                  </span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.1)' }}>
                  <Users size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Average Supplier Score</span>
                  <h3 className="kpi-value">{stats.vendorAvgScore || 100} / 100</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scorecard aggregate audit</span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
                  <Award size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Average Delivery Rating</span>
                  <h3 className="kpi-value" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{parseFloat(stats.vendorAvgRating || 5.0).toFixed(1)}</span>
                    <Star size={18} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rated across purchase receipts</span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
                  <Star size={24} />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <span className="kpi-label">Pending Supplier Approvals</span>
                  <h3 className="kpi-value">{stats.vendorCounts?.pending || 0}</h3>
                  <span style={{ fontSize: '0.75rem', color: stats.vendorCounts?.pending > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    Requires verification review
                  </span>
                </div>
                <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(2, 132, 199, 0.1)' }}>
                  <ShieldCheck size={24} />
                </div>
              </div>
            </div>

            {/* Performance Tiers & Category Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {/* Performance Tier Segmented Bar */}
              <div className="glass-panel">
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Supplier Quality Tier Distribution</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                  Supplier segmentation based on historical audit evaluations
                </p>

                <div style={{ display: 'flex', height: '14px', borderRadius: '6px', overflow: 'hidden', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: `${excellentPct}%`, background: 'var(--success)' }} title={`Tier 1 (≥90): ${vendorTiers.excellent} vendors`} />
                  <div style={{ width: `${goodPct}%`, background: 'var(--warning)' }} title={`Tier 2 (75-89): ${vendorTiers.good} vendors`} />
                  <div style={{ width: `${reviewPct}%`, background: 'var(--danger)' }} title={`Tier 3 (<75): ${vendorTiers.needsReview} vendors`} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                      <span>Tier 1: High Performers (Score ≥ 90)</span>
                    </div>
                    <strong>{vendorTiers.excellent} suppliers ({excellentPct}%)</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--warning)' }} />
                      <span>Tier 2: Good Standing (Score 75 - 89)</span>
                    </div>
                    <strong>{vendorTiers.good} suppliers ({goodPct}%)</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)' }} />
                      <span>Tier 3: Audit Required (Score &lt; 75)</span>
                    </div>
                    <strong>{vendorTiers.needsReview} suppliers ({reviewPct}%)</strong>
                  </div>
                </div>
              </div>

              {/* Vendor Category Mix */}
              <div className="glass-panel">
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Supplier Category Diversity</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                  Distribution of active suppliers across industry categories
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                  {(stats.vendorCategories || []).map((cat, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 1rem',
                        background: 'var(--card-item-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flex: '1 1 calc(50% - 0.65rem)',
                        minWidth: '140px'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{cat.category}</span>
                      <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>{cat.count} suppliers</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Supplier Volume & Revenue Leaderboard */}
            <div className="glass-panel" style={{ marginTop: '1.5rem', padding: 0 }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Supplier Performance & Revenue Leaderboard</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top suppliers ranked by awarded contract revenue and fulfillment score</span>
              </div>

              <div className="table-container" style={{ margin: 0, border: 'none' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Category</th>
                      <th>Rating</th>
                      <th>Performance Score</th>
                      <th>Orders Awarded</th>
                      <th style={{ textAlign: 'right' }}>Total Revenue Awarded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.vendorVolume || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No supplier order history found.
                        </td>
                      </tr>
                    ) : (
                      (stats.vendorVolume || []).map((v) => (
                        <tr key={v.id}>
                          <td>
                            <strong>{v.name}</strong>
                          </td>
                          <td>{v.category}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 'bold' }}>
                              <span>{parseFloat(v.rating).toFixed(1)}</span>
                              <Star size={12} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${v.performance_score >= 90 ? 'badge-active' : v.performance_score >= 75 ? 'badge-pending' : 'badge-rejected'}`}>
                              {v.performance_score} / 100
                            </span>
                          </td>
                          <td>{v.orders_count} POs</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                            ₹{v.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
            SUB-TAB 3: PURCHASING & ITEMS
        ───────────────────────────────────────────────────────────── */}
        {analyticsTab === 'items' && (
          <div>
            {/* Top Purchased Line Items Table */}
            <div className="glass-panel" style={{ padding: 0 }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Top Purchased & Sourced Line Items</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aggregated items by expenditure and requisition frequency</span>
                </div>
                <Link to="/purchase-orders" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
                  <span>View All POs</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>

              <div className="table-container" style={{ margin: 0, border: 'none' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Line Item Name</th>
                      <th>Category</th>
                      <th>Total Quantity Sourced</th>
                      <th>Request Frequency</th>
                      <th style={{ textAlign: 'right' }}>Cumulative Spend (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.topItems || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          No line items sourced yet. Line items from approved purchase requests will appear here.
                        </td>
                      </tr>
                    ) : (
                      (stats.topItems || []).map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{item.name}</strong>
                          </td>
                          <td>
                            <span className="badge badge-open" style={{ fontSize: '0.7rem' }}>
                              {item.category}
                            </span>
                          </td>
                          <td>{item.totalQuantity} units</td>
                          <td>{item.requestCount} requests</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>
                            ₹{item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Purchase Orders Lifecycle Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
              <div className="glass-panel" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Draft Orders</span>
                <h3 style={{ fontSize: '1.75rem', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>{stats.poCounts?.draft || 0}</h3>
                <span className="badge badge-draft">Drafting</span>
              </div>

              <div className="glass-panel" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dispatched to Vendor</span>
                <h3 style={{ fontSize: '1.75rem', margin: '0.5rem 0', color: 'var(--primary)' }}>{stats.poCounts?.sent || 0}</h3>
                <span className="badge badge-sent">Dispatched</span>
              </div>

              <div className="glass-panel" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vendor Accepted</span>
                <h3 style={{ fontSize: '1.75rem', margin: '0.5rem 0', color: 'var(--accent)' }}>{stats.poCounts?.accepted || 0}</h3>
                <span className="badge badge-open">Accepted</span>
              </div>

              <div className="glass-panel" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivered & Completed</span>
                <h3 style={{ fontSize: '1.75rem', margin: '0.5rem 0', color: 'var(--success)' }}>{stats.poCounts?.completed || 0}</h3>
                <span className="badge badge-completed">Completed</span>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            SUB-TAB 4: PROCUREMENT REPORTS
        ───────────────────────────────────────────────────────────── */}
        {analyticsTab === 'reports' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {/* Departmental Spend Breakdown */}
              <div className="glass-panel" style={{ padding: 0 }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Departmental Spend Analysis</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expenditure allocated per internal corporate department</span>
                </div>

                <div className="table-container" style={{ margin: 0, border: 'none' }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Requisitions</th>
                        <th style={{ textAlign: 'right' }}>Total Allocated Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats.departmentSpend || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No departmental spend logged.
                          </td>
                        </tr>
                      ) : (
                        (stats.departmentSpend || []).map((dept, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>{dept.department}</strong>
                            </td>
                            <td>{dept.requestCount} PRs</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>
                              ₹{dept.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivery Quality & Issue Resolution Statistics */}
              <div className="glass-panel">
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Delivery Quality & Dispute Resolution</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                  Post-delivery satisfaction and defect incident tracking metrics
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'var(--card-item-bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resolution Rate</span>
                    <h3 style={{ fontSize: '1.6rem', margin: '0.35rem 0', color: qualityReports.resolutionRate >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                      {qualityReports.resolutionRate}%
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {qualityReports.resolvedQueries} / {qualityReports.totalQueries} tickets resolved
                    </span>
                  </div>

                  <div style={{ background: 'var(--card-item-bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Satisfaction</span>
                    <h3 style={{ fontSize: '1.6rem', margin: '0.35rem 0', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span>{parseFloat(qualityReports.avgDeliveryRating).toFixed(1)}</span>
                      <Star size={18} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From verified deliveries</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.85rem' }}>Open Queries / Pending Review:</span>
                    <strong style={{ color: 'var(--danger)' }}>{qualityReports.openQueries}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.85rem' }}>In Progress / Investigation:</span>
                    <strong style={{ color: 'var(--warning)' }}>{qualityReports.inProgressQueries}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.85rem' }}>Resolved & Closed Tickets:</span>
                    <strong style={{ color: 'var(--success)' }}>{qualityReports.resolvedQueries}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            EXECUTIVE REPORT PRINT & PREVIEW MODAL
        ───────────────────────────────────────────────────────────── */}
        {showReportModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '820px', background: '#ffffff', color: '#0f172a' }}>
              <div className="modal-header" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>Executive Procurement Analytics Report</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Generated on {new Date().toLocaleDateString()}</span>
                </div>
                <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ color: '#0f172a', fontFamily: 'sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ color: '#4f46e5', margin: 0 }}>VendSphere Procurement Cloud</h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>Tenant Space: {user?.tenantId || 'Default'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Report Sign-Off</span>
                    <strong style={{ fontSize: '0.9rem' }}>{user.name} ({user.role})</strong>
                  </div>
                </div>

                {/* Key Metrics Snapshot */}
                <h4 style={{ color: '#0f172a', marginBottom: '0.5rem', fontSize: '0.95rem' }}>1. Financial & Procurement Health</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Monthly Spend</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹{stats.monthlySpend?.toLocaleString()}</strong>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Committed Orders</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹{stats.pendingSpend?.toLocaleString()}</strong>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Active Suppliers</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{stats.vendorCounts?.active || 0}</strong>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Dispute Resolution</span>
                    <strong style={{ fontSize: '1rem', color: '#10b981' }}>{qualityReports.resolutionRate}%</strong>
                  </div>
                </div>

                {/* Top Sourced Items */}
                <h4 style={{ color: '#0f172a', marginBottom: '0.5rem', fontSize: '0.95rem' }}>2. Top Sourced Items</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Item Name</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Units</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.topItems || []).slice(0, 5).map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px' }}>{item.name}</td>
                        <td style={{ padding: '6px 8px' }}>{item.category}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{item.totalQuantity}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>₹{item.totalCost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Top Suppliers */}
                <h4 style={{ color: '#0f172a', marginBottom: '0.5rem', fontSize: '0.95rem' }}>3. Top Contract Suppliers</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Supplier</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Category</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Score</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.vendorVolume || []).slice(0, 5).map((v, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 8px' }}>{v.name}</td>
                        <td style={{ padding: '6px 8px' }}>{v.category}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>{v.performance_score}/100</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>₹{v.total_revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-footer" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                <button type="button" onClick={() => setShowReportModal(false)} className="btn btn-secondary" style={{ color: '#0f172a' }}>
                  Close
                </button>
                <button type="button" onClick={() => window.print()} className="btn btn-primary" style={{ background: '#4f46e5' }}>
                  <Download size={16} />
                  <span>Print / Save PDF Report</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h1 className="page-title">Welcome Back, {user.name}</h1>
      <p className="page-subtitle">
        {user.role === 'Vendor'
          ? 'Monitor active bids, awarded contracts, and supplier revenue metrics.'
          : user.role === 'Employee'
            ? 'Track your submitted requisitions, active reviews, and delivery receipts.'
            : 'Enterprise procurement analytics, vendor scorecards, and purchasing statistics.'}
      </p>

      {user.role === 'Vendor' && renderVendorDashboard()}
      {user.role === 'Employee' && renderEmployeeDashboard()}
      {user.role !== 'Vendor' && user.role !== 'Employee' && renderAnalyticsDashboard()}
    </div>
  );
};

export default Dashboard;
