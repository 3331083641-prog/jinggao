// Requires the isolated backend /health and real /generate preflight first.
import {
  chromium,
  request,
} from "../frontend/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const ui = process.env.JINGGAO_SHOWCASE_UI || "http://127.0.0.1:15175";
const api = process.env.JINGGAO_SHOWCASE_API || "http://127.0.0.1:18005";
const assets = path.join(root, "docs/assets");
fs.mkdirSync(assets, { recursive: true });
const http = await request.newContext({ baseURL: api });
assert.equal((await http.get("/health")).status(), 200);
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const source = path.join(
  root,
  "tests/generated/showcase/synthetic-article.pdf",
);
const hash = () =>
  crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");
const original = hash();
async function complete(run) {
  for (let i = 0; i < 300; i++) {
    const value = await (await http.get("/api/runs/" + run.id)).json();
    if (value.state === "COMPLETED") return value;
    if (!["QUEUED", "RUNNING"].includes(value.state))
      throw new Error(value.state);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Detection timeout");
}
try {
  await page.goto(ui + "/rules");
  await page.locator("input[type=file]").setInputFiles({
    name: "合成提交规范.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("文档属性不得保留作者信息。"),
  });
  const dialog = page.getByRole("dialog", { name: "确认导入规则" });
  await dialog
    .getByRole("textbox", { name: "规则集名称" })
    .fill("合成提交规范（演示）");
  const saving = page.waitForResponse(
    (r) => r.url().endsWith("/api/rulesets") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "我已逐条确认，保存规则" }).click();
  const rules = await (await saving).json();
  assert.equal(rules.rules.length, 1);
  await page.getByRole("link", { name: "使用该规则" }).click();
  await page.waitForURL("**/new?rule=" + rules.id);
  await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
  await page.locator("input[type=file]").setInputFiles({
    name: "合成匿名材料.pdf",
    mimeType: "application/pdf",
    buffer: fs.readFileSync(source),
  });
  const generating = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const before = await (await generating).json();
  await complete(before);
  await page.goto(ui + "/");
  await page.locator("main").waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(assets, "home.png") });
  await page.goto(ui + "/workbench/" + before.task_id);
  await page
    .locator(".workspace-grid .pdf-paper canvas[data-rendered]")
    .first()
    .waitFor();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: path.join(assets, "workspace.png") });
  await page.locator(".coverage-matrix summary").click();
  assert.match(await page.locator(".coverage-matrix").innerText(), /VERIFIED/);
  await page.getByRole("button", { name: "整改", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "预览整改", exact: true }).click();
  await page.locator(".cleanup-preview").waitFor();
  const copying = page.waitForResponse(
    (r) => r.url().endsWith("/cleanup-copy") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "生成副本并复检", exact: true })
    .click();
  const after = await (await copying).json();
  await complete(after);
  assert.deepEqual(after.ruleset_snapshot, before.ruleset_snapshot);
  assert.equal(hash(), original);
  await page.goto(ui + "/workbench/" + after.task_id);
  await page.locator(".run-diff > summary").click();
  await page
    .locator(".diff-category summary")
    .filter({ hasText: "FAIL → PASS" })
    .click();
  await page.locator(".run-diff").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(assets, "evidence-remediation.png"),
  });
  assert.match(await page.locator(".run-diff").innerText(), /旧 Evidence/);
  assert.match(await page.locator(".run-diff").innerText(), /新 Evidence/);
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出报告", exact: true }).click();
  const report = await downloading;
  assert.equal(await report.failure(), null);
  await report.saveAs(path.join(root, "tests/generated/showcase/report.pdf"));
  for (const size of [
    [1920, 1080],
    [1440, 900],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await page.goto(ui + "/");
    await page.waitForTimeout(700);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(root, "tests/generated/showcase/browser-result.json"),
    JSON.stringify(
      {
        screenshots: ["home", "workspace", "evidence-remediation"],
        width: 1440,
        height: 900,
        original_sha_unchanged: true,
        snapshot_unchanged: true,
        versions: [before.version, after.version],
        desktop_sizes: 3,
        page_errors: errors,
        report_download: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "3 real synthetic screenshots; cleanup, snapshot, Diff, PDF and 3 desktop sizes verified.",
  );
} finally {
  await browser.close();
  await http.dispose();
}
