import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startHeroOrbitObservation } from './hero-orbit-observer.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(import.meta.dirname, '../.cache/playwright');
const { chromium } = await import('../frontend/node_modules/@playwright/test/index.mjs');
const folder = path.resolve(import.meta.dirname, '../review_screenshots/threejs/golden-rebuild/final');
await mkdir(folder, {recursive:true});
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'no-preference'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
try {
  await page.goto('http://127.0.0.1:5173/?heroDebug=1&orbitOnly=1');
  await page.locator('.three-hero[data-state="ready"][data-motion="animated"]').waitFor();
  console.log(JSON.stringify(await page.evaluate(startHeroOrbitObservation, 60000)));
  await page.waitForFunction(()=>window.__heroOrbitReport?.done, null, {timeout:130000});
  const report = await page.evaluate(()=>window.__heroOrbitReport);
  report.consoleErrors = errors;
  await page.screenshot({path:path.join(folder,'orbits-after-two-cycles.png')});
  await writeFile(path.join(folder,'orbit-motion-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(errors.length || report.errors.length || report.balls.length!==6) process.exitCode=1;
} finally {await browser.close();}
