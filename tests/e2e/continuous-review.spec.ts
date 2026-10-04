import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import path from "node:path";
test("89页连续阅读、95项独立滚动、缩略图同步与证据定位", async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const rules = await (
    await request.post("/api/rulesets", {
      data: {
        name: "Continuous synthetic rule",
        rules: [
          {
            id: "literal-only",
            category: "自定义",
            target: "literal",
            description: "Synthetic prohibited token",
            scope: ["BODY_TEXT"],
            detection_method: "literal",
            parameters: { text: "blocked-token" },
          },
        ],
      },
    })
  ).json();
  await page.goto("/new?rule=" + rules.id);
  await page
    .locator("input[type=file]")
    .setInputFiles(
      path.resolve("../benchmark/fixtures/synthetic-89-pages.pdf"),
    );
  const generated = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/generate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const run = await (await generated).json();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + run.id)).json()).state,
      { timeout: 60000 },
    )
    .toBe("COMPLETED");
  const result = await (await request.get("/api/runs/" + run.id)).json();
  expect(result.findings).toHaveLength(95);
  expect(result.rule_ids_executed).toEqual(["literal-only"]);
  await page.goto("/workbench/" + run.task_id);
  await expect(page.locator(".continuous-page")).toHaveCount(89);
  await expect(page.locator(".pdf-thumbnail")).toHaveCount(89);
  await expect(page.getByText("更多页面", { exact: true })).toHaveCount(0);
  const center = page.locator(".workspace-grid .viewer-scroll");
  const thumbs = page.locator(".pdf-thumbnails");
  const issues = page.locator(".workspace-grid .findings-list");
  await center.hover();
  const initialY = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 1800);
  await expect
    .poll(async () => center.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(500);
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - initialY),
  ).toBeLessThanOrEqual(1);
  await thumbs.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.getByRole("button", { name: "跳到第 89 页", exact: true }).click();
  await expect(page.locator(".page-controls")).toContainText("89 / 89");
  await expect(page.locator('canvas[data-rendered="89"]')).toBeVisible();
  expect(await page.locator(".continuous-page canvas").count()).toBeLessThan(9);
  await thumbs.evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.getByRole("button", { name: "跳到第 1 页", exact: true }).click();
  await expect(page.locator(".page-controls")).toContainText("1 / 89");
  await issues.hover();
  await page.mouse.wheel(0, 99999);
  await expect
    .poll(async () => issues.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(1000);
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - initialY),
  ).toBeLessThanOrEqual(1);
  await page.locator(".finding-row").last().click();
  await expect(page.locator(".page-controls")).toContainText("89 / 89");
  await expect(page.locator(".evidence-highlight.selected")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "跳到第 89 页", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await center.hover();
  const locatedTop = await center.evaluate((node) => node.scrollTop);
  await page.mouse.wheel(0, -1200);
  await expect
    .poll(async () => center.evaluate((node) => node.scrollTop))
    .toBeLessThan(locatedTop - 500);
  await page.screenshot({
    path: path.resolve(
      "../review_screenshots/strict-review/continuous-" +
        info.project.name +
        ".png",
    ),
  });
  expect(errors).toEqual([]);
});
