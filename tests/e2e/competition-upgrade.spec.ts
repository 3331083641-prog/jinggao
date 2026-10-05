import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

test("规则原文到安全副本、同快照复检、证据 Diff 和 PDF 的完整闭环", async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const source = path.resolve("../benchmark/fixtures/synthetic-cleanup.pdf");
  const sha = () =>
    crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");
  const original = sha();
  await page.goto("/rules");
  await page.locator("input[type=file]").setInputFiles({
    name: "元数据规定.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("文档属性不得保留作者信息。"),
  });
  const dialog = page.getByRole("dialog", { name: "确认导入规则" });
  await expect(dialog.locator(".draft-list > div")).toHaveCount(1);
  await dialog
    .getByRole("textbox", { name: "规则集名称" })
    .fill("安全副本验收 " + info.project.name);
  const save = page.waitForResponse(
    (r) => r.url().endsWith("/api/rulesets") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "我已逐条确认，保存规则" }).click();
  const rules = await (await save).json();
  expect(rules.rules[0].original_text).toContain("文档属性不得保留作者信息");
  expect(rules.rules[0].target).toBe("metadata");
  await page.getByRole("link", { name: "使用该规则" }).click();
  await page.waitForURL("**/new?rule=" + rules.id);
  await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
  await page.locator("input[type=file]").setInputFiles(source);
  const generate = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const before = await (await generate).json();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + before.id)).json()).state,
    )
    .toBe("COMPLETED");
  await page.goto("/workbench/" + before.task_id);
  await page.locator(".coverage-matrix summary").click();
  await expect(page.locator(".coverage-matrix")).toContainText("VERIFIED");
  await page.getByRole("link", { name: "查看完整证据链", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/evidence/" + before.id));
  await page.goto("/workbench/" + before.task_id);
  await page.getByRole("button", { name: "整改", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "预览整改", exact: true }).click();
  await expect(page.locator(".cleanup-preview")).toContainText(
    "将修改 1 处结构内容",
  );
  const copied = page.waitForResponse(
    (r) => r.url().endsWith("/cleanup-copy") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "生成副本并复检", exact: true })
    .click();
  const after = await (await copied).json();
  expect(after.version).toBe(2);
  expect(after.parent_run_id).toBe(before.id);
  expect(after.ruleset_snapshot).toEqual(before.ruleset_snapshot);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + after.id)).json()).state,
    )
    .toBe("COMPLETED");
  await page.goto("/workbench/" + after.task_id);
  await page.locator(".run-diff > summary").click();
  await expect(page.locator(".run-diff")).toContainText("FAIL → PASS");
  await page
    .locator(".diff-category summary")
    .filter({ hasText: "FAIL → PASS" })
    .click();
  await expect(page.locator(".run-diff")).toContainText("旧 Evidence");
  await expect(page.locator(".run-diff")).toContainText("新 Evidence");
  await page
    .locator(".run-diff a")
    .filter({ hasText: "旧 Evidence" })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp("run=" + before.id));
  await page.goto("/workbench/" + after.task_id);
  await page.getByRole("button", { name: "整改", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载净化副本" }).click();
  const file = await download;
  expect(await file.failure()).toBeNull();
  expect(sha()).toBe(original);
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出报告", exact: true }).click();
  const report = await reportDownload;
  expect(await report.failure()).toBeNull();
  await report.saveAs(
    path.resolve(
      "../tests/generated/cleanup-report-" + info.project.name + ".pdf",
    ),
  );
  await page.getByRole("button", { name: "概览", exact: true }).click();
  await page.screenshot({
    path: path.resolve(
      "../review_screenshots/competition-upgrade/workspace-" +
        info.project.name +
        ".png",
    ),
    fullPage: true,
  });
  for (const route of ["/", "/new", "/rules", "/history", "/reports"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
