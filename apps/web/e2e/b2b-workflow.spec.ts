import { test, expect, Page } from '@playwright/test';

test.describe('B2B Corporate Flow', () => {
  test('should submit a B2B request and verify audit trail', async ({ page }: { page: Page }) => {
    // 1. Navigate to B2B
    await page.goto('/corporativo');
    await expect(page.getByRole('heading', { name: /corporativo|b2b/i })).toBeVisible();

    // 2. Fill B2B Form
    await page.getByLabel(/empresa|company/i).fill('Test Corp');
    await page.getByLabel(/contacto|contact/i).fill('Juan Perez');
    await page.getByLabel(/email|correo/i).fill('juan@testcorp.com');
    await page.getByLabel(/cantidad|quantity/i).fill('100');
    await page.getByLabel(/mensaje|message/i).fill('Necesitamos 100 totes con nuestro logo.');

    // 3. Submit
    await page.getByRole('button', { name: /enviar|submit/i }).click();
    await expect(page.locator('text=/enviado con éxito|success/i')).toBeVisible();

    // 4. Admin Login (Simulated / Protected Route)
    // We assume there's a way to bypass or use a test session
    await page.goto('/dashboard/b2b');
    // If redirected to login, the test should handle it or use storageState
    
    // 5. Verify Request in Dashboard
    await expect(page.locator('text=Test Corp')).toBeVisible();
    
    // 6. Approval Flow
    const approveButton = page.getByRole('button', { name: /aprobar|approve/i }).first();
    await approveButton.click();
    await expect(page.locator('text=/aprobado|approved/i')).toBeVisible();

    // 7. Verify Audit Log
    await page.goto('/dashboard/audit');
    await expect(page.locator('text=/B2B_APPROVE|UPDATE_AUTO/i')).toBeVisible();
  });
});
