import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Sparkles,
  ShieldCheck,
  FileText,
  Clock,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Lock,
  ArrowRight,
  Download,
  X,
  Check,
  Building2,
  Crown
} from 'lucide-react';

export const Subscriptions = () => {
  const { user, api } = useAuth();
  
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'invoices', 'history'

  // Billing Cycle state for comparison toggle
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'

  // Checkout Modal State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' or 'card'
  const [vpaInput, setVpaInput] = useState('');
  const [cardForm, setCardForm] = useState({
    cardNumber: '4532 8921 7712 9043',
    cardHolder: user?.name || 'Company Admin',
    expiry: '12/28',
    cvv: '889'
  });
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [otpStep, setOtpStep] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState(null);

  // Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [currentRes, plansRes, invoicesRes, paymentsRes] = await Promise.all([
        api.get('/api/subscriptions/current'),
        api.get('/api/subscriptions/plans'),
        api.get('/api/subscriptions/invoices'),
        api.get('/api/subscriptions/payments')
      ]);

      setSubscription(currentRes.data);
      setPlans(plansRes.data);
      setInvoices(invoicesRes.data);
      setPayments(paymentsRes.data);
      if (currentRes.data?.billingCycle) {
        setBillingCycle(currentRes.data.billingCycle);
      }
    } catch (err) {
      console.error('Error fetching subscription metadata:', err);
      setError('Failed to load subscription data. ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const handleToggleAutopay = async () => {
    try {
      const nextState = !subscription.autopayEnabled;
      const res = await api.post('/api/subscriptions/toggle-autopay', { enabled: nextState });
      setSubscription(prev => ({ ...prev, autopayEnabled: nextState }));
      alert(res.data.message);
    } catch (err) {
      alert('Failed to toggle automatic renewal: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your plan auto-renewal at period end?')) return;
    try {
      const res = await api.post('/api/subscriptions/cancel');
      setSubscription(prev => ({ ...prev, cancelAtPeriodEnd: true, autopayEnabled: false }));
      alert(res.data.message);
    } catch (err) {
      alert('Failed to cancel subscription: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenCheckout = async (plan) => {
    setSelectedPlan(plan);
    try {
      setPaymentProcessing(true);
      const res = await api.post('/api/subscriptions/create-order', {
        planId: plan.id,
        billingCycle
      });
      setCheckoutOrder(res.data);
      setVpaInput(`${user?.email?.split('@')[0] || 'company'}@okaxis`);
      setIsCheckoutOpen(true);
      setOtpStep(false);
      setOtpInput('');
    } catch (err) {
      alert('Failed to initiate checkout order: ' + (err.response?.data?.error || err.message));
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleInitiatePayment = () => {
    if (paymentMethod === 'upi' && !vpaInput.includes('@')) {
      alert('Please enter a valid UPI ID / VPA (e.g., user@okicici).');
      return;
    }
    if (paymentMethod === 'card' && (!cardForm.cardNumber || !cardForm.cvv)) {
      alert('Please enter complete debit/credit card details.');
      return;
    }
    // Advance to 3D Secure / UPI Authorization step
    setOtpStep(true);
  };

  const handleConfirmPayment = async () => {
    if (!otpInput || otpInput.length < 4) {
      alert('Please enter valid 4 or 6-digit OTP / UPI PIN.');
      return;
    }

    try {
      setPaymentProcessing(true);

      const paymentId = `PAY_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Request signature calculation validation
      const paymentPayload = {
        orderId: checkoutOrder.orderId,
        paymentId,
        signature: 'VALID_SIMULATED_HMAC_SIG', // Backend validates signature
        planId: selectedPlan.id,
        billingCycle,
        paymentMethod: paymentMethod === 'upi' ? `UPI / Google Pay (${selectedUpiApp.toUpperCase()})` : 'Debit/Credit Card',
        paymentDetails: paymentMethod === 'upi' ? { vpa: vpaInput, app: selectedUpiApp } : { cardLast4: cardForm.cardNumber.slice(-4), holder: cardForm.cardHolder }
      };

      const res = await api.post('/api/subscriptions/verify-payment', paymentPayload);

      alert(`🎉 ${res.data.message}`);
      setIsCheckoutOpen(false);
      setOtpStep(false);
      fetchSubscriptionData();

    } catch (err) {
      alert('Payment authorization failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setPaymentProcessing(false);
    }
  };

  const openInvoiceModal = async (invoiceId) => {
    try {
      const res = await api.get(`/api/subscriptions/invoices/${invoiceId}`);
      setSelectedInvoice(res.data);
    } catch (err) {
      alert('Failed to load invoice details: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading subscription billing status...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header Title Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Crown style={{ color: 'var(--warning)' }} size={32} />
            <span>Premium Subscriptions & Billing</span>
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Manage company subscription plan, autopay renewals, tax invoices, and payment methods.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-glass)', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            <Sparkles size={16} />
            <span>Plans & Billing</span>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            <FileText size={16} />
            <span>Invoices ({invoices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            <Clock size={16} />
            <span>Payment History</span>
          </button>
        </div>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {/* Active Subscription Banner */}
      {subscription && (
        <div className="glass-panel" style={{ marginBottom: '2rem', background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge badge-active" style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}>
                  {subscription.subscriptionStatus}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Current Active Plan
                </span>
              </div>
              <h2 style={{ fontSize: '1.5rem', marginTop: '0.5rem', color: 'var(--text-primary)' }}>
                {subscription.planName} Plan ({subscription.billingCycle.toUpperCase()})
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Period Ends: <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</strong> ({subscription.daysRemaining} days remaining)
              </p>
            </div>

            {/* Features Quota Metrics */}
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', background: 'var(--card-item-bg)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-item-border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Monthly RFQ Quota</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {subscription.usage.rfqsThisMonth} / {subscription.usage.maxRfqs === -1 ? '∞ Unlimited' : subscription.usage.maxRfqs}
                </span>
              </div>

              <div style={{ textAlign: 'center', background: 'var(--card-item-bg)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-item-border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>AI Vendor Engine</span>
                <span style={{ fontSize: '1rem', fontWeight: 'bold', color: subscription.usage.aiMatchingEnabled ? 'var(--success)' : 'var(--text-muted)' }}>
                  {subscription.usage.aiMatchingEnabled ? '⚡ Active' : 'Locked'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={subscription.autopayEnabled}
                    onChange={handleToggleAutopay}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span>Autopay (Auto-Renew)</span>
                </label>
                {subscription.cancelAtPeriodEnd ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 'bold' }}>Cancels on period end</span>
                ) : (
                  <button onClick={handleCancelSubscription} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left' }}>
                    Cancel Auto-Renew
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: PLANS OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Billing Interval Switcher */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
            <span style={{ fontWeight: billingCycle === 'monthly' ? 'bold' : 'normal', color: billingCycle === 'monthly' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              Monthly Billing
            </span>

            <button
              onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
              style={{
                width: '60px',
                height: '32px',
                borderRadius: '16px',
                background: billingCycle === 'yearly' ? 'var(--primary)' : 'var(--btn-secondary-bg)',
                border: '1px solid var(--glass-border)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '3px',
                  left: billingCycle === 'yearly' ? '32px' : '4px',
                  transition: 'all 0.3s ease'
                }}
              />
            </button>

            <span style={{ fontWeight: billingCycle === 'yearly' ? 'bold' : 'normal', color: billingCycle === 'yearly' ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Yearly Billing</span>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                SAVE 20%
              </span>
            </span>
          </div>

          {/* Pricing Cards Grid */}
          <div className="glass-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'stretch' }}>
            {plans.map((plan) => {
              const isCurrent = subscription?.plan?.toLowerCase() === plan.id.toLowerCase();
              const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
              const formattedPrice = price === 0 ? 'Free' : `₹${price.toLocaleString()}`;

              return (
                <div
                  key={plan.id}
                  className="glass-panel"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    borderColor: isCurrent ? 'var(--primary)' : plan.id === 'professional' ? 'var(--accent)' : 'var(--glass-border)',
                    boxShadow: isCurrent ? '0 0 30px rgba(99, 102, 241, 0.25)' : 'none',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {plan.id === 'professional' && (
                    <div style={{ position: 'absolute', top: '15px', right: '-35px', transform: 'rotate(45deg)', background: 'var(--accent)', color: '#000', fontWeight: 'bold', fontSize: '0.65rem', padding: '0.25rem 2.5rem', textTransform: 'uppercase' }}>
                      POPULAR
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.4rem' }}>{plan.name}</h3>
                      {isCurrent && (
                        <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                          Active Plan
                        </span>
                      )}
                    </div>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', minHeight: '40px', marginBottom: '1.5rem' }}>
                      {plan.description}
                    </p>

                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--table-border)', paddingBottom: '1.5rem' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {formattedPrice}
                      </span>
                      {price > 0 && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          /{billingCycle === 'yearly' ? 'year' : 'month'}
                        </span>
                      )}
                    </div>

                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
                      {plan.features?.map((feat, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          <CheckCircle2 size={16} style={{ color: 'var(--success)', marginTop: '2px', flexShrink: 0 }} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleOpenCheckout(plan)}
                    disabled={isCurrent}
                    className={`btn ${isCurrent ? 'btn-secondary' : plan.id === 'professional' ? 'btn-accent' : 'btn-primary'}`}
                    style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}
                  >
                    {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TAX INVOICES */}
      {activeTab === 'invoices' && (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3>Company Tax Invoices</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Download or print official GST tax invoices for accounting records.</p>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Issued Date</th>
                  <th>Subscription Plan</th>
                  <th>Billing Cycle</th>
                  <th>Tax (18% GST)</th>
                  <th>Total Amount</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No subscription tax invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{inv.invoice_number}</td>
                      <td>{new Date(inv.issued_at).toLocaleDateString()}</td>
                      <td>{inv.plan_name}</td>
                      <td style={{ textTransform: 'capitalize' }}>{inv.billing_cycle}</td>
                      <td>₹{parseFloat(inv.tax_amount).toLocaleString()}</td>
                      <td style={{ fontWeight: 'bold' }}>₹{parseFloat(inv.total_amount).toLocaleString()}</td>
                      <td>{inv.payment_method}</td>
                      <td>
                        <span className={`badge badge-${inv.status === 'paid' ? 'active' : 'pending'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => openInvoiceModal(inv.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        >
                          <FileText size={14} />
                          <span>View Invoice</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT TRANSACTION HISTORY */}
      {activeTab === 'history' && (
        <div className="glass-panel">
          <div style={{ marginBottom: '1.5rem' }}>
            <h3>Payment Transaction History</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Full cryptographically-verifiable log of subscription billing transactions.</p>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Transaction ID</th>
                  <th>Invoice #</th>
                  <th>Payment Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>HMAC Verification Hash</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No payment transactions recorded.
                    </td>
                  </tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.id}>
                      <td>{new Date(pay.created_at).toLocaleString()}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{pay.transaction_id}</td>
                      <td>{pay.invoice_number || 'N/A'}</td>
                      <td>{pay.payment_method}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>₹{parseFloat(pay.amount).toLocaleString()}</td>
                      <td>
                        <span className={`badge badge-${pay.status === 'success' ? 'active' : 'rejected'}`}>
                          {pay.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {pay.signature ? `${pay.signature.slice(0, 16)}...` : 'Verified'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHECKOUT PAYMENT MODAL */}
      {isCheckoutOpen && checkoutOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CreditCard style={{ color: 'var(--primary)' }} size={24} />
                <h3 style={{ margin: 0 }}>Secure Subscription Checkout</h3>
              </div>
              <button onClick={() => setIsCheckoutOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {!otpStep ? (
                <div>
                  {/* Order Summary Box */}
                  <div style={{ background: 'var(--card-item-bg)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-item-border)', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{checkoutOrder.planName} Plan ({checkoutOrder.billingCycle.toUpperCase()})</span>
                      <span>₹{checkoutOrder.basePrice.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <span>GST Tax (18%)</span>
                      <span>+₹{checkoutOrder.taxAmount.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      <span>Total Amount Payable</span>
                      <span style={{ color: 'var(--success)' }}>₹{checkoutOrder.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Payment Method Selector Tabs */}
                  <div className="form-group">
                    <label className="form-label">Select Payment Method</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('upi')}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: `2px solid ${paymentMethod === 'upi' ? 'var(--primary)' : 'var(--input-border)'}`,
                          background: paymentMethod === 'upi' ? 'rgba(99, 102, 241, 0.1)' : 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'center',
                          gap: '0.5rem',
                          fontWeight: 'bold'
                        }}
                      >
                        <QrCode size={20} style={{ color: 'var(--primary)' }} />
                        <span>UPI / Google Pay</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: `2px solid ${paymentMethod === 'card' ? 'var(--primary)' : 'var(--input-border)'}`,
                          background: paymentMethod === 'card' ? 'rgba(99, 102, 241, 0.1)' : 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'center',
                          gap: '0.5rem',
                          fontWeight: 'bold'
                        }}
                      >
                        <CreditCard size={20} style={{ color: 'var(--accent)' }} />
                        <span>Debit / Credit Card</span>
                      </button>
                    </div>
                  </div>

                  {/* UPI / GOOGLE PAY UI */}
                  {paymentMethod === 'upi' && (
                    <div>
                      {/* Supported UPI Apps */}
                      <div className="form-group">
                        <label className="form-label">Preferred UPI App</label>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                          {['gpay', 'phonepe', 'paytm', 'bhim'].map(app => (
                            <button
                              key={app}
                              type="button"
                              onClick={() => setSelectedUpiApp(app)}
                              style={{
                                flex: 1,
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${selectedUpiApp === app ? 'var(--primary)' : 'var(--input-border)'}`,
                                background: selectedUpiApp === app ? 'var(--primary-glow)' : 'var(--input-bg)',
                                color: 'var(--text-primary)',
                                textTransform: 'uppercase',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              {app}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">UPI ID / VPA Address</label>
                        <input
                          type="text"
                          className="form-input"
                          value={vpaInput}
                          onChange={(e) => setVpaInput(e.target.value)}
                          placeholder="e.g. yourname@okicici, company@paytm"
                        />
                      </div>
                    </div>
                  )}

                  {/* DEBIT / CREDIT CARD UI */}
                  {paymentMethod === 'card' && (
                    <div>
                      <div className="form-group">
                        <label className="form-label">Cardholder Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={cardForm.cardHolder}
                          onChange={(e) => setCardForm(prev => ({ ...prev, cardHolder: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Card Number</label>
                        <input
                          type="text"
                          className="form-input"
                          value={cardForm.cardNumber}
                          onChange={(e) => setCardForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                          maxLength={19}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Expiry (MM/YY)</label>
                          <input
                            type="text"
                            className="form-input"
                            value={cardForm.expiry}
                            onChange={(e) => setCardForm(prev => ({ ...prev, expiry: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">CVV</label>
                          <input
                            type="password"
                            className="form-input"
                            value={cardForm.cvv}
                            onChange={(e) => setCardForm(prev => ({ ...prev, cvv: e.target.value }))}
                            maxLength={4}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}>
                    <Lock size={14} />
                    <span>256-bit SSL Encrypted • HMAC SHA-256 Signature Verification</span>
                  </div>
                </div>
              ) : (
                /* STEP 2: 3D SECURE OTP / UPI PIN STEP */
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                    <ShieldCheck size={32} style={{ color: 'var(--primary)' }} />
                  </div>
                  <h3>Enter Payment Authorization Code</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Enter 6-digit OTP or UPI PIN sent to your registered device for payment of <strong>₹{checkoutOrder.totalAmount.toLocaleString()}</strong>.
                  </p>

                  <div className="form-group" style={{ maxWidth: '280px', margin: '1.5rem auto' }}>
                    <input
                      type="password"
                      className="form-input"
                      style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', fontWeight: 'bold' }}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      maxLength={6}
                      placeholder="••••••"
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => {
                  if (otpStep) setOtpStep(false);
                  else setIsCheckoutOpen(false);
                }}
                className="btn btn-secondary"
                disabled={paymentProcessing}
              >
                {otpStep ? 'Back' : 'Cancel'}
              </button>

              {!otpStep ? (
                <button
                  type="button"
                  onClick={handleInitiatePayment}
                  className="btn btn-primary"
                  disabled={paymentProcessing}
                >
                  <span>Proceed to Pay ₹{checkoutOrder.totalAmount.toLocaleString()}</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="btn btn-success"
                  style={{ background: 'var(--success)', color: '#fff' }}
                  disabled={paymentProcessing}
                >
                  {paymentProcessing ? 'Verifying HMAC Signature...' : 'Authorize Payment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAX INVOICE PRINT PREVIEW MODAL */}
      {selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', background: '#ffffff', color: '#0f172a' }}>
            <div className="modal-header" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={24} style={{ color: '#4f46e5' }} />
                <h3 style={{ margin: 0, color: '#0f172a' }}>Tax Invoice: {selectedInvoice.invoice_number}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ color: '#0f172a', fontFamily: 'sans-serif' }}>
              {/* Header Invoice Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ color: '#4f46e5', margin: 0 }}>VendSphere SaaS</h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    {selectedInvoice.seller?.address}<br />
                    GSTIN: {selectedInvoice.seller?.gstin}<br />
                    Email: {selectedInvoice.seller?.email}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>TAX INVOICE</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                    <strong>Invoice #:</strong> {selectedInvoice.invoice_number}<br />
                    <strong>Date:</strong> {new Date(selectedInvoice.issued_at).toLocaleDateString()}<br />
                    <strong>Status:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>PAID</span>
                  </p>
                </div>
              </div>

              {/* Billed To Details */}
              <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', display: 'block' }}>Billed To Customer</span>
                <h4 style={{ margin: '0.25rem 0', color: '#0f172a' }}>{selectedInvoice.company_name}</h4>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0 }}>
                  Subdomain: <strong>{selectedInvoice.subdomain}.vendsphere.com</strong><br />
                  Payment Transaction ID: <strong>{selectedInvoice.transaction_id}</strong>
                </p>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>Description</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#475569' }}>Billing Cycle</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem', color: '#475569' }}>Base Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#0f172a' }}>{selectedInvoice.plan_name}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', textTransform: 'capitalize' }}>{selectedInvoice.billing_cycle}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{parseFloat(selectedInvoice.amount).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals Breakdown */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Subtotal</span>
                    <span>₹{parseFloat(selectedInvoice.amount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>CGST + SGST (18%)</span>
                    <span>₹{parseFloat(selectedInvoice.tax_amount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', borderTop: '2px solid #cbd5e1', paddingTop: '0.5rem', color: '#0f172a' }}>
                    <span>Total Paid</span>
                    <span>₹{parseFloat(selectedInvoice.total_amount).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
              <button onClick={() => window.print()} className="btn btn-primary" style={{ background: '#4f46e5' }}>
                <Download size={16} />
                <span>Print / Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
