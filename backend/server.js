import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkConnection } from './config/db.js';
import { tenantResolver } from './middleware/tenantResolver.js';

// Import Route Handlers
import tenantRoutes from './routes/tenants.js';
import authRoutes from './routes/auth.js';
import vendorRoutes from './routes/vendors.js';
import requestRoutes from './routes/requests.js';
import rfqRoutes from './routes/rfqs.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboards.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing middlewares
app.use(cors({
  origin: '*', // Allow all client requests in local test environments
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));
app.use(express.json());

// API Health Check (Requires no tenant context)
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

// Mount the SaaS Tenant Resolver Middleware
// All routes below this resolver will dynamically check search_path context
app.use(tenantResolver);

// Register Route Handlers
app.use('/api/tenants', tenantRoutes); // register is excluded from tenant header enforcement internally
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase-requests', requestRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/purchase-orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`===================================================`);
  console.log(`  VendSphere Server running on port ${PORT}`);
  console.log(`===================================================`);
  
  try {
    await checkConnection();
  } catch (err) {
    console.warn('Warning: Database connection verification failed. Make sure PostgreSQL is active.');
  }
});
