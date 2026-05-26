import { test, expect, Page } from '@playwright/test';

const LOGIN_URL = 'https://qaplayground.com/bank';
const DASHBOARD_URL = 'https://qaplayground.com/bank/dashboard';

const CREDENTIALS = {
  admin:   { username: 'admin',  password: 'admin123' },
  viewer:  { username: 'viewer', password: 'viewer123' },
  invalid: { username: 'admin',  password: 'wrongpass' },
};

async function login(page: Page, role: keyof typeof CREDENTIALS) {
  await page.goto(LOGIN_URL);
  await page.getByTestId('username-input').fill(CREDENTIALS[role].username);
  await page.getByTestId('password-input').fill(CREDENTIALS[role].password);
  await page.getByTestId('login-button').click();
}

test.describe('SecureBank — Login (Issue #1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL);
  });

  // ── Happy Path ────────────────────────────────────────────────────────────

  test.describe('Happy Path', () => {
    // TC-1-01
    test('successful admin login redirects to dashboard', async ({ page }) => {
      await page.getByTestId('username-input').fill(CREDENTIALS.admin.username);
      await page.getByTestId('password-input').fill(CREDENTIALS.admin.password);
      await page.getByTestId('login-button').click();

      await expect(page).toHaveURL(DASHBOARD_URL);
    });

    // TC-1-06
    test('viewer login reaches the dashboard', async ({ page }) => {
      await page.getByTestId('username-input').fill(CREDENTIALS.viewer.username);
      await page.getByTestId('password-input').fill(CREDENTIALS.viewer.password);
      await page.getByTestId('login-button').click();

      await expect(page).toHaveURL(DASHBOARD_URL);
    });

    // TC-1-08 (part 1) — logout button visible on dashboard
    test('logout button is present after login', async ({ page }) => {
      await login(page, 'admin');
      await expect(page.getByTestId('logout-button')).toBeVisible();
    });

    // TC-1-08 — BUG: logout button does not return user to login form
    // Tracked: https://github.com/yoggit/zero-to-green/issues (see logged defect)
    test.fail('logout returns user to the login page', async ({ page }) => {
      await login(page, 'admin');
      await page.getByTestId('logout-button').click();

      await expect(page.getByTestId('username-input')).toBeVisible();
    });
  });

  // ── Negative / Edge Cases ─────────────────────────────────────────────────

  test.describe('Negative Cases', () => {
    // TC-1-02
    test('invalid credentials show an error message', async ({ page }) => {
      await page.getByTestId('username-input').fill(CREDENTIALS.invalid.username);
      await page.getByTestId('password-input').fill(CREDENTIALS.invalid.password);
      await page.getByTestId('login-button').click();

      await expect(page.getByTestId('login-alert')).toBeVisible();
    });

    test('invalid login keeps user on the login page', async ({ page }) => {
      await page.getByTestId('username-input').fill(CREDENTIALS.invalid.username);
      await page.getByTestId('password-input').fill(CREDENTIALS.invalid.password);
      await page.getByTestId('login-button').click();

      await expect(page.getByTestId('login-button')).toBeVisible();
    });

    // TC-1-04
    test('empty username keeps user on login page', async ({ page }) => {
      await page.getByTestId('password-input').fill(CREDENTIALS.admin.password);
      await page.getByTestId('login-button').click();

      await expect(page.getByTestId('login-button')).toBeVisible();
    });

    // TC-1-05
    test('empty password keeps user on login page', async ({ page }) => {
      await page.getByTestId('username-input').fill(CREDENTIALS.admin.username);
      await page.getByTestId('login-button').click();

      await expect(page.getByTestId('login-button')).toBeVisible();
    });
  });

  // ── TC-1-03: Password Toggle ──────────────────────────────────────────────

  test.describe('Password Visibility Toggle', () => {
    test('password field is masked by default', async ({ page }) => {
      await expect(page.getByTestId('password-input')).toHaveAttribute('type', 'password');
    });

    test('clicking toggle reveals password as plain text', async ({ page }) => {
      await page.getByTestId('password-input').fill(CREDENTIALS.admin.password);
      await page.locator('[aria-label="Toggle password visibility"]').click();

      await expect(page.getByTestId('password-input')).toHaveAttribute('type', 'text');
    });

    test('clicking toggle a second time re-masks the password', async ({ page }) => {
      await page.locator('[aria-label="Toggle password visibility"]').click();
      await page.locator('[aria-label="Toggle password visibility"]').click();

      await expect(page.getByTestId('password-input')).toHaveAttribute('type', 'password');
    });
  });

  // ── TC-1-07: Keyboard Interaction ─────────────────────────────────────────

  test.describe('Keyboard Interaction', () => {
    test('pressing Enter in password field submits the form', async ({ page }) => {
      await page.getByTestId('username-input').fill(CREDENTIALS.admin.username);
      await page.getByTestId('password-input').fill(CREDENTIALS.admin.password);
      await page.getByTestId('password-input').press('Enter');

      await expect(page).toHaveURL(DASHBOARD_URL);
    });
  });

  // ── TC-1-10: Accessibility ────────────────────────────────────────────────

  test.describe('Accessibility', () => {
    test('username and password fields are individually focusable via keyboard', async ({ page }) => {
      await page.getByTestId('username-input').focus();
      await expect(page.getByTestId('username-input')).toBeFocused();

      await page.getByTestId('password-input').focus();
      await expect(page.getByTestId('password-input')).toBeFocused();
    });

    test('login button is reachable and enabled', async ({ page }) => {
      await expect(page.getByTestId('login-button')).toBeVisible();
      await expect(page.getByTestId('login-button')).toBeEnabled();
    });

    test('password toggle has an accessible aria-label', async ({ page }) => {
      await expect(page.locator('[aria-label="Toggle password visibility"]')).toBeVisible();
    });
  });
});
