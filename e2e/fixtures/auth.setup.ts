import { test as setup, expect } from '@playwright/test';
import { validUser, loginPath } from './test-data';

/**
 * Authentication setup fixture.
 *
 * Logs in once and saves the browser storage state so that
 * subsequent tests can reuse the authenticated session.
 */
setup('authenticate', async ({ page }) => {
  await page.goto(loginPath);

  await page.getByLabel(/correo/i).fill(validUser.email);
  await page.getByLabel(/contraseña/i).fill(validUser.password);
  await page.getByRole('button', { name: /ingresar/i }).click();

  // Wait for redirect to dashboard after successful login
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

  // Save signed-in state for reuse
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
