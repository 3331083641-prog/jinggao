import {
  test,
  expect,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  truncateSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
const fixtures = path.resolve(import.meta.dirname, "../../benchmark/fixtures");

test("多份材料真实提交：PDF 与 DOCX 分别生成独立任务", async ({
  page,
  request,
}) => {
  await page.goto("/new");
  await page
    .locator("input[type=file]")
    .setInputFiles([
      path.join(fixtures, "synthetic-risk.pdf"),
      path.join(fixtures, "synthetic-hidden.docx"),
    ]);
  await expect(page.locator(".selected-file")).toHaveCount(2);
  const requests: Promise<any>[] = [];
  page.on("response", (response) => {
    if (
      response.url().endsWith("/api/generate") &&
      response.request().method() === "POST"
    ) {
      requests.push(response.json());
    }
  });
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  await page.waitForURL("**/scan/*");
  const runs = await Promise.all(requests);
  expect(runs).toHaveLength(2);
  expect(new Set(runs.map((r) => r.task_id)).size).toBe(2);
  for (const run of runs) {
    await expect
      .poll(
        async () =>
          (await (await request.get("/api/runs/" + run.id)).json()).state,
        { timeout: 60000 },
      )
      .toBe("COMPLETED");
  }
  const details = await Promise.all(
    runs.map(async (run) => (await request.get("/api/runs/" + run.id)).json()),
  );
  expect(details.map((run) => run.document.format)).toEqual(["pdf", "docx"]);
  expect(details.every((run) => run.findings.length > 0)).toBe(true);
});

test("上传框所有可见区域直接触发一次原生选择器，取消后仍可选择", async ({
  page,
}) => {
  // Keep interception subscribed across the rapid pointer sequence. A series
  // of one-shot listeners otherwise toggles the asynchronous CDP subscription
  // off/on between clicks, and can miss an actual native chooser event.
  const keepChooserSubscription = () => {};
  page.on("filechooser", keepChooserSubscription);
  await page.goto("/new");
  const input = page.locator("input[type=file]");
  await input.evaluate((element) => {
    (window as any).nativePickerClicks = [];
    element.addEventListener("click", (event) => {
      (window as any).nativePickerClicks.push(event.isTrusted);
    });
  });
  for (const target of [
    ".dropzone .file-picker-button",
    ".dropzone > svg",
    ".dropzone h3",
    ".dropzone > p",
    ".dropzone",
  ]) {
    const box = await page.locator(target).boundingBox();
    expect(box).not.toBeNull();
    const point =
      target === ".dropzone"
        ? { x: box!.x + 24, y: box!.y + 24 }
        : { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
    // A real user clicks what is painted here. The hit target must be the native
    // file input, with no hidden-input forwarding or unrelated overlay.
    expect(
      await page.evaluate(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return hit instanceof HTMLInputElement && hit.type === "file";
      }, point),
    ).toBe(true);
    const chooser = page.waitForEvent("filechooser");
    await page.mouse.click(point.x, point.y);
    await (await chooser).setFiles(path.join(fixtures, "synthetic-risk.pdf"));
    await expect(page.locator(".selected-file")).toContainText(
      "synthetic-risk.pdf",
    );
    await page.getByRole("button", { name: "移除材料" }).click();
  }
  expect(await page.evaluate(() => (window as any).nativePickerClicks)).toEqual(
    [true, true, true, true, true],
  );
  const cancelled = page.waitForEvent("filechooser");
  await input.click();
  await (await cancelled).setFiles([]);
  await expect(page.locator(".selected-file")).toHaveCount(0);
  await input.setInputFiles(path.join(fixtures, "synthetic-risk.pdf"));
  await expect(page.locator(".selected-file")).toContainText(
    "synthetic-risk.pdf",
  );
  page.off("filechooser", keepChooserSubscription);
});

test("材料选择器：可见按钮触发、PDF删除重选、拖入、类型与大小校验、DOCX真实检测", async ({
  page,
  request,
}) => {
  await page.goto("/new");
  await expect(page.locator(".selected-file")).toHaveCount(0);
  await page.locator("input[type=file]").evaluate((input) => {
    (window as any).inputClicks = 0;
    input.addEventListener("click", () => {
      (window as any).inputClicks++;
    });
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "选择文件", exact: true }).click();
    await (await chooser).setFiles(path.join(fixtures, "synthetic-risk.pdf"));
    await expect(page.locator(".selected-file")).toContainText(
      "synthetic-risk.pdf",
    );
    await expect(page.locator("input[type=file]")).toHaveValue("");
    await page.getByRole("button", { name: "移除材料" }).click();
    await expect(page.locator(".selected-file")).toHaveCount(0);
  }
  expect(await page.evaluate(() => (window as any).inputClicks)).toBe(2);
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator(".notice-error")).toContainText("请选择");
  await expect(page.locator(".selected-file")).toHaveCount(0);
  const generated = path.resolve(import.meta.dirname, "../generated");
  mkdirSync(generated, { recursive: true });
  const oversized = path.join(generated, "oversized.pdf");
  writeFileSync(oversized, "");
  truncateSync(oversized, 50 * 1024 * 1024 + 1);
  try {
    await page.locator("input[type=file]").setInputFiles(oversized);
    await expect(page.locator(".notice-error")).toContainText("50 MB");
  } finally {
    unlinkSync(oversized);
  }
  const data = readFileSync(path.join(fixtures, "synthetic-risk.pdf")).toString(
    "base64",
  );
  await page.locator(".dropzone").evaluate((zone, base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], "dragged.pdf", { type: "application/pdf" }),
    );
    zone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  }, data);
  await expect(page.locator(".selected-file")).toContainText("dragged.pdf");
  await expect(page.locator(".notice-error")).toHaveCount(0);
  await page.getByRole("button", { name: "移除材料" }).click();
  await expect(page.locator(".selected-file")).toHaveCount(0);
  // Keyboard activation must trigger the same native chooser.
  const keyboardChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "选择文件", exact: true }).focus();
  await page.keyboard.press("Enter");
  await (
    await keyboardChooser
  ).setFiles(path.join(fixtures, "synthetic-hidden.docx"));
  await expect(page.locator(".selected-file")).toContainText(
    "synthetic-hidden.docx",
  );
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/generate") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "开始检测", exact: true }).click();
  expect((await uploaded).ok()).toBe(true);
  await page.waitForURL("**/scan/*");
  const id = page.url().split("/").at(-1)!;
  await expect(page.getByRole("link", { name: "查看工作台" })).toBeVisible({
    timeout: 60000,
  });
  const run = await (await request.get("/api/runs/" + id)).json();
  expect(run.document.format).toBe("docx");
  expect(
    run.document.parsed.surfaces.some(
      (s: any) => s.source_type === "HIDDEN_TEXT",
    ),
  ).toBe(true);
  expect(run.findings.some((f: any) => f.status === "FAIL")).toBe(true);
});

