// Demo-only: the setlist sheet lists a set's 64 presets and offers print/CSV.
import assert from 'node:assert/strict';
import { launchUI, openUI, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO, '1'); assert.equal(process.env.PORT, '5231');
const browser = await launchUI();
try {
  const page = await openUI(browser);
  await page.click('#fileMenu'); await wait(200);
  await page.evaluate(() => [...document.querySelectorAll('button, [role=menuitem]')].find(e => /Print setlist/.test(e.textContent))?.click());
  await page.waitForSelector('.setlist-item');
  await page.waitForFunction(() => ![...document.querySelectorAll('.setlist-item span')].some(s => s.textContent === '…'), { timeout: 15000 });
  assert.equal(await page.$$eval('.setlist-item', e => e.length), 64);
  await page.pdf({ path: '/tmp/hd500-setlist-test.pdf', format: 'A4' });   // print stylesheet renders without throwing
  console.log('Setlist sheet passed.');
} finally { await browser.close(); }
