// Read-only acceptance of an existing local run; private artifacts stay ignored.
import { chromium, expect } from '../frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const [id, baseUrl = 'http://127.0.0.1:5173'] = process.argv.slice(2);
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error('Local UI URL required');
if (!id) throw new Error('Usage: node verify_real_workspace.mjs run-id');
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'review_screenshots/strict-review');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({channel: 'msedge', headless: true});
const context = await browser.newContext({reducedMotion: 'reduce'});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const run = await (await page.request.get(baseUrl + '/api/runs/' + id)).json();
  expect(run.state).toBe('COMPLETED');
  expect(run.rule_ids_executed).toEqual(run.ruleset_snapshot.rules.map(rule => rule.id));
  const total = run.document.page_count;
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768]]) {
    await page.setViewportSize({width,height});
    await page.goto(baseUrl + '/workbench/' + run.task_id + '?run=' + id);
    await expect(page.locator('.continuous-page')).toHaveCount(total);
    await expect(page.locator('.pdf-thumbnail')).toHaveCount(total);
    await expect(page.locator('canvas[data-rendered="1"]')).toBeVisible();
    await expect(page.locator('.page-controls')).toContainText('1 / ' + total);
    await page.screenshot({path: path.join(out,'real-start-' + width + '.png')});
    await page.getByRole('button',{name: '跳到第 ' + total + ' 页', exact: true}).click();
    await expect(page.locator('canvas[data-rendered="' + total + '"]')).toBeVisible();
    await expect(page.locator('.page-controls')).toContainText(total + ' / ' + total);
    await page.screenshot({path: path.join(out,'real-end-' + width + '.png')});
    expect(await page.locator('.continuous-page canvas').count()).toBeLessThan(9);
    const evidence = run.findings.find(f => f.bbox && f.page && f.page > 1);
    if (evidence) {
      await page.locator('.finding-row').filter({hasText: evidence.evidence.slice(0,20)}).first().click();
      await expect(page.locator('.evidence-highlight[data-selected=true]').first()).toBeVisible();
    }
    await page.locator('.task-summary .text-link').click();
    const rules = page.getByRole('dialog',{name:'当前生效规则'});
    await expect(rules).toContainText('生效 ' + run.rule_ids_executed.length + ' 项 · 已执行 ' + run.rule_ids_executed.length + ' 项');
    await expect(rules.locator('details')).toHaveCount(run.rule_ids_executed.length);
    await rules.locator('summary').first().click();
    await expect(rules).toContainText(run.ruleset_snapshot.rules[0].original_text);
    await page.getByRole('button',{name:'关闭',exact:true}).click();
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({state:run.state,pages:total,executed:run.rule_ids_executed.length,counts:run.counts,diagnostics:run.diagnostics.length,consoleErrors:errors.length}));
} finally {
  await context.close();
  await browser.close();
}
