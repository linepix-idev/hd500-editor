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
  const field = g => {
    const k = KNOWN[g.id], inp = h('input', { type: 'number', value: g.value, min: k?.min, max: k?.max, 'aria-label': label(g),
      onChange: () => api('globals', { id: g.id, value: Number(inp.value) }).then(() => { g.value = Number(inp.value); toast('Sent to the pedal.'); }).catch(fail) });
    return inp;
  };
  const row = g => h('div', { class: 'row' }, h('label', {}, label(g), KNOWN[g.id]?.unit ? h('small', { class: 'dim' }, ` ${KNOWN[g.id].unit}`) : null), field(g));
  const named = rows.filter(g => KNOWN[g.id] || names[g.id]), unnamed = rows.filter(g => !KNOWN[g.id] && !names[g.id]);
  let snap = null; const finder = h('div', {});
  const paintFinder = changes => finder.replaceChildren(
    h('p', { class: 'ios-footer' }, snap ? 'Now change ONE setting on the pedal (Setup/Utilities), then press Compare.' : 'Take a snapshot, change one setting on the pedal, then compare to find which value moved.'),
    h('div', { class: 'ios-action' }, h('button', { class: 'primary', onClick: async () => {
      try {
        const now = await api('globals');
        if (!snap) { snap = now; toast('Snapshot saved.'); return paintFinder(); }
        const ch = now.filter(g => snap.find(s => s.id === g.id)?.value !== g.value).map(g => ({ ...g, was: snap.find(s => s.id === g.id)?.value }));
        snap = null; paintFinder(ch);
      } catch (e) { fail(e); }
    } }, snap ? 'Compare' : 'Take snapshot')),
    changes ? (changes.length ? h('div', { class: 'ios-group' }, changes.map(c => { const nm = h('input', { type: 'text', placeholder: 'What is it?', value: names[c.id] ?? '', onChange: () => { names[c.id] = nm.value; save(names); } });
      return h('div', { class: 'row' }, h('label', {}, `${hex(c.id)}: ${c.was} → ${c.value}`), nm); }))
      : h('p', { class: 'ios-footer' }, 'Nothing changed. Try again.')) : null);
  paintFinder();
  body.replaceChildren(
    h('p', { class: 'ios-footer' }, 'These settings belong to the pedal itself, not to the preset. Only the tuner reference is identified so far; help map the rest below.'),
    named.length ? h('div', { class: 'ios-group' }, named.map(row)) : null,
    h('h3', { class: 'ios-header' }, 'Find a setting'), finder,
    h('h3', { class: 'ios-header' }, `Not identified yet (${unnamed.length})`),
    h('div', { class: 'ios-group' }, unnamed.map(row)),
    h('div', { class: 'ios-action' }, h('button', { onClick: () => download('hd500-global-names.json', JSON.stringify(names, null, 2), 'application/json') }, 'Export names')));
}
