import { openGlobals } from './global.js';
import { openBackups } from './backups.js';
import { openSetlist } from './setlist.js';
import { connectHelp } from './connect-help.js';
import { tapTempo, initTempoPill } from './tempo.js';
import { liveEdits } from './editing.js';
import { lang, langs, setLang, tr } from './i18n.js';
import { initTooltips, h, api, fail, toast, $, modal, menu, download, pickFile, bytesToB64, b64ToBytes } from './util.js';
import { S, onChange, notify, presetLabel } from './store.js';
import { renderChain, flashItem, isDragging, clearBlock } from './chain.js';
import { renderInspector, patchParam } from './inspector.js';
import { renderSetup, renderControllers, renderFootswitches, renderAdvanced, renderSidebar, resetSidebar, initSidebar, invalidate, flashFs, libraryProgress, learnSetup, learnUnknown, openDevTools } from './panels.js';
import { selectSlot } from './nav.js';
import { icon, buttonIcon } from './icons.js';

initTooltips();
new ResizeObserver(() => document.documentElement.style.setProperty('--toolbar-height', `${$('#top').getBoundingClientRect().height}px`)).observe($('#top'));

const TABS = { setup: renderSetup, controllers: renderControllers, fs: renderFootswitches };
let lastPreset = null, saving = false;

