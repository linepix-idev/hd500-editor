#!/usr/bin/env node
// MCP for the HD500 Editor (stdio, no dependencies): an AI reads and edits the preset in the running editor through the SAME API
// the human uses, so every change shows up live in the app (and on the pedal). Safe by design: edits only touch the edit buffer,
// a snapshot of the user's sound is taken before the first change, and writing to the pedal's memory needs an explicit confirm.
// Register: claude mcp add hd500 -- node /path/to/hd500-edit/mcp/hd500-mcp.mjs
import { readFileSync, existsSync } from 'node:fs';
import readline from 'node:readline';

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? '';
const DATA = process.env.HD500_DATA ?? `${process.env.XDG_DATA_HOME ?? `${HOME}/.local/share`}/hd500-editor`;
const ROOT = new URL('..', import.meta.url).pathname;

const INSTRUCTIONS = `HD500 Editor: edits a Line 6 POD HD500 live. The human sees (and hears) every change.
Flow: look(summary) -> look(models, query) / describe(model) when choosing -> edit(ops in a batch) -> look(chain) to verify.
Rules: edits only change the edit buffer (nothing is written to the pedal's memory). The user's sound is snapshotted before your first edit.
Never call save unless the user asked to save; it needs confirm:true. Switching preset with unsaved edits needs discard:true.
Values: param "value" is a number 0..1 (normalized) OR a string with unit: "35%", "250 ms", "-6 dB", "2.5 kHz", "800 Hz", or an option name for list params.
Blocks are addressed by item id: 0 Amp A, 1 Cab A, 2 Amp B, 3 Cab B, 4..11 Effects 1..8 (look shows them).
Never invent facts about the real gear a model is based on: use describe.`;

