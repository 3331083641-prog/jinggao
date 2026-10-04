import {
  test,
  expect,
  type Page,
} from "../../frontend/node_modules/@playwright/test/index.mjs";
import path from "node:path";
import fs from "node:fs";
const root = path.resolve(import.meta.dirname, "../..");
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await expect(page.locator(".three-label")).toHaveCount(3);
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector<HTMLElement>(".three-hero")?.dataset.triangles,
      ) > 0,
  );
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".three-canvas")!).opacity ===
      "1",
  );
}
function errors(page: Page) {
  const list: string[] = [];
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") list.push(m.text());
  });
  return list;
}
async function clickModel(page: Page, name: "document" | "shield") {
  const pos = await page.locator(".three-hero").evaluate(
    (e, prefix) => ({
      x: Number((e as HTMLElement).dataset[prefix + "X"]),
      y: Number((e as HTMLElement).dataset[prefix + "Y"]),
    }),
    name,
  );
  await page.locator(".three-hero canvas").click({ position: pos });
}
test("Three 首页：真实透明 Canvas、静态减弱动画、三个标签及截图", async ({
  page,
}, info) => {
  const faults = errors(page);
  await ready(page);
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-motion",
    "static",
  );
  const stats = await page
    .locator(".three-hero")
    .evaluate((e) => ({ ...(e as HTMLElement).dataset }));
  expect(Number(stats.triangles)).toBeGreaterThan(1000);
  expect(Number(stats.triangles)).toBeLessThan(100000);
  expect(Number(stats.drawCalls)).toBeLessThan(40);
  expect(Number(stats.pixelRatio)).toBeLessThanOrEqual(1.5);
  expect(
    await page
      .locator(".three-hero canvas")
      .evaluate(
        (e) =>
          (e as HTMLCanvasElement).getContext("webgl2")!.getContextAttributes()!
            .alpha,
      ),
  ).toBe(true);
  const frames = await page.locator(".three-hero").getAttribute("data-frames");
  await page.waitForTimeout(300);
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-frames",
    frames!,
  );
  const bounds = await page.locator(".three-hero").boundingBox();
  expect(bounds).not.toBeNull();
  for (const label of await page.locator(".three-label").all()) {
    const box = await label.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    expect(box!.y).toBeGreaterThanOrEqual(bounds!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      bounds!.y + bounds!.height,
    );
  }
  const first = await page
    .getByRole("link", { name: "开始检测", exact: true })
    .boundingBox();
  expect(first!.x + first!.width).toBeLessThan(bounds!.x);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const width = page.viewportSize()!.width;
  const folder = path.join(root, "review_screenshots/threejs");
  fs.mkdirSync(folder, { recursive: true });
  await page.screenshot({
    path: path.join(folder, "home-three-" + width + ".png"),
  });
  await info.attach("geometry-budget", {
    body: JSON.stringify(stats),
    contentType: "application/json",
  });
  expect(faults).toEqual([]);
});
test("Three 交互：鼠标视差、主文档提示、盾牌反馈及两个 CTA", async ({
  page,
}) => {
  const faults = errors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-motion",
    "animated",
  );
  const scene = page.locator(".three-hero"),
    box = (await scene.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.25);
  await expect
    .poll(async () =>
      Math.abs(Number(await scene.getAttribute("data-parallax"))),
    )
    .toBeGreaterThan(0.01);
  await page.getByRole("heading", { name: "净稿", exact: true }).hover();
  await expect
    .poll(async () =>
      Math.abs(Number(await scene.getAttribute("data-parallax"))),
    )
    .toBeLessThan(0.004);
  const pulseObserver = await scene.evaluateHandle((e) => {
    const element = e as HTMLElement;
    element.dataset.qaPeakPulse = "0";
    element.dataset.qaPeakDocument = "0";
    const observer = new MutationObserver(() => {
      element.dataset.qaPeakPulse = String(
        Math.max(
          Number(element.dataset.qaPeakPulse),
          Number(element.dataset.shieldPulse),
        ),
      );
      element.dataset.qaPeakDocument = String(
        Math.max(
          Number(element.dataset.qaPeakDocument),
          Number(element.dataset.documentDepth),
        ),
      );
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["data-shield-pulse", "data-document-depth"],
    });
    return observer;
  });
  await clickModel(page, "document");
  await expect(page.locator(".three-tooltip")).toHaveText("规则 → 检测 → 证据");
  await expect
    .poll(async () => Number(await scene.getAttribute("data-qa-peak-document")))
    .toBeGreaterThan(0.8);
  await expect(page.locator(".three-tooltip")).toHaveCount(0, {
    timeout: 3500,
  });
  // Observe before clicking: a 550 ms feedback can finish while the browser
  // protocol waits for the click/assertion round-trip on a software renderer.
  // Keep the actual DOM animation peak; do not lengthen the product animation.
  await clickModel(page, "shield");
  await expect(scene).toHaveAttribute("data-shield-click", "1");
  await expect
    .poll(async () => Number(await scene.getAttribute("data-qa-peak-pulse")), {
      intervals: [50, 50, 50],
    })
    .toBeGreaterThan(0.1);
  await pulseObserver.evaluate((observer) => observer.disconnect());
  await pulseObserver.dispose();
  await scene.evaluate((e) => {
    e.removeAttribute("data-qa-peak-pulse");
    e.removeAttribute("data-qa-peak-document");
  });
  await page.getByRole("link", { name: "开始检测", exact: true }).hover();
  await expect(scene).toHaveAttribute("data-cta", "detect");
  await page.getByRole("link", { name: "查看规则库", exact: true }).hover();
  await expect(scene).toHaveAttribute("data-cta", "rules");
  await expect(page.locator(".three-label").first()).toHaveCSS("opacity", "1");
  expect(faults).toEqual([]);
});
test("Three 生命周期：滚出视口停止帧、回到视口恢复、切页销毁", async ({
  page,
}) => {
  const faults = errors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  const scene = page.locator(".three-hero");
  await page.setViewportSize({
    width: page.viewportSize()!.width,
    height: 350,
  });
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(scene).toHaveAttribute("data-visible", "false");
  await page.waitForTimeout(150);
  const paused = await scene.getAttribute("data-frames");
  await page.waitForTimeout(300);
  await expect(scene).toHaveAttribute("data-frames", paused!);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(scene).toHaveAttribute("data-visible", "true");
  await expect.poll(() => scene.getAttribute("data-frames")).not.toBe(paused);
  const old = await scene.elementHandle();
  await page.getByRole("link", { name: "开始检测", exact: true }).click();
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.locator(".three-hero canvas")).toHaveCount(0);
  await page.waitForTimeout(250);
  const stopped = await old!.evaluate((e) => (e as HTMLElement).dataset.frames);
  await page.waitForTimeout(300);
  expect(await old!.evaluate((e) => (e as HTMLElement).dataset.frames)).toBe(
    stopped,
  );
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await expect(scene).toHaveAttribute("data-state", "ready");
  expect(faults).toEqual([]);
});
test("Three 降级：WebGL 不可用保留静态 SVG 与有效入口", async ({ page }) => {
  const faults = errors(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl" || type === "webgl2") return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-state",
    "fallback",
  );
  await expect(page.locator(".three-hero canvas")).toHaveCount(0);
  await expect(page.locator(".three-fallback svg")).toBeVisible();
  await page.getByRole("link", { name: "开始检测", exact: true }).click();
  await expect(page).toHaveURL(/\/new$/);
  expect(faults).toEqual([]);
});
test("Three 降级：真实 GPU context lost 后恢复 SVG，手机不用 Canvas", async ({
  page,
}) => {
  const faults = errors(page);
  await ready(page);
  await page
    .locator(".three-hero canvas")
    .evaluate((e) =>
      (e as HTMLCanvasElement)
        .getContext("webgl2")!
        .getExtension("WEBGL_lose_context")!
        .loseContext(),
    );
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-state",
    "fallback",
  );
  await expect(page.locator(".three-hero canvas")).toHaveCount(0);
  await expect(page.locator(".three-fallback svg")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".three-hero canvas")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "开始检测", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(faults).toEqual([]);
});
test("Three 开发三视图：同一个场景切换 Front / Side / Top", async ({
  page,
}, info) => {
  const faults = errors(page);
  await page.goto("/?debug3d=1");
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-state",
    "ready",
  );
  const points: number[] = [];
  for (const [key, view] of [
    ["1", "front"],
    ["2", "side"],
    ["3", "top"],
    ["0", "production"],
  ]) {
    await page.keyboard.press(key);
    await expect(page.locator(".three-hero")).toHaveAttribute(
      "data-rendered-view",
      view,
    );
    points.push(
      Number(await page.locator(".three-hero").getAttribute("data-document-x")),
    );
    if (info.project.name === "desktop-1920" && view !== "production") {
      await page.screenshot({
        path: path.join(
          root,
          "review_screenshots/threejs/debug-" + view + ".png",
        ),
        animations: "disabled",
      });
    }
  }
  const sceneHeight = (await page.locator(".three-hero").boundingBox())!.height;
  expect(Math.abs(points[0] - points[1]) / sceneHeight).toBeGreaterThan(0.02);
  expect(faults).toEqual([]);
});