function render() {
  if(isDragging()) return;
  const st = S.st;
  const focused=document.activeElement, focusItem=focused?.closest('.block')?.dataset.item, focusPid=focused?.closest('[data-pid]')?.dataset.pid, focusLabel=focused?.getAttribute('aria-label'), focusPanel=focused?.closest('#inspector,#tabBody')?.id, focusSel=S.sel, focusLed=focused?.classList.contains('led');
  for (const id of ['save','undo','redo','prev','next','fileMenu','chainTrash']) $('#'+id).disabled=!st?.connected || (id==='save' && saving);
  $('#conn').classList.toggle('on', !!st?.connected);
  $('#connText').textContent = st?.connected ? 'POD HD500 connected' : 'disconnected';
  if (!st?.connected || !st.preset) { $('#chain').replaceChildren(h('div', { class: 'placeholder' }, icon('input'), h('p',{},'No connection to the pedal.'), h('button',{onClick:reconnect},'Try again'))); $('#inspector').replaceChildren(); $('#tabBody').replaceChildren(); $('#libraryList').replaceChildren(); resetSidebar(); return; }
  if(!$('#pname').isContentEditable) $('#pname').textContent = st.preset.name || '—';
  $('#pnum').textContent = `${S.st.setNames[st.selection.set]?.slice(0, 10) ?? 'Set ' + (st.selection.set + 1)} · ${presetLabel(st.selection.preset)}`;
  $('#dirty').hidden = !st.dirty; $('#save').classList.add('primary'); $('#save').setAttribute('aria-label',st.dirty?'Save unsaved changes':'Save to pedal');
  $('#revert').hidden = !st.dirty;
  $('#undo').disabled = !st.canUndo; $('#redo').disabled = !st.canRedo;
  renderSidebar();
  renderChain($('#chain'));
  renderInspector($('#inspector'));
  renderSide();
  if(focusItem) document.querySelector(`.block[data-item="${focusItem}"]${focusLed ? ' .led' : ''}`)?.focus({preventScroll:true});
  else if(focusPanel&&focusSel===S.sel) { const controls=[...$('#'+focusPanel).querySelectorAll('[aria-label]')]; const target=controls.find(el=>tr(el.getAttribute('aria-label'))===focusLabel&&(!focusPid||el.closest('[data-pid]')?.dataset.pid===focusPid));target?.focus({preventScroll:true}); }
  const key=`${st.selection.set}:${st.selection.preset}`; if(lastPreset && lastPreset!==key && !matchMedia('(prefers-reduced-motion: reduce)').matches) $('#chainWrap').animate([{opacity:.5,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});lastPreset=key;
  document.title = `${st.dirty ? '● ' : ''}${st.preset.name} — HD500 Editor`;
}
function renderSide() {
  if(!S.st?.preset) return;
  for (const b of $('#tabs').children) { b.setAttribute('aria-selected',String(b.dataset.tab===S.tab));b.tabIndex=b.dataset.tab===S.tab?0:-1; }
  $('#tabBody').setAttribute('aria-labelledby','tab-'+S.tab);
  TABS[S.tab]($('#tabBody'));
}
onChange(render);
function paintStatus(status = S.st) {
  if (!status || !S.st?.preset) return;
  Object.assign(S.st, { dirty: status.dirty, canUndo: status.canUndo, canRedo: status.canRedo, comparing: !!status.comparing });
  $('#dirty').hidden = !status.dirty; $('#revert').hidden = !status.dirty || !!status.comparing;
  $('#compare').hidden = !status.dirty; $('#compare').setAttribute('aria-pressed', String(!!status.comparing)); document.body.classList.toggle('comparing', !!status.comparing);
  $('#undo').disabled = !status.canUndo; $('#redo').disabled = !status.canRedo;
  $('#save').setAttribute('aria-label', status.dirty ? 'Save unsaved changes' : 'Save to pedal');
  document.title = `${status.dirty ? '● ' : ''}${S.st.preset.name} — HD500 Editor`;
}
document.addEventListener('local-edit', () => { if (S.st?.comparing) { S.st.comparing = false; } paintStatus({ ...S.st, dirty: true, comparing: false }); });
$('#compare').onclick = async () => { try { await liveEdits.flush(); const v = await api('compare', { on: !S.st?.comparing }); load(v); toast(v.comparing ? 'Hearing the saved version. Press Compare again to return to your edits.' : 'Back to your edits.'); } catch (e) { fail(e); } };

async function load(st) { if(!S.cat) S.cat=await api('catalog'); S.st = st; if (typeof st?.mcp === 'boolean') paintMcp(st.mcp); notify(); if (st?.preset) paintStatus(st); }
async function init() {
  try { S.cat = await api('catalog'); await load(await api('state')); } catch (e) {
    for(const id of ['save','undo','redo','prev','next','fileMenu','chainTrash']) $('#'+id).disabled=true;
    $('#connText').textContent = 'disconnected';
    $('#chain').replaceChildren(await connectHelp(e.message, reconnect));
  }
  const es = new EventSource('/api/events');
  es.onerror=()=>{ $('#conn').classList.remove('on'); $('#connText').textContent='server offline'; };
  es.onopen=()=>{ if(S.st) { $('#conn').classList.toggle('on',!!S.st.connected);$('#connText').textContent=S.st.connected?'POD HD500 connected':'disconnected'; } };
  es.addEventListener('state', async e => {
    if (liveEdits.pending) { await liveEdits.flush(); return load(await api('state')); }
    load(JSON.parse(e.data));
  });
  // AI (MCP) activity: a calm animated pill + a thin light across the top bar; touched blocks glow once.
  let aiHide = null;
  es.addEventListener('ai', e => {
    const d = JSON.parse(e.data), pill = $('#aiPill');
    clearTimeout(aiHide);
    if (d.status) { $('#aiStatus').textContent = d.status; pill.hidden = false; pill.classList.remove('leaving'); document.body.classList.add('ai-active'); }
    else { pill.classList.add('leaving'); document.body.classList.remove('ai-active'); aiHide = setTimeout(() => { pill.hidden = true; pill.classList.remove('leaving'); }, 900); }
    for (const id of d.items ?? []) { const el = document.querySelector(`.block[data-item="${id}"]`); if (el) { el.classList.remove('ai-flash'); void el.offsetWidth; el.classList.add('ai-flash'); } }
  });
  es.addEventListener('mcp', e => paintMcp(JSON.parse(e.data).enabled));
  es.addEventListener('history', e => { paintStatus(JSON.parse(e.data)); renderSidebar(); });
  es.addEventListener('edit-error', async e => { fail(new Error(JSON.parse(e.data).error)); await liveEdits.flush(); await load(await api('state')); });
  es.addEventListener('param', e => { const { item, id, value } = JSON.parse(e.data); if (liveEdits.ignores(`param:${item}:${id}`)) return; const it = S.st?.preset.items.find(i => i.id === item); const p = it?.params.find(p => p.id === id); if (p) p.value = value; patchParam(item, id, value); });
  es.addEventListener('active', e => { // alteração feita no pedal (footswitch)
    const { item, active } = JSON.parse(e.data); if (liveEdits.ignores(`active:${item}`)) return; const it = S.st?.preset.items.find(i => i.id === item); if (!it) return;
    it.active = active; notify(); flashItem(item); if (it.fs) flashFs(it.fs);
  });
  es.addEventListener('setup', e => { const ev = JSON.parse(e.data); if (liveEdits.ignores(`setup:${ev.id}`)) return; const set = S.st?.preset.settings.find(x => x.id === ev.id); if (set) set.value = ev.value;  { const m = S.st?.preset.mixer, k = ({ 44: 'levelA', 45: 'levelB', 46: 'panA', 47: 'panB' })[ev.id]; if (m && k) { m[k] = ev.value; if (S.sel === 'mixer') renderInspector($('#inspector')); } if (ev.id === 23 && S.st && typeof ev.value === 'number') { S.st.preset.tempo = ev.value; if (S.tab === 'setup') renderSide(); } if (ev.id === 56 && S.st) { S.st.preset.trails = ev.value === 1; if (S.sel === 'mixer') renderInspector($('#inspector')); } } learnSetup(ev); });
  es.addEventListener('unknown', e => learnUnknown(JSON.parse(e.data)));
  es.addEventListener('progress', e => libraryProgress(JSON.parse(e.data)));
}
async function reconnect() { try { if(!S.cat) S.cat=await api('catalog'); await load(await api('reconnect', {})); } catch (e) { fail(e); } }

// ---- topo
function paintMcp(on) {
  const b = $('#mcpBtn'); if (!b) return; S.mcp = on;
  b.setAttribute('aria-pressed', String(on)); b.classList.toggle('off', !on); buttonIcon(b, on ? 'sparkle' : 'sparkleOff');
  b.title = on ? 'MCP on: the AI can read and edit the pedal. Click to turn off.' : 'MCP off: the AI is blocked. Click to turn on.';
}
$('#mcpBtn').onclick = async () => { const next = !(S.mcp ?? true); try { const r = await api('mcp', { enabled: next }); paintMcp(r.enabled); toast(r.enabled ? 'MCP on: the AI can edit the pedal.' : 'MCP off: the AI is blocked.'); } catch (e) { fail(e); } };
paintMcp(true);
$('#live').onclick = () => { liveEdits.setLive(!liveEdits.live); $('#live').setAttribute('aria-checked', String(liveEdits.live)); $('#live').title = liveEdits.live ? 'Edits go to the pedal while you drag. Save still writes to its memory.' : 'Edits go to the pedal when you release the control.'; };
initSidebar();
const step = d => { if(S.st?.connected) return selectSlot(undefined, (S.st.selection.preset + d + S.cat.presets) % S.cat.presets); };
$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
$('#revert').onclick = () => { if (confirm('Discard changes and reload the preset stored in the pedal?')) api('select', { set: S.st.selection.set, preset: S.st.selection.preset }).catch(fail); };
function renamePreset() {
  if(!S.st?.preset || $('#pname').isContentEditable) return;
  const el=$('#pname'),old=S.st.preset.name;el.contentEditable='true';el.setAttribute('role','textbox');el.setAttribute('aria-label','Preset name');el.focus();
  const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  let cancelled=false;
  const finish=()=>{el.contentEditable='false';el.removeAttribute('role');el.removeAttribute('aria-label');el.removeEventListener('keydown',keys);el.removeEventListener('blur',finish);const name=cancelled?old:el.textContent.trim().slice(0,16);el.textContent=name||old;if(!cancelled&&name&&name!==old)api('edit',{op:'name',name}).catch(fail);};
  const keys=e=>{e.stopPropagation();if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();cancelled=e.key==='Escape';el.blur();} };el.addEventListener('keydown',keys);el.addEventListener('blur',finish);
}
$('#presetName').ondblclick=renamePreset;
$('#presetName').onkeydown=e=>{if(e.key==='Enter'&&!$('#pname').isContentEditable){e.preventDefault();renamePreset();}};
$('#presetName').title='Rename preset (double-click)';
$('#undo').onclick = () => api('edit', { op: 'undo' }).catch(fail); $('#redo').onclick = () => api('edit', { op: 'redo' }).catch(fail);
const save = async () => {
  if (!S.st?.connected || saving) return;
  saving=true; $('#save').disabled = true; buttonIcon($('#save'),'save','Saving…');
  try { const state=await api('save', {}); await load(state); invalidate(state.selection.set); toast('Preset saved to the pedal. Previous version backed up in backups/.'); } catch (e) { fail(e); }
  saving=false; $('#save').disabled = !S.st?.connected; buttonIcon($('#save'),'save','Save to pedal');
};
$('#save').onclick = save;
$('#tabs').addEventListener('keydown',e=>{ if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=[...$('#tabs').children],at=tabs.indexOf(e.target.closest('button'));const index=e.key==='Home'?0:e.key==='End'?2:(at+(e.key==='ArrowRight'?1:2))%3;e.preventDefault();e.stopPropagation();S.tab=tabs[index].dataset.tab;renderSide();tabs[index].focus();});
$('#tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t && t.dataset.tab !== S.tab) { S.tab = t.dataset.tab; renderSide(); const b = $('#tabBody'); b.classList.remove('enter'); void b.offsetWidth; b.classList.add('enter'); } });
$('#conn').onclick = () => { if (!S.st?.connected || !$('#conn').classList.contains('on')) reconnect(); };

addEventListener('keydown', e => {
  if (e.target.matches('input, textarea') || e.target.isContentEditable || $('#modal').hidden===false || document.querySelector('.menu') || e.defaultPrevented) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); api('edit', { op: e.shiftKey ? 'redo' : 'undo' }).catch(fail); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); api('edit', { op: 'redo' }).catch(fail); }
  else if (!mod && !e.altKey && e.key === 'ArrowRight' && !e.target.matches('svg, select')) step(1);
  else if (!mod && !e.altKey && e.key === 'ArrowLeft' && !e.target.matches('svg, select')) step(-1);
  else if (!mod && e.key.toLowerCase() === 'l') { openSidebar();$('#librarySearch').focus(); }
  else if (!mod && e.key.toLowerCase()==='b') toggleSidebar();
  else if(e.key==='Escape'&&document.body.classList.contains('sidebar-open')) closeSidebar();
});
init();

