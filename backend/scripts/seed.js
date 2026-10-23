import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createDatabaseIfNotExists = async () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:6529@localhost:5432/vendsphere';
  const defaultUrl = connectionString.replace(/\/vendsphere(\?.*)?$/, '/postgres$1');
  
  const client = new pg.Client({ connectionString: defaultUrl });
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'vendsphere'");
    if (res.rows.length === 0) {
      console.log("Database 'vendsphere' does not exist. Creating it now...");
      await client.query("CREATE DATABASE vendsphere");
      console.log("Database 'vendsphere' created successfully.");
    } else {
      console.log("Database 'vendsphere' already exists.");
    }
  } catch (err) {
    console.error("Error checking or creating database:", err.message);
  } finally {
    await client.end();
  }
};

const seedDatabase = async () => {
  await createDatabaseIfNotExists();
  console.log('Starting VendSphere Database Setup and Seeding...');
  const client = await pool.connect();

  try {
    // 1. Initial public setup and uuid extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    
    // Read and run public migration tables
    const migrationPath = path.join(__dirname, '../db/migration.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Creating global public registry tables...');
    await client.query(migrationSql);

    // Seed Subscription Plans Catalog
    console.log('Seeding subscription plans catalog...');
    const plans = [
      { id: 'starter', name: 'Starter', desc: 'Essential procurement tools for growing teams & small businesses.', p_monthly: 0, p_yearly: 0, max_rfq: 5, max_pr: 2, max_vendors: 3, ai: false, branding: false, priority: false },
      { id: 'professional', name: 'Professional', desc: 'Advanced procurement features with AI Vendor Matching & higher limits.', p_monthly: 4999, p_yearly: 47990, max_rfq: 50, max_pr: 200, max_vendors: -1, ai: true, branding: true, priority: true },
      { id: 'enterprise', name: 'Enterprise', desc: 'Unlimited capacity, full AI suite, custom workflows, & dedicated account manager.', p_monthly: 14999, p_yearly: 143990, max_rfq: -1, max_pr: -1, max_vendors: -1, ai: true, branding: true, priority: true }
    ];

    for (const p of plans) {
      await client.query(
        `INSERT INTO public.subscription_plans 
         (id, name, description, price_monthly, price_yearly, max_rfqs_per_month, max_pr_per_month, max_vendors, ai_matching_enabled, custom_branding_enabled, priority_support, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name, description = EXCLUDED.description, price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly, max_pr_per_month = EXCLUDED.max_pr_per_month, max_vendors = EXCLUDED.max_vendors`,
        [p.id, p.name, p.desc, p.p_monthly, p.p_yearly, p.max_rfq, p.max_pr, p.max_vendors, p.ai, p.branding, p.priority]
      );
    }

    // 2. Define Tenant Onboarding Helper
    const onboardTenant = async (id, name, subdomain, planName = 'Enterprise', cycle = 'monthly') => {
      console.log(`Onboarding tenant: ${name} (${id}) on ${planName} plan...`);
      
      // Clean previous run
      await client.query(`DROP SCHEMA IF EXISTS "tenant_${id}" CASCADE;`);
      await client.query('DELETE FROM public.global_users WHERE tenant_id = $1', [id]);
      await client.query('DELETE FROM public.tenants WHERE id = $1', [id]);

      const now = new Date();
      const end = new Date(now);
      if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);

      // Insert tenant with subscription details
      await client.query(
        `INSERT INTO public.tenants 
         (id, name, subdomain, plan, status, billing_cycle, subscription_status, autopay_enabled, current_period_start, current_period_end) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, name, subdomain, planName, 'Active', cycle, 'active', true, now, end]
      );

      // Insert initial subscription record
      const pId = planName.toLowerCase();
      const pRow = plans.find(p => p.id === pId) || plans[2];
      const amount = cycle === 'yearly' ? pRow.p_yearly : pRow.p_monthly;
      const tax = amount * 0.18;
      const total = amount + tax;

      const subRes = await client.query(
        `INSERT INTO public.subscriptions 
         (tenant_id, plan_id, billing_cycle, status, amount, tax_amount, total_amount, autopay_enabled, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
         RETURNING id`,
        [id, pId, cycle, 'active', amount, tax, total, now, end]
      );

      // Insert initial invoice record
      const invNum = `INV-INIT-${id.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const invRes = await client.query(
        `INSERT INTO public.invoices
         (invoice_number, tenant_id, subscription_id, plan_name, billing_cycle, amount, tax_amount, total_amount, status, payment_method, transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [invNum, id, subRes.rows[0].id, `${planName} Plan`, cycle, amount, tax, total, 'paid', 'UPI / Google Pay', `TXN_INIT_${id.toUpperCase()}`]
      );

      // Insert initial payment log
      await client.query(
        `INSERT INTO public.payment_history
         (tenant_id, invoice_id, payment_gateway, transaction_id, payment_method, amount, status, signature, raw_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, invRes.rows[0].id, 'VendSphere Secure Pay', `TXN_INIT_${id.toUpperCase()}`, 'UPI / Google Pay', total, 'success', 'SEED_HMAC_VERIFIED_SIGNATURE', JSON.stringify({ note: 'Initial seed transaction' })]
      );

      // Create schema & tables
      await client.query(`CREATE SCHEMA "tenant_${id}";`);
      await client.query(`SET search_path TO "tenant_${id}", public;`);
      await client.query(migrationSql); // runs tenant DDL

      // Create users
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('password123', salt);

      const users = [
        { name: `${name} Admin`, email: `admin@${id}.com`, role: 'Admin', dept: 'Administration' },
        { name: `${name} Purchaser`, email: `procurement@${id}.com`, role: 'ProcurementManager', dept: 'Purchasing' },
        { name: `${name} Manager`, email: `manager@${id}.com`, role: 'Manager', dept: 'Management' },
        { name: `${name} Requester`, email: `requester@${id}.com`, role: 'Employee', dept: 'Engineering' }
      ];

      for (const u of users) {
        // Insert global auth registry
        const gRes = await client.query(
          'INSERT INTO public.global_users (email, password_hash, tenant_id, role) VALUES ($1, $2, $3, $4) RETURNING id',
          [u.email, hash, id, u.role]
        );
        const globalId = gRes.rows[0].id;

        // Insert local user profile in schema
        await client.query(
          'INSERT INTO users (global_user_id, name, email, role, department, status) VALUES ($1, $2, $3, $4, $5, $6)',
          [globalId, u.name, u.email, u.role, u.dept, 'Active']
        );
      }

      // Seed approval workflows
      // Workflow 1: Two-Stage Manager & Admin Approval
      await client.query(
        'INSERT INTO approval_workflows (name, threshold_amount, steps) VALUES ($1, $2, $3)',
        ['Manager & Admin Approval', 0.00, JSON.stringify([
          { step_number: 1, role: 'Manager' },
          { step_number: 2, role: 'Admin' }
        ])]
      );

      // Workflow 2: Executive Board Approval
      await client.query(
        'INSERT INTO approval_workflows (name, threshold_amount, steps) VALUES ($1, $2, $3)',
        ['Executive Board Approval', 5000.00, JSON.stringify([
          { step_number: 1, role: 'Manager' },
          { step_number: 2, role: 'Admin' }
        ])]
      );

      // Seed vendors (13 vendors total, adding 10 diverse corporate vendors)
      const vendors = [
        { name: 'Apex Sourcing', contact: 'Alice Smith', email: `sales@apex-${id}.com`, phone: '555-0101', cat: 'Office Supplies', terms: 'Net 30', rating: 5.0, score: 100, status: 'Active' },
        { name: 'Industrial Parts Group', contact: 'Bob Johnson', email: `info@industrial-${id}.com`, phone: '555-0102', cat: 'Hardware', terms: 'Net 15', rating: 4.2, score: 85, status: 'Active' },
        { name: 'Custom Printing Services', contact: 'Charlie Brown', email: `print@print-${id}.com`, phone: '555-0103', cat: 'Marketing', terms: 'Due on Receipt', rating: 5.0, score: 100, status: 'Pending Approval' },
        { name: 'Nexus Logistics & Supply', contact: 'Sarah Jenkins', email: `info@nexuslogistics-${id}.com`, phone: '555-0104', cat: 'Logistics & Freight', terms: 'Net 30', rating: 4.8, score: 94, status: 'Active' },
        { name: 'CloudScale Systems & IT', contact: 'David Chen', email: `enterprise@cloudscale-${id}.com`, phone: '555-0105', cat: 'IT & Software', terms: 'Net 15', rating: 4.9, score: 98, status: 'Active' },
        { name: 'Global Freight Forwarders', contact: 'Elena Rostova', email: `dispatch@globalfreight-${id}.com`, phone: '555-0106', cat: 'Logistics & Freight', terms: 'Net 60', rating: 4.1, score: 82, status: 'Active' },
        { name: 'Vanguard Security Solutions', contact: 'Marcus Vance', email: `contact@vanguardsec-${id}.com`, phone: '555-0107', cat: 'Facility & Security', terms: 'Net 30', rating: 4.6, score: 91, status: 'Active' },
        { name: 'BioGreen Office Supplies', contact: 'Karen Green', email: `orders@biogreen-${id}.com`, phone: '555-0108', cat: 'Office Supplies', terms: 'Net 15', rating: 4.7, score: 92, status: 'Active' },
        { name: 'Precision Metalworks & Fabrication', contact: 'Michael Chang', email: `quotes@precisionmetal-${id}.com`, phone: '555-0109', cat: 'Hardware & Machinery', terms: 'Net 30', rating: 4.4, score: 88, status: 'Active' },
        { name: 'ProMedia Marketing Agency', contact: 'Jessica Taylor', email: `hello@promedia-${id}.com`, phone: '555-0110', cat: 'Marketing & Media', terms: 'Due on Receipt', rating: 4.3, score: 86, status: 'Pending Approval' },
        { name: 'Titan Chemical Solutions', contact: 'Robert Lawson', email: `support@titanchem-${id}.com`, phone: '555-0111', cat: 'Raw Materials', terms: 'Net 60', rating: 3.5, score: 68, status: 'Blocked' },
        { name: 'Apex Energy & Fuel Co.', contact: 'Daniel Garcia', email: `b2b@apexenergy-${id}.com`, phone: '555-0112', cat: 'Utilities & Energy', terms: 'Net 15', rating: 4.8, score: 95, status: 'Active' },
        { name: 'Summit Consulting Group', contact: 'Amanda Sterling', email: `advisory@summitcg-${id}.com`, phone: '555-0113', cat: 'Professional Services', terms: 'Net 30', rating: 5.0, score: 100, status: 'Active' }
      ];

      for (const v of vendors) {
        // 1. Create a user account for the active vendor contacts so they can log in
        const vUserEmail = v.email;
        const gVendorRes = await client.query(
          'INSERT INTO public.global_users (email, password_hash, tenant_id, role) VALUES ($1, $2, $3, $4) RETURNING id',
          [vUserEmail, hash, id, 'Vendor']
        );
        
        const localUserRes = await client.query(
          'INSERT INTO users (global_user_id, name, email, role, department, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [gVendorRes.rows[0].id, v.contact, vUserEmail, 'Vendor', 'External', 'Active']
        );

        // 2. Insert vendor profile linked to the user account
        await client.query(
          `INSERT INTO vendors (name, contact_name, email, phone, category, payment_terms, rating, performance_score, status, user_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [v.name, v.contact, v.email, v.phone || '555-0199', v.cat, v.terms, v.rating, v.score, v.status, localUserRes.rows[0].id]
        );
      }

      console.log(`Tenant ${name} database seeded successfully.`);
    };

    // 3. Seed Acme Corp, Beta Tech & Nova Labs (Freemium)
    await onboardTenant('acme', 'Acme Corp', 'acme', 'Enterprise', 'yearly');
    await onboardTenant('beta', 'Beta Tech', 'beta', 'Professional', 'monthly');
    await onboardTenant('nova', 'Nova Labs', 'nova', 'Starter', 'monthly');

    // ========================================================
    // SECTION 3: SAAS DATA ISOLATION VERIFICATION SANITY CHECK
    // ========================================================
    console.log('\n--- Running Multi-Tenant Isolation Sanity Check ---');
    
    // Set search path to tenant acme
    await client.query('SET search_path TO "tenant_acme", public;');
    const acmeUsersCountRes = await client.query('SELECT COUNT(*) FROM users');
    const acmeUsersRes = await client.query('SELECT email FROM users');
    console.log(`Acme Schema - Users Count: ${acmeUsersCountRes.rows[0].count}`);
    console.log(`Acme Emails: ${acmeUsersRes.rows.map(r => r.email).join(', ')}`);

    // Set search path to tenant beta
    await client.query('SET search_path TO "tenant_beta", public;');
    const betaUsersCountRes = await client.query('SELECT COUNT(*) FROM users');
    const betaUsersRes = await client.query('SELECT email FROM users');
    console.log(`Beta Schema - Users Count: ${betaUsersCountRes.rows[0].count}`);
    console.log(`Beta Emails: ${betaUsersRes.rows.map(r => r.email).join(', ')}`);

    // Validate absolute isolation
    const acmeEmailsInBeta = betaUsersRes.rows.filter(r => r.email.includes('acme.com'));
    if (acmeEmailsInBeta.length === 0) {
      console.log('PASS: Tenant Isolation verified successfully. Data is strictly separated.');
    } else {
      console.log('FAIL: Data leak detected! Acme users visible in Beta schema.');
    }

    console.log('----------------------------------------------------');
    console.log('Seeding process completed successfully!');

  } catch (error) {
    console.error('Failed to seed database:', error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
};

seedDatabase();
