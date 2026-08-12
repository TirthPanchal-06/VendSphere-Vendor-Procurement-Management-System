import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BACKEND_URL = 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tenantId, setTenantId] = useState('');
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize axios configuration
  const api = axios.create({
    baseURL: BACKEND_URL,
  });

  // Inject request interceptors to dynamically set headers on every API call
  api.interceptors.request.use(
    (config) => {
      const activeToken = token || localStorage.getItem('vendsphere_token');
      const activeTenantId = tenantId || localStorage.getItem('vendsphere_tenant_id');

      if (activeToken) {
        config.headers.Authorization = `Bearer ${activeToken}`;
      }
      if (activeTenantId) {
        config.headers['x-tenant-id'] = activeTenantId;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  useEffect(() => {
    // Load initial authorization states from storage (runs only once on mount)
    const storedToken = localStorage.getItem('vendsphere_token');
    const storedUser = localStorage.getItem('vendsphere_user');
    const storedTenantId = localStorage.getItem('vendsphere_tenant_id');
    const storedTenantInfo = localStorage.getItem('vendsphere_tenant_info');

    if (storedToken && storedUser && storedTenantId) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setTenantId(storedTenantId);
      if (storedTenantInfo) {
        setTenantInfo(JSON.parse(storedTenantInfo));
      }
    }
    setLoading(false);
  }, []); // Empty array: runs only once on mount to restore session

  // Login handler
  const login = async (email, password, inputTenantId) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, 
        { email, password, tenantId: inputTenantId },
        { headers: { 'x-tenant-id': inputTenantId } }
      );

      const { token: receivedToken, user: receivedUser, tenant: receivedTenant } = response.data;

      localStorage.setItem('vendsphere_token', receivedToken);
      localStorage.setItem('vendsphere_user', JSON.stringify(receivedUser));
      localStorage.setItem('vendsphere_tenant_id', receivedTenant.id);
      localStorage.setItem('vendsphere_tenant_info', JSON.stringify(receivedTenant));

      setToken(receivedToken);
      setUser(receivedUser);
      setTenantId(receivedTenant.id);
      setTenantInfo(receivedTenant);

      return { success: true };
    } catch (error) {
      console.error('AuthContext login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Authentication failed. Please verify credentials.' 
      };
    }
  };

  // Tenant Onboarding Registration handler
  const registerTenant = async (formData) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/tenants/register`, formData);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Tenant onboarding failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Failed to onboard tenant company.' 
      };
    }
  };

  // Log out handler
  const logout = () => {
    localStorage.removeItem('vendsphere_token');
    localStorage.removeItem('vendsphere_user');
    localStorage.removeItem('vendsphere_tenant_id');
    localStorage.removeItem('vendsphere_tenant_info');
    
    setToken(null);
    setUser(null);
    setTenantId('');
    setTenantInfo(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, tenantId, tenantInfo, loading, login, logout, registerTenant, api }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be wrapped within an AuthProvider context');
  }
  return context;
};