// ---- tema
const applyTheme = t => { document.documentElement.dataset.theme = t; buttonIcon($('#theme'),t === 'light' ? 'moon' : 'sun'); try { localStorage.setItem('hd500.theme', t); } catch {} };
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
  ['Print setlist…', openSetlist],
  ['Backups…', openBackups],
  ['Developer tools…', openDevTools],
  ['Help and shortcuts', showHelp],
  ...Object.entries(langs).filter(([k]) => k !== lang).map(([k, name]) => [name, () => setLang(k)]),
]); };

function showHelp() {
  const k = (a, b) => h('tr', {}, h('td', {}, h('kbd', {}, a)), h('td', {}, b));
  modal('Help', [
    h('p', {}, 'HD500 Editor is a free editor for the Line 6 POD HD500, built by reverse-engineering the USB protocol. It is not affiliated with Line 6.'),
    h('table', { class: 'table' }, k('Ctrl+S', 'Save to pedal'), k('Ctrl+Z / Ctrl+Y', 'Undo / redo'), k('← →', 'Previous / next preset'), k('L', 'Search all presets'), k('B','Toggle library'), k('Alt + arrows','Move selected effect'), k('Delete','Clear selected block'), k('Escape','Cancel drag'),
      k('Drag a block', 'Reorders and moves between lanes (before/after, paths A and B)'), k('Right-click a knob', 'Assign to EXP 1 / EXP 2'), k('Double-click a knob', 'Type a value'), k('Shift + drag', 'Fine adjustment')),
    h('p', { class: 'dim' }, 'Changes go to the pedal\'s edit buffer; "Save to pedal" writes to the current slot and keeps a backup of the previous content in backups/.'),
    h('p', { class: 'dim' }, 'Found out what a setting does? See the Advanced tab → Learn setting and share it on GitHub.')]);
}
$('#help').onclick = showHelp;
addEventListener('keydown', e => { if (e.key === '?' && !e.target.isContentEditable && !e.target.matches('input, textarea, select') && $('#modal').hidden) showHelp(); });

