// Demo-only: Compare plays the saved version, returns to the edits, and an edit exits the comparison.
import assert from 'node:assert/strict';
import { launchUI, openUI, api, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO, '1'); assert.equal(process.env.PORT, '5231');
const browser = await launchUI();
try {
  const page = await openUI(browser);
  const it = (await api('state')).preset.items.find(i => i.id === 4), par = it.params.find(q => q.setup == null && !q.cab), v0 = par.value;
  await api('edit', { op: 'param', item: 4, index: par.index, id: par.id, value: 0.77 }); await wait(500);
  await page.reload({ waitUntil: 'networkidle2' }); await page.waitForSelector('#compare:not([hidden])');
  const val = async () => (await api('state')).preset.items.find(i => i.id === 4).params.find(q => q.index === par.index).value;
  await page.click('#compare'); await wait(500);
  assert.ok(Math.abs(await val() - v0) < 0.01, 'compare plays the saved value');
  assert.equal(await page.$eval('#compare', e => e.getAttribute('aria-pressed')), 'true');
  await page.click('#compare'); await wait(500);
  assert.ok(Math.abs(await val() - 0.77) < 0.01, 'second press returns to the edit');
  await page.click('#compare'); await wait(400);
  await api('edit', { op: 'param', item: 4, index: par.index, id: par.id, value: 0.5 }); await wait(500);
  assert.ok(Math.abs(await val() - 0.5) < 0.01 && !(await api('state')).comparing, 'an edit exits the comparison');
  console.log('Compare passed.');
} finally { await browser.close(); }
