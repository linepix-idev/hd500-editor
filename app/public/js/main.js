import { lang, langs, setLang, tr } from './i18n.js';
import { h, api, fail, toast, $, modal, menu, download, pickFile, bytesToB64, b64ToBytes } from './util.js';
import { S, onChange, notify, presetLabel, GROUP_CLASS } from './store.js';
import { renderChain, flashItem, isDragging, clearBlock } from './chain.js';
import { renderInspector, patchParam } from './inspector.js';
import { renderSetup, renderMixer, renderFootswitches, renderAdvanced, renderSidebar, initSidebar, invalidate, flashFs, libraryProgress, learnSetup, learnUnknown } from './panels.js';
import { selectSlot } from './nav.js';
import { icon, buttonIcon, categoryIcon } from './icons.js';

const TABS = { setup: renderSetup, mixer: renderMixer, fs: renderFootswitches, advanced: renderAdvanced };
let lastPreset = null, saving = false;

function render() {
  if(isDragging()) return;
  const st = S.st;
  const focused=document.activeElement, focusItem=focused?.closest('.block')?.dataset.item, focusPid=focused?.closest('[data-pid]')?.dataset.pid, focusLabel=focused?.getAttribute('aria-label'), focusPanel=focused?.closest('#inspector,#tabBody')?.id, focusSel=S.sel, focusLed=focused?.classList.contains('led');
  for (const id of ['save','undo','redo','prev','next','fileMenu','chainTrash']) $('#'+id).disabled=!st?.connected || (id==='save' && saving);
  $('#conn').classList.toggle('on', !!st?.connected);
  $('#connText').textContent = st?.connected ? 'POD HD500 connected' : 'disconnected';
  if (!st?.connected || !st.preset) { $('#chain').replaceChildren(h('div', { class: 'placeholder' }, icon('input'), h('p',{},'No connection to the pedal.'), h('button',{onClick:reconnect},'Try again'))); $('#inspector').replaceChildren(); $('#tabBody').replaceChildren(); $('#libraryList').replaceChildren(); return; }
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
$('#inspector').addEventListener('knobend', notify);

async function load(st) { if(!S.cat) S.cat=await api('catalog'); S.st = st; notify(); }
async function init() {
  try { S.cat = await api('catalog'); await load(await api('state')); } catch (e) {
    for(const id of ['save','undo','redo','prev','next','fileMenu','chainTrash']) $('#'+id).disabled=true;
    $('#connText').textContent = 'disconnected';
    $('#chain').replaceChildren(h('div', { class: 'placeholder' }, h('b', {}, 'Could not talk to the pedal.'), h('br'), e.message, h('br'), h('br'), h('button', { onClick: reconnect }, 'Try again')));
  }
  const es = new EventSource('/api/events');
  es.onerror=()=>{ $('#conn').classList.remove('on'); $('#connText').textContent='server offline'; };
  es.onopen=()=>{ if(S.st) { $('#conn').classList.toggle('on',!!S.st.connected);$('#connText').textContent=S.st.connected?'POD HD500 connected':'disconnected'; } };
  es.addEventListener('state', e => load(JSON.parse(e.data)));
  es.addEventListener('param', e => { const { item, id, value } = JSON.parse(e.data); const it = S.st?.preset.items.find(i => i.id === item); const p = it?.params.find(p => p.id === id); if (p) p.value = value; patchParam(item, id, value); });
  es.addEventListener('active', e => { // alteração feita no pedal (footswitch)
    const { item, active } = JSON.parse(e.data), it = S.st?.preset.items.find(i => i.id === item); if (!it) return;
    it.active = active; notify(); flashItem(item); if (it.fs) flashFs(it.fs);
  });
  es.addEventListener('setup', e => { const ev = JSON.parse(e.data); const set = S.st?.preset.settings.find(x => x.id === ev.id); if (set) set.value = ev.value;  { const m = S.st?.preset.mixer, k = ({ 44: 'levelA', 45: 'levelB', 46: 'panA', 47: 'panB' })[ev.id]; if (m && k) { m[k] = ev.value; if (S.tab === 'mixer') renderSide(); } if (ev.id === 56 && S.st) { S.st.preset.trails = ev.value === 1; if (S.tab === 'mixer') renderSide(); } } learnSetup(ev); });
  es.addEventListener('unknown', e => learnUnknown(JSON.parse(e.data)));
  es.addEventListener('progress', e => libraryProgress(JSON.parse(e.data)));
}
async function reconnect() { try { if(!S.cat) S.cat=await api('catalog'); await load(await api('reconnect', {})); } catch (e) { fail(e); } }

// ---- topo
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
$('#tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { S.tab = t.dataset.tab; renderSide(); } });
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
for(const [id,name] of Object.entries({sidebarToggle:'sidebar',prev:'left',next:'right',undo:'undo',redo:'redo',revert:'reread',fileMenu:'library',language:'globe',help:'help',libraryMore:'more',libraryClose:'close',colorLegend:'colors',chainTrash:'trash'})) buttonIcon($('#'+id),name);
buttonIcon($('#save'),'save','Save to pedal');$('#searchIcon').append(icon('search'));
for(const [tab,name] of Object.entries({setup:'input',mixer:'mixer',fs:'footswitch',advanced:'settings'})) $('#tabs [data-tab="'+tab+'"]').prepend(icon(name));
$('#conn').setAttribute('aria-live','polite');
function closeSidebar() { document.body.classList.remove('sidebar-open');document.body.classList.add('sidebar-collapsed');$('#drawerBackdrop').hidden=true;$('#sidebarToggle').setAttribute('aria-expanded','false');$('#sidebarToggle').focus(); syncSidebar(); }
function openSidebar() { document.body.classList.remove('sidebar-collapsed');document.body.classList.add('sidebar-open');$('#drawerBackdrop').hidden=!matchMedia('(max-width: 799px)').matches;$('#sidebarToggle').setAttribute('aria-expanded','true'); syncSidebar(); if(innerWidth<800) $('#setSel').focus(); }
function toggleSidebar() { const expanded=innerWidth>=1200?!document.body.classList.contains('sidebar-collapsed'):document.body.classList.contains('sidebar-open');expanded?closeSidebar():openSidebar(); }
function syncSidebar() { const mobile=innerWidth<800,open=document.body.classList.contains('sidebar-open');$('#librarySidebar').inert=mobile&&!open; $('main').inert=mobile&&open;$('#drawerBackdrop').hidden=!mobile||!open;$('#sidebarToggle').setAttribute('aria-expanded',String(innerWidth>=1200?!document.body.classList.contains('sidebar-collapsed'):open)); }
$('#libraryClose').onclick=closeSidebar;$('#sidebarToggle').onclick=toggleSidebar;$('#drawerBackdrop').onclick=closeSidebar;addEventListener('resize',syncSidebar);syncSidebar();
$('#chainTrash').onclick=()=>clearBlock();
$('#language').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();menu(r.left,r.bottom+4,Object.entries(langs).map(([key,name])=>[name,()=>setLang(key)]));};
$('#colorLegend').onclick=()=>{
  const groups=[{kind:'amp',group:'Amp'},{kind:'cab',group:'Cab'},...['Dynamics','Distortion','Modulation','Delay','Reverb','Filter','Pitch','Preamp+EQ','Volume/Pan','Wah','FX Loop'].map(group=>({kind:'fx',group}))];
  modal('Signal colors',[h('p',{class:'dim'},'Color follows the sound: block, cable and knob.'),h('div',{class:'legend-grid'},groups.map(it=>h('div',{class:`legend-item ${it.kind} ${GROUP_CLASS(it.group)}`},icon(categoryIcon(it)),h('span',{},it.group)))),h('p',{class:'dim'},'Orange selects. Green is on. Dashed cables mean bypass.')]);
};

$('#librarySidebar').addEventListener('keydown',e=>{
  if(e.key==='Escape'&&innerWidth<800){e.preventDefault();closeSidebar();return;}
  if(e.key==='Tab'&&innerWidth<800&&document.body.classList.contains('sidebar-open')){
    const nodes=[...$('#librarySidebar').querySelectorAll('button,input,select')].filter(n=>!n.disabled&&n.getClientRects().length),first=nodes[0],last=nodes.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
});

// atalho para o Mixer: abre a aba e leva o painel para a tela (ele fica abaixo da cadeia em telas baixas)
const openMixer = () => { S.tab = 'mixer'; renderSide(); document.querySelector('#side')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); };
{ const b = $('#openMixer'); b.append(icon('mixer'), document.createTextNode('Mixer')); b.onclick = openMixer; }
addEventListener('keydown', e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'm' && !e.target.matches('input, textarea, select, [contenteditable]')) openMixer(); });

// lápis visíveis: renomear o preset atual e o set atual
{ const a = $('#renameBtn'), b = $('#renameSetBtn'); a.append(icon('edit')); b.append(icon('edit'));
  a.onclick = () => renamePreset();
  b.onclick = async () => { const set = S.st.selection.set, n = prompt('New set name (up to 16 characters)', S.st.setNames[set]); if (n != null && n.trim()) { try { await api('library/rename-set', { set, name: n.trim() }); toast('Set renamed.'); } catch (e) { fail(e); } } }; }
