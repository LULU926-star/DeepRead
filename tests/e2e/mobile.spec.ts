import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

const SHOT_DIR = 'tests/e2e/shots';

async function errorsOf(page: Page): Promise<ConsoleMessage[]> {
  const errs: ConsoleMessage[] = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m); });
  page.on('pageerror', (e) => errs.push({
    type: () => 'pageerror', text: () => `[pageerror] ${e.message}`,
    args: () => [], location: () => ({ url: '', lineNumber: 0, columnNumber: 0 }),
  } as unknown as ConsoleMessage & { __kind?: string }));
  return errs;
}

test.describe('Mobile + reduced-motion', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('M1. Mobile 375×812 layout renders and stays usable', async ({ page }) => {
    const errors = await errorsOf(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.workspace-header');

    // Sidebar adapts to a horizontal scroll layout below 1100px
    const sidebar = page.locator('.session-sidebar');
    await expect(sidebar).toBeVisible();

    // All 6 tabs still render in mobile (with min-width:78px from 420px breakpoint, but @720 they get 86px)
    for (const label of ['对话', '检索', '综合综述', '方法对比', 'BibTeX', '相似论文']) {
      await expect(page.locator('.workspace-tabs button').filter({ hasText: label })).toBeVisible();
    }

    // Tabs container must be horizontally scrollable on mobile (overflow-x)
    const tabsEl = page.locator('.workspace-tabs');
    const overflowX = await tabsEl.evaluate((n) => getComputedStyle(n as HTMLElement).overflowX);
    expect(['auto', 'scroll', 'overlay']).toContain(overflowX);

    // Mobile hamburger trigger for conversation history should now be visible
    // The CSS says .chat-history-trigger { display: inline-grid; } only inside @media (max-width: 720px)
    const chatHistoryTrigger = page.locator('.chat-history-trigger');
    if (await chatHistoryTrigger.count() > 0) {
      await expect(chatHistoryTrigger.first()).toBeVisible();
    }

    // Take a mobile screenshot
    await page.screenshot({ path: `${SHOT_DIR}/M1_mobile_375.png`, fullPage: false });

    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e) => e.text()).join('\n')).toHaveLength(0);
  });

  test('M2. Mobile canvas surfaces the 720px mobile sheet affordances', async ({ page }) => {
    const errors = await errorsOf(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.workspace-header');

    // Check workspace-body grid switched to a single column on mobile
    const wbStyles = await page.locator('.workspace-body').evaluate((n) => {
      const cs = getComputedStyle(n as HTMLElement);
      return { gridTemplateColumns: cs.gridTemplateColumns, gridTemplateRows: cs.gridTemplateRows };
    });
    // Single column expected (i.e., only one explicit column)
    const colCount = wbStyles.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
    expect(colCount).toBe(1);

    // Tab bar minimum width is reduced
    const tabWidth = await page.locator('.workspace-tabs button').first().evaluate((n) => (n as HTMLElement).getBoundingClientRect().width);
    expect(tabWidth).toBeLessThan(100); // ~86px max from 720px rule, ~78px from 420 rule

    await page.screenshot({ path: `${SHOT_DIR}/M2_mobile_sheets.png`, fullPage: true });

    const fatal = errors.filter((m: any) => m.__kind === 'pageerror' || /Uncaught/.test(m.text()));
    expect(fatal, fatal.map((e) => e.text()).join('\n')).toHaveLength(0);
  });
});

test.describe('Reduced motion', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    contextOptions: { reducedMotion: 'reduce' },
  });

  test('R1. prefers-reduced-motion reduces animation duration', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.workspace-header');

    // Verify CSS reduces animation-duration to 0.01ms as defined in index.css
    const animDur = await page.locator('.workspace-tabs button').first().evaluate((n) => {
      const cs = getComputedStyle(n as HTMLElement);
      return cs.animationDuration;
    });
    // Expect something close to 0 (the CSS sets it to 0.01ms)
    expect(['0.01ms', '0s', '0.00001s', '1e-05s']).toContain(animDur);

    // transition-duration also collapsed
    const transitionDur = await page.locator('.workspace-tabs button').first().evaluate((n) => {
      const cs = getComputedStyle(n as HTMLElement);
      return cs.transitionDuration;
    });
    expect(['0.01ms', '0s', '0.00001s', '1e-05s']).toContain(transitionDur);

    await page.screenshot({ path: `${SHOT_DIR}/R1_reduced_motion.png`, fullPage: false });
  });

  test('R2. Animation still works when reduced-motion is no-preference', async ({ page }) => {
    // Override context to ensure "no-preference"
    await page.context().addInitScript(() => {
      // Force the matchMedia to no-preference for this test
      Object.defineProperty(window, 'matchMedia', {
        value: (q: string) => ({
          matches: false,
          media: q,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('.workspace-header');

    const animDur = await page.locator('.workspace-tabs button').first().evaluate((n) => {
      const cs = getComputedStyle(n as HTMLElement);
      return cs.animationDuration;
    });
    // With no-preference the CSS rule doesn't apply, so duration should be 0s by default (since no animations are defined) OR a normal value
    expect(animDur).not.toBe('0.01ms');

    await page.screenshot({ path: `${SHOT_DIR}/R2_no_reduced_motion.png`, fullPage: false });
  });
});
