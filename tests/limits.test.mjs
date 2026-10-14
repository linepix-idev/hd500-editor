// Every edit is validated/clamped before it can reach the pedal (an out-of-range microphone index once froze it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Preset, MICS, catalog } from '../core/preset.mjs';
import { sanitize } from '../app/limits.mjs';

const p = new Preset(readFileSync(new URL('../core/blank_preset.bin', import.meta.url)));
const S = (b, preset = p) => sanitize({ ...b }, preset);

test('numbers must be finite', () => {
  for (const bad of [NaN, Infinity, 'x', undefined]) assert.throws(() => S({ op: 'tempo', bpm: bad }));
  assert.throws(() => S({ op: 'setupF', id: 0x2e, value: NaN }));
});
test('microphone and the other list settings are clamped to their options', () => {
  assert.equal(S({ op: 'setup', id: 0x34, value: 99 }).value, MICS.length - 1);
  assert.equal(S({ op: 'setup', id: 0x35, value: -4 }).value, 0);
  assert.equal(S({ op: 'setup', id: 0x38, value: 7 }).value, 1);
});
test('mixer levels, pans and tempo are clamped (and routed to setupF)', () => {
  assert.deepEqual([S({ op: 'setup', id: 0x2c, value: 100 }).value, S({ op: 'setup', id: 0x2c, value: 100 }).op], [12, 'setupF']);
  assert.equal(S({ op: 'setupF', id: 0x2d, value: -500 }).value, -60);
  assert.equal(S({ op: 'setupF', id: 0x2e, value: 5 }).value, 1);
  assert.equal(S({ op: 'tempo', bpm: 999 }).bpm, 240); assert.equal(S({ op: 'tempo', bpm: 3 }).bpm, 30);
});
test('inputs must be real choices; unknown settings are rejected', () => {
  assert.equal(S({ op: 'setup', id: 0x36, value: 2 }).value, 2);
  assert.throws(() => S({ op: 'setup', id: 0x36, value: 4 }), /input 1/);          // 4 is not an input
  assert.throws(() => S({ op: 'setup', id: 0x55, value: 40 }));
  assert.throws(() => S({ op: 'setup', id: 250, value: 1 }), /unknown/);
});
test('parameters: clamped, id must match the block', () => {
  const it = p.item(4); assert.equal(it.empty, true);                              // blank preset: no params yet
  assert.equal(S({ op: 'param', item: 4, index: 0, id: 1, value: 9 }, null).value, 1);
  assert.throws(() => S({ op: 'param', item: 99, index: 0, id: 1, value: 0 }));
});
test('chain, model, fs, controller, name, raw, midi', () => {
  const ok = Array.from({ length: 8 }, (_, i) => ({ id: i + 4, lane: i % 6 }));
  assert.equal(S({ op: 'chain', order: ok }).order.length, 8);
  assert.throws(() => S({ op: 'chain', order: ok.map(o => ({ ...o, id: 4 })) }), /twice/); assert.throws(() => S({ op: 'chain', order: ok.slice(1) }));
  assert.throws(() => S({ op: 'model', item: 4, type: 123 }), /does not exist/);
  assert.equal(S({ op: 'model', item: 4, type: catalog.pedals[1].type }).type, catalog.pedals[1].type);
  assert.throws(() => S({ op: 'model', item: 0, type: catalog.pedals[1].type }));  // an effect type on an amp slot
  assert.equal(S({ op: 'fs', item: 4, fs: 55 }).fs, 9); assert.throws(() => S({ op: 'fs', item: 0, fs: 1 }));
  assert.equal(S({ op: 'ctl', item: 4, index: 0, ctl: 9, lo: -1, hi: 2 }, null).hi, 1);
  assert.equal(S({ op: 'name', name: 'A very long preset name!!' }).name.length, 16); assert.throws(() => S({ op: 'name', name: '   ' }));
  assert.equal(S({ op: 'raw', offset: 99999, value: 999 }).offset, 4095);
  assert.throws(() => S({ op: 'midi', index: 1, bytes: [1, 2] })); assert.throws(() => S({ op: 'bogus' }));
});
