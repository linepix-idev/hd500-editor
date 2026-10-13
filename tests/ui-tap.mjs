// Demo-only: tap tempo averages the intervals and reaches the server.
import assert from 'node:assert/strict';
import { launchUI, openUI, api, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO, '1'); assert.equal(process.env.PORT, '5231');
const browser = await launchUI();
try {
  const page = await openUI(browser);
  await page.click('#tab-setup');
  for (let i = 0; i < 5; i++) { await page.click('.tap-btn'); await wait(500); }
  await wait(400);
  const shown = Number(await page.$eval('input[aria-label="Tempo (BPM)"]', e => e.value));
  const server = (await api('state')).preset.tempo;
  assert.ok(shown >= 110 && shown <= 125, `ui bpm ${shown}`);
  assert.ok(Math.abs(server - shown) < 1.01, `server ${server} vs ui ${shown}`);
  console.log(`Tap tempo passed (${shown} BPM).`);
} finally { await browser.close(); }
