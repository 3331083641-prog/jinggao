import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/new');
await page.locator('input[type=file]').setInputFiles('D:/jinggao/benchmark/fixtures/synthetic-risk.pdf');
await page.getByRole('button',{name:'开始检测',exact:true}).click();
await page.waitForURL('**/scan/*');
await page.screenshot({path:'D:/jinggao/review_screenshots/03-scan-first.png'});
const runId=page.url().split('/').at(-1);
await page.getByRole('link',{name:'查看工作台'}).waitFor({timeout:90000});
await page.getByRole('link',{name:'查看工作台'}).click();
await page.locator('canvas').waitFor();
await page.locator('.finding-row').filter({hasText:'明确身份'}).first().count();
await page.locator('.finding-row').first().click();
await page.screenshot({path:'D:/jinggao/review_screenshots/04-workspace-first.png'});
await page.goto('http://127.0.0.1:5173/evidence/'+runId);
await page.locator('.evidence-expanded').waitFor();
await page.locator('canvas').waitFor();
await page.screenshot({path:'D:/jinggao/review_screenshots/05-evidence-first.png'});
for(const [route,name] of [['rules','06-rules-first'],['history','07-history-first'],['reports','08-reports-first']]){
 await page.goto('http://127.0.0.1:5173/'+route);
 await page.locator('.panel').first().waitFor();
 await page.screenshot({path:'D:/jinggao/review_screenshots/'+name+'.png'});
}
console.log(JSON.stringify({runId,errors},null,2));
await browser.close();
