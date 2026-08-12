# VendSphere | SaaS Vendor and Procurement Management System

VendSphere is a modern, enterprise-grade, multi-tenant Software-as-a-Service (SaaS) application designed to streamline vendor onboarding, purchase requisitions, multi-level approval workflows, quotation bidding (RFQs), purchase orders, and supplier scorecard evaluations with complete data isolation.

---

## Key Core Features

- **Company Onboarding (Multi-Tenancy)**: Sign up a new company to dynamically spin up a isolated, dedicated PostgreSQL schema (`tenant_subdomain`) with zero data leak risk.
- **Role-Based Authentication (RBAC)**: Supports roles including `Admin`, `ProcurementManager`, `Manager`, `Employee`, and `Vendor` with isolated dashboard structures.
- **Purchase Requisitions**: Employees create purchase requests containing multiple line items with real-time budget calculations.
- **Conditional Multi-Level Approvals**: Configurable threshold rules (e.g., Capex approvals) routing PRs sequentially through managers and admins.
- **RFQ Sourcing & Vendor Bidding**: Procurement managers compile approved requests into RFQs, invite active vendors, and compare submitted quote options (unit pricing + lead times) side-by-side.
- **Purchase Orders (PO)**: Generate and dispatch sequential POs, manage vendor sign-offs, and track shipments.
- **Automated Scorecard Evaluation**: An automated performance engine that measures promised lead times against actual delivery, dynamically updating supplier ratings and scores.
- **In-App Notifications**: Real-time action alerts for pending reviews, awarded bids, and PO dispatches.

---

## Technology Stack

- **Frontend**: React.js (Vite), React Router Dom (Client-side Routing), Axios, and Lucide React Icons.
- **Styling**: Tailored **Vanilla CSS Design Tokens** (index.css) implementing a premium dark theme, glassmorphism panel backdrops (`backdrop-filter`), hover scale feedback, and responsive layouts.
- **Backend**: Node.js, Express.js, and raw Node-PostgreSQL (`pg` Connection Pool).
- **Database**: PostgreSQL (multi-tenant Schema-based Isolation).

---

## Project Architecture

[VendSphere Workspace Root]
 ├── backend/
 │    ├── config/           # Database pool initialization & schema search_path binds
 │    ├── db/
 │    │    └── migration.sql # Dynamic SQL script mapping tenant schemas
 │    ├── middleware/       # tenantResolver.js, authMiddleware.js
 │    ├── routes/           # Core API modules (auth, vendors, requests, rfqs, orders, dashboards, notifications)
 │    ├── scripts/          # seed.js (Auto-db builder, mock seeder, isolation validator)
 │    ├── server.js         # Entry node
 │    └── package.json
 ├── frontend/
 │    ├── src/
 │    │    ├── components/  # Reusable UI widgets (Navbar, Sidebar)
 │    │    ├── context/     # AuthContext.jsx
 │    │    ├── pages/       # Login, Dashboard, Vendors, PurchaseRequests, Workflows, RFQs, PurchaseOrders
 │    │    ├── App.jsx      # Router & Layout setup
 │    │    ├── index.css    # Premium Vanilla CSS Design Tokens
 │    │    └── main.jsx
 │    ├── package.json
 │    └── vite.config.js
 └── README.md

---

## How to Run & Verify Locally

### Prerequisites

- Node.js (v18 or higher recommended).
- PostgreSQL database service active on `localhost:5432`.

### Step 1: Clone and Configure Environment

Verify or update the connection URL inside the `/backend/.env` file:

```env
DATABASE_URL=postgresql://postgres:6529@localhost:5432/vendsphere
JWT_SECRET=vendsphere_development_jwt_secret_key_13579
PORT=5000
```

*(Replace `6529` and `postgres` with your local PostgreSQL credentials if different)*.

### Step 2: Seed Database & Run Isolation Test

Initialize the schemas and load mock data by executing the seeder script in the `/backend` folder:

```powershell
cd backend
node scripts/seed.js
```

This script will:

1. Connect to default `postgres` schema to check if `vendsphere` database exists, creating it if missing.
2. Build the `public` global tenant directories.
3. Onboard two companies: **Acme Corp (`acme`)** and **Beta Tech (`beta`)** under separate schemas.
4. Execute a sanity check asserting that **Beta Tech** cannot query **Acme Corp** users (Tenancy Isolation Verification).

### Step 3: Launch Servers

Start the backend Express API (Port 5000) and frontend React server (Port 5173):

**Launch Backend:**

```powershell
cd backend
npm run dev
```

**Launch Frontend:**

```powershell
cd frontend
npm run dev
```

---

## Mock Accounts Seeded for Testing

All test accounts are configured with the default password: **`password123`**.

### Company 1: Acme Corp (Tenant: `acme`)

- **Admin**: `admin@acme.com`
- **Procurement Manager**: `procurement@acme.com`
- **Manager (Approver)**: `manager@acme.com`
- **Employee (Requester)**: `requester@acme.com`
- **Supplier Contact (Vendor)**: `sales@apex-acme.com` (Invited to bid)

### Company 2: Beta Tech (Tenant: `beta`)

- **Admin**: `admin@beta.com`
- **Procurement Manager**: `procurement@beta.com`
- **Manager (Approver)**: `manager@beta.com`
- **Employee (Requester)**: `requester@beta.com`
- **Supplier Contact (Vendor)**: `sales@apex-beta.com`

---

## Security & Data Isolation Architecture

VendSphere uses **Schema-Based Multi-Tenancy**. All clients connect via a single shared connection pool to optimize resources. When a request arrives, the `tenantResolver` middleware:

1. Extracts the tenant subdomain or `x-tenant-id` header.
2. Validates and retrieves the tenant schema index.
3. Executes a connection command:

   ```sql
   SET search_path TO "tenant_{tenantId}", public;
   ```

4. Executes queries, causing PostgreSQL to automatically point to the tenant-specific tables (e.g. `tenant_acme.users`) and fall back to public schemas for global operations. This guarantees zero data overlap.
