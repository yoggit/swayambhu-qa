import { test, expect, Page } from '@playwright/test';

const URL = 'https://qaplayground.dev/apps/budget-tracker/';

// ─── Helper ───────────────────────────────────────────────────────────────────
// Adds a new entry row and fills all fields. Uses .last() to always target the
// freshest row so multiple sequential calls don't interfere with each other.
async function addEntry(
  page: Page,
  entry: { date: string; description: string; type: 'Income' | 'Expense'; amount: string }
) {
  await page.getByRole('button', { name: 'New Entry' }).click();
  await page.locator('.input-date').last().fill(entry.date);
  await page.getByPlaceholder(/Add a Description/).last().fill(entry.description);
  await page.locator('select.input-type').last().selectOption(entry.type);
  await page.locator('.input-amount').last().fill(entry.amount);
  await page.locator('.input-amount').last().press('Tab');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Budget Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  // ── Happy Path ───────────────────────────────────────────────────────────────

  test.describe('Happy Path', () => {
    test('page loads with New Entry button and zero balance', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'New Entry' })).toBeVisible();
      await expect(page.locator('.total')).toHaveText('$0.00');
    });

    test('adding an income entry updates the total correctly', async ({ page }) => {
      await addEntry(page, {
        date: '2024-01-15',
        description: 'Monthly salary',
        type: 'Income',
        amount: '5000',
      });

      await expect(page.locator('.total')).toHaveText('$5,000.00');
    });

    test('adding an expense entry reduces the total', async ({ page }) => {
      await addEntry(page, {
        date: '2024-01-15',
        description: 'Rent payment',
        type: 'Expense',
        amount: '1500',
      });

      await expect(page.locator('.total')).toHaveText('-$1,500.00');
    });

    test('income minus expense shows the correct net balance', async ({ page }) => {
      await addEntry(page, {
        date: '2024-01-15',
        description: 'Monthly salary',
        type: 'Income',
        amount: '5000',
      });
      await addEntry(page, {
        date: '2024-01-20',
        description: 'Rent payment',
        type: 'Expense',
        amount: '1500',
      });

      await expect(page.locator('.total')).toHaveText('$3,500.00');
    });

    test('multiple income entries accumulate in the total', async ({ page }) => {
      await addEntry(page, { date: '2024-01-10', description: 'Salary', type: 'Income', amount: '3000' });
      await addEntry(page, { date: '2024-01-12', description: 'Freelance', type: 'Income', amount: '1200' });
      await addEntry(page, { date: '2024-01-15', description: 'Bonus', type: 'Income', amount: '800' });

      await expect(page.locator('.total')).toHaveText('$5,000.00');
    });

    test('deleting an income entry reduces the total', async ({ page }) => {
      await addEntry(page, { date: '2024-01-15', description: 'Salary', type: 'Income', amount: '5000' });
      await addEntry(page, { date: '2024-01-16', description: 'Bonus', type: 'Income', amount: '1000' });

      await expect(page.locator('.total')).toHaveText('$6,000.00');

      // Delete the first entry (salary)
      await page.locator('.delete-entry').first().click();

      await expect(page.locator('.total')).toHaveText('$1,000.00');
    });

    test('deleting an expense entry increases the total', async ({ page }) => {
      await addEntry(page, { date: '2024-01-15', description: 'Salary', type: 'Income', amount: '5000' });
      await addEntry(page, { date: '2024-01-20', description: 'Rent', type: 'Expense', amount: '1500' });

      await expect(page.locator('.total')).toHaveText('$3,500.00');

      await page.locator('.delete-entry').last().click();

      await expect(page.locator('.total')).toHaveText('$5,000.00');
    });

    test('table shows Date, Description, Type, Amount column headers', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible();
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────────

  test.describe('Edge Cases', () => {
    test('new entry row appears when New Entry is clicked', async ({ page }) => {
      await expect(page.locator('.input-date')).not.toBeVisible();

      await page.getByRole('button', { name: 'New Entry' }).click();

      await expect(page.locator('.input-date')).toBeVisible();
      await expect(page.getByPlaceholder(/Add a Description/)).toBeVisible();
      await expect(page.locator('select.input-type')).toBeVisible();
      await expect(page.locator('.input-amount')).toBeVisible();
    });

    test('type dropdown defaults to Income option', async ({ page }) => {
      await page.getByRole('button', { name: 'New Entry' }).click();

      await expect(page.locator('select.input-type')).toHaveValue('income');
    });

    test('type dropdown contains only Income and Expense options', async ({ page }) => {
      await page.getByRole('button', { name: 'New Entry' }).click();
      const options = await page.locator('select.input-type option').allTextContents();

      expect(options).toEqual(['Income', 'Expense']);
    });

    test('entry with zero amount does not change the total', async ({ page }) => {
      await addEntry(page, { date: '2024-01-15', description: 'Zero test', type: 'Income', amount: '0' });

      await expect(page.locator('.total')).toHaveText('$0.00');
    });

    test('deleting all entries resets total to zero', async ({ page }) => {
      await addEntry(page, { date: '2024-01-15', description: 'Income 1', type: 'Income', amount: '3000' });
      await addEntry(page, { date: '2024-01-16', description: 'Expense 1', type: 'Expense', amount: '1000' });

      await expect(page.locator('.total')).toHaveText('$2,000.00');

      await page.locator('.delete-entry').first().click();
      await page.locator('.delete-entry').first().click();

      await expect(page.locator('.total')).toHaveText('$0.00');
    });

    test('clicking New Entry multiple times adds multiple rows', async ({ page }) => {
      await page.getByRole('button', { name: 'New Entry' }).click();
      await page.getByRole('button', { name: 'New Entry' }).click();
      await page.getByRole('button', { name: 'New Entry' }).click();

      await expect(page.locator('.input-date')).toHaveCount(3);
    });

    test('large amount is formatted with commas in the total', async ({ page }) => {
      await addEntry(page, { date: '2024-01-15', description: 'Big income', type: 'Income', amount: '1000000' });

      await expect(page.locator('.total')).toHaveText('$1,000,000.00');
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────────

  test.describe('Accessibility', () => {
    test('New Entry button is reachable and activatable via keyboard', async ({ page }) => {
      await page.keyboard.press('Tab');
      // Tab through page controls until New Entry is focused, then activate
      const newEntryBtn = page.getByRole('button', { name: 'New Entry' });
      await newEntryBtn.focus();
      await page.keyboard.press('Enter');

      await expect(page.locator('.input-date')).toBeVisible();
    });

    test('all form fields can individually receive keyboard focus', async ({ page }) => {
      await page.getByRole('button', { name: 'New Entry' }).click();

      // Verify each field is individually focusable (important for screen reader / keyboard users)
      await page.locator('.input-date').last().focus();
      await expect(page.locator('.input-date').last()).toBeFocused();

      await page.getByPlaceholder(/Add a Description/).last().focus();
      await expect(page.getByPlaceholder(/Add a Description/).last()).toBeFocused();

      await page.locator('select.input-type').last().focus();
      await expect(page.locator('select.input-type').last()).toBeFocused();

      await page.locator('.input-amount').last().focus();
      await expect(page.locator('.input-amount').last()).toBeFocused();
    });

    test('page title identifies the application', async ({ page }) => {
      await expect(page).toHaveTitle(/Budget Tracker/i);
    });
  });
});