// ---- arrastar um .h5e para a janela carrega o preset no buffer
addEventListener('dragover', e => { if ([...e.dataTransfer?.types ?? []].includes('Files')) e.preventDefault(); });
addEventListener('drop', async e => {
  const f = e.dataTransfer?.files?.[0]; if (!f || !/\.h5e$/i.test(f.name)) return;
  if(e.defaultPrevented) return; e.preventDefault();
  try { await api('library/import-h5e', { data: bytesToB64(new Uint8Array(await f.arrayBuffer())), to: null }); toast(`"${f.name}" loaded into the buffer. Use "Save to pedal" to write it.`); } catch (x) { fail(x); }
});

// Local symbols and responsive library controls.
for(const [id,name] of Object.entries({sidebarToggle:'sidebar',prev:'left',next:'right',undo:'undo',redo:'redo',revert:'reread',fileMenu:'library',pedalSettings:'settings',compare:'swap',language:'globe',help:'help',libraryMore:'more',libraryClose:'close',colorLegend:'colors',chainTrash:'trash'})) buttonIcon($('#'+id),name);
buttonIcon($('#save'),'save','Save to pedal');$('#searchIcon').append(icon('search'));
for(const [tab,name] of Object.entries({setup:'input',controllers:'expression',fs:'footswitch'})) $('#tabs [data-tab="'+tab+'"]').prepend(icon(name));
$('#conn').setAttribute('aria-live','polite');
function closeSidebar() { document.body.classList.remove('sidebar-open');document.body.classList.add('sidebar-collapsed');$('#drawerBackdrop').hidden=true;$('#sidebarToggle').setAttribute('aria-expanded','false');$('#sidebarToggle').focus(); syncSidebar(); }
function openSidebar() { document.body.classList.remove('sidebar-collapsed');document.body.classList.add('sidebar-open');$('#drawerBackdrop').hidden=!matchMedia('(max-width: 799px)').matches;$('#sidebarToggle').setAttribute('aria-expanded','true'); syncSidebar(); if(innerWidth<800) $('#setSel').focus(); }
function toggleSidebar() { const expanded=innerWidth>=1200?!document.body.classList.contains('sidebar-collapsed'):document.body.classList.contains('sidebar-open');expanded?closeSidebar():openSidebar(); }
function syncSidebar() { const mobile=innerWidth<800,open=document.body.classList.contains('sidebar-open');$('#librarySidebar').inert=mobile&&!open; $('main').inert=mobile&&open;$('#drawerBackdrop').hidden=!mobile||!open;$('#sidebarToggle').setAttribute('aria-expanded',String(innerWidth>=1200?!document.body.classList.contains('sidebar-collapsed'):open)); }
$('#libraryClose').onclick=closeSidebar;$('#sidebarToggle').onclick=toggleSidebar;$('#drawerBackdrop').onclick=closeSidebar;addEventListener('resize',syncSidebar);syncSidebar();
$('#chainTrash').onclick=()=>clearBlock();
$('#pedalSettings').onclick = () => openGlobals();
$('#language').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();menu(r.left,r.bottom+4,Object.entries(langs).map(([key,name])=>[name,()=>setLang(key)]));};
$('#colorLegend').onclick=()=>{
  modal('Signal colors', [h('div', { class: 'legend-grid' },
    h('div', { class: 'legend-item' }, h('i', { class: 'legend-dot', style: { background: 'var(--path-a)' } }), 'Path A'),
    h('div', { class: 'legend-item' }, h('i', { class: 'legend-dot', style: { background: 'var(--path-b)' } }), 'Path B')),
    h('p', { class: 'dim' }, 'Blue selects. Green is on. Dashed cables mean bypass.')]);
};

