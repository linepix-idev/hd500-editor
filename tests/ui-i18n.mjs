// Own demo listener; model help and picker navigation never write presets or touch USB.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launchUI, openUI, api, UI_URL } from './browser.mjs';

assert.equal(process.env.HD500_DEMO ?? '1', '1', 'Only DEMO is permitted');
assert.equal(process.env.PORT ?? '5231', '5231', 'Only demo port 5231 is permitted');
assert.equal(UI_URL, 'http://127.0.0.1:5231', 'Use our own demo listener');
process.env.HD500_DEMO = '1'; process.env.PORT = '5231';
const { start, stop } = await import('../app/server.mjs');
const details = JSON.parse(readFileSync(new URL('../catalog/fx-origins.details.json', import.meta.url), 'utf8'));
let browser;
try {
  await start(5231);
  browser = await launchUI();
  const errors = [], page = await openUI(browser, errors, { lang: 'pt' });
  const before = (await api('state')).preset;
  assert.equal(await page.$eval('html', e => e.lang), 'pt-BR');

  async function assertSheet(name) {
    await page.waitForSelector('.model-info');
    const d = details[name], text = await page.$eval('.model-info', e => e.textContent);
    for (const sentence of [d.notes, ...d.facts.map(f => f.text)].filter(Boolean)) {
      assert(!text.includes(sentence), `${name}: English sentence leaked: ${sentence}`);
    }
    if (d.notes) assert.equal(await page.$eval('.origin-notes', e => e.textContent), d.notes_pt);
    const identity = [d.maker, d.unit].filter(Boolean).join(' ');
    const visible = d.facts.filter(f => f.text !== `${name} origin: ${identity}.`);
    assert.deepEqual(await page.$$eval('.origin-facts li', es => es.map(e => e.textContent)), visible.map(f => f.text_pt));
    if (!visible.length) {
      assert.equal(await page.$('.origin-facts'), null, `${name}: hide empty facts`);
      assert.equal(await page.$('.origin-sources'), null);
      assert(!text.includes('Fatos documentados'));
    } else {
      const source = await page.$eval('.origin-sources', e => e.textContent);
      assert(!/catalog\/fx-origins\.json:|tools\/sources\/pod-hd-model-gallery\.txt:/.test(source));
      assert.match(source, /^Fonte: /);
      if (name === 'Tape Echo') assert.equal(source, 'Fonte: Galeria de Modelos POD HD da Line 6 [1]');
      if (name === 'Chrome Custom') assert.equal(source,
        'Fonte: Galeria de Modelos POD HD da Line 6 (lista de origens) [1]; Galeria de Modelos POD HD da Line 6 [2][3]');
    }
  }

  // The demo's Tape Echo block exercises the actual inspector (i) button.
  await page.click('.block[data-item="5"] .nm');
  await page.click('#inspector .model-info-button'); await assertSheet('Tape Echo');
  await page.keyboard.press('Escape');
  await page.click('.block[data-item="4"] .nm');
  for (const name of ['Screamer', 'Vetta Juice', 'Particle Verb', 'Chrome Custom', 'Tube Comp', 'Graphic EQ', 'Vocoder']) {
    await page.click('#inspector .model-title');
    await page.waitForSelector('.dlg input[type="search"]');
    await page.type('.dlg input[type="search"]', name);
    await page.evaluate(name => {
      const card = [...document.querySelectorAll('.model-card')].find(e => e.querySelector('.model-text')?.firstChild?.textContent === name);
      if (!card) throw new Error(`No picker card for ${name}`);
      card.querySelector('.model-info-button').click();
    }, name);
    await assertSheet(name); await page.keyboard.press('Escape');
  }

  // Unknown source paths/URLs remain readable, while duplicates still group their numbers.
  await page.evaluate(async () => {
    const { showModelInfo } = await import('/js/model-info.js');
    showModelInfo({ name: 'Source fixture', kind: 'fx', params: [], details: {
      maker: null, unit: null, notes: null, facts: [
        { text: 'First fixture fact.', text_pt: 'Primeiro fato de teste.', source: 'other/source.txt:7' },
        { text: 'Second fixture fact.', text_pt: 'Segundo fato de teste.', source: 'other/source.txt:7' },
        { text: 'URL fixture fact.', text_pt: 'Fato de teste com URL.', source: 'https://example.com/reference' },
      ],
    } });
  });
  await page.waitForSelector('.origin-sources');
  assert.equal(await page.$eval('.origin-sources', e => e.textContent), 'Fonte: other/source.txt:7 [1][2]; https://example.com/reference [3]');
  assert.equal(await page.$eval('.origin-sources a', e => e.href), 'https://example.com/reference');
  await page.keyboard.press('Escape');

  // Inspect the additional translated tooltip/menu paths found by coverage.
  assert.match(await page.$eval('.block[data-item="5"]', e => e.title), /baseado em.*Selecione o bloco/);
  await page.click('#fileMenu');
  assert((await page.$eval('.menu', e => e.textContent)).includes('Ferramentas de desenvolvimento…'));
  await page.keyboard.press('Escape');
  assert.deepEqual((await api('state')).preset, before, 'Help navigation leaves the demo preset unchanged');
  assert.deepEqual(errors, []);

  // English selection must still show the original, source-verified notes and facts.
  const english = await openUI(browser, errors);
  await english.click('.block[data-item="5"] .nm'); await english.click('#inspector .model-info-button');
  await english.waitForSelector('.origin-notes');
  assert.equal(await english.$eval('.origin-notes', e => e.textContent), details['Tape Echo'].notes);
  assert.equal(await english.$eval('.origin-facts li', e => e.textContent), details['Tape Echo'].facts[1].text);
  assert.equal(await english.$eval('.origin-sources', e => e.textContent), 'Source: Line 6 POD HD Model Gallery [1]');
  assert.deepEqual(errors, []);
  console.log('UI i18n: 8 PT model sheets, grouped sources, tooltips/menu and English fallback passed (DEMO only).');
} finally {
  try { await browser?.close(); } finally { await stop(); }
}
