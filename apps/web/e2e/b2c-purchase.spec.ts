import { test, expect, Page } from '@playwright/test';

test.describe('B2C Purchase Flow', () => {
  test('should navigate from home to checkout and show Wompi widget', async ({ page }: { page: Page }) => {
    // 1. Home
    await page.goto('/');
    await expect(page).toHaveTitle(/Tote Bag/i);

    // 2. Go to Catalog
    const shopLink = page.getByRole('link', { name: /tienda|shop|catálogo/i }).first();
    await shopLink.click();
    await expect(page).toHaveURL(/.*catalog/);

    // 3. Select a product (wait for products to load)
    await page.waitForSelector('.product-card', { state: 'visible', timeout: 10000 });
    const firstProduct = page.locator('.product-card').first();
    await firstProduct.click();

    // 4. Add to cart
    const addToCartButton = page.getByRole('button', { name: /agregar|añadir|add to cart/i });
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    // 5. Go to Checkout
    const cartButton = page.getByRole('button', { name: /carrito|cart/i });
    await cartButton.click();
    const checkoutLink = page.getByRole('link', { name: /comprar|checkout/i });
    await checkoutLink.click();
    await expect(page).toHaveURL(/.*checkout/);

    // 6. Fill checkout form
    await page.getByLabel(/nombre|name/i).fill('Test User');
    await page.getByLabel(/email|correo/i).fill('test@example.com');
    await page.getByLabel(/teléfono|phone/i).fill('3001234567');
    await page.getByLabel(/dirección|address/i).fill('Calle 123 # 45-67');

    // 7. Proceed to Payment
    const paymentButton = page.getByRole('button', { name: /pagar|payment/i });
    await paymentButton.click();

    // 8. Verify Wompi Widget or Redirect
    // Since we use Wompi Sandbox, we expect the widget to appear or a redirect notice
    // Note: In E2E tests, we often mock the actual payment gateway or just check for its presence
    await expect(page.locator('text=/redirigido|wompi/i')).toBeVisible();
  });
});
