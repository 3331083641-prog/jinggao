import { chromium } from "../frontend/node_modules/@playwright/test/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [taskId, runId] = process.argv.slice(2);
if (![taskId, runId].every(id => /^[a-f0-9]{32}$/.test(id || ""))) throw Error("Supply fixture task and run IDs.");
const directory = path.resolve("review_screenshots/report-deletion");
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ reducedMotion: "reduce", deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const base = "http://127.0.0.1:5173";
try {
  const run = await (await page.request.get(base + "/api/runs/" + runId)).json();
  const name = "报告删除功能验收.txt";
  if (run.document?.name !== name || run.task_id !== taskId) throw Error("Only the known QA fixture can be removed.");
  await page.goto(base + "/workbench/" + taskId);
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出报告", exact: true }).click();
  const pdf = await downloading;
  await pdf.saveAs(path.join(directory, "fixture-report.pdf"));
  if (await pdf.failure()) throw Error("Report export failed");
  await page.goto(base + "/reports");
  await page.getByRole("textbox", { name: "搜索报告" }).fill(name);
  const row = page.locator("tbody tr").filter({ hasText: name });
  await row.getByRole("button", { name: "更多报告操作 " + name, exact: true }).click();
  await page.getByRole("menuitem", { name: "删除报告", exact: true }).click();
  const deleting = page.waitForResponse(r => r.url().endsWith("/api/reports/" + runId) && r.request().method() === "DELETE");
  await page.getByRole("dialog", { name: "删除报告", exact: true }).getByRole("button", { name: "确认删除", exact: true }).click();
  const deletion = await deleting;
  await row.waitFor({ state: "detached" });
  const preserved = await (await page.request.get(base + "/api/runs/" + runId)).json();
  const reports = await (await page.request.get(base + "/api/reports")).json();
  if (deletion.status() !== 200 || reports.some(r => r.id === runId) || JSON.stringify(preserved.findings) !== JSON.stringify(run.findings)) throw Error("Report deletion invariant failed");
  await page.goto(base + "/history");
  const taskRow = page.locator("tbody tr").filter({ hasText: taskId.slice(0, 10) });
  await taskRow.getByRole("button", { name: "删除任务 " + name, exact: true }).click();
  await page.getByRole("dialog", { name: "删除本地任务" }).getByRole("button", { name: "确认删除", exact: true }).click();
  await taskRow.waitFor({ state: "detached" });
  const measurements = [];
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + "/reports");
    const first = page.locator("tbody tr").first();
    await first.getByRole("button", { name: "更多报告操作" }).click();
    await page.getByRole("menuitem", { name: "删除报告", exact: true }).waitFor();
    await page.screenshot({ path: path.join(directory, "menu-" + width + ".png") });
    await page.keyboard.press("Escape");
    await first.getByRole("button", { name: "查看", exact: true }).click();
    await page.locator(".report-delete").waitFor();
    await page.screenshot({ path: path.join(directory, "detail-" + width + ".png"), fullPage: true });
    measurements.push(await page.evaluate(() => ({
      viewport: [innerWidth, innerHeight],
      overflow: document.documentElement.scrollWidth > innerWidth,
      navigationItems: document.querySelectorAll('nav[aria-label="主要导航"] a').length,
      deleteButton: !!document.querySelector('.report-delete'),
    })));
  }
  const result = { actualExport: true, actualDelete: deletion.status(), evidencePreserved: true, fixtureTaskCleaned: true, measurements, errors };
  writeFileSync(path.join(directory, "live-validation.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length || measurements.some(m => m.overflow)) process.exitCode = 1;
} finally { await browser.close(); }
