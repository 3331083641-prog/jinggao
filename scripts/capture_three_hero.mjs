import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root, '.cache/playwright');
const { chromium } = await import('../frontend/node_modules/@playwright/test/index.mjs');
const round = process.argv[2] || 'round1';
const folder = path.join(root, 'review_screenshots/threejs', round);
await mkdir(folder, {recursive:true});
const browser = await chromium.launch();
const results=[];
try {
  for (const [width,height] of [[1920,1080],[1440,900],[1366,768]]) {
    const page=await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
    const errors=[];page.on('pageerror', e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('.three-hero[data-state="ready"]').waitFor();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.three-canvas')).opacity==='1');
    await page.screenshot({path:path.join(folder, 'home-three-'+width+'.png')});
    results.push({width,height,errors, scene:await page.locator('.three-hero').evaluate(e=>({...e.dataset})), overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), labels:await page.locator('.three-label').allTextContents()});
    if(width===1920) {
      await page.goto('http://127.0.0.1:5173/?heroDebug=1');
      await page.locator('.three-hero[data-state="ready"]').waitFor();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.three-canvas')).opacity==='1');
      for(const [key,view] of [['1','front'],['2','left'],['3','right'],['4','top'],['5','bottom']]) {
        await page.keyboard.press(key);
        await page.waitForFunction(v=>document.querySelector('.three-hero').dataset.renderedView===v, view);
        await page.screenshot({path:path.join(folder,'debug-'+view+'.png')});
      }
      await page.goto('http://127.0.0.1:5173/?heroDebug=1&orbitOnly=1');
      await page.locator('.three-hero[data-state="ready"]').waitFor();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.three-canvas')).opacity==='1');
      for(const [key,view] of [['1','front'],['2','left'],['3','right'],['4','top'],['5','bottom']]) {
        await page.keyboard.press(key);
        await page.waitForFunction(v=>document.querySelector('.three-hero').dataset.renderedView===v, view);
        await page.screenshot({path:path.join(folder,'orbits-'+view+'.png')});
      }
    }
    await page.close();
  }
} finally {await browser.close();}
await writeFile(path.join(folder,'verification.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length||r.overflow||r.labels.length!==3)) process.exitCode=1;
