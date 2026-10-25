import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import path from "node:path";

test("扫描 PDF 案例通过真实 RapidOCR 产生可定位 Evidence", async ({
  page,
  request,
}, info) => {
  await page.goto("/rules");
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("../demos/ocr-rule.txt"));
  const dialog = page.getByRole("dialog", { name: "确认导入规则" });
  await expect(dialog.locator(".draft-list > div")).toHaveCount(1);
  await dialog
    .getByRole("textbox", { name: "规则集名称" })
    .fill("本地 OCR 示例 " + info.project.name);
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/api/rulesets") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "我已逐条确认，保存规则" }).click();
  const rules = await (await saved).json();
  expect(rules.rules[0].scope).toEqual(["IMAGE_OCR"]);
  await page.getByRole("link", { name: "使用该规则" }).click();
  await page.waitForURL("**/new?rule=" + rules.id);
  await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("../benchmark/fixtures/synthetic-scan.pdf"));
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const run = await (await created).json();
  let result: any;
  await expect
    .poll(
      async () => {
        result = await (await request.get("/api/runs/" + run.id)).json();
        return result.state;
      },
      { timeout: 60000 },
    )
    .toBe("COMPLETED");
  const evidence = result.findings.find(
    (f: any) =>
      f.source_type === "IMAGE_OCR" &&
      f.surface_id &&
      ["FAIL", "REVIEW"].includes(f.status),
  );
  expect(evidence).toBeTruthy();
  expect(evidence.page).toBe(1);
  expect(evidence.evidence).toMatch(/大学|University/i);
  expect(result.rule_ids_executed).toHaveLength(1);
  expect(result.coverage_matrix[0].status).toBe("PARTIAL");
  await page.goto("/workbench/" + run.task_id);
  await page.locator(".coverage-matrix summary").click();
  await expect(page.locator(".coverage-matrix")).toContainText("PARTIAL");
  await page.getByRole("link", { name: "查看完整证据链", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/evidence/" + run.id));
  await expect(page.locator("main")).toContainText(evidence.evidence);
  await page.goto(
    `/workbench/${run.task_id}?run=${run.id}&finding=${evidence.id}`,
  );
  await expect(page.locator(".viewer-scroll")).toBeVisible();
});
