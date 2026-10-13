import { lang, langs, setLang } from './i18n.js';
import { h, api, fail, toast, $, modal, menu, download, pickFile, bytesToB64, b64ToBytes } from './util.js';
import { S, onChange, notify, presetLabel } from './store.js';
import { renderChain, flashItem } from './chain.js';
import { renderInspector, patchParam } from './inspector.js';
import { renderSetup, renderFootswitches, renderLibrary, renderAdvanced, flashFs, libraryProgress, learnSetup, learnUnknown } from './panels.js';
import { pickPreset } from './picker.js';
import { selectSlot } from './nav.js';

const TABS = { setup: renderSetup, fs: renderFootswitches, library: renderLibrary, advanced: renderAdvanced };

function render() {
  const st = S.st;
  $('#conn').classList.toggle('on', !!st?.connected);
  $('#connText').textContent = st?.connected ? 'POD HD500 connected' : 'disconnected';
  if (!st?.connected || !st.preset) { $('#chain').replaceChildren(h('div', { class: 'placeholder' }, 'No connection to the pedal.')); return; }
  $('#pname').textContent = st.preset.name || '—';
  $('#pnum').textContent = `${S.st.setNames[st.selection.set]?.slice(0, 10) ?? 'Set ' + (st.selection.set + 1)} · ${presetLabel(st.selection.preset)}`;
  $('#dirty').hidden = !st.dirty; $('#save').classList.toggle('primary', !!st.dirty);
  $('#revert').hidden = !st.dirty;
  $('#undo').disabled = !st.canUndo; $('#redo').disabled = !st.canRedo;
  const sel = $('#setSel'); if (!sel.options.length || sel.options.length !== st.setNames.length) sel.replaceChildren(...st.setNames.map((n, i) => h('option', { value: i }, `${i + 1} · ${n}`)));
  sel.value = st.selection.set;
  renderChain($('#chain'));
  renderInspector($('#inspector'));
  renderSide();
  document.title = `${st.dirty ? '● ' : ''}${st.preset.name} — HD500 Editor`;
}
function renderSide() {
  for (const b of $('#tabs').children) b.setAttribute('aria-selected', b.dataset.tab === S.tab);
  TABS[S.tab]($('#tabBody'));
}
onChange(render);

async function load(st) { S.st = st; notify(); }
async function init() {
  S.cat = await api('catalog');
  try { await load(await api('state')); } catch (e) {
    $('#connText').textContent = 'disconnected';
    $('#chain').replaceChildren(h('div', { class: 'placeholder' }, h('b', {}, 'Could not talk to the pedal.'), h('br'), e.message, h('br'), h('br'), h('button', { onClick: reconnect }, 'Try again')));
  }
  const es = new EventSource('/api/events');
  es.addEventListener('state', e => load(JSON.parse(e.data)));
  es.addEventListener('param', e => { const { item, id, value } = JSON.parse(e.data); const it = S.st?.preset.items.find(i => i.id === item); const p = it?.params.find(p => p.id === id); if (p) p.value = value; patchParam(item, id, value); });
  es.addEventListener('active', e => { // alteração feita no pedal (footswitch)
    const { item, active } = JSON.parse(e.data), it = S.st?.preset.items.find(i => i.id === item); if (!it) return;
    it.active = active; notify(); flashItem(item); if (it.fs) flashFs(it.fs);
  });
  es.addEventListener('setup', e => { const ev = JSON.parse(e.data); const set = S.st?.preset.settings.find(x => x.id === ev.id); if (set) set.value = ev.value; learnSetup(ev); });
  es.addEventListener('unknown', e => learnUnknown(JSON.parse(e.data)));
  es.addEventListener('progress', e => libraryProgress(JSON.parse(e.data)));
}
async function reconnect() { try { await load(await api('reconnect', {})); } catch (e) { fail(e); } }

