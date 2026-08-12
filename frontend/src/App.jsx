import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';

// Page imports
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import PurchaseRequests from './pages/PurchaseRequests';
import Workflows from './pages/Workflows';
import RFQs from './pages/RFQs';
import PurchaseOrders from './pages/PurchaseOrders';
import Users from './pages/Users';

// Auth Guard for Private Routes
const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Verifying SaaS security boundaries...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Layout component wrapping sidebar and header
const AppLayout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            
            <Route path="/vendors" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager']}><Vendors /></PrivateRoute>
            } />
            
            <Route path="/purchase-requests" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee']}><PurchaseRequests /></PrivateRoute>
            } />
            
            <Route path="/workflows" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin']}><Workflows /></PrivateRoute>
            } />
            
            <Route path="/users" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin']}><Users /></PrivateRoute>
            } />
            
            <Route path="/rfqs" element={
              <PrivateRoute allowedRoles={['Admin', 'ProcurementManager', 'Vendor']}><RFQs /></PrivateRoute>
            } />
            
            <Route path="/purchase-orders" element={
              <PrivateRoute allowedRoles={['Admin', 'ProcurementManager', 'Manager', 'Vendor']}><PurchaseOrders /></PrivateRoute>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
