import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:3000';
const outputDir = path.resolve('output/playwright');
const viewport = { width: 1920, height: 1080 };

async function ensureDir() {
  await fs.mkdir(outputDir, { recursive: true });
}

async function capture() {
  await ensureDir();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: path.join(outputDir, 'page-full.png'), fullPage: true });

  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const sectionCount = Math.max(1, Math.ceil(totalHeight / viewport.height));

  for (let i = 0; i < sectionCount; i += 1) {
    const y = i * viewport.height;
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'instant' }), y);
    await page.waitForTimeout(400);
    const sectionName = `page-section-${String(i + 1).padStart(2, '0')}.png`;
    await page.screenshot({
      path: path.join(outputDir, sectionName),
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    });
  }

  await browser.close();
  console.log(`Captured ${sectionCount} section screenshots in ${outputDir}`);
}

await capture();
