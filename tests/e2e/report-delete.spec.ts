import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";

test("报告可取消删除、确认删除，历史证据保留且主动导出可恢复", async ({
  page,
  request,
}, info) => {
  const name = "报告删除验收-" + info.project.name + ".txt";
  await page.goto("/new");
  await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
  await page.locator("input[type=file]").setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from("科研材料自查报告删除验收。"),
  });
  const generating = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const run = await (await generating).json();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + run.id)).json()).state,
    )
    .toBe("COMPLETED");
  await page.goto("/reports");
  await page.getByRole("textbox", { name: "搜索报告" }).fill(name);
  const row = page.locator("tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row
    .getByRole("button", { name: "更多报告操作 " + name, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除报告", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "删除报告", exact: true });
  await expect(dialog).toContainText("Run 1");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "查看", exact: true }).click();
  await page
    .locator(".report-detail")
    .getByRole("button", { name: "删除报告", exact: true })
    .click();
  // Failure leaves the report intact and offers retry in the same dialog.
  await page.route("**/api/reports/" + run.id, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "删除暂时失败，请重试" }),
    }),
  );
  await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(dialog).toContainText("删除暂时失败，请重试");
  await expect(row).toHaveCount(1);
  await page.unroute("**/api/reports/" + run.id);
  const deleting = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/reports/" + run.id) &&
      r.request().method() === "DELETE",
  );
  await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
  expect((await deleting).status()).toBe(200);
  await expect(row).toHaveCount(0);
  await expect(page.locator(".report-detail")).toHaveCount(0);
  await page.reload();
  await page.getByRole("heading", { name: "报告中心", exact: true }).waitFor();
  expect(
    (await (await request.get("/api/reports")).json()).some(
      (r: any) => r.id === run.id,
    ),
  ).toBe(false);
  const record = await (await request.get("/api/runs/" + run.id)).json();
  expect(record.findings.length).toBeGreaterThan(0);
  await page.goto("/workbench/" + run.task_id);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "导出报告", exact: true }).click();
  expect(await (await download).failure()).toBeNull();
  await page.goto("/reports");
  await page.getByRole("textbox", { name: "搜索报告" }).fill(name);
  await expect(row).toHaveCount(1);
});
