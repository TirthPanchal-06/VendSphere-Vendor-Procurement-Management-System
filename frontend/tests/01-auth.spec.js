// @ts-check
import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs, logout } from './helpers/auth.js';

test.describe('Authentication & Session Management', () => {

  test('should load the login page with all brand elements and form controls', async ({ page }) => {
    await page.goto('/login');

    // Brand and title
    await expect(page).toHaveTitle(/VendSphere/i);
    await expect(page.getByRole('heading', { name: 'VendSphere' })).toBeVisible();
    await expect(page.getByText(/Enterprise Procurement & Vendor Portal/i)).toBeVisible();

    // Form inputs
    await expect(page.locator('input[placeholder="e.g. acme"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /enter portal/i })).toBeVisible();

    // Quick demo buttons
    await expect(page.getByRole('button', { name: 'Acme Admin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'J.V. Group Admin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acme Purchaser' })).toBeVisible();
  });

  test('should show validation error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[placeholder="e.g. acme"]').fill('acme');
    await page.locator('input[type="email"]').fill('nonexistent@company.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /enter portal/i }).click();

    // Error alert banner should display
    const alert = page.locator('.alert-danger');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Invalid email|not found/i);
  });

  test('should login successfully using quick-demo one-click fill for Acme Admin', async ({ page }) => {
    await page.goto('/login');

    // Click quick-fill button
    await page.getByRole('button', { name: 'Acme Admin' }).click();

    // Inputs should be pre-populated
    await expect(page.locator('input[placeholder="e.g. acme"]')).toHaveValue('acme');
    await expect(page.locator('input[type="email"]')).toHaveValue('admin@acme.com');
    await expect(page.locator('input[type="password"]')).toHaveValue('password123');

    // Submit
    await page.getByRole('button', { name: /enter portal/i }).click();

    // Redirect to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);

    // Sidebar should display logged in user name & role
    await expect(page.locator('.sidebar')).toContainText(/Acme Corp Admin/i);
    await expect(page.locator('.sidebar')).toContainText(/Admin/i);
  });

  test('should login successfully as Purchaser and display appropriate role in sidebar', async ({ page }) => {
    await loginAs(page, TEST_USERS.acmePurchaser);

    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('.sidebar')).toContainText(/Acme Corp Purchaser/i);
    await expect(page.locator('.sidebar')).toContainText(/Procurement/i);
  });

  test('should login successfully as J.V. Group Admin in jvgroup tenant space', async ({ page }) => {
    await loginAs(page, TEST_USERS.jvGroupAdmin);

    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('.sidebar')).toContainText(/Tirth Panchal/i);
    await expect(page.locator('.sidebar')).toContainText(/Admin/i);
  });

  test('should log out cleanly and redirect back to login page', async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeAdmin);
    await logout(page);

    // Verify localStorage auth keys cleared and user redirected
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('button', { name: /enter portal/i })).toBeVisible();
  });

});
