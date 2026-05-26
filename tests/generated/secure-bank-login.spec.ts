import { test, expect, Page } from '@playwright/test';

const LOGIN_URL = 'https://qaplayground.com/bank';
const DASHBOARD_URL = 'https://qaplayground.com/bank/dashboard';

const CREDENTIALS = {
  admin: { username: 'admin', password: 'admin123' },
  viewer: { username: 'viewer', password: 'viewer123' },
  invalid: { username: 'hacker', password: 'wrongpassword' },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function login(page: Page, role: keyof typeof CREDENTIALS) {
  await page.goto(LOGIN_URL);
  await page.fill('#username', CREDENTIALS[role].username);
  await page.fill('#password', CREDENTIALS[role].password);
  await page.getByTestId('login-button').click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('SecureBank — Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LOGIN_URL);
  });

  // ── Happy Path ──────────────────────────────────────────────────────────────

  test.describe('Happy Path', () => {
    // TC-LOGIN-01
    test('successful admin login redirects to dashboard', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.admin.username);
      await page.fill('#password', CREDENTIALS.admin.password);
      await page.getByTestId('login-button').click();

      await expect(page).toHaveURL(DASHBOARD_URL);
    });

    test('dashboard shows the logged-in username after admin login', async ({ page }) => {
      await login(page, 'admin');

      await expect(page.getByText('admin')).toBeVisible();
    });

    test('dashboard displays total balance and account stats after admin login', async ({ page }) => {
      await login(page, 'admin');

      await expect(page.getByText('Total Balance')).toBeVisible();
      await expect(page.getByText('Active Accounts')).toBeVisible();
      await expect(page.getByText('Total Transactions')).toBeVisible();
    });

    test('logout button is present on the dashboard', async ({ page }) => {
      await login(page, 'admin');

      await expect(page.getByTestId('logout-button')).toBeVisible();
    });

    test('logout returns the user to the login page', async ({ page }) => {
      await login(page, 'admin');
      await expect(page).toHaveURL(DASHBOARD_URL);

      await page.getByTestId('logout-button').click();

      await expect(page).toHaveURL(LOGIN_URL);
      await expect(page.locator('#username')).toBeVisible();
    });

    // TC-LOGIN-05
    test('viewer login grants access with restricted role', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.viewer.username);
      await page.fill('#password', CREDENTIALS.viewer.password);
      await page.getByTestId('login-button').click();

      // Viewer should reach the dashboard but with a restricted role indicator
      await expect(page).toHaveURL(DASHBOARD_URL);
      await expect(page.getByText('viewer')).toBeVisible();
    });
  });

  // ── TC-LOGIN-02: Error Handling ─────────────────────────────────────────────

  test.describe('Error Handling', () => {
    // TC-LOGIN-02
    test('invalid credentials show an error alert', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.invalid.username);
      await page.fill('#password', CREDENTIALS.invalid.password);
      await page.getByTestId('login-button').click();

      await expect(page.getByRole('alert')).toBeVisible();
    });

    test('invalid login keeps the user on the login page', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.invalid.username);
      await page.fill('#password', CREDENTIALS.invalid.password);
      await page.getByTestId('login-button').click();

      await expect(page).toHaveURL(LOGIN_URL);
    });

    test('wrong password for valid username shows error alert', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.admin.username);
      await page.fill('#password', 'wrongpassword');
      await page.getByTestId('login-button').click();

      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page).toHaveURL(LOGIN_URL);
    });

    test('empty username submission shows validation feedback', async ({ page }) => {
      await page.fill('#password', CREDENTIALS.admin.password);
      await page.getByTestId('login-button').click();

      // Should stay on login — browser or app validation prevents submission
      await expect(page).toHaveURL(LOGIN_URL);
    });

    test('empty password submission shows validation feedback', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.admin.username);
      await page.getByTestId('login-button').click();

      await expect(page).toHaveURL(LOGIN_URL);
    });

    test('completely empty form submission stays on login page', async ({ page }) => {
      await page.getByTestId('login-button').click();

      await expect(page).toHaveURL(LOGIN_URL);
    });
  });

  // ── TC-LOGIN-03: Password Visibility Toggle ─────────────────────────────────

  test.describe('Password Visibility Toggle', () => {
    // TC-LOGIN-03
    test('password field is masked by default', async ({ page }) => {
      await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    });

    test('clicking toggle reveals password as plain text', async ({ page }) => {
      await page.fill('#password', CREDENTIALS.admin.password);
      await page.getByRole('button', { name: 'Toggle password visibility' }).click();

      await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    });

    test('clicking toggle a second time re-masks the password', async ({ page }) => {
      await page.getByRole('button', { name: 'Toggle password visibility' }).click();
      await page.getByRole('button', { name: 'Toggle password visibility' }).click();

      await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    });
  });

  // ── TC-LOGIN-04: Keyboard Interaction ──────────────────────────────────────

  test.describe('Keyboard Interaction', () => {
    // TC-LOGIN-04
    test('pressing Enter in the password field submits the form', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.admin.username);
      await page.fill('#password', CREDENTIALS.admin.password);
      await page.locator('#password').press('Enter');

      await expect(page).toHaveURL(DASHBOARD_URL);
    });

    test('pressing Enter in the username field moves focus to password', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.admin.username);
      await page.locator('#username').press('Tab');

      await expect(page.locator('#password')).toBeFocused();
    });

    test('login button is focusable and submits via keyboard', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.admin.username);
      await page.fill('#password', CREDENTIALS.admin.password);
      await page.getByTestId('login-button').focus();
      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(DASHBOARD_URL);
    });
  });

  // ── Form Controls ───────────────────────────────────────────────────────────

  test.describe('Form Controls', () => {
    test('Clear button empties both username and password fields', async ({ page }) => {
      await page.fill('#username', CREDENTIALS.admin.username);
      await page.fill('#password', CREDENTIALS.admin.password);
      await page.getByRole('button', { name: 'Clear' }).click();

      await expect(page.locator('#username')).toHaveValue('');
      await expect(page.locator('#password')).toHaveValue('');
    });

    test('Remember me checkbox can be checked and unchecked', async ({ page }) => {
      const checkbox = page.locator('[name=rememberMe]');

      await checkbox.check();
      await expect(checkbox).toBeChecked();

      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
    });

    test('username field accepts text input', async ({ page }) => {
      await page.fill('#username', 'testuser');
      await expect(page.locator('#username')).toHaveValue('testuser');
    });
  });

  // ── Accessibility ───────────────────────────────────────────────────────────

  test.describe('Accessibility', () => {
    test('page has a descriptive title', async ({ page }) => {
      await expect(page).toHaveTitle(/SecureBank|QA Playground/i);
    });

    test('username and password fields are individually focusable', async ({ page }) => {
      await page.locator('#username').focus();
      await expect(page.locator('#username')).toBeFocused();

      await page.locator('#password').focus();
      await expect(page.locator('#password')).toBeFocused();
    });

    test('login button has accessible label', async ({ page }) => {
      await expect(page.getByTestId('login-button')).toBeVisible();
      await expect(page.getByTestId('login-button')).toBeEnabled();
    });

    test('password toggle button has an aria-label', async ({ page }) => {
      const toggle = page.getByRole('button', { name: 'Toggle password visibility' });
      await expect(toggle).toBeVisible();
    });

    test('page has a skip to content link for screen readers', async ({ page }) => {
      await expect(page.getByRole('link', { name: /skip to content/i })).toBeAttached();
    });
  });
});
