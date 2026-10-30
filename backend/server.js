import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkConnection } from './config/db.js';
import { tenantResolver } from './middleware/tenantResolver.js';

// Route Handlers
import tenantRoutes from './routes/tenants.js';
import authRoutes from './routes/auth.js';
import vendorRoutes from './routes/vendors.js';
import requestRoutes from './routes/requests.js';
import rfqRoutes from './routes/rfqs.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboards.js';
import notificationRoutes from './routes/notifications.js';
import subscriptionRoutes from './routes/subscriptions.js';
import queryRoutes from './routes/queries.js';
import returnRoutes from './routes/returns.js';
import riskRoutes from './routes/risks.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Middlewares
// ==========================================

// Enable CORS for client requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));

// Request body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// Health Check Endpoint (No tenant context needed)
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await checkConnection();
    res.json({
      status: 'healthy',
      message: 'VendSphere Backend API is running.',
      database: 'Connected',
      time: dbStatus.now
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      message: 'Backend server is running but database connection failed.',
      error: error.message
    });
  }
});

// ==========================================
// Multi-Tenant Isolation Middleware
// ==========================================
// Resolves tenant context (via header, body, query, or subdomain) and binds isolated DB query runner
app.use(tenantResolver);

// ==========================================
// API Routes
// ==========================================
app.use('/api/tenants', tenantRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase-requests', requestRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/purchase-orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/risks', riskRoutes);

// ==========================================
// Global Error Handler
// ==========================================
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// ==========================================
// Server Initialization
// ==========================================
app.listen(PORT, async () => {
  console.log('===================================================');
  console.log(`  VendSphere Server running on port ${PORT}`);
  console.log('===================================================');

  try {
    await checkConnection();
  } catch (err) {
    console.warn('Warning: Database connection verification failed. Make sure PostgreSQL is active.');
  }
});
