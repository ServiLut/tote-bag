import { expect, test } from '@playwright/test';

const STATIC_ROUTES = [
  { path: '/', title: /Tote Bag Shop/i, text: /tote/i },
  { path: '/about', title: /About|Tote Bag Shop/i, text: /tote|nosotros|about/i },
  {
    path: '/corporativo',
    title: /Corporativo|Tote Bag Shop/i,
    text: /corporativo|b2b/i,
  },
  { path: '/envios', title: /Envios|Tote Bag Shop/i, text: /env[ií]os|shipping/i },
] as const;

test.describe('Static route smoke @smoke', () => {
  for (const route of STATIC_ROUTES) {
    test(`renders ${route.path}`, async ({ page }) => {
      const response = await page.goto(route.path);

      expect(response?.ok()).toBeTruthy();
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator('body')).toContainText(route.text);
    });
  }
});
