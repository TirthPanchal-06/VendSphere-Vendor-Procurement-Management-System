import { getTenantDb, queryGlobal } from '../config/db.js';

// Cache active tenants in memory to reduce database round-trips
const activeTenantsCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute cache lifetime

const fetchAndCacheTenant = async (tenantId) => {
  const normalizedId = (tenantId || '').trim().toLowerCase();
  const cached = activeTenantsCache.get(normalizedId);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.tenant;
  }

  try {
    const result = await queryGlobal(
      'SELECT id, name, subdomain, status FROM public.tenants WHERE LOWER(id) = LOWER($1) OR LOWER(subdomain) = LOWER($2)',
      [normalizedId, normalizedId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tenant = result.rows[0];
    
    // Store in cache
    activeTenantsCache.set(tenant.id.toLowerCase(), { tenant, timestamp: now });
    activeTenantsCache.set(tenant.subdomain.toLowerCase(), { tenant, timestamp: now });

    return tenant;
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    return null;
  }
};

export const tenantResolver = async (req, res, next) => {
  // 1. Resolve tenant ID from headers, body, or query
  let tenantId = req.headers['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId;

  if (!tenantId) {
    const hostname = req.hostname; // e.g. acme.vendsphere.com or localhost
    const parts = hostname.split('.');
    
    // If we have a subdomain structure (e.g., tenant.domain.com) and it's not 'www' or local root
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      tenantId = parts[0];
    }
  }

  // 2. Certain global paths don't require tenant identification (e.g. health checks, global registration)
  const isGlobalRoute = 
    req.path.startsWith('/api/tenants/register') || 
    req.path.startsWith('/api/auth/global-login') ||
    req.path.startsWith('/api/subscriptions/webhooks') ||
    req.path === '/api/subscriptions/plans' ||
    req.path === '/api/health';

  if (!tenantId) {
    if (isGlobalRoute) {
      return next();
    }
    return res.status(400).json({ error: 'Tenant context is missing. Please provide x-tenant-id header or request via a valid tenant subdomain.' });
  }

  // 3. Validate tenant and ensure it is active
  const tenant = await fetchAndCacheTenant(tenantId);

  if (!tenant) {
    return res.status(404).json({ error: `Tenant '${tenantId}' does not exist.` });
  }

  if (tenant.status !== 'Active') {
    return res.status(403).json({ error: `Tenant company '${tenant.name}' is suspended or inactive.` });
  }

  // 4. Bind tenant properties to request context
  req.tenantId = tenant.id;
  req.tenantName = tenant.name;
  req.tenantSubdomain = tenant.subdomain;
  
  // Attach isolated database handler
  req.db = getTenantDb(tenant.id);

  next();
};

// Utility to clear cache (e.g., when tenant changes profile or registers)
export const invalidateTenantCache = (tenantId) => {
  activeTenantsCache.delete(tenantId);
};
