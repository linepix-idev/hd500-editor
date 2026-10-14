// Demo-only: AI activity pill appears, an edit made from outside (MCP-style) shows up live without reload, pill disappears.
import assert from 'node:assert/strict';
import { launchUI, openUI, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO, '1'); assert.equal(process.env.PORT, '5231');
const post = (p, b) => fetch(`http://127.0.0.1:5231/api/${p}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1', 'x-hd500-actor': 'ai' }, body: JSON.stringify(b) }).then(r => r.json());
const browser = await launchUI();
try {
  const page = await openUI(browser);
  assert.equal(await page.$eval('#aiPill', e => e.hidden), true);
  await post('ai', { status: 'Warming the tone', items: [] }); await wait(400);
  assert.equal(await page.$eval('#aiPill', e => e.hidden), false);
  assert.match(await page.$eval('#aiPill', e => e.textContent), /Warming the tone/);
  assert.equal(await page.evaluate(() => document.body.classList.contains('ai-active')), true);
  const st = await (await fetch('http://127.0.0.1:5231/api/state')).json(), it = st.preset.items.find(i => i.id === 4), par = it.params.find(q => q.setup == null && !q.cab);
  await page.click('.block[data-item="4"]'); await wait(300);
  await post('edit', { op: 'param', item: 4, index: par.index, id: par.id, value: 0.83 }); await wait(700);
  const shown = await page.$eval(`#inspector .knob[data-idx="${par.index}"] .rd`, e => e.textContent);
  assert.equal(shown, '83%', 'the open UI shows the AI edit without a reload');
  assert.equal(await page.$eval('.block[data-item="4"]', e => e.classList.contains('ai-flash')), true, 'the touched block glows');
  await post('ai', { status: null }); await wait(1500);
  assert.equal(await page.$eval('#aiPill', e => e.hidden), true);
  console.log('AI indicator passed.');
} finally { await browser.close(); }
