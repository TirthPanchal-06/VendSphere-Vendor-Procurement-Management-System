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
  plan VARCHAR(20) DEFAULT 'Standard',
  status VARCHAR(20) DEFAULT 'Active',
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
