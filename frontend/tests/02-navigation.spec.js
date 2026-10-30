// @ts-check
import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './helpers/auth.js';

test.describe('Application Navigation & Page Routing', () => {

  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin who has access to all menu items
    await loginAs(page, TEST_USERS.acmeAdmin);
  });

  test('should navigate to Vendors Directory and render vendor table', async ({ page }) => {
    await page.getByRole('link', { name: /vendors directory/i }).click();
    await page.waitForURL('**/vendors');
    await expect(page).toHaveURL(/.*vendors/);

    // Page title and actions
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Supplier Directory/i);
    await expect(page.locator('.sidebar-link.active')).toContainText(/Vendors Directory/i);
  });

  test('should navigate to Purchase Requests page', async ({ page }) => {
    await page.getByRole('link', { name: /purchase requests/i }).click();
    await page.waitForURL('**/purchase-requests');
    await expect(page).toHaveURL(/.*purchase-requests/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Purchase Requisitions/i);
    await expect(page.locator('.sidebar-link.active')).toContainText(/Purchase Requests/i);
  });

  test('should navigate to Approval Workflows page', async ({ page }) => {
    await page.getByRole('link', { name: /approval workflows/i }).click();
    await page.waitForURL('**/workflows');
    await expect(page).toHaveURL(/.*workflows/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Workflow/i);
  });

  test('should navigate to User Directory page', async ({ page }) => {
    await page.getByRole('link', { name: /user directory/i }).click();
    await page.waitForURL('**/users');
    await expect(page).toHaveURL(/.*users/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/User/i);
  });

  test('should navigate to Sourcing (RFQs) page', async ({ page }) => {
    await page.getByRole('link', { name: /sourcing \(rfqs\)/i }).click();
    await page.waitForURL('**/rfqs');
    await expect(page).toHaveURL(/.*rfqs/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sourcing|RFQ/i);
  });

  test('should navigate to Purchase Orders page', async ({ page }) => {
    await page.getByRole('link', { name: /purchase orders/i }).click();
    await page.waitForURL('**/purchase-orders');
    await expect(page).toHaveURL(/.*purchase-orders/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Purchase Order/i);
  });

  test('should navigate to Feedback & Queries page', async ({ page }) => {
    await page.getByRole('link', { name: /feedback & queries/i }).click();
    await page.waitForURL('**/queries');
    await expect(page).toHaveURL(/.*queries/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Feedback|Query/i);
  });

  test('should navigate to Returns & Warranty page', async ({ page }) => {
    await page.getByRole('link', { name: /returns & warranty/i }).click();
    await page.waitForURL('**/returns');
    await expect(page).toHaveURL(/.*returns/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Return/i);
  });

  test('should navigate to Risk Management page', async ({ page }) => {
    await page.getByRole('link', { name: /risk management/i }).click();
    await page.waitForURL('**/risks');
    await expect(page).toHaveURL(/.*risks/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Risk/i);
  });

  test('should navigate to Subscription & Billing page', async ({ page }) => {
    await page.getByRole('link', { name: /subscription & billing/i }).click();
    await page.waitForURL('**/subscriptions');
    await expect(page).toHaveURL(/.*subscriptions/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Subscription|Plan/i);
  });

});
