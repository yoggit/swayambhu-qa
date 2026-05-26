/**
 * scrape-page.ts
 *
 * Navigates to a URL using Playwright and extracts a structured JSON snapshot
 * of the page. This snapshot is the raw material every QA agent uses to
 * understand the UI before writing tests.
 *
 * Usage:
 *   npx ts-node scripts/scrape-page.ts <url> [--screenshot]
 *
 * Output:
 *   Prints PageSnapshot JSON to stdout.
 *   If --screenshot is passed, saves a PNG to reports/screenshots/<slug>.png
 */

import { chromium, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InteractiveElement {
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  label?: string;
  text?: string;
  ariaLabel?: string;
  testId?: string;
  selector: string;
  isVisible: boolean;
  isEnabled: boolean;
}

interface FormSnapshot {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  fields: InteractiveElement[];
  submitButton?: InteractiveElement;
}

interface NavigationLink {
  text: string;
  href: string;
  ariaLabel?: string;
  isExternal: boolean;
}

interface PageSnapshot {
  url: string;
  finalUrl: string;
  title: string;
  headings: { level: number; text: string }[];
  forms: FormSnapshot[];
  buttons: InteractiveElement[];
  inputs: InteractiveElement[];
  links: NavigationLink[];
  alerts: string[];
  pageErrors: string[];
  screenshotPath?: string;
  scrapedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(url: string): string {
  return url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').slice(0, 80);
}

function bestSelector(el: { id?: string; testId?: string; name?: string; ariaLabel?: string; text?: string; tag: string }): string {
  if (el.testId) return `[data-testid="${el.testId}"]`;
  if (el.id) return `#${el.id}`;
  if (el.name) return `[name="${el.name}"]`;
  if (el.ariaLabel) return `[aria-label="${el.ariaLabel}"]`;
  if (el.text && el.text.length < 40) return `${el.tag}:has-text("${el.text}")`;
  return el.tag;
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

async function scrapePage(url: string, takeScreenshot: boolean): Promise<PageSnapshot> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (QA-Agents-Bot/1.0)',
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(1000); // let dynamic content settle

  const title = await page.title();

  type BrowserSnapshot = {
    headings: { level: number; text: string }[];
    forms: FormSnapshot[];
    buttons: InteractiveElement[];
    inputs: InteractiveElement[];
    links: NavigationLink[];
    alerts: string[];
  };

  const snapshot = await page.evaluate((): BrowserSnapshot => {
    // ── Headings ──
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent?.trim() || '',
    }));

    // ── Helper to build element info ──
    function elementInfo(el: Element, includeText = false): Omit<InteractiveElement, 'isVisible' | 'isEnabled' | 'selector'> & { selector?: string } {
      const input = el as HTMLInputElement;
      const label = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() : undefined;
      const ariaLabel = el.getAttribute('aria-label') || undefined;
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-cy') || undefined;
      return {
        tag: el.tagName.toLowerCase(),
        type: input.type || undefined,
        id: el.id || undefined,
        name: input.name || undefined,
        placeholder: (el as HTMLInputElement).placeholder || undefined,
        label,
        text: includeText ? el.textContent?.trim().slice(0, 100) || undefined : undefined,
        ariaLabel,
        testId,
      };
    }

    function isVisible(el: Element): boolean {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }

    // ── Forms ──
    const forms: FormSnapshot[] = Array.from(document.querySelectorAll('form')).map((form) => {
      const fields: InteractiveElement[] = Array.from(
        form.querySelectorAll('input:not([type=hidden]), textarea, select')
      ).map((el) => {
        const info = elementInfo(el);
        return {
          ...info,
          selector: info.testId ? `[data-testid="${info.testId}"]` : info.id ? `#${info.id}` : info.name ? `[name="${info.name}"]` : el.tagName.toLowerCase(),
          isVisible: isVisible(el),
          isEnabled: !(el as HTMLInputElement).disabled,
        };
      });

      const submitBtn = form.querySelector('button[type=submit], input[type=submit]');
      const submitInfo = submitBtn ? elementInfo(submitBtn, true) : undefined;

      return {
        id: form.id || undefined,
        name: (form as HTMLFormElement).name || undefined,
        action: form.getAttribute('action') || undefined,
        method: form.getAttribute('method') || 'get',
        fields,
        submitButton: submitInfo ? {
          ...submitInfo,
          selector: submitInfo.testId ? `[data-testid="${submitInfo.testId}"]` : submitInfo.id ? `#${submitInfo.id}` : 'button[type=submit]',
          isVisible: isVisible(submitBtn!),
          isEnabled: !(submitBtn as HTMLButtonElement).disabled,
        } : undefined,
      };
    });

    // ── Standalone buttons (not inside forms) ──
    const buttons: InteractiveElement[] = Array.from(
      document.querySelectorAll('button, [role=button], input[type=button], input[type=submit]')
    )
      .filter((el) => !el.closest('form'))
      .map((el) => {
        const info = elementInfo(el, true);
        return {
          ...info,
          selector: info.testId ? `[data-testid="${info.testId}"]` : info.id ? `#${info.id}` : info.ariaLabel ? `[aria-label="${info.ariaLabel}"]` : `button:has-text("${el.textContent?.trim().slice(0, 30)}")`,
          isVisible: isVisible(el),
          isEnabled: !(el as HTMLButtonElement).disabled,
        };
      });

    // ── Standalone inputs (not inside forms) ──
    const inputs: InteractiveElement[] = Array.from(
      document.querySelectorAll('input:not([type=hidden]), textarea, select')
    )
      .filter((el) => !el.closest('form'))
      .map((el) => {
        const info = elementInfo(el);
        return {
          ...info,
          selector: info.testId ? `[data-testid="${info.testId}"]` : info.id ? `#${info.id}` : info.name ? `[name="${info.name}"]` : el.tagName.toLowerCase(),
          isVisible: isVisible(el),
          isEnabled: !(el as HTMLInputElement).disabled,
        };
      });

    // ── Navigation links ──
    const links: NavigationLink[] = Array.from(
      document.querySelectorAll('nav a, header a, [role=navigation] a')
    ).map((a) => {
      const anchor = a as HTMLAnchorElement;
      return {
        text: anchor.textContent?.trim() || '',
        href: anchor.href,
        ariaLabel: anchor.getAttribute('aria-label') || undefined,
        isExternal: anchor.hostname !== window.location.hostname,
      };
    });

    // ── Alerts / banners ──
    const alerts = Array.from(
      document.querySelectorAll('[role=alert], [role=status], .alert, .banner, .notification, .toast')
    ).map((el) => el.textContent?.trim() || '');

    return { headings, forms, buttons, inputs, links, alerts };
  });

  let screenshotPath: string | undefined;
  if (takeScreenshot) {
    const dir = path.join(process.cwd(), 'reports', 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    screenshotPath = path.join(dir, `${slugify(url)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  await browser.close();

  // Post-process: fill in best-guess selectors for any that defaulted to tag name
  const allElements = [
    ...snapshot.buttons,
    ...snapshot.inputs,
    ...snapshot.forms.flatMap((f) => f.fields),
  ];
  for (const el of allElements) {
    if (!el.selector || el.selector === el.tag) {
      el.selector = bestSelector(el);
    }
  }

  return {
    url,
    finalUrl: page.url(),
    title,
    headings: snapshot.headings,
    forms: snapshot.forms,
    buttons: snapshot.buttons,
    inputs: snapshot.inputs,
    links: snapshot.links,
    alerts: snapshot.alerts,
    pageErrors,
    screenshotPath,
    scrapedAt: new Date().toISOString(),
  };
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

(async () => {
  const args = process.argv.slice(2);
  const url = args.find((a) => a.startsWith('http'));
  const takeScreenshot = args.includes('--screenshot');

  if (!url) {
    console.error('Usage: npx ts-node scripts/scrape-page.ts <url> [--screenshot]');
    process.exit(1);
  }

  try {
    const snapshot = await scrapePage(url, takeScreenshot);
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.error('Scrape failed:', err);
    process.exit(1);
  }
})();
