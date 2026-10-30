// @ts-check
import { test, expect } from '@playwright/test';
import { TEST_USERS, loginAs } from './helpers/auth.js';

test.describe('Forms, Modals & CRUD Operations (Non-Destructive)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.acmeAdmin);
  });

  test('should open New Purchase Request modal, validate dynamic line-item calculation, and close cleanly', async ({ page }) => {
    await page.getByRole('link', { name: /purchase requests/i }).click();
    await page.waitForURL('**/purchase-requests');

    // Click "Create Requisition" button
    const newReqBtn = page.getByRole('button', { name: /create requisition/i });
    await expect(newReqBtn).toBeVisible();
    await newReqBtn.click();

    // Verify modal appears
    const modal = page.locator('.modal-content', { hasText: /create purchase requisition/i });
    await expect(modal).toBeVisible();

    // Fill requisition title & description
    await modal.locator('input[placeholder="e.g. Office Hardware Refresh Q3"]').fill('Automated Test Requisition');
    await modal.locator('textarea').fill('Testing dynamic line-item computation without submitting to database.');

    // Enter line item details: 3 units @ 15,000 each
    await modal.locator('input[placeholder="Item name"]').first().fill('High-Performance Test Monitor');
    await modal.locator('input[placeholder="Qty"]').first().fill('3');
    await modal.locator('input[placeholder="Est. Cost"]').first().fill('15000');

    // Verify estimated total reflects 45,000 calculation
    await expect(modal).toContainText(/45,000/);

    // Cancel / close modal without submitting to preserve database integrity
    const cancelBtn = modal.getByRole('button', { name: /^cancel$/i });
    await cancelBtn.click();

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('should open Risk Mitigation Strategy modal, verify pre-populated mitigation plan, and close safely', async ({ page }) => {
    await page.getByRole('link', { name: /risk management/i }).click();
    await page.waitForURL('**/risks');

    // Verify 4 analytical sub-tabs
    await expect(page.getByRole('button', { name: /command center/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /vendor delays/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /price fluctuation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /procurement bottlenecks/i })).toBeVisible();

    // Switch to Vendor Delays sub-tab
    await page.getByRole('button', { name: /vendor delays/i }).click();

    // Look for an action button to mitigate
    const mitigateBtn = page.getByRole('button', { name: /mitigate/i }).first();
    if (await mitigateBtn.isVisible()) {
      await mitigateBtn.click();

      // Mitigation modal should open
      const modal = page.locator('.modal-content', { hasText: /risk mitigation action/i });
      await expect(modal).toBeVisible();

      // Textarea should contain pre-populated recommended strategy
      const strategyTextarea = modal.locator('textarea');
      await expect(strategyTextarea).toBeVisible();
      const planText = await strategyTextarea.inputValue();
      expect(planText.length).toBeGreaterThan(10);

      // Close modal without executing action to keep database untouched
      const cancelBtn = modal.getByRole('button', { name: /cancel/i }).or(modal.locator('.modal-header button'));
      await cancelBtn.first().click();
      await expect(modal).not.toBeVisible();
    }
  });

  test('should view Purchase Order details modal, toggle tabs, and inspect PDF export confirmation', async ({ page }) => {
    await page.getByRole('link', { name: /purchase orders/i }).click();
    await page.waitForURL('**/purchase-orders');

    // Filter or view the first available purchase order
    const viewBtn = page.getByRole('button', { name: /^view$/i }).first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();

      // Order Details Modal should be displayed
      const modal = page.locator('.modal-content', { hasText: /purchase order details/i });
      await expect(modal).toBeVisible();

      // Sub-tab navigation inside PO modal
      const lineItemsTab = modal.getByRole('button', { name: /quotation items/i });
      if (await lineItemsTab.isVisible()) {
        await lineItemsTab.click();
      }

      // Check PDF Export confirmation preview
      const exportPdfBtn = modal.getByRole('button', { name: /export pdf confirmation/i });
      if (await exportPdfBtn.isVisible()) {
        await exportPdfBtn.click();

        // PDF Confirmation Preview modal
        const pdfModal = page.locator('.modal-content', { hasText: /export purchase order pdf/i });
        await expect(pdfModal).toBeVisible();

        // Cancel / close PDF modal
        await pdfModal.getByRole('button', { name: /cancel/i }).click();
        await expect(pdfModal).not.toBeVisible();
      }

      // Close Details modal
      await modal.getByRole('button', { name: /close/i }).first().click();
      await expect(modal).not.toBeVisible();
    }
  });

  test('should filter Purchase Orders by status tabs without error', async ({ page }) => {
    await page.getByRole('link', { name: /purchase orders/i }).click();
    await page.waitForURL('**/purchase-orders');

    // Click through status filters
    const allTab = page.getByRole('button', { name: /^all/i });
    const draftTab = page.getByRole('button', { name: /^draft/i });
    const sentTab = page.getByRole('button', { name: /sent to vendor/i });
    const acceptedTab = page.getByRole('button', { name: /^accepted/i });
    const completedTab = page.getByRole('button', { name: /^completed/i });

    if (await draftTab.isVisible()) {
      await draftTab.click();
      await expect(draftTab).toHaveClass(/btn-primary/);
    }
    if (await sentTab.isVisible()) {
      await sentTab.click();
      await expect(sentTab).toHaveClass(/btn-primary/);
    }
    if (await allTab.isVisible()) {
      await allTab.click();
      await expect(allTab).toHaveClass(/btn-primary/);
    }
  });

});
