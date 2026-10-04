import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";

test("多份自定义规则联合检测、来源保留及删除后快照复检", async ({
  page,
  request,
}, info) => {
  const members: any[] = [];
  for (const [name, text] of [
    ["摘要规则", "摘要一般不超过两页。"],
    ["AI规则", "若使用人工智能工具，应在程序前面添加注释，注明工具信息。"],
  ]) {
    await page.goto("/rules");
    await page.getByRole("heading", { name: "规则库", exact: true }).waitFor();
    await page.locator("input[type=file]").setInputFiles({
      name: name + ".txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text),
    });
    const dialog = page.getByRole("dialog", { name: "确认导入规则" });
    await dialog
      .getByRole("textbox", { name: "规则集名称" })
      .fill(name + " " + info.project.name);
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/rulesets") && r.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "我已逐条确认，保存规则" })
      .click();
    members.push(await (await saved).json());
  }
  await page.goto("/new");
  await page.getByRole("heading", { name: "上传材料", exact: true }).waitFor();
  await page.locator("input[type=file]").setInputFiles({
    name: "联合检查.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "摘要：验证多份规则\n关键词：验收\nAI辅助代码\ndef solve(): return 1",
    ),
  });
  await page.getByRole("button", { name: "自定义规则", exact: true }).click();
  const options = page.locator(".custom-rule-list");
  for (const checkbox of await options.getByRole("checkbox").all())
    await checkbox.uncheck();
  await expect(
    page.getByRole("button", { name: "开始检测", exact: true }),
  ).toBeDisabled();
  for (const member of members)
    await options
      .getByRole("checkbox", { name: member.name + " 1 项", exact: true })
      .check();
  await expect(
    page.getByText("自定义规则 · 可多选（已选 2 份）", { exact: true }),
  ).toBeVisible();
  const generating = page.waitForResponse(
    (r) => r.url().endsWith("/api/generate") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  const run = await (await generating).json();
  expect(run.ruleset_snapshot.members.map((r: any) => r.id).sort()).toEqual(
    members.map((r) => r.id).sort(),
  );
  expect(
    run.ruleset_snapshot.rules.map((r: any) => r.parameters.source_file).sort(),
  ).toEqual(["AI规则.txt", "摘要规则.txt"]);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/runs/" + run.id)).json()).state,
    )
    .toBe("COMPLETED");
  const result = await (await request.get("/api/runs/" + run.id)).json();
  for (const rule of run.ruleset_snapshot.rules)
    expect(result.findings.some((f: any) => f.rule_id === rule.id)).toBe(true);
  expect(
    (await request.get("/api/runs/" + run.id + "/report.pdf")).status(),
  ).toBe(200);
  for (const member of members) {
    await page.goto("/rules");
    await page.locator(".rule-card").filter({ hasText: member.name }).click();
    await page.getByRole("button", { name: "删除规则", exact: true }).click();
    await page
      .getByRole("dialog", { name: "删除规则", exact: true })
      .getByRole("button", { name: "确认删除", exact: true })
      .click();
    await expect(
      page.locator(".rule-card").filter({ hasText: member.name }),
    ).toHaveCount(0);
  }
  await page.goto(`/new?task=${run.task_id}&rule=${run.ruleset_id}`);
  await expect(
    page.getByText("本次复检使用已保存的联合规则快照。", { exact: true }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "联合复检.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("摘要：重新检查\n关键词：验收"),
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
});
