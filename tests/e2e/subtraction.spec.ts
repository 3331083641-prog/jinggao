import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
const navigation = [
  "首页",
  "新建检测",
  "工作台",
  "历史任务",
  "规则库",
  "报告中心",
];
test("六页减法验收：唯一导航、渐进披露、报告菜单与三个桌面尺寸截图", async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const uploaded = await request.post("/api/generate", {
    multipart: {
      file: {
        name: "synthetic-risk.pdf",
        mimeType: "application/pdf",
        buffer: readFileSync(root + "/benchmark/fixtures/synthetic-risk.pdf"),
      },
      ruleset_id: "anonymous",
      scopes: "body,metadata,hidden,images",
    },
  });
  expect(uploaded.ok()).toBe(true);
  const runId = (await uploaded.json()).id;
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + runId)).json()).state,
      { timeout: 60000 },
    )
    .toBe("COMPLETED");
  async function capture(name: string) {
    await expect(page.locator(".sidebar")).toHaveCount(1);
    expect(await page.locator(".sidebar nav a").allTextContents()).toEqual(
      navigation,
    );
    await expect(page.locator('.sidebar a[href="/reports"]')).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path:
        root +
        "/review_screenshots/subtraction-redesign/" +
        info.project.name +
        "/" +
        name +
        ".png",
      animations: "disabled",
    });
  }
  await page.goto("/");
  await expect(page.locator(".recent-list tbody tr").first()).toBeVisible();
  expect(
    await page.locator(".recent-list tbody tr").count(),
  ).toBeLessThanOrEqual(3);
  await capture("01-home");
  await page.getByRole("link", { name: "新建检测", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "选择文件", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".selected-file")).toHaveCount(0);
  await expect(page.locator(".privacy-strip,.detector-grid")).toHaveCount(0);
  const startButton = await page.locator(".start-row .button").boundingBox();
  expect(startButton!.y + startButton!.height).toBeLessThanOrEqual(
    info.project.use.viewport!.height,
  );
  await capture("02-new-check");
  await page.goto("/workspace/" + runId);
  await expect(page.locator("canvas[data-rendered]").first()).toBeVisible();
  await expect(page.locator(".hero-scene")).toHaveCount(0);
  await expect(page.locator(".task-facts")).toHaveCount(0);
  await expect(page.locator(".finding-expanded")).toHaveCount(0);
  await capture("03-workbench");
  await page.getByRole("button", { name: "任务详情", exact: true }).click();
  await expect(page.locator(".task-facts")).toContainText("SHA-256");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .locator(".finding-row")
    .filter({ hasText: "验证大学信息学院" })
    .first()
    .click();
  await expect(page.locator('canvas[data-rendered="3"]')).toBeVisible();
  await expect(page.locator('[data-selected="true"]')).toBeVisible();
  await expect(page.locator(".finding-expanded")).toContainText("建议");
  await page.getByRole("link", { name: "历史任务", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.locator(".history-stat")).toHaveCount(3);
  await capture("04-history");
  await page.getByRole("link", { name: "规则库", exact: true }).click();
  await expect(page.locator(".rule-card").first()).toBeVisible();
  await page.getByRole("textbox", { name: "搜索规则" }).fill("基础规则");
  await expect(page.locator(".rule-card")).toHaveCount(3);
  await expect(page.locator(".rule-checks>button")).toHaveCount(4);
  await capture("05-rules");
  await page.getByRole("button", { name: "全部检查项", exact: true }).click();
  expect(await page.locator(".rule-checks>button").count()).toBeGreaterThan(4);
  await page.getByRole("link", { name: "报告中心", exact: true }).click();
  await page
    .getByRole("textbox", { name: "搜索报告" })
    .fill("synthetic-risk.pdf");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.locator(".report-detail")).toHaveCount(0);
  await capture("06-reports");
  const more = page.getByRole("button", { name: "更多报告操作" }).first();
  await more.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "发起复检" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "导出报告" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole("button", { name: "查看", exact: true }).first().click();
  await expect(
    page.locator(".report-detail canvas[data-rendered]").first(),
  ).toBeVisible();
  await capture("07-report-detail");
  await page.getByRole("button", { name: "关闭报告详情" }).click();
  await expect(page.locator(".report-detail")).toHaveCount(0);
  expect(errors).toEqual([]);
});
