import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap, Check, X, ShieldAlert, ArrowRight } from 'lucide-react';

export const UpgradeModal = ({ isOpen, onClose, title, message, featureName, maxLimit, currentCount }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToSubscriptions = () => {
    onClose();
    navigate('/subscriptions');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '580px', border: '1px solid var(--border-color)' }}>
        <div className="modal-header" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', background: 'rgba(37, 99, 235, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{title || 'Upgrade to Premium Plan'}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VendSphere Freemium Limits</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="alert-danger" style={{ marginBottom: '1.5rem', background: 'rgba(37, 99, 235, 0.08)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldAlert size={16} />
              <span>{featureName ? `${featureName} Limit Exceeded` : 'Freemium Limit Reached'}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {message || 'You have reached the maximum allowed limit on your Free Starter plan. Upgrade to unlock higher quotas and advanced features.'}
            </p>
          </div>

          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Why Upgrade to Premium?</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <Zap size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: '600', fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>Higher Monthly Quotas & Unlimited Vendors</span>
                <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Up to 50 RFQs & 200 PRs/mo with Unlimited Approved Vendors on Professional. Unlimited everything on Enterprise.</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <Crown size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: '600', fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>AI Vendor Scoring & Recommendation</span>
                <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Automate supplier selection with machine learning recommendation engine.</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--card-item-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <Check size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <div>
                <span style={{ fontWeight: '600', fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)' }}>Custom Invoice Branding & PDF Exports</span>
                <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Export official tax invoices with custom company logo and GST details.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Maybe Later
          </button>
          <button type="button" onClick={handleGoToSubscriptions} className="btn btn-primary">
            <span>View Subscription Plans</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
