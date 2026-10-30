import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Truck,
  GitMerge,
  FileText,
  Layers,
  ShoppingBag,
  CreditCard,
  LogOut,
  Building2,
  MessageSquare,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

export const Sidebar = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const role = user.role;

  // Define navigation links based on user roles
  const getNavLinks = () => {
    const links = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee', 'Vendor'] },
      { to: '/vendors', label: 'Vendors Directory', icon: Truck, roles: ['Admin', 'Company Admin', 'ProcurementManager'] },
      { to: '/purchase-requests', label: 'Purchase Requests', icon: FileText, roles: ['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee'] },
      { to: '/workflows', label: 'Approval Workflows', icon: GitMerge, roles: ['Admin', 'Company Admin'] },
      { to: '/users', label: 'User Directory', icon: Users, roles: ['Admin', 'Company Admin'] },
      { to: '/rfqs', label: 'Sourcing (RFQs)', icon: Layers, roles: ['Admin', 'ProcurementManager', 'Vendor'] },
      { to: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingBag, roles: ['Admin', 'ProcurementManager', 'Manager', 'Employee', 'Vendor'] },
      { to: '/queries', label: 'Feedback & Queries', icon: MessageSquare, roles: ['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee'] },
      { to: '/returns', label: 'Returns & Warranty', icon: RotateCcw, roles: ['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee', 'Vendor'] },
      { to: '/risks', label: 'Risk Management', icon: AlertTriangle, roles: ['Admin', 'Company Admin', 'ProcurementManager', 'Manager'] },
      { to: '/subscriptions', label: 'Subscription & Billing', icon: CreditCard, roles: ['Admin', 'Company Admin', 'ProcurementManager', 'Manager'] },
    ];


    return links.filter(link => link.roles.includes(role));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Building2 size={26} style={{ color: 'var(--primary)' }} />
        <span>VendSphere</span>
      </div>

      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          {getNavLinks().map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} />
                  <span>{link.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
          <p style={{ fontWeight: '700', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {user.name}
          </p>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>
            {role === 'ProcurementManager' ? 'Procurement' : role}
          </span>
        </div>
        <button
          onClick={logout}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            padding: '5px'
          }}
          title="Sign Out"
        >
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  );
};
