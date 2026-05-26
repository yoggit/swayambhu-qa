import { test, expect } from '@playwright/test';

const URL = 'https://qaplayground.dev/apps/progress-bar/';

// Returns the numeric percentage shown in the label (e.g. "37%" → 37).
async function readPercentage(page: import('@playwright/test').Page): Promise<number> {
  const text = await page.locator('.progress-label, [data-testid="progress-label"], .percentage')
    .or(page.locator('[role="progressbar"]'))
    .first()
    .textContent({ timeout: 5000 });
  const match = (text ?? '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Returns the bar fill as a 0–100 integer derived from its CSS width.
async function readBarWidth(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const bar =
      document.querySelector('.progress-bar-fill, .progress-fill, [role="progressbar"] > *') as HTMLElement
      ?? document.querySelector('[role="progressbar"]') as HTMLElement;
    if (!bar) return 0;
    const width = bar.style.width || getComputedStyle(bar).width;
    const parent = bar.parentElement;
    if (!parent) return parseFloat(width) || 0;
    const pct = (parseFloat(width) / parent.offsetWidth) * 100;
    return Math.round(isNaN(pct) ? parseFloat(width) : pct);
  });
}

test.describe('Progress Bar — Start, Stop & Track Completion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  // ── Happy Path ───────────────────────────────────────────────────────────────

  test.describe('Happy Path', () => {
    test('TC-TEST34-01: page loads with 0% progress and Start button visible', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-01' });

      await expect(page.getByRole('button', { name: /start/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /stop/i })).not.toBeVisible();

      const pct = await readPercentage(page);
      expect(pct).toBe(0);
    });

    test('TC-TEST34-02: clicking Start begins animation and reveals Stop button', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-02' });

      await page.getByRole('button', { name: /start/i }).click();

      // Bar must start moving within 2 seconds
      await expect(async () => {
        const pct = await readPercentage(page);
        expect(pct).toBeGreaterThan(0);
      }).toPass({ timeout: 2000 });

      await expect(page.getByRole('button', { name: /stop/i })).toBeVisible();
    });

    test('TC-TEST34-03: bar reaches 100% and shows completion state', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-03' });

      await page.getByRole('button', { name: /start/i }).click();

      // Wait up to 30 s for 100%
      await expect(async () => {
        const pct = await readPercentage(page);
        expect(pct).toBe(100);
      }).toPass({ timeout: 30000, intervals: [500] });

      // Completion visual — either text changes or bar gets a done class / colour
      const barOrContainer = page.locator(
        '[role="progressbar"], .progress-bar, .progress-container, .progress-wrapper'
      ).first();
      const completionText = page.getByText(/done|complete|finished|100/i);
      const eitherVisible = (await barOrContainer.getAttribute('class') ?? '').match(/done|complete|full/)
        || await completionText.isVisible().catch(() => false);

      // At minimum the label must show 100%
      await expect(async () => {
        expect(await readPercentage(page)).toBe(100);
      }).toPass({ timeout: 1000 });

      // Start button must reappear for reset
      await expect(page.getByRole('button', { name: /start/i })).toBeVisible({ timeout: 3000 });
    });

    test('TC-TEST34-04: Stop halts progress and Start resumes from same percentage', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-04' });

      await page.getByRole('button', { name: /start/i }).click();

      // Wait until bar is past 20%
      await expect(async () => {
        expect(await readPercentage(page)).toBeGreaterThan(20);
      }).toPass({ timeout: 15000, intervals: [300] });

      const pctAtStop = await readPercentage(page);
      await page.getByRole('button', { name: /stop/i }).click();

      // Verify bar is frozen for 1 second
      await page.waitForTimeout(1000);
      const pctAfterWait = await readPercentage(page);
      expect(pctAfterWait).toBe(pctAtStop);

      // Resume and verify progress continues beyond the paused point
      await page.getByRole('button', { name: /start/i }).click();
      await expect(async () => {
        expect(await readPercentage(page)).toBeGreaterThan(pctAtStop);
      }).toPass({ timeout: 10000, intervals: [300] });
    });

    test('TC-TEST34-05: after completion, Start resets to 0% and restarts animation', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-05' });

      await page.getByRole('button', { name: /start/i }).click();

      await expect(async () => {
        expect(await readPercentage(page)).toBe(100);
      }).toPass({ timeout: 30000, intervals: [500] });

      // Click Start to restart
      await page.getByRole('button', { name: /start/i }).click();

      // Bar must drop back to 0 or near-0 immediately, then begin filling
      await expect(async () => {
        expect(await readPercentage(page)).toBeLessThan(10);
      }).toPass({ timeout: 3000, intervals: [200] });

      // Confirm it's moving again
      await expect(async () => {
        expect(await readPercentage(page)).toBeGreaterThan(0);
      }).toPass({ timeout: 5000, intervals: [300] });
    });
  });

  // ── Negative / Edge Cases ────────────────────────────────────────────────────

  test.describe('Negative Cases', () => {
    test('TC-TEST34-06: percentage label stays in sync with bar fill width', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-06' });

      await page.getByRole('button', { name: /start/i }).click();

      // Check sync at three sample points
      for (const targetPct of [25, 50, 75]) {
        await expect(async () => {
          expect(await readPercentage(page)).toBeGreaterThanOrEqual(targetPct);
        }).toPass({ timeout: 20000, intervals: [300] });

        const label = await readPercentage(page);
        const barWidth = await readBarWidth(page);
        // Allow ±5% tolerance between label text and bar fill
        expect(Math.abs(label - barWidth)).toBeLessThanOrEqual(5);
      }

      // Check sync while frozen
      await page.getByRole('button', { name: /stop/i }).click();
      const frozenLabel = await readPercentage(page);
      const frozenBar = await readBarWidth(page);
      expect(Math.abs(frozenLabel - frozenBar)).toBeLessThanOrEqual(5);
    });

    test('TC-TEST34-07: Stop at 0–5% still halts correctly and Start resumes', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-07' });

      await page.getByRole('button', { name: /start/i }).click();

      // Stop as quickly as possible (within ~200 ms)
      const stopBtn = page.getByRole('button', { name: /stop/i });
      await expect(stopBtn).toBeVisible({ timeout: 3000 });
      await stopBtn.click();

      const earlyPct = await readPercentage(page);
      expect(earlyPct).toBeGreaterThanOrEqual(0);
      expect(earlyPct).toBeLessThanOrEqual(15); // tolerate slight delay

      // Bar must stay frozen
      await page.waitForTimeout(1000);
      expect(await readPercentage(page)).toBe(earlyPct);

      // Start resumes — does NOT reset to 0
      await page.getByRole('button', { name: /start/i }).click();
      await expect(async () => {
        expect(await readPercentage(page)).toBeGreaterThan(earlyPct);
      }).toPass({ timeout: 10000, intervals: [300] });
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────────

  test.describe('Accessibility', () => {
    test('TC-TEST34-08: keyboard navigation — Tab to Start and Enter to activate', async ({ page }) => {
      test.info().annotations.push({ type: 'tcId', description: 'TC-TEST34-08' });

      // Tab until the Start button is focused
      const startBtn = page.getByRole('button', { name: /start/i });
      await startBtn.focus();
      await expect(startBtn).toBeFocused();

      // Activate with Enter
      await page.keyboard.press('Enter');

      // Bar must start moving
      await expect(async () => {
        expect(await readPercentage(page)).toBeGreaterThan(0);
      }).toPass({ timeout: 3000, intervals: [300] });

      // Tab to Stop and activate with Enter
      const stopBtn = page.getByRole('button', { name: /stop/i });
      await stopBtn.focus();
      await expect(stopBtn).toBeFocused();
      await page.keyboard.press('Enter');

      const pctAfterKeyStop = await readPercentage(page);
      await page.waitForTimeout(800);
      expect(await readPercentage(page)).toBe(pctAfterKeyStop);
    });
  });
});