// ---------- editor discovery ----------
const candidates = () => {
  const out = [];
  if (process.env.HD500_URL) out.push(process.env.HD500_URL.replace(/\/$/, ''));
  try { const j = JSON.parse(readFileSync(`${DATA}/server.json`, 'utf8')); if (j.port) out.push(`http://127.0.0.1:${j.port}`); } catch {}
  out.push('http://127.0.0.1:5230');
  return [...new Set(out)];
};
let base = null;
const find = async () => {
  for (const u of candidates()) { try { const r = await fetch(`${u}/api/catalog`, { signal: AbortSignal.timeout(1500) }); if (r.ok) return u; } catch {} }
  throw new Error('HD500 Editor is not running (or not reachable). Open the app, then try again.');
};
const call = async (path, body) => {
  base ??= await find();
  let r;
  try { r = await fetch(`${base}/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1', 'x-hd500-actor': 'ai' }, body: JSON.stringify(body) }); }
  catch (e) { // POST só repete se a conexão nem chegou a abrir; senão a operação pode já ter sido executada
    if (body !== undefined && e?.cause?.code !== 'ECONNREFUSED') throw e;
    base = await find(); r = await fetch(`${base}/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1', 'x-hd500-actor': 'ai' }, body: JSON.stringify(body) }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
};
let catalogCache = null;
const catalog = async () => (catalogCache ??= await call('catalog'));
const state = () => call('state');
const presence = (status, items) => call('ai', { status, items }).catch(() => {});
const wait = ms => new Promise(r => setTimeout(r, ms));
const optName = (list, v) => (list.find(x => x[0] === v) ?? [])[1] ?? v;
const optValue = (list, key, v) => { if (typeof v === 'number') return v; const hit = list.find(x => norm(x[1]) === norm(v)); if (!hit) throw new Error(`unknown ${key} "${v}" (${list.map(x => x[1]).join(', ')})`); return hit[0]; };
const slot = p => `${Math.floor(p / 4) + 1}${'ABCD'[p % 4]}`;

// ---------- value formatting / parsing ----------
const NOTES = ['1/64', '1/32', '1/16T', '1/16', '1/8T', '1/8', '1/8.', '1/4T', '1/4', '1/4.', '1/2', '1/2.', '1/1'];
const lerp = (p, v) => v * ((p.max ?? 1) - (p.min ?? 0)) + (p.min ?? 0);
function fmt(p, v) {
  switch (p.kind) {
    case 'list': return p.options?.[Math.round(v)] ?? String(Math.round(v));
    case 'percent': return `${Math.round(v * 100)}%`;
    case 'freq': return `${Math.round(lerp(p, v))} Hz`;
    case 'freqk': return `${lerp(p, v).toFixed(1)} kHz`;
    case 'range': return `${lerp(p, v).toFixed(1)} dB`;
    case 'time': return `${Math.round(v * (p.maxMs ?? 1000))} ms`;
    case 'tempo': return v > 1 ? NOTES[Math.round(v) - 2] ?? 'note' : ((p.max ?? 0) >= 500 ? `${Math.round(lerp(p, v))} ms` : `${lerp(p, v).toFixed(2)} Hz`);
    default: return v.toFixed(2);
  }
}
function parseValue(p, raw) {
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim(), m = /^(-?\d+(?:[.,]\d+)?)\s*(%|ms|db|hz|khz)?$/i.exec(s);
  if (p.kind === 'list') {
    const opts = (p.options ?? []).map(o => String(o).toLowerCase()), i = opts.indexOf(s.toLowerCase());
    if (i >= 0) return i; const j = opts.findIndex(o => o.includes(s.toLowerCase())); if (j >= 0) return j;
    if (m) return Number(m[1]); throw new Error(`"${raw}" is not an option of ${p.name}: ${p.options?.join(', ')}`);
  }
  if (!m) throw new Error(`cannot read value "${raw}" for ${p.name}`);
  const n = Number(m[1].replace(',', '.')), u = (m[2] ?? '').toLowerCase(), span = (p.max ?? 1) - (p.min ?? 0) || 1;
  if (u === '%') return n / 100;
  if (u === 'ms' && p.kind === 'time') return n / (p.maxMs ?? 1000);
  if (u === 'ms' && p.kind === 'tempo') return (n - (p.min ?? 0)) / span;
  if (u === 'hz' && (p.kind === 'freq' || p.kind === 'tempo')) return (n - (p.min ?? 0)) / span;
  if (u === 'khz' && p.kind === 'freqk') return (n - (p.min ?? 0)) / span;
  if (u === 'db' && p.kind === 'range') return (n - (p.min ?? 0)) / span;
  if (u) throw new Error(`unit "${m[2]}" does not fit ${p.name} (${p.kind})`);
  return n;                                         // bare number = normalized 0..1
}

// ---------- lookups ----------
const KIND = i => i.kind === 'amp' ? `Amp ${i.id === 0 ? 'A' : 'B'}` : i.kind === 'cab' ? `Cab ${i.id === 1 ? 'A' : 'B'}` : `FX${i.id - 3}`;
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function findParam(it, ref) {
  if (typeof ref === 'number') { const p = it.params[ref]; if (p) return p; }
  const n = norm(ref), exact = it.params.find(p => norm(p.name) === n) ?? it.params.find(p => norm(p.name).startsWith(n)) ?? it.params.find(p => norm(p.name).includes(n));
  if (!exact) throw new Error(`block ${it.id} (${it.model}) has no parameter "${ref}". Parameters: ${it.params.map(p => p.name).join(', ')}`);
  return exact;
}
function findModel(cat, kind, name) {
  const list = kind === 'amp' ? cat.amps : kind === 'cab' ? cat.cabs : cat.pedals, n = norm(name);
  const hit = list.find(m => norm(m.name) === n) ?? list.filter(m => norm(m.name).includes(n));
  if (Array.isArray(hit)) { if (hit.length === 1) return hit[0]; throw new Error(hit.length ? `"${name}" is ambiguous: ${hit.map(m => m.name).join(', ')}` : `no ${kind} model named "${name}". Use look(models, query).`); }
  return hit;
}
const fsIndex = (cat, v) => { if (v == null || v === 'none' || v === 0) return 0; if (typeof v === 'number') return v; const i = cat.fs.findIndex(n => norm(n) === norm(v) || (norm(v) === 'toe' && n === 'EXP toe')); if (i < 0) throw new Error(`unknown footswitch "${v}" (${cat.fs.join(', ')})`); return i; };

// ---------- text views ----------
function chainText(st, cat, { detail = true } = {}) {
  const p = st.preset, lines = [];
  lines.push(`Preset "${p.name}" · set ${st.selection.set + 1} (${st.setNames[st.selection.set]}) slot ${slot(st.selection.preset)}${st.dirty ? ' · UNSAVED EDITS' : ''}${st.comparing ? ' · COMPARING (hearing the saved version)' : ''}`);
  lines.push(`Inputs: ${optName(cat.input1, p.setup.input1)} → path A, ${optName(cat.input2, p.setup.input2)} → path B · guitar Z ${optName(cat.inZ, p.setup.inZ)} · tempo ${(+p.tempo).toFixed(1)} BPM`);
  const m = p.mixer; lines.push(`Mixer: A ${m.levelA <= -59.9 ? 'mute' : m.levelA.toFixed(1) + ' dB'} pan ${m.panA.toFixed(2)} · B ${m.levelB <= -59.9 ? 'mute' : m.levelB.toFixed(1) + ' dB'} pan ${m.panB.toFixed(2)} · trails ${p.trails ? 'on' : 'off'}`);
  const byId = id => p.items.find(i => i.id === id), c = st.chain ?? {};
  lines.push(`Flow: pre[${(c.pre ?? []).join(',')}]  A: pre[${(c.aPre ?? []).join(',')}] amp0 cab1 post[${(c.aPost ?? []).join(',')}]  B: pre[${(c.bPre ?? []).join(',')}] amp2 cab3 post[${(c.bPost ?? []).join(',')}]  → mixer → post[${(c.post ?? []).join(',')}]`);
  for (const i of p.items) {
    if (i.empty) { lines.push(`[${i.id}] ${KIND(i)}: empty`); continue; }
    const head = `[${i.id}] ${KIND(i)}: ${i.model}${i.group ? ` (${i.group})` : ''}${i.basedOn ? ` ≈ ${i.basedOn}` : ''} · ${i.active ? 'ON' : 'off'}${i.fs ? ` · ${cat.fs[i.fs]}` : ''}`;
    if (!detail) { lines.push(head); continue; }
    const params = i.params.filter(q => !q.hidden).map(q => `${q.name}=${fmt(q, q.value)}${q.ctl ? `[${cat.ctl[q.ctl]} ${fmt(q, q.lo)}→${fmt(q, q.hi)}]` : ''}`).join(', ');
    lines.push(`${head}\n     ${params || '(no parameters)'}`);
  }
  return lines.join('\n');
}

function searchModels(cat, { query = '', kind }) {
  const q = norm(query), rows = [];
  for (const [k, list] of [['amp', cat.amps], ['cab', cat.cabs], ['fx', cat.pedals]]) {
    if (kind && kind !== k) continue;
    for (const m of list) {
      const hay = norm([m.name, m.group, m.basedOn, m.details?.maker, m.details?.unit].filter(Boolean).join(' '));
      if (!q || hay.includes(q)) rows.push(`${k}: ${m.name}${m.group ? ` (${m.group})` : ''}${m.basedOn ? ` ≈ ${m.basedOn}` : ''}`);
    }
  }
  return rows.length ? rows.slice(0, 80).join('\n') + (rows.length > 80 ? `\n… ${rows.length - 80} more, refine the query` : '') : 'no models match';
}

function describeModel(cat, name) {
  const found = [['amp', cat.amps], ['cab', cat.cabs], ['fx', cat.pedals]].flatMap(([k, l]) => l.filter(m => norm(m.name) === norm(name)).map(m => [k, m]));
  if (!found.length) throw new Error(`no model named "${name}"`);
  let desc = {}; try { desc = JSON.parse(readFileSync(`${ROOT}catalog/descriptions.json`, 'utf8')); } catch {}
  return found.map(([k, m]) => {
    const d = m.details ?? {}, out = [`${k}: ${m.name}${m.group ? ` (${m.group})` : ''}`];
    if (m.basedOn) out.push(`Based on: ${m.basedOn}`);
    if (d.maker || d.unit) out.push(`Maker/unit: ${[d.maker, d.unit].filter(Boolean).join(' ')}`);
    if (d.notes) out.push(`Note: ${d.notes}`);
    for (const f of d.facts ?? []) out.push(`Fact: ${f.text}`);
    const g = desc.groups?.[m.group]; if (g) out.push(`Group: ${typeof g === 'string' ? g : g.description ?? JSON.stringify(g)}`);
    if (m.params?.length) out.push(`Parameters: ${m.params.map(p => `${p.name} (${p.kind})`).join(', ')}`);
    return out.join('\n');
  }).join('\n\n');
}

// ---------- editing ----------
let stashedFor = null;
async function ensureSnapshot(st) {
  const key = `${st.selection.set}:${st.selection.preset}:${st.preset.name}`;
  if (stashedFor === key) return null;
  const r = await call('backups/stash', { tag: 'ia' }); stashedFor = key; return r.file;
}
const MIX = { levelA: 0x2c, levelB: 0x2d, panA: 0x2e, panB: 0x2f };
async function runOp(o, st, cat) {
  const items = st.preset.items, need = id => { const it = items.find(i => i.id === id); if (!it) throw new Error(`no block with item ${id}`); return it; };
  switch (o.op) {
    case 'param': {
      const it = need(o.item); if (it.empty) throw new Error(`block ${o.item} is empty`);
      const p = findParam(it, o.param), v = parseValue(p, o.value), clamped = p.kind === 'list' ? Math.max(0, Math.min((p.options?.length ?? 1) - 1, v)) : Math.max(0, Math.min(1, v));
      if (p.setup != null) await call('edit', { op: p.float ? 'setupF' : 'setup', id: p.setup, value: clamped });
      else await call('edit', { op: p.cab ? 'cabParam' : 'param', item: it.id, index: p.index, id: p.id, value: clamped });
      p.value = clamped; return `${it.model} ${p.name} → ${fmt(p, clamped)}`;
    }
    case 'model': {
      const it = need(o.item), m = findModel(cat, it.kind, o.model); await call('edit', { op: 'model', item: it.id, type: m.type }); return `${KIND(it)} → ${m.name}`;
    }
    case 'active': { const it = need(o.item); await call('edit', { op: 'active', item: it.id, active: !!o.on }); return `${it.model}: ${o.on ? 'ON' : 'off'}`; }
    case 'fs': { const it = need(o.item), fs = fsIndex(cat, o.fs); await call('edit', { op: 'fs', item: it.id, fs }); return `${it.model} → ${cat.fs[fs]}`; }
    case 'controller': {
      const it = need(o.item), p = findParam(it, o.param), ctl = o.controller == null || o.controller === 'none' ? 0 : cat.ctl.findIndex(n => norm(n) === norm(o.controller));
      if (ctl < 0) throw new Error(`unknown controller "${o.controller}" (${cat.ctl.join(', ')})`);
      const lo = o.heel != null ? parseValue(p, o.heel) : undefined, hi = o.toe != null ? parseValue(p, o.toe) : undefined;
      await call('edit', { op: 'ctl', item: it.id, index: p.index, ctl, lo: ctl ? (lo ?? p.lo) : p.value, hi: ctl ? (hi ?? p.hi) : p.value }); return `${it.model} ${p.name} ← ${cat.ctl[ctl]}`;
    }
    case 'order': { // {order: [{item, lane}]} for the 8 effects, lane: pre|aPre|bPre|aPost|bPost|post
      if (!Array.isArray(o.order)) throw new Error('order needs a list [{item, lane}] with all 8 effect blocks, in order');
      await call('edit', { op: 'chain', order: o.order.map(x => ({ id: x.item, lane: cat.lanes[x.lane] ?? x.lane })) }); return 'chain reordered';
    }
    case 'mixer': {
      const done = [];
      for (const k of Object.keys(MIX)) if (o[k] != null) { const v = k.startsWith('level') ? (o[k] === 'mute' ? -60 : Number(o[k])) : Number(o[k]); await call('edit', { op: 'setupF', id: MIX[k], value: v }); done.push(`${k}=${o[k]}`); }
      if (o.trails != null) { await call('edit', { op: 'setup', id: 0x38, value: o.trails ? 1 : 0 }); done.push(`trails=${o.trails}`); }
      return `mixer ${done.join(' ')}`;
    }
    case 'tempo': await call('edit', { op: 'tempo', bpm: Number(o.bpm) }); return `tempo ${o.bpm} BPM`;
    case 'input': {
      const done = [];
      for (const [key, id, list] of [['input1', 0x36, cat.input1], ['input2', 0x37, cat.input2], ['guitarZ', 0x55, cat.inZ]]) {
        if (o[key] == null) continue; const v = optValue(list, key, o[key]);
        await call('edit', { op: 'setup', id, value: v }); done.push(`${key}=${optName(list, v)}`);
      } return `inputs ${done.join(' ')}`;
    }
    case 'name': await call('edit', { op: 'name', name: String(o.name).slice(0, 16) }); return `preset renamed "${String(o.name).slice(0, 16)}"`;
    case 'undo': case 'redo': await call('edit', { op: o.op }); return o.op;
    default: throw new Error(`unknown op "${o.op}"`);
  }
}

// ---------- tools ----------
const TOOLS = [
  { name: 'look', description: 'Read the editor. what: summary (default: preset, inputs, mixer, flow, every block with its parameter values) | blocks (one line per block) | models (search the model catalog: query, kind amp|cab|fx) | presets (names of a set: set 1-8) | backups (recent backups).',
    inputSchema: { type: 'object', properties: { what: { type: 'string', enum: ['summary', 'blocks', 'models', 'presets', 'backups'] }, query: { type: 'string' }, kind: { type: 'string', enum: ['amp', 'cab', 'fx'] }, set: { type: 'integer' } } } },
  { name: 'describe', description: 'Facts about a model: what real gear it is based on (never invent this), maker/unit, sourced notes, parameters.', inputSchema: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'] } },
  { name: 'edit', description: `Apply operations to the CURRENT preset buffer (live; nothing is written to the pedal memory). Group many ops in one call. Ops: {op:"param", item, param (name or index), value}; {op:"model", item, model}; {op:"active", item, on}; {op:"fs", item, fs:"FS1".."FS8"|"EXP toe"|"none"}; {op:"controller", item, param, controller:"EXP 1"|"EXP 2"|"none", heel?, toe?}; {op:"order", order:[{item, lane}]} (all 8 effects; lanes pre|aPre|bPre|aPost|bPost|post); {op:"mixer", levelA?, levelB? (dB -60..12 or "mute"), panA?, panB? (-1..1), trails?}; {op:"tempo", bpm}; {op:"input", input1?, input2?, guitarZ?}; {op:"name", name}; {op:"undo"}; {op:"redo"}. ${INSTRUCTIONS.split('\n').find(l => l.startsWith('Values'))}`,
    inputSchema: { type: 'object', properties: { ops: { type: 'array', items: { type: 'object' } }, label: { type: 'string' } }, required: ['ops'] } },
  { name: 'select', description: 'Switch to another preset (set 1-8, preset slot 1-64 or "2C"). Refuses when there are unsaved edits unless discard:true.', inputSchema: { type: 'object', properties: { set: { type: 'integer' }, preset: { type: ['integer', 'string'] }, discard: { type: 'boolean' } }, required: ['set', 'preset'] } },
  { name: 'compare', description: 'Toggle hearing the saved version of the preset versus the current edits (A/B).', inputSchema: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] } },
  { name: 'save', description: 'Write the current preset into the pedal memory (the previous content is backed up automatically). ONLY when the user asked to save; requires confirm:true.', inputSchema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] } },
];

