// Pedal-wide settings (outside the preset). Status ids 0x00–0x25 are readable/writable; only a few are named so far,
// so the sheet includes a guided "find a setting" tool: snapshot, change it on the pedal, compare, name it.
import { h, api, fail, toast, modal, download } from './util.js';
const KEY = 'hd500.globalNames';
const KNOWN = { 2: { name: 'Tuner reference', unit: 'Hz', min: 400, max: 480 } };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const save = n => { try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} };
const hex = id => '0x' + id.toString(16).padStart(2, '0');

export async function openGlobals() {
  const names = load(); let rows;
  const body = h('div', { class: 'globals' }, h('p', { class: 'ios-footer' }, 'Reading the pedal…'));
  modal('Pedal settings', body);
  try { rows = await api('globals'); } catch (e) { body.replaceChildren(h('p', { class: 'ios-footer' }, e.message)); return; }
  const label = g => KNOWN[g.id]?.name ?? names[g.id] ?? `Setting ${hex(g.id)}`;
  const inputs = new Map();
  const field = g => {
    const k = KNOWN[g.id], inp = h('input', { type: 'number', value: g.value, min: k?.min, max: k?.max, 'aria-label': label(g),
      onChange: () => api('globals', { id: g.id, value: Number(inp.value) }).then(() => { g.value = Number(inp.value); toast('Sent to the pedal.'); }).catch(fail) });
    inputs.set(g.id, inp); return inp;
  };
  const row = g => h('div', { class: 'row', dataset: { gid: g.id } }, h('label', {}, label(g), KNOWN[g.id]?.unit ? h('small', { class: 'dim' }, ` ${KNOWN[g.id].unit}`) : null), field(g));
  const named = rows.filter(g => KNOWN[g.id] || names[g.id]), unnamed = rows.filter(g => !KNOWN[g.id] && !names[g.id]);
  // Live watch: poll the pedal and report every value that changes while you turn knobs / walk its menus.
  const finder = h('div', {}), changes = new Map(); let last = new Map(rows.map(g => [g.id, g.value])), timer = null, watching = false;
  const listChanges = () => [...changes.values()].sort((x, y) => y.at - x.at);
  const paintFinder = () => finder.replaceChildren(
    h('div', { class: 'ios-group' }, h('div', { class: 'row' }, h('label', {}, 'Watch the pedal'),
      h('button', { class: 'switch', role: 'switch', 'aria-checked': String(watching), 'aria-label': 'Watch the pedal', onClick: () => { watching ? stop() : start(); } }))),
    h('p', { class: 'ios-footer' }, watching ? 'Watching. Change a setting on the pedal (Global / Setup / Utilities) and it appears here; then say what it is.' : 'Turn on, then change one setting at a time on the pedal.'),
    changes.size ? h('div', { class: 'ios-group' }, listChanges().map(c => { const nm = h('input', { type: 'text', placeholder: 'What is it?', value: names[c.id] ?? '', 'aria-label': `Name of ${hex(c.id)}`, onChange: () => { names[c.id] = nm.value; save(names); } });
      return h('div', { class: 'row' }, h('label', {}, `${hex(c.id)}: ${c.first} → ${c.now}`), nm); })) : null);
  let busy = false;
  const tick = async () => {
    if (!body.isConnected) return stop();
    if (busy) return; busy = true;
    try {
      const now = await api('globals'); let moved = false;
      for (const g of now) { const was = last.get(g.id); if (was !== undefined && was !== g.value) { const c = changes.get(g.id); changes.set(g.id, { id: g.id, first: c?.first ?? was, now: g.value, at: Date.now() }); moved = true; } last.set(g.id, g.value); }
      for (const g of now) { const el = inputs.get(g.id); if (el && document.activeElement !== el) el.value = g.value; }
      for (const c of changes.values()) if (Date.now() - c.at < 1500) { const r = body.querySelector(`[data-gid="${c.id}"]`); if (r) { r.classList.remove('flash-row'); void r.offsetWidth; r.classList.add('flash-row'); } }
      if (moved) paintFinder();
    } catch {} finally { busy = false; }
  };
  const start = () => { if (watching) return; watching = true; timer = setInterval(tick, 500); paintFinder(); };
  const stop = () => { watching = false; clearInterval(timer); if (body.isConnected) paintFinder(); };
  paintFinder();
  setTimeout(start, 0);
  body.replaceChildren(
    h('p', { class: 'ios-footer' }, 'These settings belong to the pedal itself, not to the preset. Only the tuner reference is identified so far; help map the rest below.'),
    named.length ? h('div', { class: 'ios-group' }, named.map(row)) : null,
    h('h3', { class: 'ios-header' }, 'Find a setting'), finder,
    h('h3', { class: 'ios-header' }, `Not identified yet (${unnamed.length})`),
    h('div', { class: 'ios-group' }, unnamed.map(row)),
    h('div', { class: 'ios-action' }, h('button', { onClick: () => download('hd500-global-names.json', JSON.stringify(names, null, 2), 'application/json') }, 'Export names')));
}
