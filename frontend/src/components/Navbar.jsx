import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import { Bell, Check, Inbox, Sun, Moon, Crown } from 'lucide-react';

export const Navbar = () => {
  const { user, tenantInfo, api } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [subPlan, setSubPlan] = useState('');
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const fetchSubscriptionBadge = async () => {
    if (!user) return;
    try {
      const res = await api.get('/api/subscriptions/current');
      if (res.data?.planName) {
        setSubPlan(res.data.planName);
      }
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchSubscriptionBadge();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      // Update state locally
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  };

  if (!user) return null;

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1.25rem 2.5rem',
      background: 'var(--navbar-bg)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--glass-border)',
      marginLeft: '280px',
      position: 'sticky',
      top: 0,
      zIndex: 9
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{tenantInfo?.name || 'Company Portal'}</span>
            {subPlan && (
              <Link to="/subscriptions" style={{ textDecoration: 'none' }}>
                <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>
                  <Crown size={10} style={{ marginRight: '3px' }} />
                  {subPlan}
                </span>
              </Link>
            )}
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {tenantInfo?.subdomain}.vendsphere.com
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }} ref={dropdownRef}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            background: 'var(--btn-secondary-bg)',
            border: '1px solid var(--glass-border)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            transition: 'var(--transition-fast)'
          }}
          className="theme-toggle-btn"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            background: 'var(--btn-secondary-bg)',
            border: '1px solid var(--glass-border)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            color: 'var(--text-primary)',
            transition: 'var(--transition-fast)'
          }}
          className="nav-bell-btn"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: 'var(--danger)',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px var(--danger)'
            }}>
              {unreadCount}
            </span>
          )}
        </button>

        {/* Dynamic Dropdown Panel */}
        {showDropdown && (
          <div style={{
            position: 'absolute',
            top: '50px',
            right: 0,
            width: '380px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 100
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Inbox size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '0.85rem' }}>All clear! No notifications.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--table-border)',
                      background: notif.is_read ? 'transparent' : 'var(--glass-glow)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      position: 'relative'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h6 style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem', color: notif.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {notif.title}
                      </h6>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                        {notif.message}
                      </p>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        style={{
                          background: 'var(--btn-secondary-bg)',
                          border: '1px solid var(--glass-border)',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--success)'
                        }}
                        title="Mark as Read"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
