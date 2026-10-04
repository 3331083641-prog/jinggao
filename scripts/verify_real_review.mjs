// Local-only real-file validation. All outputs stay ignored under review_screenshots.
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const [paper, sourceDirectory, taskId] = process.argv.slice(2);
if (!paper || !sourceDirectory) throw new Error('Usage: node verify_real_review.mjs paper source-directory [existing-task-id]');
const root = path.resolve(import.meta.dirname,'..');
const out = path.join(root,'review_screenshots/strict-review');
await fs.mkdir(out,{recursive:true});
const sources = (await fs.readdir(sourceDirectory)).filter(name => /^附件[234]/.test(name)).map(name => path.join(sourceDirectory,name));
if (sources.length !== 3) throw new Error('Expected exactly three provided rule attachments');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5173/rules');
  await page.locator('input[type=file]').setInputFiles(sources);
  const dialog=page.getByRole('dialog',{name:'确认导入规则'});
  await dialog.locator('.draft-list').waitFor({timeout:180000});
  await dialog.getByRole('textbox',{name:'规则集名称'}).fill('联合提交规范 · 条款核对版');
  const save=page.waitForResponse(r=>r.url().endsWith('/api/rulesets') && r.request().method()==='POST');
  await dialog.getByRole('button',{name:'我已逐条确认，保存规则'}).click();
  const rules=await (await save).json();
  await fs.writeFile(path.join(out,'confirmed-private.json'),JSON.stringify(rules,null,2));
  await page.goto('http://127.0.0.1:5173/new?rule='+rules.id+(taskId?'&task='+taskId:''));
  await page.locator('input[type=file]').setInputFiles(paper);
  const generate=page.waitForResponse(r=>r.url().endsWith('/api/generate') && r.request().method()==='POST');
  await page.getByRole('button',{name:'开始检测',exact:true}).click();
  const response=await generate;
  if(!response.ok()) throw new Error('Generation failed: '+response.status());
  const queued=await response.json();
  await fs.writeFile(path.join(out,'real-queued-private.json'),JSON.stringify(queued));
  console.log(JSON.stringify({queued:queued.id,ruleCount:rules.rules.length,task:queued.task_id}));
  let run;
  for(let attempt=0;attempt<900;attempt++) {
    run=await (await page.request.get('http://127.0.0.1:5173/api/runs/'+queued.id)).json();
    if(!['RUNNING','QUEUED'].includes(run.state)) break;
    await page.waitForTimeout(2000);
  }
  if(run.state!=='COMPLETED')throw new Error('Run incomplete: '+run.state);
  if(JSON.stringify(run.rule_ids_executed)!==JSON.stringify(run.ruleset_snapshot.rules.map(rule=>rule.id)))throw new Error('Rule isolation mismatch');
  await fs.writeFile(path.join(out,'after-private.json'),JSON.stringify(run,null,2));
  const report=await page.request.get('http://127.0.0.1:5173/api/runs/'+run.id+'/report.pdf');
  if(!report.ok()) throw new Error('Report export failed');
  await fs.writeFile(path.join(out,'real-private-report.pdf'),await report.body());
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768]]) {
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:5173/workbench/'+run.task_id+'?run='+run.id);
    await page.locator('.continuous-page[data-page="89"]').waitFor();
    await page.locator('.viewer-scroll').evaluate(node=>{node.scrollTop=node.scrollHeight});
    await page.locator('.page-controls').getByText('89 / 89').waitFor();
    await page.locator('canvas[data-rendered="89"]').waitFor();
    await page.screenshot({path:path.join(out,'real-end-'+width+'.png')});
    await page.locator('.viewer-scroll').evaluate(node=>{node.scrollTop=0});
    await page.locator('.page-controls').getByText('1 / 89',{exact:true}).waitFor();
    await page.locator('canvas[data-rendered="1"]').waitFor();
    await page.screenshot({path:path.join(out,'real-start-'+width+'.png')});
  }
  console.log(JSON.stringify({state:run.state,counts:run.counts,executed:run.rule_ids_executed.length,diagnostics:run.diagnostics.length,errors}));
}finally{await context.close();await browser.close();}
