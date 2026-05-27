/**
 * scrape-app.ts — Discover real UI selectors from a live app using Playwright.
 * Usage: npx ts-node scripts/scrape-app.ts --url https://myapp.com
 */

import { chromium } from '@playwright/test';
import { logger } from './logger';

const args = process.argv.slice(2);
const url = args[args.indexOf('--url') + 1];
const issueId = args[args.indexOf('--id') + 1] || 'unknown';
if (!url) { console.error('Usage: npx ts-node scripts/scrape-app.ts --url <url> [--id <id>]'); process.exit(1); }

(async () => {
  const log = logger(issueId);
  log.phase(2, 'RUN', `Scraping ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Give JS-heavy apps (Swagger UI, React, etc.) time to render without waiting for networkidle,
  // which never settles on apps with continuous background polling.
  await page.waitForTimeout(3000);

  async function collectElements() {
    return page.evaluate(() => {
      const result: any = { inputs: [], buttons: [], testids: [], headings: [], bodyText: '' };

      document.querySelectorAll('input, textarea, select').forEach((el: any) => {
        result.inputs.push({
          tag: el.tagName, type: el.type, id: el.id, name: el.name,
          placeholder: el.placeholder, testid: el.dataset?.testid || '',
          class: el.className.slice(0, 80),
        });
      });

      document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach((el: any) => {
        result.buttons.push({
          text: el.innerText?.trim().slice(0, 60), id: el.id,
          testid: el.dataset?.testid || '', class: el.className.slice(0, 80), type: el.type,
        });
      });

      document.querySelectorAll('[data-testid]').forEach((el: any) => {
        result.testids.push({ tag: el.tagName, testid: el.dataset.testid, text: el.innerText?.trim().slice(0, 80) });
      });

      document.querySelectorAll('h1,h2,h3,h4,label').forEach((el: any) => {
        result.headings.push({ tag: el.tagName, text: el.innerText?.trim(), htmlFor: (el as any).htmlFor || '' });
      });

      result.bodyText = document.body.innerText.slice(0, 2000);
      return result;
    });
  }

  // Initial state
  const initial = await collectElements();

  // Click each button and collect newly revealed elements
  const afterInteraction: any[] = [];
  const buttonTexts = initial.buttons.map((b: any) => b.text).filter(Boolean);

  for (const btnText of buttonTexts) {
    try {
      await page.getByText(btnText, { exact: false }).first().click();
      await page.waitForTimeout(1000);
      const state = await collectElements();
      afterInteraction.push({ clickedButton: btnText, ...state });
      // Press Escape to close any modal/dialog before next click
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch { /* button may not be clickable */ }
  }

  const data = { initial, afterInteraction };

  const totalInputs = afterInteraction.reduce((acc, s) => Math.max(acc, s.inputs.length), initial.inputs.length);
  const totalButtons = afterInteraction.reduce((acc, s) => Math.max(acc, s.buttons.length), initial.buttons.length);
  const totalTestids = afterInteraction.reduce((acc, s) => Math.max(acc, s.testids.length), initial.testids.length);
  log.phase(2, 'OK', `Scrape complete`, {
    url,
    inputs: totalInputs,
    buttons: totalButtons,
    testids: totalTestids,
    interactionsClicked: afterInteraction.length,
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