$('#librarySidebar').addEventListener('keydown',e=>{
  if(e.key==='Escape'&&innerWidth<800){e.preventDefault();closeSidebar();return;}
  if(e.key==='Tab'&&innerWidth<800&&document.body.classList.contains('sidebar-open')){
    const nodes=[...$('#librarySidebar').querySelectorAll('button,input,select')].filter(n=>!n.disabled&&n.getClientRects().length),first=nodes[0],last=nodes.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
});

// The mixer is a node in the chain: select it (click or M) and its editor opens in the block inspector.
const openMixer = () => { S.sel = 'mixer'; notify(); document.querySelector('#inspector')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); };
addEventListener('keydown', e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && e.key.toLowerCase() === 't' && !e.target.matches('input, textarea, select, [contenteditable]')) tapTempo(); });
addEventListener('keydown', e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'm' && !e.target.matches('input, textarea, select, [contenteditable]')) openMixer(); });

// lápis visíveis: renomear o preset atual e o set atual
{ const a = $('#renameBtn'), b = $('#renameSetBtn'); a.append(icon('edit')); b.append(icon('edit'));
  a.onclick = () => renamePreset();
  b.onclick = async () => { const set = S.st.selection.set, n = prompt('New set name (up to 16 characters)', S.st.setNames[set]); if (n != null && n.trim()) { try { await api('library/rename-set', { set, name: n.trim() }); toast('Set renamed.'); } catch (e) { fail(e); } } }; }

// Soft edge fades on the signal chain when it scrolls horizontally (no hard-cut blocks at the card edge).
{
  const sc = document.querySelector('.chain-scroll');
  if (sc) {
    const chain = sc.querySelector('#chain');
    // Fit: tighten the layout in two steps before falling back to scrolling.
    const fit = () => { if (!chain) return; chain.classList.remove('compact', 'tight'); if (sc.scrollWidth > sc.clientWidth + 2) { chain.classList.add('compact'); if (sc.scrollWidth > sc.clientWidth + 2) chain.classList.add('tight'); } };
    const paint = () => { sc.dataset.fadeL = String(sc.scrollLeft > 4); sc.dataset.fadeR = String(sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4); };
    sc.addEventListener('scroll', paint, { passive: true });
    let raf = 0; const refit = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { fit(); paint(); }); };
    new ResizeObserver(refit).observe(sc); new MutationObserver(refit).observe(sc, { childList: true, subtree: true });
    refit();
  }
}

initTempoPill(document.querySelector('.canvas-toolbar > div'));
