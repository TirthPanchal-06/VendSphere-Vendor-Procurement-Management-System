-- VENDSPHERE DATABASE SCHEMA MIGRATION SCRIPT

-- ========================================================
-- SECTION 1: GLOBAL DATABASE STRUCTURE (public schema)
-- ========================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for Tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  subdomain VARCHAR(50) UNIQUE NOT NULL,
  plan VARCHAR(20) DEFAULT 'Starter',
  status VARCHAR(20) DEFAULT 'Active',
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  subscription_status VARCHAR(20) DEFAULT 'active',
  autopay_enabled BOOLEAN DEFAULT true,
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN DEFAULT false,
  payment_method_type VARCHAR(50) DEFAULT 'upi',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist if table was already created in an earlier migration
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 month');
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS payment_method_type VARCHAR(50) DEFAULT 'upi';

-- Subscription Plans Catalog Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL,
  price_yearly NUMERIC(10,2) NOT NULL,
  max_rfqs_per_month INTEGER DEFAULT 5, -- -1 for unlimited
  max_pr_per_month INTEGER DEFAULT 2, -- -1 for unlimited (2 for Starter)
  max_vendors INTEGER DEFAULT 3, -- -1 for unlimited (3 for Starter)
  ai_matching_enabled BOOLEAN DEFAULT false,
  custom_branding_enabled BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_vendors INTEGER DEFAULT 3;

-- Subscriptions History Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(50) REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) REFERENCES public.subscription_plans(id),
  billing_cycle VARCHAR(20) NOT NULL, -- 'monthly', 'yearly'
  status VARCHAR(20) NOT NULL, -- 'active', 'expired', 'cancelled', 'past_due'
  amount NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  autopay_enabled BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  tenant_id VARCHAR(50) REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_name VARCHAR(100) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  tax_amount NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0.00,
  total_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'paid', -- 'paid', 'pending', 'failed', 'refunded'
  payment_method VARCHAR(50) NOT NULL, -- 'UPI / Google Pay', 'Credit/Debit Card'
  transaction_id VARCHAR(100) NOT NULL,
  billing_address JSONB,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment History Log Table
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(50) REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_gateway VARCHAR(50) DEFAULT 'VendSphere Secure Pay',
  transaction_id VARCHAR(100) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'UPI / Google Pay', 'Credit/Debit Card'
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'pending'
  signature VARCHAR(255) NOT NULL,
  raw_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Audit Log Table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(255) NOT NULL,
  processed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for Global Users (for authentication and mapping to tenant schemas)
CREATE TABLE IF NOT EXISTS public.global_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(50) REFERENCES public.tenants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);



-- ========================================================
-- SECTION 2: TENANT SCHEMA TABLES
-- ========================================================
-- Note: These tables do not specify a schema prefix. They
-- will be created within the dynamic tenant schema (e.g., tenant_xyz)
-- by executing "SET search_path TO tenant_xyz;" before running this section.

-- Tenant Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID, -- References public.global_users(id)
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL, -- Admin, ProcurementManager, Manager, Employee, Vendor
  department VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  category VARCHAR(100),
  payment_terms VARCHAR(100),
  rating NUMERIC(3, 2) DEFAULT 5.00,
  performance_score INTEGER DEFAULT 100,
  status VARCHAR(20) DEFAULT 'Pending Approval', -- Draft, Pending Approval, Active, Blocked
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Associate Vendor to a Tenant User (Vendor login link)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Purchase Requests
CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
  items JSONB NOT NULL, -- List of items: [{name, quantity, estimated_cost, category}]
  total_estimated_cost NUMERIC(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Draft', -- Draft, Pending Approval, Approved, Rejected, PO Created
  current_approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Approval Workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  threshold_amount NUMERIC(12, 2) NOT NULL, -- Trigger workflow if total_cost >= threshold_amount
  steps JSONB NOT NULL, -- Workflow steps: [{step_number, role, user_id (optional)}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Approval Logs (Auditing)
CREATE TABLE IF NOT EXISTS approval_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES purchase_requests(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- Approved, Rejected
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Request For Quotations (RFQ)
CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  items JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'Open', -- Open, Closed, Awarded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RFQ Invited Vendors
CREATE TABLE IF NOT EXISTS rfq_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Bids / Quotations
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  items JSONB NOT NULL, -- Submissions: [{name, quantity, unit_price, total_cost}]
  total_cost NUMERIC(12, 2) NOT NULL,
  delivery_days INTEGER NOT NULL,
  remarks TEXT,
  status VARCHAR(50) DEFAULT 'Submitted', -- Submitted, Under Review, Accepted, Rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Orders (PO)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Draft', -- Draft, Sent to Vendor, Accepted, Completed, Cancelled
  delivery_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- PR_PENDING, PR_APPROVED, PR_REJECTED, RFQ_RECEIVED, BID_SUBMITTED, PO_SENT, PO_ACCEPTED
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Audit Log
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Simulated Email logs
CREATE TABLE IF NOT EXISTS simulated_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employee Feedback & Queries on Delivered Purchase Orders
CREATE TABLE IF NOT EXISTS order_feedback_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NOT NULL,
  query_subject VARCHAR(255) NOT NULL,
  query_category VARCHAR(100) NOT NULL,
  query_priority VARCHAR(50) DEFAULT 'Medium',
  query_description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Open',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Query Activity Timeline & Responses
CREATE TABLE IF NOT EXISTS query_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_id UUID NOT NULL REFERENCES order_feedback_queries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  notes TEXT,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

