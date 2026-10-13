// HD500_DEMO=1 PORT=5231 node app/server.mjs, then node tests/screenshots.mjs docs/img
import assert from 'node:assert/strict';
import { mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { launchUI, openUI, wait } from './browser.mjs';
const out = process.argv[2] ?? 'docs/img'; await mkdir(out, { recursive: true });
const browser = await launchUI();
try {
  const errors=[],page = await openUI(browser,errors);
  await page.waitForFunction(() => !document.querySelector('#libraryList .skeleton'));
  await page.click('.block[data-item="5"] .nm');
  for (const theme of ['dark','light']) for (const [width,height] of [[1440,900],[1100,800],[900,800],[390,800]]) {
    await page.setViewport({width,height}); await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await wait(300);
    await page.screenshot({path:`${out}/liquid-${theme}-${width}.png`});
  }
  await copyFile(`${out}/liquid-dark-1440.png`,`${out}/editor.png`);
  await copyFile(`${out}/liquid-light-1440.png`,`${out}/light.png`);
  await page.setViewport({width:1440,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.click('[data-tab="fs"]');await wait(200);await page.screenshot({path:`${out}/footswitches.png`});
  await page.focus('#librarySearch');await wait(200);await page.screenshot({path:`${out}/library.png`});
  await page.click('#inspector .model-title');await wait(250);await page.screenshot({path:`${out}/models.png`});await page.keyboard.press('Escape');
  await page.click('#inspector .model-info-button');await wait(250);await page.screenshot({path:`${out}/model-info.png`});await page.keyboard.press('Escape');
  await page.setViewport({width:390,height:800});await page.click('#sidebarToggle');await wait(300);await page.screenshot({path:`${out}/library-mobile.png`});
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
await mkdir('/tmp/hd500-ui',{recursive:true});
execFileSync('python3',['tests/contact-sheet.py',out,'/tmp/hd500-ui/contact.png'],{stdio:'inherit'});
console.log(`Captures: ${out}; contact sheet: /tmp/hd500-ui/contact.png`);