const presetIndex = v => { if (typeof v === 'number') return v - 1; const m = /^(\d+)([A-Da-d])$/.exec(String(v).trim()); if (m) return (Number(m[1]) - 1) * 4 + 'ABCD'.indexOf(m[2].toUpperCase()); const n = Number(v); if (Number.isFinite(n)) return n - 1; throw new Error(`bad preset "${v}"`); };

const handlers = {
  async look({ what = 'summary', query, kind, set }) {
    const cat = await catalog();
    if (what === 'models') return searchModels(cat, { query, kind });
    if (what === 'presets') { const st = await state(), s = set ? set - 1 : st.selection.set, names = await call('library/slots', { set: s }); return `Set ${s + 1} (${st.setNames[s]})\n` + names.map((n, i) => `${slot(i)} ${n}`).join('\n'); }
    if (what === 'backups') return (await call('backups/detailed')).slice(0, 20).map(b => `${b.file} · set ${b.set + 1} ${slot(b.preset)} "${b.name}" ${b.at}`).join('\n') || 'no backups';
    return chainText(await state(), cat, { detail: what !== 'blocks' });
  },
  async describe({ model }) { return describeModel(await catalog(), model); },
  async edit({ ops, label }) {
    if (!Array.isArray(ops) || !ops.length) throw new Error('ops is empty');
    let st = await state(); if (!st.connected) throw new Error('the pedal is not connected');
    const cat = await catalog(), snap = await ensureSnapshot(st), log = [];
    await presence(label ?? 'Editing the sound', []);
    if (st.comparing) await call('compare', { on: false });
    for (const o of ops) {
      try { log.push('✔ ' + await runOp(o, st, cat)); }
      catch (e) { log.push(`✖ ${o.op}: ${e.message}`); break; }
      if (['model', 'order', 'undo', 'redo'].includes(o.op)) { await wait(350); st = await state(); }
    }
    await presence(null);
    return `${label ? label + '\n' : ''}${log.join('\n')}${snap ? `\n(snapshot of the previous sound saved: ${snap})` : ''}`;
  },
  async select({ set, preset, discard }) {
    const st = await state(); if (st.dirty && !discard) throw new Error('there are unsaved edits; pass discard:true to drop them (they are not recoverable except from the AI snapshot)');
    if (st.dirty) await call('backups/stash', { tag: 'ia' });
    const next = await call('select', { set: set - 1, preset: presetIndex(preset) }); stashedFor = null;
    return `now on set ${next.selection.set + 1} slot ${slot(next.selection.preset)} "${next.preset.name}"`;
  },
  async compare({ on }) { const v = await call('compare', { on }); return v.comparing ? 'hearing the saved version' : 'back to the edits'; },
  async save({ confirm }) {
    if (confirm !== true) throw new Error('save needs confirm:true, and only when the user asked to save');
    const st = await call('save', {}); return `saved to set ${st.selection.set + 1} slot ${slot(st.selection.preset)} (previous content backed up)`;
  },
};

// ---------- JSON-RPC (MCP stdio) ----------
const send = m => process.stdout.write(JSON.stringify(m) + '\n');
// Tool calls run one at a time, in order: an edit batch must never interleave with another one.
let chain = Promise.resolve();
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => { chain = chain.then(() => onLine(line)).catch(() => {}); });
async function onLine(line) {
  let m; try { m = JSON.parse(line); } catch { return; }
  const { id, method, params } = m; if (id === undefined) return;
  try {
    if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'hd500', version: '0.1.0' }, instructions: INSTRUCTIONS } });
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      const h = handlers[params.name]; if (!h) throw new Error(`unknown tool: ${params.name}`);
      const writes = { select: 'Switching preset', compare: 'Comparing with the saved version', save: 'Saving to the pedal' };
      try {
        if (writes[params.name]) await presence(writes[params.name], []);
        const text = String(await h(params.arguments ?? {}));
        if (writes[params.name]) await presence(null);
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
      }
      catch (e) { await presence(null); return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `error: ${e.message}` }], isError: true } }); }
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unsupported method: ${method}` } });
  } catch (e) { send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e.message ?? e) } }); }
}
