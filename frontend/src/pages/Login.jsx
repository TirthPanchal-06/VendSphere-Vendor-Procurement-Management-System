import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, UserPlus, LogIn, Sparkles, Truck } from 'lucide-react';
import axios from 'axios';

export const Login = () => {
  const { login, registerTenant } = useAuth();
  const navigate = useNavigate();

  const [formMode, setFormMode] = useState('login'); // 'login', 'onboard_company', 'register_vendor'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login 
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginTenantId, setLoginTenantId] = useState('');

  // Tenant Sign-up
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Vendor Signup
  const [vendorTenantId, setVendorTenantId] = useState('');
  const [vendorCompanyName, setVendorCompanyName] = useState('');
  const [vendorContactName, setVendorContactName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPassword, setVendorPassword] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Hardware');
  const [vendorPhone, setVendorPhone] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!loginEmail || !loginPassword || !loginTenantId) {
      setError('All fields are required.');
      return;
    }

    const result = await login(loginEmail, loginPassword, loginTenantId);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!companyName || !subdomain || !adminName || !adminEmail || !adminPassword) {
      setError('All registration fields are required.');
      return;
    }

    const result = await registerTenant({
      companyName,
      subdomain,
      adminName,
      adminEmail,
      adminPassword
    });

    if (result.success) {
      setSuccess(`Company Onboarded Successfully! You can now log in using tenant subdomain: ${subdomain}`);
      setLoginTenantId(subdomain);
      setLoginEmail(adminEmail);
      setFormMode('login');
      // Clear fields
      setCompanyName('');
      setSubdomain('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
    } else {
      setError(result.error);
    }
  };

  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!vendorTenantId || !vendorCompanyName || !vendorContactName || !vendorEmail || !vendorPassword) {
      setError('All vendor registration fields are required.');
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/auth/vendor-signup', {
        tenantId: vendorTenantId,
        companyName: vendorCompanyName,
        name: vendorContactName,
        email: vendorEmail,
        password: vendorPassword,
        category: vendorCategory,
        phone: vendorPhone
      }, {
        headers: { 'x-tenant-id': vendorTenantId }
      });

      setSuccess(`Vendor registered successfully under tenant "${vendorTenantId}"! Account is pending approval.`);
      setLoginTenantId(vendorTenantId);
      setLoginEmail(vendorEmail);
      setFormMode('login');
      // Clear vendor fields
      setVendorTenantId('');
      setVendorCompanyName('');
      setVendorContactName('');
      setVendorEmail('');
      setVendorPassword('');
      setVendorPhone('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete vendor registration. Make sure client subdomain is correct.');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      background: 'radial-gradient(circle at center, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background glows */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '20%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'var(--login-glow-1)',
        filter: 'blur(100px)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '20%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'var(--login-glow-2)',
        filter: 'blur(100px)',
        zIndex: 0
      }} />

      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: formMode === 'login' ? '480px' : '650px',
        position: 'relative',
        zIndex: 1,
        border: '1px solid var(--glass-border)',
        background: 'var(--bg-glass)',
        boxShadow: 'var(--shadow-lg)',
        padding: '3rem'
      }}>
        {/* Brand Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            color: '#fff',
            marginBottom: '1rem',
            boxShadow: '0 8px 24px var(--primary-glow)'
          }}>
            {formMode === 'register_vendor' ? <Truck size={32} /> : <Building2 size={32} />}
          </div>
          <h2 style={{
            fontSize: '2rem',
            background: 'linear-gradient(135deg, var(--text-primary) 40%, var(--accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            VendSphere
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {formMode === 'onboard_company'
              ? 'Onboard your company onto the procurement cloud'
              : formMode === 'register_vendor'
                ? 'Register your supplier business profile'
                : 'SaaS Procurement & Vendor Portal'}
          </p>
        </div>

        {/* Error / Success Messages */}
        {error && (
          <div className="alert-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success">
            {success}
          </div>
        )}

        {/* Dynamic Form View */}
        {formMode === 'login' && (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Tenant Subdomain</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. acme"
                value={loginTenantId}
                onChange={(e) => setLoginTenantId(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Your company registered space identifier (e.g. acme, beta)
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@company.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem' }}>
              <span>Enter Portal</span>
              <LogIn size={18} />
            </button>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '1.5rem',
              fontSize: '0.85rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Corporate Client? </span>
                <button
                  type="button"
                  onClick={() => { setFormMode('onboard_company'); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                >
                  Onboard Company
                </button>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Supplier? </span>
                <button
                  type="button"
                  onClick={() => { setFormMode('register_vendor'); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: '#10b981', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                >
                  Register Vendor
                </button>
              </div>
            </div>
          </form>
        )}

        {formMode === 'onboard_company' && (
          /* TENANT REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem'
            }}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subdomain Prefix</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="acme"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{
              height: '1px',
              background: 'var(--glass-border)',
              margin: '1.5rem 0'
            }} />

            <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} />
              <span>Admin Account Setup</span>
            </h4>

            <div className="form-group">
              <label className="form-label">Administrator Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@company.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Admin Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Create password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem' }}>
              <span>Initialize Company Schema</span>
              <UserPlus size={18} />
            </button>

            <div style={{
              textAlign: 'center',
              marginTop: '1.5rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              <span>Already onboarded? </span>
              <button
                type="button"
                onClick={() => { setFormMode('login'); setError(''); setSuccess(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {formMode === 'register_vendor' && (
          /* VENDOR REGISTRATION FORM */
          <form onSubmit={handleVendorSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Client Tenant Subdomain</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. acme"
                  value={vendorTenantId}
                  onChange={(e) => setVendorTenantId(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Your Supplier Business Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Sourcing"
                  value={vendorCompanyName}
                  onChange={(e) => setVendorCompanyName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Sales Contact Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={vendorContactName}
                  onChange={(e) => setVendorContactName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. +91 98765 43210"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Vendor Category</label>
                <select
                  className="form-select"
                  value={vendorCategory}
                  onChange={(e) => setVendorCategory(e.target.value)}
                >
                  <option value="Hardware">Hardware</option>
                  <option value="Software">Software</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Consulting">Consulting</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Business Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="sales@supplier.com"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Login Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Create password"
                value={vendorPassword}
                onChange={(e) => setVendorPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem' }}>
              <span>Submit Vendor Registration</span>
              <UserPlus size={18} />
            </button>

            <div style={{
              textAlign: 'center',
              marginTop: '1.5rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              <span>Already registered? </span>
              <button
                type="button"
                onClick={() => { setFormMode('login'); setError(''); setSuccess(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
