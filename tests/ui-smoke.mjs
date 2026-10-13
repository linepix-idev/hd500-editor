// Read-only browser checks; defaults to the demo on port 5231.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launchUI, openUI, wait } from './browser.mjs';
const out = process.argv[2] ?? '/tmp/hd500-ui'; await mkdir(out, { recursive: true });
const browser = await launchUI();
try {
  const errors = [], page = await openUI(browser, errors);
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  await page.waitForFunction(() => document.querySelectorAll('#libraryList .slot').length === 64 && !document.querySelector('#libraryList .skeleton'));
  assert.equal(await page.$$eval('#libraryList .bank-title', n => n.length), 16);
  await shot('t1-home');
  for (const tab of ['fs', 'advanced', 'setup']) { await page.click(`[data-tab="${tab}"]`); await wait(150); await shot('t2-' + tab); }
  await page.click('.block[data-item="4"] .nm'); await shot('t3-select');
  await page.click('#inspector .model-title'); await page.waitForSelector('.models button'); await shot('t4-picker');
  assert.equal(await page.$eval('.dlg', e => e.getAttribute('aria-modal')), 'true');
  await page.type('.dlg input[type="search"]', 'no-model-with-this-name');
  assert.equal(await page.$$eval('.models button', n => n.length), 0);
  await page.keyboard.press('Escape');
  await page.click('.block[data-item="0"]'); await shot('t5-amp');
  await page.click('.block[data-item="1"]'); await shot('t6-cab');
  await page.type('#librarySearch', 'Clean');
  await page.waitForFunction(() => [...document.querySelectorAll('#libraryList .slot')].some(e => e.textContent.includes('Clean Strat')));
  await shot('t7-library-search');
  await page.click('#libraryMore'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
  assert.equal(await page.$('.menu'), null);
  await page.click('#tabs [data-tab="setup"]'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval('[data-tab="fs"]', e => e.getAttribute('aria-selected')), 'true');
  for (const theme of ['light', 'dark']) for (const [width, height] of [[1440,900],[1100,800],[390,800]]) {
    await page.setViewport({ width, height }); await page.evaluate(t => document.documentElement.dataset.theme=t, theme); await wait(150);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow: ${theme} ${width}`);
    await shot(`smoke-${theme}-${width}`);
  }
  await page.click('#sidebarToggle'); await page.waitForFunction(() => document.body.classList.contains('sidebar-open'));
  assert.equal(await page.$eval('#librarySidebar', e => e.inert), false);
  await page.focus('#librarySearch'); await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#librarySidebar', e => e.inert), true);
  assert.deepEqual(errors, []); console.log('UI smoke passed: library, picker, tabs, keyboard, two themes and three viewports.');
} finally { await browser.close(); }
