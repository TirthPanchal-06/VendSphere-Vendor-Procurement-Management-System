// @ts-check
import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './helpers/auth.js';

test.describe('Dashboard & Analytics Cockpit', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeAdmin);
  });

  test('should render Executive KPI cards correctly', async ({ page }) => {
    // Check key executive metrics
    await expect(page.getByText(/Completed Spend/i).first()).toBeVisible();
    await expect(page.getByText(/Committed \/ Pending Spend/i)).toBeVisible();
    await expect(page.getByText(/Supplier Health Index/i)).toBeVisible();
    await expect(page.getByText(/Requisitions Lifecycle/i)).toBeVisible();
  });

  test('should display the Procurement Risk Pulse banner with score and drill-down link', async ({ page }) => {
    // Risk Pulse widget
    const pulseCard = page.locator('.glass-panel', { hasText: /Enterprise Procurement Risk Pulse/i });
    await expect(pulseCard).toBeVisible();

    // Verify presence of threat statistics
    await expect(pulseCard).toContainText(/Vendor Delays/i);
    await expect(pulseCard).toContainText(/Price Spikes/i);
    await expect(pulseCard).toContainText(/Bottlenecks/i);

    // Click Open Risk Cockpit button
    const cockpitBtn = pulseCard.getByRole('link', { name: /open risk cockpit/i });
    await expect(cockpitBtn).toBeVisible();
    await cockpitBtn.click();

    // Verifies navigation to /risks
    await page.waitForURL('**/risks');
    await expect(page).toHaveURL(/.*risks/);
  });

  test('should switch across Analytics Sub-tabs smoothly', async ({ page }) => {
    // Default is Executive Overview
    await expect(page.getByRole('button', { name: /executive overview/i })).toBeVisible();

    // Switch to Vendor Performance
    await page.getByRole('button', { name: /vendor performance/i }).click();
    await expect(page.getByText(/Registered Suppliers/i).first()).toBeVisible();
    await expect(page.getByText(/Average Supplier Score/i)).toBeVisible();

    // Switch to Purchasing & Items
    await page.getByRole('button', { name: /purchasing & items/i }).click();
    await expect(page.getByText(/Top Purchased & Sourced Line Items/i)).toBeVisible();

    // Switch to Procurement Reports
    await page.getByRole('button', { name: /procurement reports/i }).click();
    await expect(page.getByText(/Departmental Spend Analysis/i)).toBeVisible();
  });

  test('should open and close the Executive Report Generator modal', async ({ page }) => {
    const reportBtn = page.getByRole('button', { name: /generate executive report/i });
    await expect(reportBtn).toBeVisible();
    await reportBtn.click();

    // Modal should appear
    const modal = page.locator('.modal-content', { hasText: /Executive Procurement Analytics Report/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Financial & Procurement Health/i)).toBeVisible();

    // Close modal via close button
    const closeBtn = modal.getByRole('button', { name: /close/i });
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

});
