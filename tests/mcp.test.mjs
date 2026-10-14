// MCP server against the demo editor: tools, units, safety rules, snapshot-before-edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
process.env.HD500_DEMO = '1';
const dir = mkdtempSync(`${tmpdir()}/hd500-mcp-`); process.env.HD500_BACKUPS = dir;
const { start, stop } = await import('../app/server.mjs');
const port = await start(0);

const child = spawn(process.execPath, ['mcp/hd500-mcp.mjs'], { env: { ...process.env, HD500_URL: `http://127.0.0.1:${port}` }, stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '', next = 1; const waiting = new Map();
child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l) continue; const m = JSON.parse(l); waiting.get(m.id)?.(m); } });
const rpc = (method, params) => new Promise(res => { const id = next++; waiting.set(id, res); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
const tool = async (name, args = {}) => { const r = await rpc('tools/call', { name, arguments: args }); return { text: r.result.content[0].text, error: !!r.result.isError }; };

test('lists the tools', async () => {
  const r = await rpc('initialize', {}); assert.equal(r.result.serverInfo.name, 'hd500');
  const t = (await rpc('tools/list')).result.tools.map(x => x.name); assert.deepEqual(t.sort(), ['compare', 'describe', 'edit', 'look', 'save', 'select']);
});
test('look summary shows blocks with units', async () => {
  const { text } = await tool('look'); assert.match(text, /^Preset "/); assert.match(text, /\[4\] FX1: /); assert.match(text, /Mixer: A/);
});
test('edit: unit values, snapshot, then a bad op stops the batch', async () => {
  const before = readdirSync(dir).length;
  const r = await tool('edit', { ops: [{ op: 'param', item: 4, param: 'drive', value: '35%' }, { op: 'param', item: 4, param: 'nope', value: 1 }, { op: 'tempo', bpm: 99 }] });
  assert.match(r.text, /✔ .* → 35%/); assert.match(r.text, /✖ param: block 4/); assert.doesNotMatch(r.text, /tempo 99/);
  assert.equal(readdirSync(dir).length, before + 1, 'snapshot written once');
  assert.match((await tool('look', { what: 'blocks' })).text, /UNSAVED EDITS/);
});
test('model by name, mixer and tempo', async () => {
  const r = await tool('edit', { ops: [{ op: 'model', item: 5, model: 'Screamer' }, { op: 'mixer', levelA: -3, panA: -0.5 }, { op: 'tempo', bpm: 140 }, { op: 'fs', item: 5, fs: 'FS3' }, { op: 'active', item: 5, on: false }] });
  assert.doesNotMatch(r.text, /✖/); const s = (await tool('look')).text;
  assert.match(s, /Mixer: A -3\.0 dB pan -0\.50/); assert.match(s, /140\.0 BPM/); assert.match(s, /\[5\] FX2: Screamer .*off · FS3/);
});
test('inputs are shown and set by name', async () => {
  assert.match((await tool('look')).text, /Inputs: (Guitar|Mic|Aux|Variax[^→]*) → path A, /);
  assert.match((await tool('edit', { ops: [{ op: 'input', input1: 'Guitar', guitarZ: '1M' }] })).text, /input1=Guitar guitarZ=1M/);
});
test('safety: select with edits and save without confirm are refused', async () => {
  const a = await tool('select', { set: 1, preset: '1A' }); assert.ok(a.error); assert.match(a.text, /unsaved edits/);
  const b = await tool('save', {}); assert.ok(b.error); assert.match(b.text, /confirm:true/);
});
test('describe is grounded in the catalog and search finds origins', async () => {
  assert.match((await tool('describe', { model: 'Screamer' })).text, /Ibanez Tube Screamer/);
  assert.match((await tool('look', { what: 'models', query: 'tube screamer' })).text, /Screamer/);
  assert.ok((await tool('describe', { model: 'Does Not Exist' })).error);
});
test('compare and discard-select work', async () => {
  assert.match((await tool('compare', { on: true })).text, /saved version/); assert.match((await tool('compare', { on: false })).text, /edits/);
  assert.match((await tool('select', { set: 1, preset: '1A', discard: true })).text, /now on set 1 slot 1A/);
});
test.after(async () => { child.kill(); await stop(); });