test("Golden 模型：四层实体文档、凸面倒角盾牌、闭合管面与六个共享节点", async ({
  page,
}) => {
  const faults = errors(page);
  await ready(page);
  const structure = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .find((name) => name.includes("/@react-three_fiber.js?"))!;
    const fiber = await import(url);
    const state = fiber._roots
      .get(document.querySelector(".three-hero canvas"))
      .store.getState();
    const root = state.scene.getObjectByName("hero-root");
    const papers: any[] = [];
    root.traverse((object: any) => {
      if (object.name === "paper-main" || object.name === "paper-back")
        papers.push(object);
    });
    const tracks = ["orbit-a", "orbit-b"].map((name) => {
      const group = root.getObjectByName(name),
        curve = group.userData.curve;
      const tube = group.children.find(
        (o: any) => o.name === "closed-orbit",
      ).geometry;
      return {
        closed: curve.closed,
        tubeClosed: tube.parameters.closed,
        gap: curve.getPointAt(0).distanceTo(curve.getPointAt(1)),
        tangentDot: curve.getTangentAt(0).dot(curve.getTangentAt(1)),
      };
    });
    const meshes = [0, 1].map((i) => root.getObjectByName("orbit-nodes-" + i));
    const shield = root.getObjectByName("shield");
    const check = root.getObjectByName("shield-check");
    check.geometry.computeBoundingBox();
    return {
      papers: papers.length,
      paperGeometryCount: new Set(papers.map((p) => p.geometry.uuid)).size,
      paperThickness: papers[0].geometry.parameters.options.depth,
      paperBevel: papers[0].geometry.parameters.options.bevelEnabled,
      paperMaterial: papers[0].material[0].type,
      tracks,
      spheres: meshes.map((m) => m.count),
      sharedSphere: meshes[0].geometry === meshes[1].geometry,
      sharedGold: meshes[0].material === meshes[1].material,
      shieldParts: shield.children.map((o: any) => o.name),
      checkDepth:
        check.geometry.boundingBox.max.z - check.geometry.boundingBox.min.z,
      shieldMetalness: root.getObjectByName("shield-face").material.metalness,
      environment: Boolean(state.scene.environment),
      commonRoot: ["document-stack", "shield", "orbit-group"].every(
        (name) => root.getObjectByName(name).parent === root,
      ),
    };
  });
  expect(structure.papers).toBe(4);
  expect(structure.paperGeometryCount).toBe(1);
  expect(structure.paperThickness).toBeGreaterThan(0);
  expect(structure.paperBevel).toBe(true);
  expect(structure.paperMaterial).toBe("MeshPhysicalMaterial");
  expect(structure.spheres).toEqual([3, 3]);
  expect(
    structure.sharedSphere &&
      structure.sharedGold &&
      structure.commonRoot &&
      structure.environment,
  ).toBe(true);
  expect(structure.shieldParts).toEqual(
    expect.arrayContaining([
      "shield-face",
      "shield-inset",
      "shield-rim",
      "shield-check",
    ]),
  );
  expect(structure.checkDepth).toBeGreaterThan(0.01);
  expect(structure.shieldMetalness).toBeGreaterThanOrEqual(0.42);
  expect(structure.shieldMetalness).toBeLessThanOrEqual(0.6);
  for (const track of structure.tracks) {
    expect(track.closed && track.tubeClosed).toBe(true);
    expect(track.gap).toBeLessThan(1e-8);
    expect(track.tangentDot).toBeGreaterThan(0.999);
  }
  expect(faults).toEqual([]);
});

