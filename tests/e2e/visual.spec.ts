import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
test("固定视觉基线：Hero、上传区、规则详情", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "开始检测", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".three-canvas")!).opacity ===
      "1",
  );
  await expect(page.locator(".home-hero")).toHaveScreenshot("home-hero.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
  await page.goto("/new");
  await expect(
    page.getByRole("button", { name: "选择文件", exact: true }),
  ).toBeVisible();
  // The surrounding column stretches when the local user has custom rules.
  // Compare the actual upload control so the baseline is independent of their data.
  await expect(page.locator(".dropzone")).toHaveScreenshot("upload-area.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
  await page.goto("/rules");
  await expect(page.getByRole("link", { name: "使用该规则" })).toBeVisible();
  await expect(page.locator(".rule-detail")).toHaveScreenshot(
    "rule-detail.png",
    { animations: "disabled", maxDiffPixelRatio: 0.005 },
  );
});
