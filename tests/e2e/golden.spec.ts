import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
test("Golden UI：真实材料六页截图与布局检查", async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const runs: any[] = [];
  for (const [index, name] of [
    "synthetic-risk.pdf",
    "synthetic-fixed.pdf",
    "synthetic-hidden.docx",
    "synthetic-risk.pdf",
    "synthetic-fixed.pdf",
  ].entries()) {
    const response = await request.post("/api/generate", {
      multipart: {
        file: {
          name,
          mimeType: name.endsWith("pdf")
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: readFileSync(root + "/benchmark/fixtures/" + name),
        },
        ruleset_id: "anonymous",
        scopes: "body,metadata,hidden,images",
        ...(index === 4 ? { task_id: runs[0].task_id } : {}),
      },
    });
    expect(response.ok()).toBe(true);
    const run = await response.json();
    await expect
      .poll(
        async () =>
          (await (await request.get("/api/runs/" + run.id)).json()).state,
        { timeout: 60000 },
      )
      .toBe("COMPLETED");
    runs.push(run);
  }
  const round = process.env.GOLDEN_ROUND || "final";
  async function shot(name: string) {
    await expect(page.locator(".page-content")).toHaveCSS("opacity", "1");
    for (const selector of [
      ".workspace-grid",
      ".report-detail",
      ".history-drawer",
    ]) {
      if (await page.locator(selector).count())
        await expect(page.locator(selector)).toHaveCSS("opacity", "1");
    }
    await expect(page.locator(".sidebar")).toHaveCount(1);
    await expect(page.locator(".sidebar nav a")).toHaveCount(6);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path:
        root +
        "/review_screenshots/pixel-match/" +
        round +
        "/" +
        info.project.name +
        "/" +
        name +
        ".png",
      animations: "disabled",
    });
  }
  await page.goto("/");
  await expect(page.locator(".recent-list tbody tr")).toHaveCount(3);
  await shot("01-home");
  await page.goto("/new");
  await expect(page.locator(".dropzone")).toBeVisible();
  await shot("02-new-empty");
  await page
    .locator("input[type=file]")
    .setInputFiles([
      root + "/benchmark/fixtures/synthetic-risk.pdf",
      root + "/benchmark/fixtures/synthetic-hidden.docx",
    ]);
  await expect(page.locator(".selected-file")).toHaveCount(2);
  await shot("02-new-check");
  await page.goto("/workbench/" + runs[0].task_id);
  await expect(
    page.locator(".pdf-paper canvas[data-rendered]").first(),
  ).toBeVisible();
  await expect(page.locator(".pdf-thumbnail canvas").first()).toBeVisible();
  await expect(page.locator(".run-link")).toHaveCount(2);
  await shot("03-workbench");
  await page.getByRole("button", { name: "跳到第 3 页", exact: true }).click();
  await expect(page.locator('canvas[data-rendered="3"]')).toBeVisible();
  await page
    .locator(".pdf-paper canvas")
    .first()
    .evaluate((canvas) =>
      canvas.setAttribute("data-persist-probe", "same-viewer"),
    );
  for (const name of ["文档", "证据", "整改", "概览"]) {
    await page
      .locator(".tabs")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.locator(".pdf-paper canvas").first()).toHaveAttribute(
      "data-persist-probe",
      "same-viewer",
    );
  }
  await page.locator(".run-link").filter({ hasText: "Run 1" }).click();
  await expect(page.locator(".task-name")).toHaveText("synthetic-risk.pdf");
  await expect(page.locator(".risk-item.fail strong")).toHaveText("4");
  await shot("03-workbench-run1");
  await page.locator(".run-link").filter({ hasText: "Run 2" }).click();
  await expect(page.locator(".task-name")).toHaveText("synthetic-fixed.pdf");
  await expect(page.locator(".risk-item.fail strong")).toHaveText("0");
  await page.goto("/history");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await shot("04-history-list");
  await page.locator("tbody tr").first().click();
  await expect(
    page.locator(".history-drawer .pdf-paper canvas[data-rendered]").first(),
  ).toBeVisible();
  await shot("04-history");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.goto("/rules");
  await page.getByRole("textbox", { name: "搜索规则" }).fill("基础规则");
  await expect(page.locator(".rule-card")).toHaveCount(3);
  await shot("05-rules");
  await page.goto("/reports");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await shot("06-reports-list");
  await page.getByRole("button", { name: "查看", exact: true }).first().click();
  await expect(
    page.locator(".report-detail .pdf-paper canvas[data-rendered]").first(),
  ).toBeVisible();
  await shot("06-reports");
  expect(errors).toEqual([]);
});
