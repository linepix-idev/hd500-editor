import { h, api, fail, menu, toast } from './util.js';
import { pickModel } from './picker.js';
import { S, notify, GROUP_CLASS } from './store.js';

const LANE = { pre: 0, aPre: 1, bPre: 2, aPost: 3, bPost: 4, post: 5 };
const LANE_KEYS = ['pre', 'aPre', 'bPre', 'aPost', 'bPost', 'post'];
let dragId = null;

const EMPTY = { amp: 0x7ffff, cab: 0x7ffff, fx: 0x20dffff };
const edit = (op, a) => api('edit', { op, ...a });
const settle = async (id, type) => { for (let i = 0; i < 25; i++) { if (S.st.preset.items.find(x => x.id === id)?.type === type) return; await new Promise(r => setTimeout(r, 100)); } };

async function pasteBlock(it) {
  const c = S.clip; if (!c) return toast('Nothing copied yet.', true);
  if (c.kind !== it.kind) return toast(`You can only paste ${c.kind === 'fx' ? 'effects into effect slots' : c.kind === 'amp' ? 'amps into amp slots' : 'cabs into cab slots'}.`, true);
  try {
    if (it.type !== c.type) { await edit('model', { item: it.id, type: c.type }); await settle(it.id, c.type); }
    const cur = S.st.preset.items.find(x => x.id === it.id);
    for (const p of c.params) { const t = cur.params.find(x => x.index === p.index); if (t && p.value != null && t.setup == null) await edit(t.cab ? 'cabParam' : 'param', { item: it.id, index: t.index, id: t.id, value: p.value }); }
    await edit('active', { item: it.id, active: c.active }); toast(`Pasted: ${c.model}`);
  } catch (e) { fail(e); }
}
function blockMenu(e, it) {
  e.preventDefault(); S.sel = it.id; notify();
  const empty = it.empty;
  menu(e.clientX, e.clientY, [
    ['Change model…', () => pickModel(it)],
    empty ? null : ['Copy block', () => { S.clip = { kind: it.kind, type: it.type, model: it.model, active: it.active, params: it.params.filter(p => p.setup == null).map(p => ({ index: p.index, value: p.value })) }; toast(`Copied: ${it.model}`); }],
    S.clip && S.clip.kind === it.kind ? [`Paste “${S.clip.model}”`, () => pasteBlock(it)] : null,
    empty ? null : [it.active ? 'Turn off' : 'Turn on', () => { it.active = !it.active; notify(); edit('active', { item: it.id, active: it.active }).catch(fail); }],
    it.kind === 'fx' && !empty ? ['No footswitch', () => edit('fs', { item: it.id, fs: 0 }).catch(fail)] : null,
    empty ? null : ['Clear block', () => edit('model', { item: it.id, type: EMPTY[it.kind] }).catch(fail)],
  ]);
}

function Block(it) {
  const fsName = it.fs ? S.cat.fs[it.fs] : null;
  if (it.kind === 'fx' && it.empty) {
    return h('div', { class: `block emptyslot ${S.sel === it.id ? 'sel' : ''}`, draggable: true, dataset: { item: it.id }, title: 'Empty effect slot — click to choose a model',
      onClick: () => { S.sel = it.id; notify(); }, onContextmenu: e => blockMenu(e, it), onDragstart: e => startDrag(e, it), onDragend: endDrag }, '＋');
  }
  if (it.kind !== 'fx' && it.empty) {
    return h('div', { class: `block ${it.kind} emptyslot ${S.sel === it.id ? 'sel' : ''}`, dataset: { item: it.id }, title: 'Empty — click to choose',
      onClick: () => { S.sel = it.id; notify(); }, onContextmenu: e => blockMenu(e, it) }, h('span', {}, it.kind === 'amp' ? 'Amp ＋' : 'Cab ＋'));
  }
  const led = h('button', { class: `led ${it.active ? 'on' : ''}`, 'aria-label': `${it.model}: ${it.active ? 'on' : 'off'}`, title: 'Toggle (bypass)',
    onClick: e => { e.stopPropagation(); it.active = !it.active; notify(); api('edit', { op: 'active', item: it.id, active: it.active }).catch(fail); } });
  return h('div', {
    class: `block ${it.kind} ${GROUP_CLASS(it.group)} ${it.active ? '' : 'off'} ${S.sel === it.id ? 'sel' : ''}`, draggable: it.kind === 'fx', dataset: { item: it.id }, tabindex: 0,
    onClick: () => { S.sel = it.id; notify(); }, onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { S.sel = it.id; notify(); e.preventDefault(); } },
    onContextmenu: e => blockMenu(e, it), onDragstart: e => startDrag(e, it), onDragend: endDrag,
  }, led,
    h('div', { class: 'grp' }, it.kind === 'fx' ? it.group ?? 'FX' : it.kind === 'amp' ? 'Amp' : 'Cab'),
    h('div', { class: 'nm' }, it.model),
    fsName ? h('span', { class: 'fsb', dataset: { fs: it.fs } }, fsName) : null);
}

