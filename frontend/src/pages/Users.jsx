import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, X, Award } from 'lucide-react';

/**
 * Company User Directory Page
 * Provides corporate staff listing and RBAC account registration for Admins.
 */
export const Users = () => {
  const { api } = useAuth();

  // Component state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal toggle
  const [showAddModal, setShowAddModal] = useState(false);

  // Form fields state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Employee');
  const [department, setDepartment] = useState('Engineering');

  // Load corporate staff directory
  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/auth/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch corporate users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle registration of a new staff account
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/api/auth/register-user', {
        name,
        email,
        password,
        role,
        department
      });

      setShowAddModal(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('Employee');
      setDepartment('Engineering');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register corporate user.');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading user directories...</div>;
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Company User Directory</h1>
          <p className="page-subtitle">Manage company staff logins, departments, and security roles (RBAC).</p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <UserPlus size={16} />
          <span>Add Company User</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>User Name</th>
                <th>Email Address</th>
                <th>Security Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Onboard Date</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No staff profiles found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: '700' }}>{u.name}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {u.id.slice(0, 8)}</span>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Award size={14} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: '600' }}>
                          {u.role === 'ProcurementManager' ? 'Procurement Manager' : u.role}
                        </span>
                      </div>
                    </td>
                    <td>{u.department}</td>
                    <td>
                      <span className={`badge badge-${u.status?.toLowerCase() === 'active' ? 'active' : 'blocked'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register Staff Account</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddUserSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Tirth Panchal"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Corporate Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. tirth.p@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sign-In Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Password (minimum 6 chars)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Company Role</label>
                    <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                      <option value="Employee">Employee (Requester)</option>
                      <option value="Manager">Manager (Approver)</option>
                      <option value="ProcurementManager">Procurement Manager</option>
                      <option value="Company Admin">Company Admin (Co-Admin)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Purchasing, Engineering"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
