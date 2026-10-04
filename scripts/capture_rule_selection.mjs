import { chromium } from "../frontend/node_modules/@playwright/test/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const directory = path.resolve("review_screenshots/multi-rule-selection");
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ reducedMotion: "reduce", deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const measurements = [];
try {
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768]]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:5173/new");
    await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
    await page.getByRole("button", { name: "自定义规则", exact: true }).click();
    const choices = page.locator(".custom-rule-list");
    await choices.getByRole("checkbox").first().waitFor();
    for (const box of await choices.getByRole("checkbox").all()) await box.uncheck();
    for (const box of (await choices.getByRole("checkbox").all()).slice(0, 2)) await box.check();
    await page.getByText("自定义规则 · 可多选（已选 2 份）", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(directory, "new-" + width + ".png"), fullPage: true });
    measurements.push(await page.evaluate(() => ({
      viewport: [innerWidth, innerHeight],
      overflow: document.documentElement.scrollWidth > innerWidth,
      navigationItems: document.querySelectorAll('nav[aria-label="主要导航"] a').length,
      selectedRules: document.querySelectorAll('.custom-rule-list input:checked').length,
    })));
  }
  const result = { measurements, errors };
  writeFileSync(path.join(directory, "visual-validation.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length || measurements.some(m => m.overflow || m.selectedRules !== 2)) process.exitCode = 1;
} finally { await browser.close(); }
