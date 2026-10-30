import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// POST /api/tenants/register - Onboard a new tenant company
router.post('/register', async (req, res) => {
  const { companyName, subdomain, adminName, adminEmail, adminPassword } = req.body;

  if (!companyName || !subdomain || !adminName || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Sanitize subdomain to prevent SQL injection or bad folder name (alphanumeric only)
  const cleanSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanSubdomain.length < 3) {
    return res.status(400).json({ error: 'Subdomain must be at least 3 alphanumeric characters.' });
  }

  const tenantId = cleanSubdomain; // Using clean subdomain as the unique tenant ID
  const schemaName = `tenant_${tenantId}`;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check if subdomain already exists
    const checkSubdomain = await client.query(
      'SELECT id FROM public.tenants WHERE subdomain = $1',
      [cleanSubdomain]
    );
    if (checkSubdomain.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: `Subdomain '${cleanSubdomain}' is already taken.` });
    }

    // 2. Check if global email is registered
    const checkEmail = await client.query(
      'SELECT id FROM public.global_users WHERE email = $1',
      [adminEmail]
    );
    if (checkEmail.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'Email address is already registered in the system.' });
    }

    // 3. Register tenant in global catalog with default Starter (Freemium) plan
    await client.query(
      'INSERT INTO public.tenants (id, name, subdomain, plan, status) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, companyName, cleanSubdomain, 'Starter', 'Active']
    );

    // 4. Create separate schema for tenant
    await client.query(`CREATE SCHEMA "${schemaName}";`);

    // 5. Read and run migrations to create tables inside tenant schema
    const migrationPath = path.join(__dirname, '../db/migration.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Set search path to current tenant schema so tables are created there, then execute DDL
    await client.query(`SET search_path TO "${schemaName}", public;`);
    await client.query(migrationSql);

    // 6. Create global user record for auth lookup
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const globalUserRes = await client.query(
      'INSERT INTO public.global_users (email, password_hash, tenant_id, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [adminEmail, passwordHash, tenantId, 'Admin']
    );
    const globalUserId = globalUserRes.rows[0].id;

    // 7. Create local tenant user profile inside tenant schema
    await client.query(
      'INSERT INTO users (global_user_id, name, email, role, department, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [globalUserId, adminName, adminEmail, 'Admin', 'Administration', 'Active']
    );

    await client.query('COMMIT');
    client.release();

    res.status(201).json({
      message: 'Tenant onboarding completed successfully!',
      tenantId,
      subdomain: cleanSubdomain,
      admin: { name: adminName, email: adminEmail }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Tenant onboarding failed:', error);
    res.status(500).json({ error: 'Failed to onboard tenant company. Details: ' + error.message });
  }
});

export default router;
