// @ts-check
import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './helpers/auth.js';

test.describe('Role-Based Access Control (RBAC) & UI Boundaries', () => {

  test('Admin role should have full access to configuration pages', async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeAdmin);

    // Sidebar should display privileged links
    await expect(page.getByRole('link', { name: /approval workflows/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /user directory/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /risk management/i })).toBeVisible();

    // Directly accessing /workflows should be permitted
    await page.goto('/workflows');
    await expect(page).toHaveURL(/.*workflows/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Workflow/i);
  });

  test('Employee role should NOT see administrative links in sidebar', async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeEmployee);

    // Permitted links for Employee
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /purchase requests/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /purchase orders/i })).toBeVisible();

    // Privileged links MUST NOT be present
    await expect(page.getByRole('link', { name: /approval workflows/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /user directory/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /vendors directory/i })).not.toBeVisible();
  });

  test('Employee role should NOT have the Pay button on Purchase Orders', async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeEmployee);

    await page.getByRole('link', { name: /purchase orders/i }).click();
    await page.waitForURL('**/purchase-orders');

    // The Pay button in table action rows must not exist for Employee
    const payButton = page.locator('button', { hasText: /^Pay$/i });
    await expect(payButton).not.toBeVisible();
  });

  test('PrivateRoute should block Employee from accessing /workflows and redirect to /dashboard', async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeEmployee);

    // Attempt direct URL navigation to privileged /workflows
    await page.goto('/workflows');

    // PrivateRoute should redirect back to /dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('PrivateRoute should block Employee from accessing /users and redirect to /dashboard', async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeEmployee);

    // Attempt direct URL navigation to privileged /users
    await page.goto('/users');

    // PrivateRoute should redirect back to /dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
  });

});