test("Golden 多视角：同一模型保持四层；所有节点沿各自轨道移动", async ({
  page,
}) => {
  const faults = errors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?heroDebug=1");
  await expect(page.locator(".three-hero")).toHaveAttribute(
    "data-state",
    "ready",
  );
  async function sample() {
    return page.evaluate(async () => {
      const url = performance
        .getEntriesByType("resource")
        .map((r) => r.name)
        .find((n) => n.includes("/@react-three_fiber.js?"))!;
      const fiber = await import(url),
        scene = fiber._roots
          .get(document.querySelector(".three-hero canvas"))
          .store.getState().scene;
      const group = scene.getObjectByName("orbit-group"),
        positions: number[][] = [];
      let maxError = 0;
      for (const path of [0, 1]) {
        const mesh = scene.getObjectByName("orbit-nodes-" + path),
          curve = scene.getObjectByName(path ? "orbit-b" : "orbit-a").userData
            .curve;
        for (let i = 0; i < mesh.count; i++) {
          const a = mesh.instanceMatrix.array,
            o = i * 16,
            actual = [a[o + 12], a[o + 13], a[o + 14]],
            node = mesh.userData.nodes[i];
          positions.push(actual);
          const expected = curve.getPointAt(
            (node.phase + group.userData.nodeTime / node.period) % 1,
          );
          maxError = Math.max(
            maxError,
            Math.hypot(
              actual[0] - expected.x,
              actual[1] - expected.y,
              actual[2] - expected.z,
            ),
          );
        }
      }
      return {
        positions,
        maxError,
        geometry: scene.getObjectByName("paper-main").geometry.uuid,
      };
    });
  }
  const first = await sample();
  for (const [key, view] of [
    ["1", "front"],
    ["2", "left"],
    ["3", "right"],
    ["4", "top"],
    ["5", "bottom"],
    ["0", "production"],
  ]) {
    await page.keyboard.press(key);
    await expect(page.locator(".three-hero")).toHaveAttribute(
      "data-rendered-view",
      view,
    );
    expect((await sample()).geometry).toBe(first.geometry);
  }
  await page.waitForTimeout(1800);
  const last = await sample();
  expect(last.positions).toHaveLength(6);
  expect(last.maxError).toBeLessThan(1e-5);
  last.positions.forEach((p, i) => {
    const start = first.positions[i];
    expect(
      Math.hypot(p[0] - start[0], p[1] - start[1], p[2] - start[2]),
    ).toBeGreaterThan(0.04);
  });
  expect(faults).toEqual([]);
});
