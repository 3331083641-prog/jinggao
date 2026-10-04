import { writeFile } from 'node:fs/promises';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(import.meta.dirname, '../.cache/playwright');
const { chromium } = await import('../frontend/node_modules/@playwright/test/index.mjs');
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const errors=[], requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
page.on('request',request=>requests.push(request.url()));
try {
  await page.goto('http://127.0.0.1:4173/?heroDebug=1&orbitOnly=1&helpers=1');
  await page.locator('.three-hero[data-state="ready"]').waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('.three-hero').dataset.triangles)>0);
  for(const key of ['1','2','3','4','5']) await page.keyboard.press(key);
  const state=await page.locator('.three-hero').evaluate(e=>({...e.dataset}));
  const labels=await page.locator('.three-label').allTextContents();
  await page.getByRole('link',{name:'开始检测',exact:true}).click();
  await page.locator('.three-hero canvas').waitFor({state:'detached'});
  const remainingCanvas=await page.locator('.three-hero canvas').count();
  const externalRequests=requests.filter(url=>!new URL(url).hostname.match(/^(127\.0\.0\.1|localhost)$/));
  const result={checkedAt:new Date().toISOString(),source:'Production Vite preview :4173',
    state,labels,route:page.url(),remainingCanvas,externalRequests,consoleErrors:errors};
  await writeFile(path.resolve(import.meta.dirname,'../docs/golden-hero-production-browser.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  if(errors.length || externalRequests.length || remainingCanvas || state.view!=='production' ||
     state.orbitOnly!=='false' || labels.length!==3) process.exitCode=1;
} finally {await browser.close();}