test("规则选择器：PDF和DOCX进入后端解析、重复选择同一文件、确认后保存", async ({
  page,
  request,
}) => {
  await page.goto("/rules");
  await expect(page.locator(".rule-detail")).toBeVisible();
  const initial = await (await request.get("/api/rulesets")).json();
  await page.locator("input[type=file]").evaluate((input) => {
    (window as any).ruleClicks = 0;
    input.addEventListener("click", () => {
      (window as any).ruleClicks++;
    });
  });
  for (const name of [
    "synthetic-rules.pdf",
    "synthetic-rules.pdf",
    "synthetic-rules.docx",
  ]) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "导入规则", exact: true }).click();
    const parsed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/rulesets/parse") &&
        response.request().method() === "POST",
    );
    await (await chooser).setFiles(path.join(fixtures, name));
    const response = await parsed;
    expect(response.ok()).toBe(true);
    const draft = await response.json();
    expect(draft.source).toContain(name);
    expect(draft.rules.length).toBeGreaterThan(0);
    expect(
      draft.rules.some((r: any) => r.source_clause.includes("学校名称")),
    ).toBe(true);
    await expect(page.locator(".drawer-dialog")).toBeVisible();
    await expect(page.locator(".draft-list")).toContainText("学校名称");
    await expect(page.locator("input[type=file]")).toHaveValue("");
    expect((await (await request.get("/api/rulesets")).json()).length).toBe(
      initial.length,
    );
    if (name.endsWith("docx")) {
      await page
        .getByRole("button", { name: "我已逐条确认，保存规则" })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.locator(".rule-detail")).toContainText(
        "synthetic-rules",
      );
      expect((await (await request.get("/api/rulesets")).json()).length).toBe(
        initial.length + 1,
      );
    } else
      await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  expect(await page.evaluate(() => (window as any).ruleClicks)).toBe(3);
});
