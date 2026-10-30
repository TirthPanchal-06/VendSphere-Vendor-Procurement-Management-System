// @ts-check
import { expect } from '@playwright/test';

/**
 * Standard test accounts configured in VendSphere
 */
export const TEST_USERS = {
  acmeAdmin: {
    tenantId: 'acme',
    email: 'admin@acme.com',
    password: 'password123',
    role: 'Admin',
    name: 'Acme Corp Admin'
  },
  acmePurchaser: {
    tenantId: 'acme',
    email: 'procurement@acme.com',
    password: 'password123',
    role: 'ProcurementManager',
    name: 'Acme Corp Purchaser'
  },
  acmeManager: {
    tenantId: 'acme',
    email: 'manager@acme.com',
    password: 'password123',
    role: 'Manager',
    name: 'Acme Corp Manager'
  },
  acmeEmployee: {
    tenantId: 'acme',
    email: 'requester@acme.com',
    password: 'password123',
    role: 'Employee',
    name: 'Acme Corp Requester'
  },
  acmeVendor: {
    tenantId: 'acme',
    email: 'sales@apex-acme.com',
    password: 'password123',
    role: 'Vendor',
    name: 'Apex Sourcing'
  },
  jvGroupAdmin: {
    tenantId: 'jvgroup',
    email: 'tirth@gmail.com',
    password: 'password123',
    role: 'Admin',
    name: 'Tirth Panchal'
  }
};

/**
 * Logs in with specific user credentials or via one-click demo button
 * @param {import('@playwright/test').Page} page
 * @param {object} credentials
 * @param {string} credentials.tenantId
 * @param {string} credentials.email
 * @param {string} credentials.password
 */
export async function loginAs(page, { tenantId, email, password }) {
  await page.goto('/login');
  await expect(page).toHaveURL(/.*login/);

  // Fill in tenant subdomain
  const tenantInput = page.locator('input[placeholder="e.g. acme"]');
  await tenantInput.fill(tenantId);

  // Fill in email
  const emailInput = page.locator('input[type="email"]');
  await emailInput.fill(email);

  // Fill in password
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill(password);

  // Submit login form
  const submitBtn = page.getByRole('button', { name: /enter portal/i });
  await submitBtn.click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await expect(page).toHaveURL(/.*dashboard/);
}

/**
 * Logs out the current user via sidebar sign-out button
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  const logoutBtn = page.locator('button[title="Sign Out"]');
  await logoutBtn.click();
  await page.waitForURL('**/login', { timeout: 10000 });
  await expect(page).toHaveURL(/.*login/);
}
