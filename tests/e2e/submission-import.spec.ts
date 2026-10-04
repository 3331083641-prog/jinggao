import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import path from "node:path";

test("联合规则从多文件确认到实际检测、报告导出和任务删除", async ({
  page,
  request,
}, info) => {
  await page.goto("/rules");
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "摘要规定.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("摘要一般不超过两页。"),
    },
    {
      name: "AI规定.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "若使用人工智能工具，应在程序前面添加注释，注明工具信息。",
      ),
    },
  ]);
  const dialog = page.getByRole("dialog", { name: "确认导入规则" });
  await expect(dialog.locator(".draft-list > div")).toHaveCount(2);
  await expect(dialog).toContainText("2 份来源文件");
  await dialog
    .getByRole("textbox", { name: "规则集名称" })
    .fill("联合规则验收 " + info.project.name);
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/api/rulesets") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "我已逐条确认，保存规则" }).click();
  const rules = await (await saved).json();
  expect(rules.rules.map((r: any) => r.target)).toEqual([
    "abstract_length",
    "ai_code",
  ]);
  await page.getByRole("link", { name: "使用该规则" }).click();
  await page.waitForURL("**/new?rule=" + rules.id);
  await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("../benchmark/fixtures/synthetic-risk.pdf"));
  await expect(page.locator(".selected-file")).toContainText(
    "synthetic-risk.pdf",
  );
  const generated = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const run = await (await generated).json();
  expect(run.ruleset_id).toBe(rules.id);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + run.id)).json()).state,
      { timeout: 60000 },
    )
    .toBe("COMPLETED");
  await page.goto("/workbench/" + run.task_id);
  await page.getByRole("link", { name: "查看完整证据链", exact: true }).click();
  await page.waitForURL("**/evidence/" + run.id);
  await page
    .getByRole("heading", { name: "检测结果 / 证据链", exact: true })
    .waitFor();
  await page
    .locator(".risk-summary button")
    .filter({ hasText: "REVIEW" })
    .click();
  await page
    .getByRole("textbox", { name: "人工判断记录" })
    .fill("适用条件需进一步确认，保留原证据。");
  await page.getByRole("button", { name: "保存待确认", exact: true }).click();
  await expect(page.locator(".decision-box")).toContainText("已保存：待确认");
  const reviewed = await (await request.get("/api/runs/" + run.id)).json();
  expect(
    reviewed.findings.some(
      (f: any) => f.resolution?.decision === "pending" && f.status === "REVIEW",
    ),
  ).toBe(true);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出报告", exact: true }).click();
  const report = await download;
  expect(report.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await report.failure()).toBeNull();
  await report.saveAs(
    path.resolve(
      "../tests/generated/联合导入报告-" + info.project.name + ".pdf",
    ),
  );
  await page.goto("/history");
  const row = page
    .locator("tbody tr")
    .filter({ hasText: run.task_id.slice(0, 10) });
  await row
    .getByRole("button", { name: "删除任务 synthetic-risk.pdf", exact: true })
    .click();
  const deleted = page.waitForResponse((r) =>
    r.url().endsWith("/api/tasks/delete-batch"),
  );
  await page
    .getByRole("dialog", { name: "删除本地任务" })
    .getByRole("button", { name: "确认删除", exact: true })
    .click();
  expect((await deleted).status()).toBe(200);
  await expect(row).toHaveCount(0);
  expect((await request.get("/api/runs/" + run.id)).status()).toBe(404);
});