// ---- topo
$('#setSel').addEventListener('change', e => selectSlot(Number(e.target.value), 0));
const step = d => selectSlot(undefined, (S.st.selection.preset + d + S.cat.presets) % S.cat.presets);
$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
$('#presetName').onclick = () => pickPreset((set, preset) => selectSlot(set, preset));
$('#revert').onclick = () => { if (confirm('Discard changes and reload the preset stored in the pedal?')) api('select', { set: S.st.selection.set, preset: S.st.selection.preset }).catch(fail); };
$('#pname').addEventListener('dblclick', e => { e.stopPropagation(); const n = prompt('Preset name (up to 16 characters)', S.st.preset.name); if (n != null) api('edit', { op: 'name', name: n }).catch(fail); });
$('#undo').onclick = () => api('edit', { op: 'undo' }).catch(fail); $('#redo').onclick = () => api('edit', { op: 'redo' }).catch(fail);
const save = async () => {
  if (!S.st?.connected) return;
  $('#save').disabled = true; $('#save').textContent = 'Saving…';
  try { await api('save', {}); toast('Preset saved to the pedal. Previous version backed up in backups/.'); } catch (e) { fail(e); }
  $('#save').disabled = false; $('#save').textContent = 'Save to pedal';
};
$('#save').onclick = save;
$('#tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { S.tab = t.dataset.tab; renderSide(); } });
$('#conn').onclick = () => { if (!S.st?.connected) reconnect(); };

addEventListener('keydown', e => {
  if (e.target.matches('input, textarea') || e.target.isContentEditable) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); api('edit', { op: e.shiftKey ? 'redo' : 'undo' }).catch(fail); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); api('edit', { op: 'redo' }).catch(fail); }
  else if (!mod && e.key === 'ArrowRight' && !e.target.matches('svg, select')) step(1);
  else if (!mod && e.key === 'ArrowLeft' && !e.target.matches('svg, select')) step(-1);
  else if (!mod && e.key.toLowerCase() === 'l') $('#presetName').click();
});
init();

// ---- tema
const applyTheme = t => { document.documentElement.dataset.theme = t; $('#theme').textContent = t === 'light' ? '☾' : '☀'; try { localStorage.setItem('hd500.theme', t); } catch {} };
try { applyTheme(localStorage.getItem('hd500.theme') ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')); } catch {}
$('#theme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

// ---- menu Arquivo
async function importH5e() {
  const f = await pickFile('.h5e'); if (!f) return;
  try { await api('library/import-h5e', { data: bytesToB64(new Uint8Array(await f.arrayBuffer())), to: null }); toast('Preset loaded into the pedal\'s buffer. Use "Save to pedal" to write it.'); } catch (e) { fail(e); }
}
$('#fileMenu').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 4, [
  ['Import preset (.h5e) into the buffer…', importH5e],
  ['Export this preset (.h5e)', async () => { try { const j = await api('library/export-h5e', {}); download(`${j.name || 'preset'}.h5e`, b64ToBytes(j.data)); } catch (x) { fail(x); } }],
  ['Reconnect to the pedal', reconnect],
  ['Help and shortcuts', showHelp],
  ...Object.entries(langs).filter(([k]) => k !== lang).map(([k, name]) => [`🌐 ${name}`, () => setLang(k)]),
]); };

function showHelp() {
  const k = (a, b) => h('tr', {}, h('td', {}, h('kbd', {}, a)), h('td', {}, b));
  modal('Help', [
    h('p', {}, 'HD500 Editor is a free editor for the Line 6 POD HD500, built by reverse-engineering the USB protocol. It is not affiliated with Line 6.'),
    h('table', { class: 'table' }, k('Ctrl+S', 'Save to pedal'), k('Ctrl+Z / Ctrl+Y', 'Undo / redo'), k('← →', 'Previous / next preset'), k('L', 'Preset list'),
      k('Drag a block', 'Reorders and moves between lanes (before/after, paths A and B)'), k('Right-click a knob', 'Assign to EXP 1 / EXP 2'), k('Double-click a knob', 'Type a value'), k('Shift + drag', 'Fine adjustment')),
    h('p', { class: 'dim' }, 'Changes go to the pedal\'s edit buffer; "Save to pedal" writes to the current slot and keeps a backup of the previous content in backups/.'),
    h('p', { class: 'dim' }, 'Found out what a setting does? See the Advanced tab → Learn setting and share it on GitHub.')]);
}
$('#help').onclick = showHelp;
addEventListener('keydown', e => { if (e.key === '?' && !e.target.matches('input, textarea, select')) showHelp(); });

// ---- arrastar um .h5e para a janela carrega o preset no buffer
addEventListener('dragover', e => { if ([...e.dataTransfer?.types ?? []].includes('Files')) e.preventDefault(); });
addEventListener('drop', async e => {
  const f = e.dataTransfer?.files?.[0]; if (!f || !/\.h5e$/i.test(f.name)) return;
  e.preventDefault();
  try { await api('library/import-h5e', { data: bytesToB64(new Uint8Array(await f.arrayBuffer())), to: null }); toast(`"${f.name}" loaded into the buffer. Use "Save to pedal" to write it.`); } catch (x) { fail(x); }
});
