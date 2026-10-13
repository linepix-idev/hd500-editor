import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFxDetails } from '../tools/check-fx-details.mjs';
import { catalog, itemOffset } from '../core/preset.mjs';
import { BLANK } from '../core/library.mjs';

const details = JSON.parse(readFileSync(new URL('../catalog/fx-origins.details.json', import.meta.url), 'utf8'));
const screamer = catalog.pedals.find(p => p.name === 'Screamer');
const fixture = () => ({ Screamer: structuredClone(details.Screamer) });

test('every catalog effect has validated details; preset items expose the same facts', () => {
  assert.deepEqual(checkFxDetails(details), []);
  assert.deepEqual(Object.keys(details).sort(), catalog.pedals.map(p => p.name).sort());
  const preset = BLANK.clone(), before = Buffer.from(preset.body);
  preset.body.writeUInt32LE(screamer.type, itemOffset(4));
  const configured = Buffer.from(preset.body);
  assert.deepEqual(preset.item(4).details, details.Screamer);
  assert.deepEqual(preset.toJSON().items.find(i => i.id === 4).details, details.Screamer);
  assert.equal(preset.item(4).basedOn, 'Ibanez Tube Screamer');
  assert.deepEqual(preset.body, configured, 'Reading details never changes preset bytes');
  assert.deepEqual(preset.body.subarray(itemOffset(4) + 4), before.subarray(itemOffset(4) + 4));
});

test('provenance validator rejects missing sources and invalid file/line references', () => {
  for (const source of [undefined, '', 'catalog/missing.json:1', 'catalog/fx-origins.json:999999', 'catalog/fx-origins.json:0']) {
    const d = fixture(); d.Screamer.facts[0].source = source;
    assert(checkFxDetails(d, [screamer]).length > 0, `Must reject ${source}`);
  }
});

test('provenance validator rejects unrelated claims and counts distinct words', () => {
  const d = fixture();
  d.Screamer.facts[0].text = 'Unsupported germanium transistor circuit topology';
  assert(checkFxDetails(d, [screamer]).some(e => /fewer than 3/.test(e)));
  d.Screamer.facts[0].text = 'Ibanez Ibanez Ibanez';
  assert(checkFxDetails(d, [screamer]).some(e => /fewer than 3/.test(e)));
});

test('unknown fields stay null and original=true needs explicit gallery evidence', () => {
  assert.equal(details.Vocoder.maker, null);
  assert.equal(details.Vocoder.unit, null);
  assert.equal(details.Vocoder.notes, null);
  assert.equal(details.Vocoder.original, null);
  assert.equal(details['Vetta Comp'].original, null);
  assert.equal(details['Vetta Juice'].original, true);
  assert.equal(details['Particle Verb'].original, true);
  const d = fixture(); d.Screamer.original = true;
  assert(checkFxDetails(d, [screamer]).some(e => /explicit gallery/.test(e)));
});

test('details schema rejects missing models, invented models, long notes and missing null fields', () => {
  assert(checkFxDetails({}, [screamer]).some(e => /missing details/.test(e)));
  const d = fixture(); d.Invented = d.Screamer;
  assert(checkFxDetails(d, [screamer]).some(e => /Unknown model/.test(e)));
  delete d.Invented; d.Screamer.notes = 'x'.repeat(161); delete d.Screamer.unit;
  const errors = checkFxDetails(d, [screamer]);
  assert(errors.some(e => /160/.test(e)));
  assert(errors.some(e => /unit/.test(e)));
});
