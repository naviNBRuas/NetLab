const { test, expect } = require('@playwright/test');

test('simulator: add device and spawn packet', async ({ page, baseURL }) => {
  await page.goto('/netlab-simulator.html');
  // Wait for page to load
  await page.waitForSelector('.db');
  // Click the PC device button
  const pc = await page.locator('.db[data-t="pc"]');
  await pc.click();
  // Click on the SVG canvas center to place node
  const svg = await page.locator('#ns');
  const box = await svg.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // Wait briefly and check that a node (<g> in #nl) exists
  await page.waitForTimeout(500);
  const nodes = await page.locator('#nl > g');
  const count = await nodes.count();
  await expect(count).toBeGreaterThan(0);
});

test('pro: capture list updates and dissect opens', async ({ page }) => {
  await page.goto('/netlab-pro.html');
  await page.waitForSelector('#main-content');
  // Wait for initial packets to populate
  await page.waitForTimeout(1000);
  const rows = await page.locator('.cap-row');
  // At least one capture row should exist
  await expect(rows.first()).toBeVisible();
  // Click the first capture row to select it
  await rows.first().click();
  // Switch to DISSECT tab
  await page.locator('.mtab[data-mt="detail"]').click();
  await page.waitForSelector('.ptitle');
  await expect(page.locator('.ptitle')).toContainText('PROTOCOL DISSECTION');
});
