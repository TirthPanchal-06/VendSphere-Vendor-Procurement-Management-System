import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';

// Page Imports
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import PurchaseRequests from './pages/PurchaseRequests';
import Workflows from './pages/Workflows';
import RFQs from './pages/RFQs';
import PurchaseOrders from './pages/PurchaseOrders';
import Users from './pages/Users';
import Subscriptions from './pages/Subscriptions';
import Queries from './pages/Queries';
import Returns from './pages/Returns';
import RiskManagement from './pages/RiskManagement';

/**
 * Route guard component for authenticated and role-restricted routes
 */
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

/**
 * Main application layout enclosing Sidebar, Navbar header, and view content
 */
const AppLayout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main className="main-content">
          <Routes>
            {/* Dashboard - Accessible to all roles */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

            {/* Vendors Directory */}
            <Route path="/vendors" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager']}><Vendors /></PrivateRoute>
            } />

            {/* Purchase Requests */}
            <Route path="/purchase-requests" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee']}><PurchaseRequests /></PrivateRoute>
            } />

            {/* Approval Workflows */}
            <Route path="/workflows" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin']}><Workflows /></PrivateRoute>
            } />

            {/* User Directory */}
            <Route path="/users" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin']}><Users /></PrivateRoute>
            } />

            {/* RFQs & Sourcing */}
            <Route path="/rfqs" element={
              <PrivateRoute allowedRoles={['Admin', 'ProcurementManager', 'Vendor']}><RFQs /></PrivateRoute>
            } />

            {/* Purchase Orders */}
            <Route path="/purchase-orders" element={
              <PrivateRoute allowedRoles={['Admin', 'ProcurementManager', 'Manager', 'Employee', 'Vendor']}><PurchaseOrders /></PrivateRoute>
            } />

            {/* Feedback & Queries */}
            <Route path="/queries" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee']}><Queries /></PrivateRoute>
            } />

            {/* Item Returns & Warranty */}
            <Route path="/returns" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager', 'Manager', 'Employee', 'Vendor']}><Returns /></PrivateRoute>
            } />

            {/* Risk Management & Telemetry */}
            <Route path="/risks" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager', 'Manager']}><RiskManagement /></PrivateRoute>
            } />

            {/* Subscriptions & Billing */}
            <Route path="/subscriptions" element={
              <PrivateRoute allowedRoles={['Admin', 'Company Admin', 'ProcurementManager', 'Manager']}><Subscriptions /></PrivateRoute>
            } />

            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

/**
 * Root App Component
 */
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
