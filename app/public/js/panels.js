import { h, api, fail, toast, menu, modal, download, pickFile, b64ToBytes, bytesToB64, $ } from './util.js';
import { S, notify, presetLabel } from './store.js';
import { edit } from './params.js';
import { pickPreset, pickDestination } from './picker.js';
import { selectSlot } from './nav.js';

// ---------------------------------------------------------------------------------------- Entradas / preset
export function renderSetup(root) {
  const p = S.st.preset, su = p.setup;
  const name = h('input', { type: 'text', maxlength: 16, value: p.name, 'aria-label': 'Preset name', style: { width: '190px', background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: '8px', padding: '6px 8px' } });
  name.addEventListener('change', () => edit('name', { name: name.value }).catch(fail));
  const select = (label, key, opts, setting) => {
    const s = h('select', { 'aria-label': label, onChange: () => { su[key] = Number(s.value); edit('setup', { id: setting, value: su[key] }).then(notify).catch(fail); } }, opts.map(([v, n]) => h('option', { value: v }, n)));
    s.value = su[key]; return h('div', { class: 'row' }, h('label', {}, label), s);
  };
  const bpm = h('input', { type: 'number', min: 30, max: 240, step: 1, value: Math.round(p.tempo), 'aria-label': 'Tempo (BPM)', style: { width: '80px' }, onChange: () => edit('tempo', { bpm: Number(bpm.value) }).catch(fail) });
  root.replaceChildren(
    h('div', { class: 'row' }, h('label', {}, 'Preset name'), name),
    h('h3', { style: { fontSize: '13px', margin: '14px 0 2px' } }, 'Input routing'),
    select('Input 1 (path A)', 'input1', S.cat.input1, 0x36),
    select('Input 2 (path B)', 'input2', S.cat.input2, 0x37),
    select('Guitar input impedance', 'inZ', S.cat.inZ, 0x55),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, 'To use a mic and a guitar together: Input 1 = Guitar and Input 2 = Mic. Each input feeds its own path (A and B) in the signal chain.'),
    h('div', { class: 'row' }, h('label', {}, 'Tempo (BPM)'), bpm));
}

// ---------------------------------------------------------------------------------------- Footswitches
let fsFlash = new Map();
export function renderFootswitches(root) {
  const its = S.st.preset.items.filter(i => i.kind === 'fx' && !i.empty);
  const tile = (fs) => {
    const assigned = its.filter(i => i.fs === fs), on = assigned.some(i => i.active);
    const b = h('button', { class: `fsbtn ${on ? 'hot' : ''} ${fs === 9 ? 'exp' : ''}`, dataset: { fs }, 'aria-pressed': on, title: 'Click: toggles this footswitch\'s blocks. Drag a block from the chain to assign it.',
      onClick: () => assigned.forEach(i => { i.active = !on; edit('active', { item: i.id, active: !on }).catch(fail); }) || notify() },
      h('b', {}, S.cat.fs[fs]), assigned.length ? assigned.map(i => h('small', {}, i.model)) : h('small', {}, 'free'));
    b.addEventListener('dragover', e => { e.preventDefault(); b.classList.add('dragover'); });
    b.addEventListener('dragleave', () => b.classList.remove('dragover'));
    b.addEventListener('drop', e => { e.preventDefault(); b.classList.remove('dragover'); const id = Number(e.dataTransfer.getData('text/plain')); if (id >= 4) edit('fs', { item: id, fs }).catch(fail); });
    return b;
  };
  root.replaceChildren(
    h('p', { class: 'dim', style: { fontSize: '12px', margin: '0 0 10px' } }, 'Each footswitch toggles its assigned blocks. Step on the pedal and the block lights up here.'),
    h('div', { class: 'fsgrid' }, [5, 6, 7, 8, 1, 2, 3, 4].map(tile), tile(9)),
    its.some(i => !i.fs) ? h('p', { class: 'dim', style: { fontSize: '12px' } }, 'No footswitch: ' + its.filter(i => !i.fs).map(i => i.model).join(', ')) : null);
}
export function flashFs(fs) {
  const el = document.querySelector(`.fsbtn[data-fs="${fs}"]`); if (!el) return;
  el.style.outline = '3px solid var(--accent)'; setTimeout(() => (el.style.outline = ''), 500);
}

