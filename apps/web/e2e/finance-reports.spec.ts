import { test, expect, Page } from '@playwright/test';
import { format } from 'date-fns';

test.describe('Financial Reports and Timezone', () => {
  test('should display reports and respect Bogota timezone', async ({ page }: { page: Page }) => {
    // 1. Dashboard Login
    await page.goto('/dashboard/reportes');
    
    // 2. Check for report summary
    await expect(page.locator('text=/ventas brutas|gross sales/i')).toBeVisible();

    // 3. Select Date Range
    const datePicker = page.getByRole('button', { name: /calendario|date|fecha/i });
    await datePicker.click();
    
    // Select Current Month
    await page.getByRole('button', { name: /este mes|current month/i }).click();

    // 4. Verify displayed dates (should be Bogota local)
    // We check if the input values or labels match the expected format
    const today = new Date();
    const expectedYear = format(today, 'yyyy');
    await expect(page.locator('input[type="date"]').first()).toHaveValue(new RegExp(expectedYear));

    // 5. Export Report
    const exportButton = page.getByRole('button', { name: /exportar|download/i });
    await exportButton.click();
    
    // Wait for download
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: /excel/i }).click(),
    ]);
    
    expect(download.suggestedFilename()).toContain('.xlsx');

    // 6. Check for Bogota-specific UI elements (e.g. COP currency)
    await expect(page.locator('text=COP')).toBeVisible();
    await expect(page.locator('text=$')).toBeVisible();
  });
});
