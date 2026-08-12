import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { GitMerge, Plus, Trash2, Shield, Settings, X } from 'lucide-react';

export const Workflows = () => {
  const { api } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Creation Form 
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [thresholdAmount, setThresholdAmount] = useState(0);
  const [steps, setSteps] = useState([{ step_number: 1, role: 'Manager' }]);

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/api/purchase-requests/workflows/all');
      setWorkflows(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch approval workflows.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleAddStep = () => {
    setSteps([...steps, { step_number: steps.length + 1, role: 'Admin' }]);
  };

  const handleRemoveStep = (index) => {
    if (steps.length > 1) {
      const updated = steps
        .filter((_, i) => i !== index)
        .map((step, idx) => ({ ...step, step_number: idx + 1 }));
      setSteps(updated);
    }
  };

  const handleStepRoleChange = (index, role) => {
    const updated = [...steps];
    updated[index].role = role;
    setSteps(updated);
  };

  const handleSubmitWorkflow = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/purchase-requests/workflows/all', {
        name,
        thresholdAmount: parseFloat(thresholdAmount),
        steps
      });
      setShowAddModal(false);
      setName('');
      setThresholdAmount(0);
      setSteps([{ step_number: 1, role: 'Manager' }]);
      fetchWorkflows();
    } catch (err) {
      setError('Failed to save approval workflow.');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading workflows...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Approval Workflows</h1>
          <p className="page-subtitle">Configure rule-based multi-level approvals triggered by purchase thresholds.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>New Workflow Rule</span>
        </button>
      </div>

      {error && (
        <div className="alert-danger">
          {error}
        </div>
      )}

      {/* Workflows List Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {workflows.length === 0 ? (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No workflows configured. Requisitions will be auto-approved unless workflow rules are added.
          </div>
        ) : (
          workflows.map((wf) => (
            <div key={wf.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem' }}>{wf.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trigger Limit: </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                    ₹{parseFloat(wf.threshold_amount).toLocaleString()}+
                  </span>
                </div>
                <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', color: 'var(--primary)' }}>
                  <GitMerge size={18} />
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Approval Sequence:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {(Array.isArray(wf.steps) ? wf.steps : []).map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--card-item-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {step.step_number}
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{step.role} Approval</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Workflow Model */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Approval Workflow</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitWorkflow}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Workflow Rule Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Capex Purchase Routing"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Price Trigger Threshold (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 5000"
                    value={thresholdAmount}
                    onChange={e => setThresholdAmount(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Requisitions equal to or exceeding this budget will trigger this workflow.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--accent)' }}>Approval Levels Setup</h4>
                  <button type="button" onClick={handleAddStep} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                    Add Step
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {steps.map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.85rem', width: '60px' }}>Level {step.step_number}</span>
                      <select
                        className="form-select"
                        value={step.role}
                        onChange={e => handleStepRoleChange(idx, e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="Manager">Manager</option>
                        <option value="ProcurementManager">Procurement Manager</option>
                        <option value="Admin">Admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '5px' }}
                        disabled={steps.length === 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Workflow</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workflows;
