import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";

test("导入规则可取消删除、确认删除，历史报告与快照复检保留", async ({
  page,
  request,
}, info) => {
  await page.goto("/rules");
  await expect(
    page.getByRole("button", { name: "删除规则", exact: true }),
  ).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles({
    name: "删除验收规范.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("摘要一般不超过两页。"),
  });
  const imported = page.getByRole("dialog", { name: "确认导入规则" });
  const name = "删除验收规则 " + info.project.name;
  await imported.getByRole("textbox", { name: "规则集名称" }).fill(name);
  const saving = page.waitForResponse(
    (r) => r.url().endsWith("/api/rulesets") && r.request().method() === "POST",
  );
  await imported
    .getByRole("button", { name: "我已逐条确认，保存规则" })
    .click();
  const rule = await (await saving).json();
  await page.getByRole("link", { name: "使用该规则" }).click();
  await page.waitForURL("**/new?rule=" + rule.id);
  await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
  await page.locator("input[type=file]").setInputFiles({
    name: "规则删除复检.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("摘要：测试\n关键词：验收"),
  });
  const generating = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await expect(page.locator(".selected-file")).toContainText(
    "规则删除复检.txt",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const run = await (await generating).json();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + run.id)).json()).state,
    )
    .toBe("COMPLETED");
  await page.goto("/rules");
  const card = page.locator(".rule-card").filter({ hasText: name });
  await card.click();
  await page.getByRole("button", { name: "删除规则", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "删除规则", exact: true });
  await deletion.getByRole("button", { name: "取消", exact: true }).click();
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "删除规则", exact: true }).click();
  const deleting = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/rulesets/" + rule.id) &&
      r.request().method() === "DELETE",
  );
  await deletion.getByRole("button", { name: "确认删除", exact: true }).click();
  expect((await deleting).status()).toBe(200);
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
  expect(
    (await (await request.get("/api/runs/" + run.id)).json()).ruleset_snapshot
      .name,
  ).toBe(name);
  const report = await request.get("/api/runs/" + run.id + "/report.pdf");
  expect(report.status()).toBe(200);
  expect(report.headers()["content-type"]).toContain("application/pdf");
  await page.goto(`/new?task=${run.task_id}&rule=${rule.id}`);
  await expect(
    page.getByText("该规则已从规则库删除，本次复检使用历史快照。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: name + " 1 项", exact: true }),
  ).toBeChecked();
  await page.locator("input[type=file]").setInputFiles({
    name: "规则删除复检.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("摘要：复检\n关键词：验收"),
  });
  const rechecking = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const rerun = await (await rechecking).json();
  expect(rerun.version).toBe(2);
  expect(rerun.ruleset_snapshot).toEqual(run.ruleset_snapshot);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + rerun.id)).json()).state,
    )
    .toBe("COMPLETED");
  const fresh = await request.post("/api/generate", {
    multipart: {
      ruleset_id: rule.id,
      file: {
        name: "new.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("new"),
      },
    },
  });
  expect(fresh.status()).toBe(404);
});
