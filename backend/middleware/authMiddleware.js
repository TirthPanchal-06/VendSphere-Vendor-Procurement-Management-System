import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'vendsphere_development_jwt_secret_key_13579';

export const auth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No authorization token provided.' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Bind authenticated user properties to request
    req.user = decoded; 
    // decoded contains: { id, email, role, tenantId }

    // SECURITY CHECK: Verify the token matches the current request tenant scope
    // (Prevents session hijack/replay across different tenants on a shared domain)
    if (req.tenantId && req.user.tenantId !== req.tenantId && req.user.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Data isolation breach: Token does not match requested tenant space.' });
    }

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    res.status(401).json({ error: 'Invalid or expired authorization token.' });
  }
};

// Role-Based access control middleware generator
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { role } = req.user;

    // Super Admin overrides all local checks
    if (role === 'Super Admin') {
      return next();
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Permission denied. You do not have the required access role.' });
    }

    next();
  };
};
