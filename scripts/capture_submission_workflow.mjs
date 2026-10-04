import { chromium } from "../frontend/node_modules/@playwright/test/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const taskId = process.argv[2];
if (!/^[a-f0-9]{32}$/.test(taskId || "")) throw Error("Supply an existing task ID.");
const directory = path.resolve("review_screenshots/huawei-cup-20261004");
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
    await page.goto("http://127.0.0.1:5173/workbench/" + taskId);
    await page.getByRole("heading", { name: "文件信息", exact: true }).waitFor();
    await page.locator(".finding-row").filter({ hasText: "AI 辅助代码前的声明与工具信息" }).first().click();
    await page.locator('[data-selected="true"]').first().waitFor();
    await page.screenshot({ path: path.join(directory, "workbench-" + width + ".png") });
    measurements.push(await page.evaluate(() => ({
      viewport: [innerWidth, innerHeight],
      overflow: document.documentElement.scrollWidth > innerWidth,
      navigationItems: document.querySelectorAll('nav[aria-label="主要导航"] a').length,
      sidebars: document.querySelectorAll(".sidebar").length,
      selectedHighlights: document.querySelectorAll('[data-selected="true"]').length,
    })));
  }
  writeFileSync(path.join(directory, "visual-validation.json"), JSON.stringify({ measurements, errors }, null, 2));
  console.log(JSON.stringify({ measurements, errors }));
} finally { await browser.close(); }
