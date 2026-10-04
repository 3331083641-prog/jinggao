import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const result = {};
for (const [name, route, ready] of [['home','/','.home-recent'],['new','/new','.configuration'],['workspace','/workspace','.finding-row'],['history','/history','tbody tr'],['rules','/rules','.rule-card'],['reports','/reports','tbody tr']]) {
  await page.goto('http://127.0.0.1:5173'+route);
  await page.locator(ready).first().waitFor();
  await page.locator('.sidebar nav a').last().waitFor();
  result[name] = await page.evaluate(() => ({ cards: document.querySelectorAll('main .panel,main .rule-card,main .rule-template,main .scope-item,main .detector-grid>div,main .risk-box').length, text: document.querySelector('main').innerText.length, navigation: [...document.querySelectorAll('.sidebar nav a')].map(x=>x.textContent) }));
}
await mkdir('D:/jinggao/backups/subtraction-redesign',{recursive:true});
await writeFile(process.argv[2] || 'D:/jinggao/backups/subtraction-redesign/before-metrics.json', JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
await browser.close();
