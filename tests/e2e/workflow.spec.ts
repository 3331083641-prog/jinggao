import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const fixtures = root + "/benchmark/fixtures/";
async function screenshot(page: any, info: any, name: string) {
  await page.screenshot({
    path:
      root + "/review_screenshots/" + info.project.name + "-" + name + ".png",
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("真实 PDF 上传 → 坐标定位 → 判断 → 整改复检 → PDF 报告", async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "开始检测", exact: true }),
  ).toBeVisible();
  await screenshot(page, info, "01-home");
  await page.getByRole("link", { name: "开始检测", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "选择文件", exact: true }),
  ).toBeVisible();
  await screenshot(page, info, "02-new");
  await page
    .locator("input[type=file]")
    .setInputFiles(fixtures + "synthetic-risk.pdf");
  await expect(page.locator(".selected-file")).toContainText(
    "synthetic-risk.pdf",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  await page.waitForURL("**/scan/*");
  const runId = page.url().split("/").at(-1)!;
  await expect(page.getByRole("link", { name: "查看工作台" })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("link", { name: "查看工作台" }).click();
  await expect(page.locator(".task-sidebar")).toBeVisible();
  await page
    .locator(".finding-row")
    .filter({ hasText: "验证大学信息学院" })
    .first()
    .click();
  await expect(page.locator('canvas[data-rendered="3"]')).toBeVisible();
  await expect(page.locator('[data-selected="true"]')).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await screenshot(page, info, "04-workspace");
  await page.getByRole("button", { name: "文档", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "文档", exact: true }),
  ).toHaveClass("active");
  await page.getByRole("button", { name: "整改", exact: true }).click();
  await expect(page.getByRole("link", { name: "上传整改版本" })).toBeVisible();
  await page.getByRole("link", { name: "查看完整证据链" }).click();
  await page.getByRole("button", { name: "身份泄露", exact: false }).click();
  await expect(page.locator('canvas[data-rendered="3"]')).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole("button", { name: "上一页", exact: true }).click();
  await expect(page.locator('canvas[data-rendered="2"]')).toBeVisible();
  await page.getByRole("button", { name: "在原文中定位", exact: true }).click();
  await expect(page.locator('canvas[data-rendered="3"]')).toBeVisible();
  await expect(page.locator('[data-selected="true"]')).toBeVisible();
  await screenshot(page, info, "05-evidence");
  await page
    .getByPlaceholder("记录判断依据或整改说明（可选）")
    .fill("已核实该证据来自合成材料作者单位。");
  await page.getByRole("button", { name: "确认问题", exact: true }).click();
  await expect(page.locator(".decision-box")).toContainText("已保存");
  await page.getByRole("link", { name: "发起复检", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles(fixtures + "synthetic-fixed.pdf");
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  await page.waitForURL("**/scan/*");
  const secondId = page.url().split("/").at(-1)!;
  expect(secondId).not.toBe(runId);
  await expect(page.getByRole("link", { name: "查看工作台" })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("link", { name: "查看工作台" }).click();
  await page.locator(".run-comparison summary").click();
  await expect(page.locator(".comparison")).toContainText("FAIL");
  const first = await (await request.get("/api/runs/" + runId)).json(),
    second = await (await request.get("/api/runs/" + secondId)).json();
  expect(second.version).toBe(2);
  expect(second.counts.FAIL).toBeLessThan(first.counts.FAIL);
  expect(second.status).toBe("REVIEW");
  const report = await request.get("/api/runs/" + secondId + "/report.pdf");
  expect(report.ok()).toBe(true);
  expect((await report.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.getByRole("link", { name: "历史任务", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await screenshot(page, info, "07-history");
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").locator("canvas[data-rendered]").first(),
  ).toBeVisible();
  await screenshot(page, info, "07-history-drawer");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  // Close a newly mounted preview before its worker necessarily finishes starting.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator("tbody tr").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  await page.getByRole("link", { name: "报告中心", exact: true }).click();
  await expect(page.locator(".report-detail")).toHaveCount(0);
  await page.getByRole("button", { name: "查看", exact: true }).first().click();
  await expect(page.locator(".report-detail")).toBeVisible();
  await expect(page.locator("canvas[data-rendered]").first()).toBeVisible();
  await screenshot(page, info, "08-reports");
  expect(errors).toEqual([]);
});
test("规则自定义与语义导入必须确认才生效", async ({ page }, info) => {
  await page.goto("/rules");
  await expect(page.getByRole("link", { name: "使用该规则" })).toBeVisible();
  await screenshot(page, info, "06-rules");
  await page.getByRole("button", { name: "新建自定义规则" }).click();
  await page.getByLabel("规则集名称", { exact: true }).fill("端到端验证禁止词");
  await page.getByLabel("明确禁止的关键词").fill("验证大学");
  await page
    .getByLabel("规范原文 / 来源")
    .fill("合成提交要求：不得出现验证大学");
  await page.getByRole("button", { name: "保存规则", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".rule-detail")).toContainText("端到端验证禁止词");
  await page
    .locator("input[type=file]")
    .setInputFiles(fixtures + "synthetic-rules.txt");
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".draft-list")).toContainText("原文");
  await expect(
    page.getByRole("button", { name: "我已逐条确认，保存规则" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "我已逐条确认，保存规则" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".rule-detail")).toContainText("synthetic-rules");
  await page.getByRole("link", { name: "使用该规则" }).click();
  await expect(page.locator(".custom-rule-list input:checked")).toHaveCount(1);
});
test("真实扫描 OCR 与 DOCX 隐藏内容证据", async ({ page, request }, info) => {
  await page.goto("/new");
  await page
    .locator("input[type=file]")
    .setInputFiles(fixtures + "synthetic-scan.pdf");
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  await page.waitForURL("**/scan/*");
  const id = page.url().split("/").at(-1)!;
  await expect(page.locator("canvas[data-rendered]").first()).toBeVisible();
  await screenshot(page, info, "03-scan");
  await expect(page.getByRole("link", { name: "查看工作台" })).toBeVisible({
    timeout: 60000,
  });
  const run = await (await request.get("/api/runs/" + id)).json();
  expect(
    run.findings.some(
      (f: any) =>
        f.source_type === "IMAGE_OCR" && f.evidence.includes("验证大学"),
    ),
  ).toBe(true);
  await page.goto("/new");
  await page
    .locator("input[type=file]")
    .setInputFiles(fixtures + "synthetic-hidden.docx");
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  await page.waitForURL("**/scan/*");
  const docxId = page.url().split("/").at(-1)!;
  await expect(page.getByRole("link", { name: "查看工作台" })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("link", { name: "查看工作台" }).click();
  await expect(page.locator("section.docx")).toBeVisible();
  await page
    .locator(".finding-row")
    .filter({ hasText: "学校：验证大学" })
    .first()
    .click();
  await expect(page.locator(".surface-inspector")).toContainText("隐藏文字");
  const d = await (await request.get("/api/runs/" + docxId)).json();
  expect(
    d.findings.some(
      (f: any) => f.source_type === "REVISION" && f.status === "FAIL",
    ),
  ).toBe(true);
  await screenshot(page, info, "09-docx-hidden");
});
