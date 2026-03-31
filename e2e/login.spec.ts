import { test, expect } from '@playwright/test';
import { validUser, invalidUser, loginPath, protectedRoute } from './fixtures/test-data';

/**
 * E2E tests for the login flow.
 *
 * Validates: Requirement 5.2
 * - Successful login redirects to dashboard
 * - Invalid credentials show error message
 * - Accessing a protected route without session redirects to login with redirectTo
 */
test.describe('Login flow', () => {
  test('successful login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto(loginPath);

    await page.getByLabel(/correo/i).fill(validUser.email);
    await page.getByLabel(/contraseña/i).fill(validUser.password);
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
  });

  test('login with invalid credentials shows error message', async ({ page }) => {
    await page.goto(loginPath);

    await page.getByLabel(/correo/i).fill(invalidUser.email);
    await page.getByLabel(/contraseña/i).fill(invalidUser.password);
    await page.getByRole('button', { name: /ingresar/i }).click();

    // The login page shows an error alert with incorrect credentials message
    const errorMessage = page.locator('text=Correo o contraseña incorrectos');
    await expect(errorMessage).toBeVisible({ timeout: 10_000 });

    // Should remain on the login page
    await expect(page).toHaveURL(/login/);
  });

  test('accessing protected route without session redirects to login with redirectTo', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    // Try to access a protected route directly
    await page.goto(protectedRoute);

    // Should be redirected to login page with redirectTo parameter
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
    const url = page.url();
    expect(url).toMatch(/redirectTo/);
  });
});
