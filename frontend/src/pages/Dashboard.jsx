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
  MessageSquare
} from 'lucide-react';

export const Dashboard = () => {
  const { user, api } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <p style={{ color: 'var(--text-secondary)' }}>Compiling enterprise KPI metrics...</p>
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
        <div style={{ display: 'flex', gap: '2.5rem', marginTop: '1.5rem' }}>
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
            <span className="kpi-label">Approved requisitions</span>
            <h3 className="kpi-value">{stats.statusCounts?.approved}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}>
            <ClipboardCheck size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Estimated Sourced Spend</span>
            <h3 className="kpi-value">₹{stats.estimatedSpend?.toLocaleString()}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)' }}>
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        <div className="glass-panel">
          <h3>Sourcing Status Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--table-border)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Draft requisitions</span>
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

  const renderAdminDashboard = () => (
    <div>
      <div className="glass-card-grid">
        <div className="kpi-card">
          <div>
            <span className="kpi-label">Approved Spend (This Month)</span>
            <h3 className="kpi-value">₹{stats.monthlySpend?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}>
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Active Suppliers</span>
            <h3 className="kpi-value">{stats.vendorCounts?.active}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)' }}>
            <Users size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Pending PR Approvals</span>
            <h3 className="kpi-value">{stats.prCounts?.pending}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
            <FileText size={24} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <span className="kpi-label">Active RFQs (Sourcing)</span>
            <h3 className="kpi-value">{stats.rfqCounts?.open}</h3>
          </div>
          <div className="kpi-icon" style={{ color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)' }}>
            <Layers size={24} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', marginTop: '2rem' }}>
        {/* Audit Activities */}
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Activity size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>Recent Activities Log</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.recentActivities?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent activities logged.</p>
            ) : (
              stats.recentActivities?.map((activity) => (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid var(--table-border)'
                  }}
                >
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    background: activity.action.includes('CREATE') ? 'rgba(56, 189, 248, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    color: activity.action.includes('CREATE') ? 'var(--accent)' : 'var(--primary)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap'
                  }}>
                    {activity.action.replace('_', ' ')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500' }}>{activity.details}</p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      By {activity.user_name} ({activity.user_role}) • {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Vendors */}
        <div className="glass-panel">
          <h3 style={{ marginBottom: '1.5rem' }}>Top Performance Suppliers</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {stats.topVendors?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active suppliers found.</p>
            ) : (
              stats.topVendors?.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    background: 'var(--card-item-bg)',
                    border: '1px solid var(--card-item-border)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <div>
                    <h5 style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem' }}>{v.name}</h5>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{v.category}</span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                      <span>{v.rating}</span>
                      <Star size={12} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 'bold' }}>
                      Score: {v.performance_score}/100
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Welcome Back, {user.name}</h1>
      <p className="page-subtitle">
        Overviewing procurement metrics inside tenant {user.tenantId || 'global'} space.
      </p>

      {user.role === 'Vendor' && renderVendorDashboard()}
      {user.role === 'Employee' && renderEmployeeDashboard()}
      {user.role !== 'Vendor' && user.role !== 'Employee' && renderAdminDashboard()}
    </div>
  );
};

export default Dashboard;
