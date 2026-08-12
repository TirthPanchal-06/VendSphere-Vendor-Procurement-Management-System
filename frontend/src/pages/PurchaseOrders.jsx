import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Eye, Send, CheckCircle, PackageOpen, Award, X,
  AlertCircle, Mail, FileDown, Star, CreditCard, Banknote,
  Building2, Receipt, Printer, Download, QrCode, Lock
} from 'lucide-react';

// ─── Simulated Card Form (no API key required) ──────────────────────────────
const SimulatedCardForm = ({ amount, onSuccess, onCancel }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const [focused, setFocused] = useState('');

  // Detect card network from number
  const getCardType = (num) => {
    const n = num.replace(/\s/g, '');
    if (/^4/.test(n)) return { name: 'Visa', color: '#1a1f71' };
    if (/^5[1-5]|^2[2-7]/.test(n)) return { name: 'Mastercard', color: '#eb001b' };
    if (/^6/.test(n)) return { name: 'Rupay', color: '#f79e1b' };
    if (/^3[47]/.test(n)) return { name: 'Amex', color: '#007bc1' };
    return null;
  };

  const formatCardNumber = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + ' / ' + digits.slice(2);
    return digits;
  };

  const validate = () => {
    const e = {};
    const raw = cardNumber.replace(/\s/g, '');
    if (raw.length < 13) e.cardNumber = 'Enter a valid card number';
    const parts = expiry.replace(/\s/g, '').split('/');
    const mo = parseInt(parts[0]); const yr = parseInt('20' + (parts[1] || ''));
    const now = new Date();
    if (!mo || mo < 1 || mo > 12 || !yr || new Date(yr, mo - 1) < now) e.expiry = 'Invalid or expired date';
    if (cvv.length < 3) e.cvv = 'Enter a valid CVV';
    if (!cardName.trim()) e.cardName = 'Name on card is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setProcessing(true);
    // Simulate network delay
    await new Promise(r => setTimeout(r, 2000));
    setProcessing(false);
    const ref = 'SIM' + Date.now().toString().slice(-10);
    onSuccess({ method: 'Card (Stripe)', reference: ref });
  };

  const cardType = getCardType(cardNumber);
  const inputStyle = (field) => ({
    width: '100%', padding: '0.82rem 1rem', borderRadius: 'var(--radius-sm)',
    background: 'rgba(28,28,28,0.9)',
    border: `1px solid ${errors[field] ? '#ef4444' : focused === field ? '#6366f1' : 'rgba(255,255,255,0.09)'}`,
    color: '#f0f0f0', fontSize: '0.95rem', outline: 'none',
    fontFamily: field === 'cardNumber' || field === 'expiry' || field === 'cvv' ? 'monospace' : 'inherit',
    letterSpacing: field === 'cardNumber' ? '0.12em' : 'normal',
    transition: 'border-color 0.2s ease',
    boxShadow: focused === field ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
  });

  return (
    <form onSubmit={handleSubmit}>
      {/* Card Preview */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: '14px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
        position: 'relative', overflow: 'hidden', minHeight: '110px',
      }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(99,102,241,0.12)' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '60px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(56,189,248,0.08)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Credit / Debit Card</div>
          {cardType && <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#fff', background: cardType.color, padding: '2px 8px', borderRadius: '4px' }}>{cardType.name}</div>}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.15em', color: cardNumber ? '#f0f0f0' : 'rgba(255,255,255,0.25)', marginBottom: '0.75rem' }}>
          {cardNumber || '•••• •••• •••• ••••'}
        </div>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.75rem' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Card Holder</div>
            <div style={{ color: cardName ? '#f0f0f0' : 'rgba(255,255,255,0.3)', fontWeight: '600', fontSize: '0.82rem', marginTop: '2px' }}>{cardName || 'YOUR NAME'}</div>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Expires</div>
            <div style={{ color: expiry ? '#f0f0f0' : 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: '0.82rem', marginTop: '2px' }}>{expiry || 'MM / YY'}</div>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Name on Card</label>
          <input value={cardName} onChange={e => setCardName(e.target.value)} onFocus={() => setFocused('cardName')} onBlur={() => setFocused('')} placeholder="e.g. Rajan Mehta" style={inputStyle('cardName')} />
          {errors.cardName && <p style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '3px' }}>{errors.cardName}</p>}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Card Number</label>
          <input value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} onFocus={() => setFocused('cardNumber')} onBlur={() => setFocused('')} placeholder="4242 4242 4242 4242" maxLength={19} style={inputStyle('cardNumber')} />
          {errors.cardNumber && <p style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '3px' }}>{errors.cardNumber}</p>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Expiry Date</label>
            <input value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} onFocus={() => setFocused('expiry')} onBlur={() => setFocused('')} placeholder="MM / YY" maxLength={7} style={inputStyle('expiry')} />
            {errors.expiry && <p style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '3px' }}>{errors.expiry}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>CVV / CVC</label>
            <input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} onFocus={() => setFocused('cvv')} onBlur={() => setFocused('')} placeholder="•••" maxLength={4} type="password" style={inputStyle('cvv')} />
            {errors.cvv && <p style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '3px' }}>{errors.cvv}</p>}
          </div>
        </div>
      </div>

      {/* Security badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.6rem 0.85rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-sm)' }}>
        <Lock size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1 }}>
          Secured by <strong style={{ color: 'var(--primary)' }}>Stripe</strong> — 256-bit TLS encrypted
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['Visa', 'MC', 'Rupay'].map(n => (
            <span key={n} style={{ fontSize: '0.6rem', fontWeight: '800', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}>{n}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Back</button>
        <button type="submit" className="btn btn-primary" disabled={processing} style={{ minWidth: '170px' }}>
          {processing ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
              Processing...
            </span>
          ) : (
            <><CreditCard size={14} /><span>Pay ₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></>
          )}
        </button>
      </div>
    </form>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
export const PurchaseOrders = () => {
  const { api, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [pendingBids, setPendingBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal Controls
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [poEmails, setPoEmails] = useState([]);

  // Complete Form States
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Bid Comparison & PO Finalization Modal States
  const [showComparePoModal, setShowComparePoModal] = useState(false);
  const [selectedPendingBid, setSelectedPendingBid] = useState(null);
  const [pendingBidQuotations, setPendingBidQuotations] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  // ── Export PDF Confirmation Modal ──
  const [showPdfConfirmModal, setShowPdfConfirmModal] = useState(false);

  // ── Payment Modal States ──
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState('method'); // 'method' | 'details' | 'success'
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [gstNumber, setGstNumber] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/purchase-orders');
      setOrders(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch Purchase Orders.');
    }
  };

  const fetchPendingBids = async () => {
    if (user.role === 'Vendor') return;
    try {
      const rfqRes = await api.get('/api/rfqs');
      const awardedRfqs = rfqRes.data.filter(r => r.status === 'Awarded');
      const pendingList = [];
      for (const rfq of awardedRfqs) {
        const qRes = await api.get(`/api/rfqs/${rfq.id}/quotations`);
        const acceptedQuote = qRes.data.find(q => q.status === 'Accepted');
        if (acceptedQuote) {
          pendingList.push({
            rfqId: rfq.id,
            rfqNumber: rfq.rfq_number,
            purchaseRequestId: rfq.purchase_request_id,
            quotationId: acceptedQuote.id,
            vendorId: acceptedQuote.vendor_id,
            vendorName: acceptedQuote.vendor_name,
            totalCost: acceptedQuote.total_cost
          });
        }
      }
      const activePoQuoteIds = orders.map(o => o.quotation_id);
      setPendingBids(pendingList.filter(item => !activePoQuoteIds.includes(item.quotation_id)));
    } catch (err) {
      console.error('Failed loading pending bids:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await fetchOrders();
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { if (orders.length >= 0) fetchPendingBids(); }, [orders]);

  const handleGeneratePo = async (bid) => {
    try {
      await api.post('/api/purchase-orders', {
        purchaseRequestId: bid.purchaseRequestId,
        quotationId: bid.quotationId,
        vendorId: bid.vendorId,
        totalAmount: parseFloat(bid.totalCost)
      });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate PO.');
    }
  };

  const handleOpenReview = async (bid) => {
    setSelectedPendingBid(bid);
    setLoadingQuotes(true);
    try {
      const res = await api.get(`/api/rfqs/${bid.rfqId}/quotations`);
      setPendingBidQuotations(res.data);
      setShowComparePoModal(true);
    } catch {
      alert('Failed to retrieve bid comparisons.');
    } finally {
      setLoadingQuotes(false);
    }
  };

  const handleDispatchPo = async (poId) => {
    try {
      await api.post(`/api/purchase-orders/${poId}/send`);
      loadData();
      if (showDetailsModal && selectedPo?.id === poId) handleViewDetails(poId);
    } catch (err) { console.error(err); }
  };

  const handleAcceptPo = async (poId) => {
    try {
      await api.post(`/api/purchase-orders/${poId}/accept`);
      loadData();
      if (showDetailsModal && selectedPo?.id === poId) handleViewDetails(poId);
    } catch (err) { console.error(err); }
  };

  const handleCompleteDelivery = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/purchase-orders/${selectedPo.id}/complete`, { notes: deliveryNotes });
      setDeliveryNotes('');
      setShowCompleteModal(false);
      setShowDetailsModal(false);
      loadData();
    } catch { alert('Failed to log delivery completion.'); }
  };

  const handleViewDetails = async (poId) => {
    try {
      const res = await api.get(`/api/purchase-orders/${poId}`);
      setSelectedPo(res.data);
      setActiveTab('details');
      setShowDetailsModal(true);
      const emailRes = await api.get(`/api/purchase-orders/${poId}/emails`);
      setPoEmails(emailRes.data);
    } catch (err) { console.error('Failed to load PO details:', err); }
  };

  // ── Export PDF — actual print ──────────────────────────────────────────────
  const handleConfirmedDownloadPdf = () => {
    if (!selectedPo) return;
    setShowPdfConfirmModal(false);

    const itemsHtml = (Array.isArray(selectedPo.pr_items) ? selectedPo.pr_items : []).map(item => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${item.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${parseFloat(item.estimated_cost).toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">₹${(item.quantity * parseFloat(item.estimated_cost)).toFixed(2)}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=860,height=960');
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <title>Purchase Order — ${selectedPo.po_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #fff; padding: 48px; line-height: 1.55; }
          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #6366f1; margin-bottom: 32px; }
          .brand { display: flex; flex-direction: column; }
          .brand-name { font-size: 26px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
          .brand-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.08em; }
          .po-info { text-align: right; }
          .po-number { font-size: 22px; font-weight: 800; color: #1e293b; }
          .po-date { font-size: 12px; color: #64748b; margin-top: 4px; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 6px; }
          .badge-completed { background: #d1fae5; color: #065f46; }
          .badge-accepted { background: #dbeafe; color: #1e40af; }
          .badge-sent { background: #e0e7ff; color: #3730a3; }
          .badge-draft { background: #f1f5f9; color: #334155; }
          /* Info Grid */
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; }
          .info-card h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 10px; }
          .info-card p { font-size: 13px; color: #334155; margin-bottom: 4px; }
          .info-card p strong { color: #0f172a; }
          /* Section title */
          .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6366f1; margin-bottom: 12px; }
          /* Table */
          table { width: 100%; border-collapse: collapse; margin-bottom: 32px; border-radius: 10px; overflow: hidden; }
          thead { background: #f1f5f9; }
          th { padding: 11px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.06em; }
          th:not(:first-child) { text-align: right; }
          th:nth-child(2) { text-align: center; }
          td { font-size: 13px; color: #334155; }
          .total-row td { background: #f8fafc; font-weight: 800; font-size: 14px; padding: 14px 12px; border-top: 2px solid #e2e8f0; }
          .total-row td:last-child { color: #059669; }
          /* Delivery notes */
          .notes-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 18px; margin-bottom: 32px; }
          .notes-box h4 { font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
          .notes-box p { font-size: 13px; color: #166534; }
          /* Signature */
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
          .sig-box { border-top: 2px solid #e2e8f0; padding-top: 12px; }
          .sig-box span { font-size: 11px; color: #94a3b8; display: block; }
          /* Footer */
          .footer { border-top: 1px solid #e2e8f0; padding-top: 18px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.7; }
          .footer strong { color: #475569; }
          @media print {
            body { padding: 32px; }
            .no-print { display: none !important; }
          }
          /* Print button */
          .print-bar { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 28px; }
          .print-btn { padding: 9px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 13px; }
          .print-btn-primary { background: #6366f1; color: #fff; }
          .print-btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn print-btn-secondary" onclick="window.close()">✕ Close</button>
          <button class="print-btn print-btn-primary" onclick="window.print()">🖨 Print / Save PDF</button>
        </div>

        <div class="header">
          <div class="brand">
            <div class="brand-name">VendSphere</div>
            <div class="brand-sub">Enterprise Procurement Portal</div>
          </div>
          <div class="po-info">
            <div class="po-number">PURCHASE ORDER</div>
            <div style="font-size:18px;font-weight:700;color:#6366f1;margin-top:4px;">${selectedPo.po_number}</div>
            <div class="po-date">Date: ${new Date(selectedPo.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <span class="badge badge-${(selectedPo.status || '').replace(/ /g, '-').toLowerCase()}">${selectedPo.status}</span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <h4>Vendor / Supplier Details</h4>
            <p><strong>${selectedPo.vendor_name}</strong></p>
            <p>Email: ${selectedPo.vendor_email || 'N/A'}</p>
            <p>Phone: ${selectedPo.vendor_phone || 'N/A'}</p>
          </div>
          <div class="info-card">
            <h4>Order Metadata</h4>
            <p><strong>${selectedPo.pr_title}</strong></p>
            <p>Requisition Ref: ${selectedPo.pr_number}</p>
            <p>Payment Terms: Net 30</p>
            <p>Currency: INR (₹)</p>
          </div>
        </div>

        <p class="section-title">Line Items Authorized</p>
        <table>
          <thead>
            <tr>
              <th style="width:46%;">Item Description</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align:right;padding-right:16px;">Total Authorized Value:</td>
              <td style="text-align:right;padding:14px 12px;">₹${parseFloat(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        ${selectedPo.delivery_notes ? `
        <div class="notes-box">
          <h4>📦 Delivery & Fulfillment Notes</h4>
          <p>${selectedPo.delivery_notes}</p>
        </div>` : ''}

        <div class="signature-grid">
          <div class="sig-box">
            <span>Authorised Signatory (Buyer)</span>
            <span style="margin-top:8px;font-size:13px;color:#334155;">VendSphere Procurement Team</span>
          </div>
          <div class="sig-box">
            <span>Vendor Acceptance Signature</span>
            <span style="margin-top:8px;font-size:13px;color:#334155;">${selectedPo.vendor_name}</span>
          </div>
        </div>

        <div class="footer">
          <p>This is a system-generated, legally binding Purchase Order from the <strong>VendSphere Enterprise Procurement Platform</strong>.</p>
          <p>© ${new Date().getFullYear()} VendSphere. All rights reserved. | Document ID: ${selectedPo.po_number}-${Date.now()}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ── Payment Modal helpers ──────────────────────────────────────────────────
  const openPaymentModal = (po) => {
    setSelectedPo(po);
    setPaymentStep('method');
    setSelectedPaymentMethod(null);
    setGstNumber('');
    setBankRef('');
    setPaymentSuccess(null);
    setShowPaymentModal(true);
  };

  const handleBankPayment = async (method) => {
    if (!bankRef.trim()) { alert('Please enter the transaction reference number.'); return; }
    setPaymentProcessing(true);
    await new Promise(r => setTimeout(r, 1400));
    setPaymentProcessing(false);
    setPaymentSuccess({ method, reference: bankRef });
    setPaymentStep('success');
  };

  const handleCardPaymentSuccess = (data) => {
    setPaymentSuccess({ method: 'Card (Stripe)', reference: data.paymentMethodId });
    setPaymentStep('success');
  };

  const paymentMethods = [
    { id: 'rtgs', label: 'RTGS Transfer', sublabel: 'Real-Time Gross Settlement', icon: <Building2 size={22} />, color: '#6366f1' },
    { id: 'neft', label: 'NEFT Transfer', sublabel: 'National Electronic Funds Transfer', icon: <Banknote size={22} />, color: '#10b981' },
    { id: 'gpay', label: 'GPay / UPI Scanner', sublabel: 'Scan QR Code via Google Pay or any UPI', icon: <QrCode size={22} />, color: '#f59e0b' },
    { id: 'card', label: 'Credit / Debit Card', sublabel: 'Powered by Stripe — Visa, Mastercard, Rupay', icon: <CreditCard size={22} />, color: '#38bdf8' },
  ];

  if (loading) return <div style={{ padding: '2rem' }}>Loading orders ledger...</div>;

  return (
    <div>
      {/* Spin keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Purchase Orders (PO)</h1>
          <p className="page-subtitle">Track authorized procurement contracts, dispatch orders to suppliers, and audit delivery fulfillment.</p>
        </div>
      </div>

      {error && <div className="alert-danger">{error}</div>}

      {/* Awarded Bids Pending PO */}
      {user.role !== 'Vendor' && pendingBids.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '2rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={18} />
            <span>Awarded contracts awaiting Purchase Orders ({pendingBids.length})</span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
            These bids have been awarded to suppliers. Generate official purchase orders to authorize spend.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {pendingBids.map((bid, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--card-item-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From {bid.rfqNumber}</span>
                  <h4 style={{ fontSize: '0.85rem', margin: '2px 0 0 0' }}>Supplier: {bid.vendorName}</h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                    ₹{parseFloat(bid.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <button onClick={() => handleOpenReview(bid)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                    Review & Finalize PO
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main PO Table */}
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Sourced Request</th>
                <th>Supplier Company</th>
                <th>Authorized Amount</th>
                <th>Order Status</th>
                <th>Order Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No purchase orders found.</td></tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id}>
                    <td><span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{po.po_number}</span></td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{po.pr_title}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ref: {po.pr_number}</span>
                    </td>
                    <td>{po.vendor_name}</td>
                    <td style={{ fontWeight: '700' }}>₹{parseFloat(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge badge-${po.status?.replace(/ /g, '-').toLowerCase()}`}>{po.status}</span>
                    </td>
                    <td>{new Date(po.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => handleViewDetails(po.id)} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                          <Eye size={12} /><span>View</span>
                        </button>
                        {/* Payment button — visible for accepted/completed POs */}
                        {(po.status === 'Accepted' || po.status === 'Completed') && (
                          <button onClick={() => openPaymentModal(po)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                            <Receipt size={12} /><span>Pay</span>
                          </button>
                        )}
                        {user.role !== 'Vendor' && po.status === 'Draft' && (
                          <button onClick={() => handleDispatchPo(po.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                            <Send size={12} /><span>Dispatch</span>
                          </button>
                        )}
                        {user.role === 'Vendor' && po.status === 'Sent to Vendor' && (
                          <button onClick={() => handleAcceptPo(po.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                            <CheckCircle size={12} /><span>Sign & Accept</span>
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

      {/* ───── PO Details Modal ───── */}
      {showDetailsModal && selectedPo && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>{selectedPo.po_number}</span>
                <h3 style={{ margin: '2px 0 0 0' }}>{selectedPo.pr_title}</h3>
              </div>
              <button onClick={() => setShowDetailsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 1.5rem', background: 'rgba(255,255,255,0.02)' }}>
              {['details', 'emails'].map(tab => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', transition: 'var(--transition-fast)', textTransform: 'capitalize' }}>
                  {tab === 'emails' ? `Dispatched Emails (${poEmails.length})` : 'Order Details'}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {activeTab === 'details' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '1rem', background: 'var(--card-item-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Supplier Details</h4>
                      <p style={{ fontWeight: '700', fontSize: '0.95rem' }}>{selectedPo.vendor_name}</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Email: {selectedPo.vendor_email}</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Phone: {selectedPo.vendor_phone}</p>
                    </div>
                    <div style={{ padding: '1rem', background: 'var(--card-item-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Payment Terms</span>
                      <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--accent)' }}>Net 30</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginTop: '0.5rem' }}>Status</span>
                      <span className={`badge badge-${selectedPo.status?.replace(/ /g, '-').toLowerCase()}`} style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>{selectedPo.status}</span>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Items Authorized</h4>
                  <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Item Name</th><th>Quantity</th><th style={{ textAlign: 'right' }}>Total Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(selectedPo.pr_items) ? selectedPo.pr_items : []).map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{(item.quantity * parseFloat(item.estimated_cost)).toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--card-item-bg)', fontWeight: '800' }}>
                          <td colSpan={2} style={{ textAlign: 'right' }}>Total Authorized Cost:</td>
                          <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{parseFloat(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {selectedPo.delivery_notes && (
                    <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <PackageOpen size={16} /><span>Receipt Log / Delivery Notes</span>
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedPo.delivery_notes}</p>
                    </div>
                  )}

                  {user.role !== 'Vendor' && selectedPo.status === 'Accepted' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button onClick={() => setShowCompleteModal(true)} className="btn btn-primary">
                        <PackageOpen size={16} /><span>Log Delivery Receipt</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'emails' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {poEmails.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Mail size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.85rem' }}>No confirmation emails logged for this order yet.</p>
                    </div>
                  ) : poEmails.map((email) => (
                    <div key={email.id} style={{ background: 'var(--card-item-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div><span style={{ fontWeight: 'bold' }}>To:</span> {email.to_email}</div>
                        <span>{new Date(email.sent_at).toLocaleString()}</span>
                      </div>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>Subject: {email.subject}</div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '4px', marginTop: '0.5rem', lineHeight: '1.4', border: '1px solid var(--glass-border)' }}>{email.body}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowPdfConfirmModal(true)}
                className="btn btn-accent"
                style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={!selectedPo}
              >
                <FileDown size={14} />
                <span>Export PDF Confirmation</span>
              </button>
              {(selectedPo.status === 'Accepted' || selectedPo.status === 'Completed') && (
                <button
                  onClick={() => { setShowDetailsModal(false); openPaymentModal(selectedPo); }}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Receipt size={14} /><span>Make Payment</span>
                </button>
              )}
              <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ───── Export PDF Confirmation Modal ───── */}
      {showPdfConfirmModal && selectedPo && (
        <div className="modal-overlay" style={{ zIndex: 1020 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileDown size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Export PDF Confirmation</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Purchase Order Document</span>
                </div>
              </div>
              <button onClick={() => setShowPdfConfirmModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* PO Summary Card */}
              <div style={{ padding: '1rem 1.25rem', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Document Summary</span>
                  <span className={`badge badge-${(selectedPo.status || '').replace(/ /g, '-').toLowerCase()}`}>{selectedPo.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    ['PO Number', selectedPo.po_number],
                    ['Vendor', selectedPo.vendor_name],
                    ['Requisition', selectedPo.pr_number],
                    ['Total Value', `₹${parseFloat(selectedPo.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
                      <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contents list */}
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', fontWeight: '600' }}>The exported document will include:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[
                  '🏢  Company branding & VendSphere header',
                  '📋  Full line-item breakdown with unit prices',
                  '🏦  Vendor & requisition metadata',
                  '✍️  Signature fields for buyer & vendor',
                  selectedPo.delivery_notes ? '📦  Delivery & fulfillment notes' : null,
                  '⚖️  Legal binding disclaimer footer',
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0.45rem 0.75rem', background: 'var(--card-item-bg)', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                    {item}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.85rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <Printer size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <span>A new print window will open. Use <strong style={{ color: 'var(--text-primary)' }}>Ctrl+P</strong> or the on-page button to save as PDF.</span>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowPdfConfirmModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleConfirmedDownloadPdf} className="btn btn-accent" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} />
                <span>Generate & Export PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── Payment Modal ───── */}
      {showPaymentModal && selectedPo && (
        <div className="modal-overlay" style={{ zIndex: 1020 }}>
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={20} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Make Payment</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedPo.po_number} — {selectedPo.vendor_name}</span>
                </div>
              </div>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>

              {/* Amount banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.1rem', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>Amount Due</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>
                    ₹{parseFloat(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span className={`badge badge-${(selectedPo.status || '').replace(/ /g, '-').toLowerCase()}`}>{selectedPo.status}</span>
              </div>

              {/* GST Input — always shown */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">GST Number (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  value={gstNumber}
                  onChange={e => setGstNumber(e.target.value.toUpperCase())}
                  maxLength={15}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontSize: '0.95rem' }}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>15-digit GSTIN will be printed on the payment receipt.</p>
              </div>

              {/* ── STEP: Method Selection ── */}
              {paymentStep === 'method' && (
                <>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.85rem' }}>Select Payment Method</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {paymentMethods.map(pm => (
                      <button
                        key={pm.id}
                        onClick={() => { setSelectedPaymentMethod(pm.id); setPaymentStep('details'); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.1rem',
                          background: 'var(--card-item-bg)', border: `1px solid var(--glass-border)`,
                          borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.2s ease', color: 'var(--text-primary)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = pm.color; e.currentTarget.style.background = `${pm.color}12`; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.background = 'var(--card-item-bg)'; }}
                      >
                        <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${pm.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pm.color, flexShrink: 0 }}>
                          {pm.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{pm.label}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{pm.sublabel}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>›</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* ── STEP: Payment Details ── */}
              {paymentStep === 'details' && (
                <>
                  {/* RTGS */}
                  {selectedPaymentMethod === 'rtgs' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <Building2 size={18} style={{ color: '#6366f1' }} />
                        <h4 style={{ margin: 0, color: '#6366f1' }}>RTGS Transfer Details</h4>
                      </div>
                      <div style={{ padding: '1rem', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                        {[['Account Name', 'VendSphere Procurement Ltd.'], ['Account Number', '9876543210123456'], ['IFSC Code', 'VENDSPH0001234'], ['Bank', 'HDFC Bank, Ahmedabad Main Branch'], ['Amount', `₹${parseFloat(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                            <strong style={{ fontFamily: k === 'IFSC Code' || k === 'Account Number' ? 'monospace' : 'inherit' }}>{v}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="form-group">
                        <label className="form-label">RTGS Transaction Reference No.</label>
                        <input type="text" className="form-input" placeholder="e.g. HDFC0000123456789" value={bankRef} onChange={e => setBankRef(e.target.value.toUpperCase())} style={{ fontFamily: 'monospace' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <button onClick={() => setPaymentStep('method')} className="btn btn-secondary">Back</button>
                        <button onClick={() => handleBankPayment('RTGS')} className="btn btn-primary" disabled={paymentProcessing}>
                          {paymentProcessing ? 'Verifying...' : 'Confirm RTGS Payment'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NEFT */}
                  {selectedPaymentMethod === 'neft' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <Banknote size={18} style={{ color: '#10b981' }} />
                        <h4 style={{ margin: 0, color: '#10b981' }}>NEFT Transfer Details</h4>
                      </div>
                      <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                        {[['Account Name', 'VendSphere Procurement Ltd.'], ['Account Number', '9876543210123456'], ['IFSC Code', 'VENDSPH0001234'], ['Bank', 'HDFC Bank, Ahmedabad Main Branch'], ['Processing Time', 'Within 2 hours (bank hours)'], ['Amount', `₹${parseFloat(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                            <strong style={{ fontFamily: k === 'IFSC Code' || k === 'Account Number' ? 'monospace' : 'inherit', color: k === 'Processing Time' ? 'var(--warning)' : 'var(--text-primary)' }}>{v}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="form-group">
                        <label className="form-label">NEFT Transaction Reference No.</label>
                        <input type="text" className="form-input" placeholder="e.g. NEFT20260812001" value={bankRef} onChange={e => setBankRef(e.target.value.toUpperCase())} style={{ fontFamily: 'monospace' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <button onClick={() => setPaymentStep('method')} className="btn btn-secondary">Back</button>
                        <button onClick={() => handleBankPayment('NEFT')} className="btn btn-primary" disabled={paymentProcessing} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                          {paymentProcessing ? 'Verifying...' : 'Confirm NEFT Payment'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* GPay QR */}
                  {selectedPaymentMethod === 'gpay' && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', justifyContent: 'center' }}>
                        <QrCode size={18} style={{ color: '#f59e0b' }} />
                        <h4 style={{ margin: 0, color: '#f59e0b' }}>Scan to Pay via GPay / UPI</h4>
                      </div>
                      {/* QR Code placeholder — replace with real UPI QR API */}
                      <div style={{ display: 'inline-block', padding: '16px', background: '#fff', borderRadius: '12px', marginBottom: '1rem', border: '3px solid rgba(245,158,11,0.3)' }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi%3A%2F%2Fpay%3Fpa%3Dvendsphere%40hdfcbank%26pn%3DVendSphere+Procurement%26am%3D${selectedPo.total_amount}%26cu%3DINR%26tn%3D${selectedPo.po_number}`}
                          alt="UPI QR Code"
                          style={{ width: '180px', height: '180px', display: 'block' }}
                        />
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ display: 'inline-block', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '0.35rem 0.85rem', fontFamily: 'monospace', fontWeight: '700', fontSize: '0.9rem', color: '#f59e0b' }}>
                          vendsphere@hdfcbank
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                        Open <strong>GPay, PhonePe, Paytm</strong> or any UPI app → Scan QR → Amount pre-filled as <strong>₹{parseFloat(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </p>
                      <div className="form-group" style={{ textAlign: 'left' }}>
                        <label className="form-label">UPI Transaction ID (after payment)</label>
                        <input type="text" className="form-input" placeholder="e.g. 231012345678901" value={bankRef} onChange={e => setBankRef(e.target.value)} style={{ fontFamily: 'monospace' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                        <button onClick={() => setPaymentStep('method')} className="btn btn-secondary">Back</button>
                        <button onClick={() => handleBankPayment('UPI/GPay')} className="btn btn-primary" disabled={paymentProcessing} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                          {paymentProcessing ? 'Verifying...' : 'Confirm UPI Payment'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card — Simulated Stripe UI */}
                  {selectedPaymentMethod === 'card' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <CreditCard size={18} style={{ color: '#38bdf8' }} />
                        <h4 style={{ margin: 0, color: '#38bdf8' }}>Card Payment via Stripe</h4>
                      </div>
                      <SimulatedCardForm
                        amount={selectedPo.total_amount}
                        onSuccess={handleCardPaymentSuccess}
                        onCancel={() => setPaymentStep('method')}
                      />
                    </div>
                  )}
                </>
              )}

              {/* ── STEP: Success ── */}
              {paymentStep === 'success' && paymentSuccess && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <CheckCircle size={32} style={{ color: 'var(--success)' }} />
                  </div>
                  <h3 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Payment Recorded!</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    Your {paymentSuccess.method} payment has been successfully submitted.
                  </p>
                  <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', padding: '1rem', textAlign: 'left', marginBottom: '1.25rem' }}>
                    {[
                      ['Method', paymentSuccess.method],
                      ['Reference / ID', paymentSuccess.reference],
                      ['PO Number', selectedPo.po_number],
                      ['Amount', `₹${parseFloat(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
                      gstNumber ? ['GST Number', gstNumber] : null,
                      ['Timestamp', new Date().toLocaleString('en-IN')],
                    ].filter(Boolean).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--glass-border)', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                        <strong style={{ fontFamily: k === 'Reference / ID' || k === 'GST Number' ? 'monospace' : 'inherit', fontSize: '0.8rem' }}>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowPaymentModal(false)} className="btn btn-primary" style={{ width: '100%' }}>
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───── Complete Delivery Modal ───── */}
      {showCompleteModal && selectedPo && (
        <div className="modal-overlay" style={{ zIndex: 1010 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Confirm Delivery Receipt</h3>
              <button onClick={() => setShowCompleteModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCompleteDelivery}>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.15)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                  <AlertCircle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Completing this order locks the requisition and triggers the <strong>automated vendor evaluation scorecard algorithms</strong> based on promised bid lead times.
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Notes / Audit Remarks</label>
                  <textarea className="form-textarea" placeholder="Describe delivery condition, quantity correctness, or inspection logs..." value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCompleteModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Complete Order & Evaluate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───── Compare Bids & Finalize PO Modal ───── */}
      {showComparePoModal && selectedPendingBid && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <div>
                <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.85rem' }}>Bid Comparison & PO Finalization</span>
                <h3 style={{ margin: '2px 0 0 0' }}>{selectedPendingBid.rfqNumber}</h3>
              </div>
              <button onClick={() => setShowComparePoModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Compare all submitted bids side-by-side to audit the finalization decision before generating the Purchase Order.
              </p>
              {loadingQuotes ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading bid comparisons...</div>
              ) : (
                <>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>RFQ Bids Comparison Ledger</h4>
                  <div className="table-container" style={{ marginBottom: '2rem' }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Supplier Info</th><th>Rating & Score</th><th>Delivery Lead</th><th>Total Cost</th><th style={{ textAlign: 'right' }}>Sourcing Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingBidQuotations.map((quote) => (
                          <tr key={quote.id} style={{ background: quote.status === 'Accepted' ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
                            <td>
                              <div style={{ fontWeight: '700' }}>{quote.vendor_name}</div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remarks: {quote.remarks || 'None'}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 'bold' }}>
                                <span>{parseFloat(quote.vendor_rating).toFixed(1)}</span>
                                <Star size={12} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
                              </div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>Score: {quote.performance_score}/100</span>
                            </td>
                            <td>{quote.delivery_days} days</td>
                            <td><span style={{ fontSize: '1rem', fontWeight: '800', color: quote.status === 'Accepted' ? 'var(--success)' : 'var(--text-primary)' }}>₹{parseFloat(quote.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              {quote.status === 'Accepted' ? (
                                <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                                  <CheckCircle size={14} /><span>Awarded</span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rejected</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {(() => {
                    const winningQuote = pendingBidQuotations.find(q => q.status === 'Accepted');
                    if (!winningQuote) return null;
                    return (
                      <div>
                        <h4 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Finalized Purchase Order Preview</h4>
                        <div style={{ padding: '1.25rem', background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Authorized Vendor</span>
                              <strong>{winningQuote.vendor_name}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>Remarks: {winningQuote.remarks || 'N/A'}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Payment Terms</span>
                              <strong>Net 30</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>Promised Delivery Lead</span>
                              <strong>{winningQuote.delivery_days} Days</strong>
                            </div>
                          </div>
                          <div className="table-container">
                            <table className="custom-table">
                              <thead>
                                <tr>
                                  <th>Line Item Name</th><th>Category</th><th>Quantity</th><th style={{ textAlign: 'right' }}>Bid Unit Price (₹)</th><th style={{ textAlign: 'right' }}>Total Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(Array.isArray(winningQuote.items) ? winningQuote.items : []).map((item, idx) => (
                                  <tr key={idx}>
                                    <td>{item.name}</td><td>{item.category || 'N/A'}</td><td>{item.quantity}</td>
                                    <td style={{ textAlign: 'right' }}>₹{parseFloat(item.unitPrice || item.unit_price || 0).toFixed(2)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{parseFloat(item.totalCost || item.total_cost || 0).toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr style={{ background: 'rgba(255,255,255,0.02)', fontWeight: '800' }}>
                                  <td colSpan={4} style={{ textAlign: 'right' }}>Final PO Amount:</td>
                                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{parseFloat(winningQuote.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowComparePoModal(false)} className="btn btn-secondary">Cancel</button>
              <button
                onClick={async () => { await handleGeneratePo(selectedPendingBid); setShowComparePoModal(false); }}
                className="btn btn-primary"
                disabled={loadingQuotes}
              >
                <CheckCircle size={14} /><span>Finalize & Generate PO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
