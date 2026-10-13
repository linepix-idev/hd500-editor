import { throttle, h, api, fail, toast, menu, modal, download, pickFile, b64ToBytes, bytesToB64, $ } from './util.js';
import { S, notify, presetLabel, GROUP_CLASS } from './store.js';
import { edit, fmt } from './params.js';
import { pickDestination } from './picker.js';
import { selectSlot } from './nav.js';
import { icon } from './icons.js';
import { tr } from './i18n.js';

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


// ---------------------------------------------------------------------------------------- Mixer
// Níveis (dB, −60 = mudo … +12) e pans (−1 … +1) dos caminhos A e B + Trails. Ajustes 0x2c–0x2f e 0x38 do preset.
const MIX = { A: { level: 0x2c, pan: 0x2e, key: ['levelA', 'panA'] }, B: { level: 0x2d, pan: 0x2f, key: ['levelB', 'panB'] } };
const fmtDb = v => (v <= -59.9 ? 'Mute' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`);
const fmtPan = v => (Math.abs(v) < 0.005 ? 'Center' : `${v < 0 ? 'L' : 'R'} ${Math.round(Math.abs(v) * 100)}`);
const remembered = { A: 0, B: 0 };
export function renderMixer(root) {
  const p = S.st.preset, m = p.mixer;
  const send = (id, value) => edit('setupF', { id, value }).catch(fail);
  const path = which => {
    const spec = MIX[which], [lk, pk] = spec.key;
    const dbOut = h('output', { class: 'mx-db' }, fmtDb(m[lk])), panOut = h('output', { class: 'mx-pan' }, fmtPan(m[pk]));
    const fader = h('input', { type: 'range', class: 'mx-fader', min: -60, max: 12, step: 0.5, value: m[lk], 'aria-label': `Path ${which} level`, orient: 'vertical' });
    fader.oninput = () => { m[lk] = Number(fader.value); dbOut.textContent = fmtDb(m[lk]); mute.setAttribute('aria-pressed', String(m[lk] <= -59.9)); throttle(`mx${spec.level}`, () => send(spec.level, m[lk])); };
    const pan = h('input', { type: 'range', class: 'mx-panslider', min: -1, max: 1, step: 0.01, value: m[pk], 'aria-label': `Path ${which} pan` });
    pan.oninput = () => { m[pk] = Number(pan.value); panOut.textContent = fmtPan(m[pk]); throttle(`mx${spec.pan}`, () => send(spec.pan, m[pk])); };
    pan.ondblclick = () => { pan.value = which === 'A' ? -1 : 1; pan.oninput(); };
    const mute = h('button', { class: 'mx-mute', 'aria-pressed': String(m[lk] <= -59.9), title: 'Mute this path', onClick: () => {
      if (m[lk] > -59.9) { remembered[which] = m[lk]; m[lk] = -60; } else m[lk] = remembered[which] || 0;
      fader.value = m[lk]; fader.oninput();
    } }, 'Mute');
    return h('section', { class: `mx-path mx-${which}` },
      h('header', {}, h('b', {}, `Path ${which}`), h('span', { class: 'dim' }, which === 'A' ? 'Input 1' : 'Input 2')),
      h('div', { class: 'mx-faderwrap' }, h('div', { class: 'mx-scale', 'aria-hidden': 'true' }, [[12, '+12'], [0, '0'], [-12, '−12'], [-24, '−24'], [-36, '−36'], [-48, '−48'], [-60, 'Mute']].map(([v, t]) => h('i', { style: { top: `${(12 - v) / 72 * 100}%` } }, t))), fader),
      dbOut, mute,
      h('label', { class: 'mx-panlabel' }, h('span', {}, 'Pan'), pan, panOut));
  };
  const trails = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(p.trails), 'aria-label': 'Trails', onClick: () => {
    p.trails = !p.trails; trails.setAttribute('aria-checked', String(p.trails)); edit('setup', { id: 0x38, value: p.trails ? 1 : 0 }).catch(fail);
  } });
  root.replaceChildren(
    h('div', { class: 'mx' }, path('A'), path('B')),
    h('div', { class: 'row mx-trails' }, h('div', {}, h('b', {}, 'Trails'), h('p', { class: 'dim', style: { margin: '2px 0 0', fontSize: '12px' } }, 'Delay and reverb tails keep ringing after the effect is turned off.')), trails),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Double-click a pan slider to reset it. Levels run from Mute to +12 dB. Changes made on the pedal show up here live.'));
}


// ---------------------------------------------------------------------------------------- Controladores (pedais de expressão)
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
export function renderControllers(root) {
  const items = S.st.preset.items.filter(i => !i.empty && i.params.some(p => p.setup == null && !p.cab));
  const rows = items.flatMap(it => it.params.filter(p => p.ctl && p.setup == null && !p.cab).map(p => ({ it, p })));
  const ctlSel = (cur, onPick) => { const sel = h('select', { 'aria-label': 'Controller' }, S.cat.ctl.map((n, i) => h('option', { value: i }, i === 0 ? 'Off' : n))); sel.value = cur; sel.onchange = () => onPick(Number(sel.value)); return sel; };
  const range = (it, p) => {
    const out = h('span', { class: 'dim' }, `${fmt(p, p.lo)} → ${fmt(p, p.hi)}`);
    const mk = which => { const i = h('input', { type: 'range', min: 0, max: 1, step: 0.005, value: p[which], 'aria-label': `${p.name} ${which === 'lo' ? 'heel' : 'toe'}` });
      i.oninput = () => { p[which] = Number(i.value); out.textContent = `${fmt(p, p.lo)} → ${fmt(p, p.hi)}`; throttle(`rg${it.id}.${p.index}`, () => edit('range', { item: it.id, index: p.index, lo: p.lo, hi: p.hi }).catch(fail)); }; return i; };
    return h('div', { class: 'ctl-range' }, h('small', {}, 'heel'), mk('lo'), h('small', {}, 'toe'), mk('hi'), out);
  };
  const list = rows.length ? rows.map(({ it, p }) => h('div', { class: 'ctl-row' },
    h('div', { class: 'ctl-name' }, h('b', {}, it.model), h('span', { class: 'dim' }, p.name)),
    ctlSel(p.ctl, c => edit('ctl', { item: it.id, index: p.index, ctl: c, lo: c ? p.lo : p.value, hi: c ? p.hi : p.value }).catch(fail)), range(it, p)))
    : [h('p', { class: 'dim' }, 'No parameter is assigned to an expression pedal yet.')];
  const blockSel = h('select', { 'aria-label': 'Block' }, items.map(i => h('option', { value: i.id }, i.model)));
  const paramSel = h('select', { 'aria-label': 'Parameter' }); const addCtl = h('select', { 'aria-label': 'Controller' }, S.cat.ctl.slice(1).map((n, i) => h('option', { value: i + 1 }, n)));
  const fill = () => { const it = items.find(i => i.id === Number(blockSel.value)); paramSel.replaceChildren(...(it?.params ?? []).filter(p => p.setup == null && !p.cab).map(p => h('option', { value: p.index }, p.name))); };
  blockSel.onchange = fill; fill();
  const add = h('button', { class: 'primary', onClick: () => { const it = items.find(i => i.id === Number(blockSel.value)), p = it?.params.find(x => x.index === Number(paramSel.value)); if (p) edit('ctl', { item: it.id, index: p.index, ctl: Number(addCtl.value), lo: 0, hi: 1 }).catch(fail); } }, 'Assign');
  root.replaceChildren(
    h('p', { class: 'dim', style: { fontSize: '12px', margin: '0 0 10px' } }, 'Assign any parameter to EXP 1 or EXP 2, with its heel and toe values. Right-click a knob for a shortcut. A model change discards its assignments.'),
    h('div', { class: 'ctl-list' }, list),
    h('h3', { style: { fontSize: '13px', margin: '14px 0 6px' } }, 'Add an assignment'),
    h('div', { class: 'row' }, blockSel, paramSel, addCtl, add));
}

// ---------------------------------------------------------------------------------------- Footswitches
export function renderFootswitches(root) {
  const its = S.st.preset.items.filter(i => i.kind === 'fx' && !i.empty);
  const tile = (fs) => {
    const assigned = its.filter(i => i.fs === fs), on = assigned.some(i => i.active);
    const b = h('button', { class: `fsbtn ${on ? 'hot' : ''} ${fs === 9 ? 'exp' : ''}`, dataset: { fs }, 'aria-pressed': String(on), title: 'Click: each assigned block toggles. Drag a block from the chain to assign it.',
      onClick: () => { assigned.forEach(i => { i.active = !i.active; edit('active', { item: i.id, active: i.active }).catch(fail); }); notify(); } },
      icon(fs === 9 ? 'expression' : 'footswitch'), h('b', {}, S.cat.fs[fs]), assigned.length > 1 ? h('em', { class: 'multi-tag', title: 'Several blocks: each one toggles' }, 'Multi') : null, assigned.length ? assigned.map(i => h('span', { class: `fs-chip ${GROUP_CLASS(i.group)}`, title: i.model }, i.model)) : h('small', {}, 'free'));
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
const L = { multi: new Set(), multiSet: null, lastMulti: null, set: null, names: new Map(), pending: new Map(), errors: new Map(), versions: new Map(), queue: Promise.resolve(), search: '', generation: 0 };
let sidebarSignature = '', selectionSet = null;
function Slot(set, i, name) {
  const cur = set === S.st.selection.set && i === S.st.selection.preset;
  const b = h('button', { class: `slot ${cur ? 'cur' : ''} ${name == null ? 'skeleton' : ''} ${L.multiSet === set && L.multi.has(i) ? 'multi' : ''}`, dataset: { set, preset: i }, 'aria-current': cur ? 'true' : 'false', 'aria-label': `${presetLabel(i)} · ${name ?? tr('Loading…')}`, draggable: true, title: name ?? '', onClick: async e => { if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleMulti(set, i, e.shiftKey); return; } L.multi.clear(); await selectSlot(set, i); if (!S.st?.dirty && matchMedia('(max-width: 799px)').matches) closeDrawer(); },
    onDblclick: e => { e.preventDefault(); renameSlot(set, i); }, onContextmenu: e => { e.preventDefault(); slotMenu(e, set, i); } }, h('i', {}, presetLabel(i)), h('span', {}, cur && S.st.dirty ? S.st.preset.name : name ?? (cur ? S.st.preset.name : '—')), cur ? h('span', { class: S.st.dirty ? 'modified-mark' : 'loaded-mark', 'aria-label': S.st.dirty ? 'Unsaved changes' : 'Loaded preset' }, S.st.dirty ? '●' : '') : null);
  b.addEventListener('dragstart', e => e.dataTransfer.setData('application/x-slot', JSON.stringify({ set, preset: i, multi: L.multiSet === set && L.multi.has(i) ? [...L.multi] : null })));
  b.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-slot') || e.dataTransfer.types.includes('Files')) { e.preventDefault(); b.classList.add('dragover'); } });
  b.addEventListener('dragleave', () => b.classList.remove('dragover'));
  b.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation(); b.classList.remove('dragover');
    const f = e.dataTransfer.files?.[0];
    try {
      if (f) { if (!/\.h5e$/i.test(f.name)) throw new Error('Choose an .h5e preset file.'); if (confirm(`Import “${f.name}” to ${presetLabel(i)}? The destination will be replaced (a backup is kept).`)) await importH5eFile(f, { set, preset: i }); }
      else await dropSlot(JSON.parse(e.dataTransfer.getData('application/x-slot')), set, i, e);
    } catch (err) { fail(err); }
  });
  return b;
}
// Soltar um preset sobre outro, como no editor oficial: mesmo set = mover (inserir); Shift = trocar; Ctrl/Alt = copiar; outro set = copiar.
async function dropSlot(from, set, i, e) {
  const label = p => presetLabel(p);
  if (from.multi?.length > 1 && from.set !== set) {
    if (!confirm(`Copy ${from.multi.length} presets from set ${from.set + 1} into set ${set + 1}, same positions? The destinations will be replaced (a backup is kept).`)) return;
    for (const p of from.multi) await api('library/copy', { from: { set: from.set, preset: p }, to: { set, preset: p } });
    toast('Copied.'); invalidate(set); return;
  }
  if (from.set === set && from.preset === i) return;
  if (from.set !== set || e.ctrlKey || e.altKey || e.metaKey) {
    if (!confirm(`Copy ${label(from.preset)} (set ${from.set + 1}) to ${label(i)} (set ${set + 1})? The destination will be replaced (a backup is kept).`)) return;
    await api('library/copy', { from: { set: from.set, preset: from.preset }, to: { set, preset: i } }); toast('Copied.'); invalidate(set); return;
  }
  if (e.shiftKey) {
    if (!confirm(`Swap ${label(from.preset)} and ${label(i)}?`)) return;
    await api('library/swap', { a: { set, preset: from.preset }, b: { set, preset: i } }); toast('Swapped.'); invalidate(set); return;
  }
  if (!confirm(`Move ${label(from.preset)} to ${label(i)}? The presets in between shift by one position (backups are kept).`)) return;
  await api('library/move', { set, from: from.preset, to: i }); toast('Moved.'); invalidate(set);
}
function toggleMulti(set, i, range) {
  if (L.multiSet !== set) { L.multi.clear(); L.multiSet = set; }
  if (range && L.lastMulti != null) { const [a, b] = [Math.min(L.lastMulti, i), Math.max(L.lastMulti, i)]; for (let k = a; k <= b; k++) L.multi.add(k); }
  else if (L.multi.has(i)) L.multi.delete(i); else L.multi.add(i);
  L.lastMulti = i; sidebarSignature = ''; renderSidebar();
}
export const invalidate = set => { if (set == null) { L.names.clear(); L.errors.clear(); for(let i=0;i<8;i++) L.versions.set(i,(L.versions.get(i)??0)+1); } else { L.names.delete(set); L.errors.delete(set); L.versions.set(set,(L.versions.get(set)??0)+1); } sidebarSignature=''; notify(); if(L.search) queueMicrotask(()=>searchSets(++L.generation)); };
async function renameSlot(set, i) {
  const cur = L.names.get(set)?.[i] ?? (set === S.st.selection.set && i === S.st.selection.preset ? S.st.preset.name : '');
  const n = prompt(`Rename ${presetLabel(i)} (up to 16 characters)`, cur); if (n == null || !n.trim() || n.trim() === cur) return;
  try { const r = await api('library/rename-slot', { set, preset: i, name: n.trim() }); toast(r.current ? 'Renamed in the edit buffer. Save to pedal to keep it.' : 'Preset renamed.'); invalidate(set); } catch (x) { fail(x); }
}
function slotMenu(e, set, i) {
  const at = { set, preset: i };
  menu(e.clientX, e.clientY, [
    ['Load', () => selectSlot(set, i)],
    ['Rename…', () => renameSlot(set, i)],
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
  try { const r = await api('library/import', { bundle: b, renameSets: confirm('Also restore the set names?') }); toast(`${r.written} presets written.`); invalidate(); } catch (e) { fail(e); }
}
export function libraryProgress({ done, total }) {
  const bar = $('#libbar'); if (!bar) return;
  bar.hidden = false; const value = Math.round(done / total * 100);
  bar.firstChild.style.width = value + '%'; bar.setAttribute('aria-valuenow', value);
  if (done >= total) setTimeout(() => { if (!L.pending.size) bar.hidden = true; }, 400);
}
function closeDrawer() { $('#drawerBackdrop').click(); }
async function namesFor(set) {
  if(L.names.has(set)) return L.names.get(set);
  if(L.pending.has(set)) return L.pending.get(set);
  const version=L.versions.get(set)??0;
  const job=L.queue.catch(()=>{}).then(async()=>{
    $('#libbar').hidden=false; $('#libbar').firstChild.style.width='8%';
    try { const names=await api('library/slots',{set}); if((L.versions.get(set)??0)===version) { L.names.set(set,names); L.errors.delete(set); } return names; }
    catch(e){L.errors.set(set,e.message);throw e;}
  }).finally(()=>{ L.pending.delete(set); renderSidebar(); if(!L.pending.size) $('#libbar').hidden=true; });
  L.pending.set(set,job); L.queue=job; return job;
}
async function searchSets(generation) {
  for(let set=0;set<S.cat.sets;set++) {
    if(generation!==L.generation||!L.search) break;
    if(!L.names.has(set)&&!L.errors.has(set)) try{await namesFor(set);}catch{}
  }
  renderSidebar();
}
export function renderSidebar() {
  if(!S.st?.preset) return;
  const selected=S.st.selection;
  if(L.set==null || (selectionSet!=null&&selectionSet!==selected.set)) L.set=selected.set;
  selectionSet=selected.set;
  const sel=$('#setSel');
  if(sel.options.length!==S.st.setNames.length || [...sel.options].some((o,i)=>o.textContent!==`${i+1} · ${S.st.setNames[i]}`)) sel.replaceChildren(...S.st.setNames.map((n,i)=>h('option',{value:i},`${i+1} · ${n}`)));
  sel.value=L.set;
  if(!L.search && !L.names.has(L.set) && !L.pending.has(L.set) && !L.errors.has(L.set)) queueMicrotask(()=>namesFor(L.set).catch(()=>{}));
  const signature=JSON.stringify([L.set,L.search,[...L.names],selected,S.st.dirty,S.st.preset.name,[...L.errors],L.pending.size]);
  if(signature===sidebarSignature) return; sidebarSignature=signature;
  const root=$('#libraryList'),focused=document.activeElement?.closest('.slot'),focusKey=focused?`${focused.dataset.set}:${focused.dataset.preset}`:null,scroll=root.scrollTop;
  const content=[];
  if(L.search) {
    for(let set=0;set<S.cat.sets;set++) {
      const matches=L.names.get(set)?.map((name,i)=>({name,i})).filter(x=>x.name.toLowerCase().includes(L.search));
      if(matches?.length) content.push(h('h3',{class:'bank-title'},S.st.setNames[set]),...matches.map(x=>Slot(set,x.i,x.name)));
    }
    if(!content.length) content.push(h('p',{class:'placeholder'},L.names.size<S.cat.sets?'Searching sets…':'No presets found.'));
    if(L.names.size<S.cat.sets) content.push(h('p',{class:'dim',style:{fontSize:'11px',padding:'8px'}},'Searching sets…'));
    if(L.errors.size) content.push(h('button',{onClick:()=>{L.errors.clear();searchSets(++L.generation);}},'Try again'));
  } else {
    const names=L.names.get(L.set);
    if(L.errors.has(L.set)) content.push(h('p',{class:'dim'},'Could not read preset names.'),h('button',{onClick:()=>{L.errors.delete(L.set);namesFor(L.set).catch(()=>{});}},'Try again'));
    for(let bank=0;bank<16;bank++) content.push(h('h3',{class:'bank-title'},`${tr('Bank')} ${bank+1}`),...Array.from({length:4},(_,letter)=>{const i=bank*4+letter;return Slot(L.set,i,names?.[i]);}));
  }
  root.replaceChildren(...content); root.scrollTop=scroll;
  if(focusKey){const [set,preset]=focusKey.split(':');root.querySelector(`[data-set="${set}"][data-preset="${preset}"]`)?.focus({preventScroll:true});}
}
export function initSidebar() {
  $('#setSel').onchange=()=>{L.set=Number($('#setSel').value);L.search='';$('#librarySearch').value='';L.generation++;renderSidebar();};
  let debounce;
  $('#librarySearch').oninput=e=>{L.search=e.target.value.trim().toLowerCase(); const generation=++L.generation;renderSidebar();clearTimeout(debounce);if(L.search) debounce=setTimeout(()=>searchSets(generation),240);};
  $('#libraryList').addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const rows=[...$('#libraryList').querySelectorAll('.slot')],at=rows.indexOf(e.target.closest('.slot'));
    const next=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,at+(e.key==='ArrowDown'?1:-1)));
    e.preventDefault();e.stopPropagation();rows[next]?.focus();
  });
  $('#libraryMore').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();menu(r.left,r.bottom+5,[
    ['Re-read names',()=>{invalidate(L.set);namesFor(L.set).catch(()=>{});}],
    ['Rename set',async()=>{const name=prompt('New set name (up to 16 characters)',S.st.setNames[L.set]);if(name!=null)try{await api('library/rename-set',{set:L.set,name});}catch(e){fail(e);}}],
    ['Export set',exportSet],['Export all',exportAll],['Import bundle…',importBundle],['Import .h5e…',importH5e],['Export list (CSV)',exportList],
  ]);};
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
