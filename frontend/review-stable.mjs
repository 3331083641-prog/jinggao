import {chromium} from '@playwright/test';
const b=await chromium.launch({headless:true});
const p=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
const tasks=await (await p.request.get('http://127.0.0.1:5173/api/tasks')).json();
const runId=tasks.find(t=>t.latest_run?.state==='COMPLETED'&&t.latest_run?.counts.FAIL)?.latest_run_id;
if(!runId)throw new Error('请先通过 review-pages.mjs 上传合成验证材料，或运行 Playwright E2E。');
for(const [url,name] of [['/workspace/'+runId,'04-workspace-review'],['/evidence/'+runId,'05-evidence-review'],['/rules','06-rules-review'],['/reports','08-reports-review'],['/new','02-new-review'],['/history','07-history-review']]){
 await p.goto('http://127.0.0.1:5173'+url);
 if(url.includes('workspace')){await p.locator('.task-sidebar').waitFor();await p.locator('.finding-row').filter({hasText:'作者单位：'}).first().count();await p.locator('.finding-row').filter({hasText:'验证大学信息学院'}).first().click();}
 if(url.includes('evidence')){await p.getByRole('button',{name:'身份泄露'}).click();await p.locator('.evidence-expanded').waitFor();}
 if(url.includes('workspace')||url.includes('evidence')||url.includes('reports'))await p.locator('canvas[data-rendered]').first().waitFor({timeout:30000});
 if(url.includes('rules'))await p.getByRole('link',{name:'使用该规则'}).waitFor();
 if(url.includes('history'))await p.locator('tbody tr').first().waitFor();
 await p.screenshot({path:'D:/jinggao/review_screenshots/'+name+'.png',animations:'disabled'});
}
console.log(JSON.stringify({errors},null,2));await b.close();