// ---------------------------------------------------------------------------------------- Biblioteca
const L = { set: null, names: new Map(), busy: null };
export function renderLibrary(root) {
  if (L.set == null) L.set = S.st.selection.set;
  const sel = h('select', { 'aria-label': 'Set', onChange: () => { L.set = Number(sel.value); load(); } }, S.st.setNames.map((n, i) => h('option', { value: i }, `${i + 1} · ${n}`)));
  sel.value = L.set;
  const names = L.names.get(L.set);
  if (!names && !L.busy) queueMicrotask(load);
  const bar = h('div', { class: 'bar', id: 'libbar', hidden: !L.busy }, h('i', { style: { width: '0%' } }));
  const grid = h('div', { class: 'slots' }, Array.from({ length: S.cat.presets }, (_, i) => Slot(L.set, i, names?.[i])));
  root.replaceChildren(
    h('div', { class: 'row' }, sel, h('button', { onClick: load }, names ? 'Re-read names' : 'Read names'),
      h('button', { onClick: () => rename() }, 'Rename set')),
    bar, grid,
    h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { onClick: exportSet }, 'Export set'), h('button', { onClick: exportAll }, 'Export all'),
      h('button', { onClick: importBundle }, 'Import bundle…'), h('button', { onClick: importH5e }, 'Import .h5e…'), h('button', { onClick: exportList }, 'Export list (CSV)')),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Click to load. Right-click: copy, swap, clear, export. Drag one slot onto another to copy. Before any write the previous content goes to the backups/ folder.'));

  async function load() { if (L.busy) return; L.busy = true; $('#libbar') && ($('#libbar').hidden = false); try { L.names.set(L.set, await api('library/slots', { set: L.set })); } catch (e) { fail(e); } L.busy = null; renderLibrary(root); }
  async function rename() { const n = prompt('New set name (up to 16 characters)', S.st.setNames[L.set]); if (n != null) { try { await api('library/rename-set', { set: L.set, name: n }); } catch (e) { fail(e); } } }
}
function Slot(set, i, name) {
  const cur = set === S.st.selection.set && i === S.st.selection.preset;
  const b = h('button', { class: `slot ${cur ? 'cur' : ''}`, draggable: true, title: name ?? '', onClick: () => selectSlot(set, i),
    onContextmenu: e => { e.preventDefault(); slotMenu(e, set, i); } }, h('i', {}, presetLabel(i)), h('span', {}, name ?? '—'));
  b.addEventListener('dragstart', e => e.dataTransfer.setData('application/x-slot', JSON.stringify({ set, preset: i })));
  b.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-slot') || e.dataTransfer.types.includes('Files')) { e.preventDefault(); b.classList.add('dragover'); } });
  b.addEventListener('dragleave', () => b.classList.remove('dragover'));
  b.addEventListener('drop', async e => {
    e.preventDefault(); b.classList.remove('dragover');
    const f = e.dataTransfer.files?.[0];
    try {
      if (f) { await importH5eFile(f, { set, preset: i }); }
      else { const from = JSON.parse(e.dataTransfer.getData('application/x-slot')); if (confirm(`Copy ${presetLabel(from.preset)} (set ${from.set + 1}) to ${presetLabel(i)} (set ${set + 1})? The destination will be replaced (a backup is kept).`)) { await api('library/copy', { from, to: { set, preset: i } }); toast('Copied.'); invalidate(set); } }
    } catch (err) { fail(err); }
  });
  return b;
}
const invalidate = set => { L.names.delete(set); notify(); };
function slotMenu(e, set, i) {
  const at = { set, preset: i };
  menu(e.clientX, e.clientY, [
    ['Load', () => selectSlot(set, i)],
    ['Copy to…', () => pickDestination('Copy to', async to => { try { await api('library/copy', { from: at, to }); toast('Copied.'); invalidate(to.set); } catch (x) { fail(x); } })],
    ['Swap with…', () => pickDestination('Swap with', async b => { try { await api('library/swap', { a: at, b }); toast('Swapped.'); invalidate(set); invalidate(b.set); } catch (x) { fail(x); } })],
    ['Export .h5e', async () => { try { const j = await api('library/export-h5e', at); download(`${j.name || 'preset'}.h5e`, b64ToBytes(j.data)); } catch (x) { fail(x); } }],
    ['Import .h5e here…', async () => { const f = await pickFile('.h5e'); if (f) importH5eFile(f, at).catch(fail); }],
    ['Clear slot', async () => { if (confirm('Clear this slot (becomes "New Tone")? A backup is kept.')) { try { await api('library/clear', { at }); invalidate(set); } catch (x) { fail(x); } } }],
  ]);
}
async function importH5eFile(f, to) {
  const data = bytesToB64(new Uint8Array(await f.arrayBuffer()));
  await api('library/import-h5e', { data, to }); toast(to ? 'Preset written to the slot.' : 'Preset loaded into the pedal (edit buffer). Save to write it.'); if (to) invalidate(to.set);
}
async function importH5e() { const f = await pickFile('.h5e'); if (f) importH5eFile(f, null).catch(fail); }
async function exportSet() { try { toast('Reading the set…'); const b = await api('library/export', { sets: [L.set] }); download(`hd500-set${L.set + 1}.hd500lib`, JSON.stringify(b), 'application/json'); toast('Exported.'); } catch (e) { fail(e); } }
async function exportAll() { try { toast('Reading all 512 presets (about a minute)…', false, 6000); const b = await api('library/export', { sets: [...Array(S.cat.sets).keys()] }); download(`hd500-biblioteca-${new Date().toISOString().slice(0, 10)}.hd500lib`, JSON.stringify(b), 'application/json'); toast('Exported.'); } catch (e) { fail(e); } }
async function exportList() {
  try {
    toast('Reading the names of all presets…', false, 5000);
    const { sets } = await api('library/list', {});
    const rows = [['Set', 'Set name', 'Preset', 'Name']];
    sets.forEach((s, i) => s.presets.forEach((n, p) => rows.push([i + 1, s.name, presetLabel(p), n])));
    download('hd500-lista.csv', '\ufeff' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n'), 'text/csv');
    toast('List exported.');
  } catch (e) { fail(e); }
}
async function importBundle() {
  const f = await pickFile('.hd500lib,.json'); if (!f) return;
  let b; try { b = JSON.parse(await f.text()); } catch { return fail(new Error('invalid file')); }
  const n = b.sets?.reduce((a, s) => a + s.presets.length, 0) ?? 0;
  if (!confirm(`Write ${n} presets from ${b.sets?.length ?? 0} set(s) to the pedal, in the same places? The current slots go to the backups/ folder.`)) return;
  try { const r = await api('library/import', { bundle: b, renameSets: confirm('Also restore the set names?') }); toast(`${r.written} presets written.`); L.names.clear(); notify(); } catch (e) { fail(e); }
}
export function libraryProgress({ what, done, total }) {
  const bar = $('#libbar'); if (!bar) return; bar.hidden = false; bar.firstChild.style.width = Math.round(done / total * 100) + '%'; if (done >= total) setTimeout(() => (bar.hidden = true), 400);
}

// ---------------------------------------------------------------------------------------- Avançado
// Nomes de ajustes descobertos pelo usuário ficam no navegador; use "Export names" para compartilhar com a comunidade.
const NAMES_KEY = 'hd500.settingNames';
const loadNames = () => { try { return JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}'); } catch { return {}; } };
const saveNames = n => { try { localStorage.setItem(NAMES_KEY, JSON.stringify(n)); } catch {} };
export const learned = [];   // últimos ajustes mexidos no painel do pedal
export const unknownLog = [];
export function learnUnknown(ev) { unknownLog.unshift(ev); unknownLog.length = Math.min(unknownLog.length, 8); if (S.tab === 'advanced') renderAdvanced($('#tabBody')); }
let globalsCache = null;
export function learnSetup(ev) { learned.unshift({ ...ev, at: Date.now() }); learned.length = Math.min(learned.length, 12); if (S.tab === 'advanced') renderAdvanced($('#tabBody')); }

export function renderAdvanced(root) {
  const p = S.st.preset, names = loadNames();
  const nameOf = s => names[s.id] ?? s.name ?? '';
  const row = s => {
    const inp = h('input', { type: 'number', step: s.float ? 'any' : 1, value: s.float ? +s.value.toFixed(4) : s.value, 'aria-label': `setting ${s.id}`, onChange: () => { s.value = Number(inp.value); edit(s.float ? 'setupF' : 'setup', { id: s.id, value: s.value }).catch(fail); } });
    const nm = h('input', { type: 'text', value: nameOf(s), placeholder: 'give it a name…', 'aria-label': `name of setting ${s.id}`, style: { width: '130px' }, onChange: () => { names[s.id] = nm.value; saveNames(names); } });
    return h('tr', { dataset: { sid: s.id } }, h('td', {}, '0x' + s.id.toString(16)), h('td', {}, nm), h('td', {}, '0x' + s.offset.toString(16)), h('td', {}, inp));
  };
  const known = p.settings.filter(s => s.name), other = p.settings.filter(s => !s.name);
  const body = b64ToBytes(p.body), lines = [];
  for (let o = 0; o < body.length; o += 16) lines.push(o.toString(16).padStart(4, '0') + '  ' + [...body.slice(o, o + 16)].map(x => x.toString(16).padStart(2, '0')).join(' '));

  const learn = h('div', {}, learned.length ? learned.map(l => h('div', { class: 'row', style: { margin: '2px 0' } },
    h('b', {}, '0x' + l.id.toString(16)), h('span', { class: 'dim' }, `= ${typeof l.value === 'number' ? +l.value.toFixed(3) : l.value}`), h('span', { class: 'dim' }, nameOf({ id: l.id }) || 'unnamed'))) : h('p', { class: 'dim', style: { fontSize: '12px', margin: 0 } }, 'Move any preset setting on the pedal\'s panel (Mixer, Inputs, Setup…) and it shows up here with its id. Give it a name in the table below.'));

  // atribuições MIDI do preset: 14 registros de 6 bytes (formato ainda sem nomes)
  const midi = h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['#', ...'b0 b1 b2 b3 b4 b5'.split(' ')].map(t => h('th', {}, t)))),
    h('tbody', {}, Array.from({ length: 14 }, (_, i) => {
      const rec = [...body.slice(0xd84 + i * 6, 0xd84 + i * 6 + 6)];
      return h('tr', {}, h('td', {}, i + 1), rec.map((v, k) => { const inp = h('input', { type: 'number', min: 0, max: 255, value: v, style: { width: '54px' }, 'aria-label': `MIDI ${i + 1} byte ${k}`, onChange: () => { rec[k] = Number(inp.value); edit('midi', { index: i, bytes: rec }).catch(fail); } }); return h('td', {}, inp); }));
    })));

  const unk = unknownLog.length ? h('div', { class: 'dim', style: { fontSize: '12px', fontFamily: 'ui-monospace, monospace', margin: '6px 0' } }, unknownLog.map(u => h('div', {}, `cmd 0x${u.cmd.toString(16)} · ${u.length} B · ${u.words.map(w => w.toString(16)).join(' ')}`))) : null;
  const glob = h('div', {}, globalsCache ? h('table', { class: 'table' }, h('tbody', {}, globalsCache.map(g => { const inp = h('input', { type: 'number', value: g.value, 'aria-label': `global ${g.id}`, onChange: () => api('globals', { id: g.id, value: Number(inp.value) }).then(() => toast('Sent.')).catch(fail) }); return h('tr', {}, h('td', {}, '0x' + g.id.toString(16)), h('td', { class: 'dim' }, g.id === 2 ? 'reference pitch (Hz)' : g.id === 8 ? 'current preset' : g.id === 9 ? 'current set' : ''), h('td', {}, inp)); }))) : h('button', { onClick: async () => { try { globalsCache = await api('globals'); renderAdvanced(root); } catch (e) { fail(e); } } }, 'Read global pedal settings'));
  root.replaceChildren(
    h('h3', { style: { fontSize: '13px', margin: '0 0 6px' } }, 'Learn setting'), learn, unk,
    h('div', { class: 'row' }, h('button', { onClick: () => download('hd500-nomes-de-ajustes.json', JSON.stringify(names, null, 2), 'application/json') }, 'Export names')),
    h('h3', { style: { fontSize: '13px', margin: '12px 0 6px' } }, 'Preset settings'),
    h('div', { style: { maxHeight: '230px', overflow: 'auto' } }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['id', 'name', 'offset', 'value'].map(t => h('th', {}, t)))), h('tbody', {}, [...known, ...other].map(row)))),
    h('h3', { style: { fontSize: '13px', margin: '12px 0 6px' } }, 'Global pedal settings'),
    h('p', { class: 'dim', style: { fontSize: '12px', margin: '0 0 6px' } }, 'These apply to the whole pedal, not the preset. Only 0x2 (tuning) has a confirmed meaning; change the others at your own risk.'), glob,
    h('h3', { style: { fontSize: '13px', margin: '12px 0 6px' } }, 'MIDI assignments (experimental)'),
    h('p', { class: 'dim', style: { fontSize: '12px', margin: '0 0 6px' } }, '14 records of 6 bytes per preset: FS/EXP → MIDI message. The meaning of each byte is still being mapped; changes are applied live.'),
    h('div', { style: { maxHeight: '240px', overflow: 'auto' } }, midi),
    h('h3', { style: { fontSize: '13px', margin: '12px 0 6px' } }, 'Preset body (4096 bytes)'),
    h('div', { class: 'hex' }, lines.join('\n')));
}
