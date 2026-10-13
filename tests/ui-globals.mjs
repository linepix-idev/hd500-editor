// Demo-only: the pedal-settings sheet opens, lists settings outside the preset and the finder reports a change.
import assert from 'node:assert/strict';
import { launchUI, openUI, api, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO, '1'); assert.equal(process.env.PORT, '5231');
const browser = await launchUI();
try {
  const page = await openUI(browser);
  await page.click('#pedalSettings'); await page.waitForSelector('.globals .ios-group');
  const tuner = await page.$eval('input[aria-label="Tuner reference"]', e => e.value);
  assert.ok(Number(tuner) >= 400, `tuner ${tuner}`);
  await page.click('.globals [aria-label="Watch the pedal"]'); await wait(300);
  await api('globals', { id: 2, value: 442 }); await wait(1500);
  const text = await page.$eval('.globals', e => e.textContent);
  assert.match(text, /0x02: 440 → 442/);
  console.log('Pedal settings sheet passed.');
} finally { await browser.close(); }
