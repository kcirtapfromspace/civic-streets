import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUTPUT_DIR = 'public/demo-videos';
mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE = process.env.DEMO_URL || 'http://localhost:5173';

async function safeClick(page, selector, timeout = 5000) {
  try {
    const el = typeof selector === 'string'
      ? page.locator(selector)
      : selector;
    await el.waitFor({ state: 'visible', timeout });
    await el.click();
    return true;
  } catch {
    console.log(`  skip: ${typeof selector === 'string' ? selector : 'element'} not found`);
    return false;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: OUTPUT_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  console.log('Recording started...');

  // === SCENE 1: Navigate to map & Search ===
  await page.goto(BASE);
  await page.waitForTimeout(3000);

  // If landing page, click "Open the Map" CTA to navigate client-side
  try {
    const mapCta = page.locator('a').filter({ hasText: 'Open the Map' }).first();
    await mapCta.waitFor({ state: 'visible', timeout: 4000 });
    await mapCta.click();
    await page.waitForTimeout(4000);
  } catch {
    // Already on map or no landing page — try direct nav
    await page.goto(`${BASE}/map`);
    await page.waitForTimeout(5000);
  }
  console.log('Scene 1: Map loaded');

  // Search for Humboldt Park
  const searchBox = page.locator('input[type="text"]').first();
  await searchBox.waitFor({ state: 'visible', timeout: 20000 });
  await searchBox.click();
  await page.waitForTimeout(400);

  for (const char of 'Humboldt Park, Chicago') {
    await searchBox.press(char === ' ' ? 'Space' : char);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(2500);

  // Click suggestion
  if (await safeClick(page, page.locator('button').filter({ hasText: /Humboldt Park, Chicago, West Chicago/ }).first(), 5000)) {
    await page.waitForTimeout(3500);
    console.log('Scene 1: Searched Humboldt Park');
  }

  // === SCENE 2: Enable crash heatmap ===
  await safeClick(page, page.getByRole('button', { name: 'Layers' }));
  await page.waitForTimeout(600);
  await safeClick(page, page.getByRole('checkbox', { name: 'Crash Heatmap' }));
  await page.waitForTimeout(3500);
  console.log('Scene 2: Crash heatmap enabled');

  // Close layers
  await safeClick(page, page.getByRole('button', { name: 'Layers' }));
  await page.waitForTimeout(1500);

  // === SCENE 3: Propose a Change ===
  if (await safeClick(page, page.getByRole('button', { name: 'Propose a Change' }))) {
    await page.waitForTimeout(2500);
    console.log('Scene 3: Propose flow started');

    // Select 4 lanes no median
    if (await safeClick(page, page.locator('button').filter({ hasText: '4 lanes, no median' }).first())) {
      await page.waitForTimeout(2500);

      // Select Road Diet
      if (await safeClick(page, page.locator('button').filter({ hasText: 'Road Diet' }).first())) {
        await page.waitForTimeout(3000);
        console.log('Scene 3: Road diet selected');

        // Try Done
        if (await safeClick(page, page.locator('button').filter({ hasText: 'Done' }).first(), 8000)) {
          await page.waitForTimeout(2000);
          console.log('Scene 3: Proposal saved');
        }
      }
    }
  }

  // === SCENE 4: Satellite view ===
  if (await safeClick(page, page.getByRole('button', { name: 'Satellite' }))) {
    await page.waitForTimeout(3500);
    console.log('Scene 4: Satellite view');
  }

  if (await safeClick(page, page.getByRole('button', { name: 'Map', exact: true }))) {
    await page.waitForTimeout(2000);
  }

  // === SCENE 5: Intersection tool ===
  if (await safeClick(page, page.locator('button').filter({ hasText: 'Intersection' }).first())) {
    await page.waitForTimeout(1000);

    // Click on the map at an intersection
    await page.mouse.click(590, 470);
    await page.waitForTimeout(3500);
    console.log('Scene 5: Intersection clicked');

    if (await safeClick(page, page.locator('button').filter({ hasText: 'Improve this intersection' }).first(), 8000)) {
      await page.waitForTimeout(2500);

      // Select signalized
      if (await safeClick(page, page.locator('button').filter({ hasText: 'Signalized, basic' }).first())) {
        await page.waitForTimeout(2000);
        console.log('Scene 5: Conditions selected');

        // Select improvements
        for (const name of ['Signal timing review', 'Daylighting', 'No turn on red', 'Add crosswalks']) {
          await safeClick(page, page.locator('button').filter({ hasText: name }).first(), 3000);
          await page.waitForTimeout(400);
        }
        await page.waitForTimeout(1000);

        // Continue
        if (await safeClick(page, page.locator('button').filter({ hasText: /Continue with/ }).first())) {
          await page.waitForTimeout(3000);
          console.log('Scene 5: Intersection review');
        }
      }
    }
  }

  // Final hold
  await page.waitForTimeout(3000);

  // Close and save
  const videoPath = page.video()?.path();
  await page.close();
  await context.close();
  await browser.close();

  console.log('Video saved:', videoPath);
  console.log('Done!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