function startDrag(e, it) { dragId = it.id; e.dataTransfer.setData('text/plain', String(it.id)); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => e.target.classList.add('dragging')); }
function endDrag() { dragId = null; document.querySelectorAll('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); }

function insertIndex(laneEl, x) {
  const kids = [...laneEl.querySelectorAll(':scope > .block[data-item]')].filter(k => !k.classList.contains('dragging'));
  for (let i = 0; i < kids.length; i++) { const r = kids[i].getBoundingClientRect(); if (x < r.left + r.width / 2) return i; }
  return kids.length;
}
function Lane(key, label, ids) {
  const items = ids.map(id => S.st.preset.items.find(i => i.id === id));
  const el = h('div', { class: `lane ${items.length ? '' : 'empty'}`, dataset: { lane: key, hint: 'drop here' } },
    h('span', { class: 'lanelabel' }, label), items.map(Block));
  el.addEventListener('dragover', e => { if (dragId == null) return; e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); });
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('over');
    if (dragId == null) return;
    const lanes = Object.fromEntries(LANE_KEYS.map(k => [k, (S.st.chain[k] ?? []).filter(id => id !== dragId)]));
    lanes[key].splice(insertIndex(el, e.clientX), 0, dragId);
    const order = LANE_KEYS.flatMap(k => lanes[k].map(id => ({ id, lane: LANE[k] })));
    S.st.chain = lanes; order.forEach((o, i) => { const it = S.st.preset.items.find(x => x.id === o.id); it.pos = i; it.lane = o.lane; }); // otimista
    notify(); api('edit', { op: 'chain', order }).catch(fail);
  });
  return el;
}
const wire = () => h('i', { class: 'wire' });

export function renderChain(root) {
  const { items, setup } = S.st.preset, c = S.st.chain;
  const get = id => items.find(i => i.id === id);
  const dual = !get(2).empty || setup.input2 !== 0 || c.bPre.length || c.bPost.length || c.aPre.length || c.aPost.length;
  const row = (amp, cab, pre, post, labels) => h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
    Lane(pre, labels[0], c[pre]), wire(), Block(get(amp)), wire(), Block(get(cab)), wire(), Lane(post, labels[1], c[post]));
  const inName = n => (n === 0 ? 'Same as 1' : S.cat.input1.find(([v]) => v === n)?.[1] ?? `#${n}`);
  root.replaceChildren(
    h('div', { class: 'io span2' }, h('b', {}, 'IN 1'), inName(setup.input1)),
    h('div', { class: 'span2' }, Lane('pre', 'Before (shared)', c.pre)),
    row(0, 1, 'aPre', 'aPost', ['Path A · before', 'A · after']),
    h('div', { class: 'span2' }, Lane('post', 'After (mix)', c.post)),
    h('div', { class: 'io span2' }, h('b', {}, 'OUT'), 'Outputs'),
    dual ? row(2, 3, 'bPre', 'bPost', ['Path B · before', 'B · after'])
      : h('div', { class: 'dim', style: { fontSize: '12px', padding: '0 8px' } }, 'Path B inactive (Input 2 = Same and amp B empty)'));
}

// feedback visual quando um footswitch é pisado no pedal
export function flashItem(id) {
  const el = document.querySelector(`.block[data-item="${id}"]`); if (!el) return;
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
