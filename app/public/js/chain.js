import { gearEl, gearSpec } from './gear-spec.js';
import { h, api, fail, menu, toast } from './util.js';
import { pickModel } from './picker.js';
import { S, notify, GROUP_CLASS } from './store.js';
import { icon, categoryIcon } from './icons.js';

const LANE = { pre: 0, aPre: 1, bPre: 2, aPost: 3, bPost: 4, post: 5 };
const LANE_KEYS = ['pre', 'aPre', 'bPre', 'aPost', 'bPost', 'post'];

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

function toggle(it) {
  it.active = !it.active; notify(); edit('active', { item: it.id, active: it.active }).catch(fail);
}
export function clearBlock(id = S.sel) {
  const it = S.st?.preset.items.find(i => i.id === id);
  if (it && !it.empty) edit('model', { item: it.id, type: EMPTY[it.kind] }).catch(fail);
}
let suppressClickUntil = 0;
function Block(it) {
  const current = () => S.st.preset.items.find(item => item.id === it.id);
  const el = h('div', {
    class: `block ${it.kind} ${GROUP_CLASS(it.group)} ${it.empty ? 'emptyslot' : ''} ${it.active ? '' : 'off'} ${S.sel === it.id ? 'sel' : ''}`,
    dataset: { item: it.id }, tabindex: 0, role: 'group', 'aria-label': it.empty ? 'Empty slot' : it.model,
    title: it.empty ? 'Empty — click to choose' : `${it.basedOn ? `${it.model} — based on ${it.basedOn}. ` : ''}Select block. Drag to move. Alt + arrows to reorder.`,
    onClick: () => { if (performance.now() < suppressClickUntil) return; S.sel = it.id; notify(); },
    onDblclick: () => pickModel(current()), onContextmenu: e => blockMenu(e, current()),
    onKeydown: e => {
      if (e.target !== el) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.sel = it.id; notify(); document.querySelector(`#inspector .model-title`)?.focus(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearBlock(it.id); }
      if (e.key === 'F10' && e.shiftKey) { const r = el.getBoundingClientRect(); blockMenu({ preventDefault(){},clientX:r.left,clientY:r.bottom },current()); e.preventDefault(); }
      if (e.altKey && it.kind === 'fx' && e.key.startsWith('Arrow')) { e.preventDefault(); e.stopPropagation(); keyboardMove(it,e.key); }
    }, onPointerdown: e => prepareDrag(e, current(), el),
  }, it.empty ? icon(it.kind === 'fx' ? 'plus' : categoryIcon(it)) : gearEl(gearSpec(it)),
    h('div', { class: 'grp' }, it.kind === 'fx' ? it.empty ? '' : it.group ?? 'Effect' : it.kind === 'amp' ? 'Amp' : 'Cab'),
    it.empty ? null : h('div', { class: 'nm' }, it.model),
    !it.empty ? h('button', { class: `led ${it.active ? 'on' : ''}`, role:'switch', 'aria-checked':String(it.active), 'aria-label':`${it.model}: bypass`, title:'Toggle (bypass)',onDblclick:e=>e.stopPropagation(),onClick:e=>{ e.stopPropagation(); toggle(current()); } }) : null,
    it.fs && !it.empty ? h('span', {class:'fsb',dataset:{fs:it.fs}},S.cat.fs[it.fs]) : null);
  return el;
}
function Lane(key, label, ids) {
  return h('div', { class:`lane ${ids.length ? '' : 'empty'}`,dataset:{lane:key},'aria-label':label },
    h('span',{class:'lanelabel'},label),ids.map(id=>Block(S.st.preset.items.find(i=>i.id===id))));
}
function commitOrder(lanes, id) {
  const old = structuredClone(S.st.chain), order = LANE_KEYS.flatMap(k=>lanes[k].map(id=>({id,lane:LANE[k]})));
  S.st.chain = lanes; S.st.dirty = true;
  order.forEach((o,i)=>{ const it=S.st.preset.items.find(x=>x.id===o.id); it.pos=i; it.lane=o.lane; });
  notify();
  document.querySelector(`.block[data-item="${id}"]`)?.classList.add('landed');
  return edit('chain',{order}).catch(async e=>{ S.st.chain=old; try { S.st=await api('state'); } catch {} notify(); fail(e); });
}
function keyboardMove(it,key) {
  const lanes=structuredClone(S.st.chain), from=LANE_KEYS.find(k=>lanes[k].includes(it.id)), index=lanes[from].indexOf(it.id);
  lanes[from].splice(index,1);
  let to=from, at=index;
  if (key==='ArrowLeft') at=Math.max(0,index-1);
  if (key==='ArrowRight') at=Math.min(lanes[from].length,index+1);
  if (key==='ArrowUp' || key==='ArrowDown') { to=LANE_KEYS[(LANE_KEYS.indexOf(from)+(key==='ArrowUp' ? 5 : 1))%6]; at=lanes[to].length; }
  commitOrder(lanes,it.id);
  document.querySelector(`.block[data-item="${it.id}"]`)?.focus();
}
let gesture = null, resizeObserver, chainSignature = '';
export const isDragging = () => !!gesture?.started;
function prepareDrag(e,it,el) {
  if (e.button!==0 || e.target.closest('button')) return;
  const start={x:e.clientX,y:e.clientY}, r=el.getBoundingClientRect();
  const g=gesture={id:it.id,it,el,start,pointer:e.pointerId,started:false,target:null,index:0};
  el.setPointerCapture(e.pointerId);
  const move=e=>{
    if(e.pointerId!==g.pointer) return;
    if(!g.started && Math.hypot(e.clientX-start.x,e.clientY-start.y)<7) return;
    e.preventDefault();
    if(!g.started) {
      g.started=true; g.ghost=el.cloneNode(true); g.ghost.classList.add('drag-ghost'); g.ghost.removeAttribute('tabindex'); g.ghost.inert=true; g.ghost.setAttribute('aria-hidden','true');
      g.ghost.style.width=r.width+'px'; g.ghost.style.height=r.height+'px'; document.body.append(g.ghost);
      g.gap=h('div',{class:'drop-gap',style:{width:r.width+'px',height:r.height+'px'},'aria-hidden':'true'});
      el.before(g.gap); el.classList.add('drag-origin'); document.body.classList.add('chain-dragging');
      document.querySelector('#dragStatus').textContent='Moving block. Escape cancels.';
    }
    g.ghost.style.left=(e.clientX-r.width/2)+'px'; g.ghost.style.top=(e.clientY-r.height/2)+'px';
    document.querySelectorAll('.drop-target,.lane.over').forEach(x=>x.classList.remove('drop-target','over'));
    const hit=document.elementFromPoint(e.clientX,e.clientY), special=hit?.closest('#chainTrash,.fsbtn'), lane=hit?.closest('.lane');
    const previous=[...document.querySelectorAll('#chain .block:not(.drag-origin)')].map(el=>[el,el.getBoundingClientRect()]);
    g.target=null;
    if(special && (special.id==='chainTrash'||it.kind==='fx')) { g.target=special; special.classList.add('drop-target'); }
    else if(lane && it.kind==='fx') {
      g.gap.remove();
      const kids=[...lane.querySelectorAll(':scope>.block:not(.drag-origin)')];
      let index=kids.findIndex(k=>{ const b=k.getBoundingClientRect(); return e.clientX<b.left+b.width/2; });
      if(index<0) index=kids.length;
      lane.insertBefore(g.gap,kids[index]??null); lane.classList.add('over'); g.target=lane; g.index=index;
    }
    for(const [node,before] of previous) { const after=node.getBoundingClientRect(),dx=before.left-after.left,dy=before.top-after.top; if((dx||dy)&&!matchMedia('(prefers-reduced-motion: reduce)').matches) { node.getAnimations().forEach(a=>a.cancel()); node.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'}); } }
    const scroll=document.querySelector('.chain-scroll'),sr=scroll.getBoundingClientRect();
    if(e.clientY>sr.top&&e.clientY<sr.bottom){ if(e.clientX>sr.right-36) scroll.scrollLeft+=14; if(e.clientX<sr.left+36) scroll.scrollLeft-=14; }
    drawWires();
  };
  const finish=(cancel=false)=>{
    removeEventListener('pointermove',move); removeEventListener('pointerup',up); removeEventListener('pointercancel',cancelEvent); removeEventListener('keydown',esc,true);
    if(el.hasPointerCapture(g.pointer)) el.releasePointerCapture(g.pointer);
    gesture=null;
    if(!g.started) return;
    suppressClickUntil=performance.now()+400; g.ghost.remove(); g.gap.remove(); el.classList.remove('drag-origin'); document.body.classList.remove('chain-dragging');
    document.querySelectorAll('.drop-target,.lane.over').forEach(x=>x.classList.remove('drop-target','over'));
    let committed=false;
    if(!cancel && g.target) {
      if(g.target.id==='chainTrash') clearBlock(it.id);
      else if(g.target.matches('.fsbtn')) edit('fs',{item:it.id,fs:Number(g.target.dataset.fs)}).catch(fail);
      else { const lanes=Object.fromEntries(LANE_KEYS.map(k=>[k,S.st.chain[k].filter(id=>id!==it.id)])); lanes[g.target.dataset.lane].splice(g.index,0,it.id); commitOrder(lanes,it.id); committed=true; }
    }
    if(!committed) notify(); document.querySelector(`.block[data-item="${it.id}"]`)?.focus({preventScroll:true});
    document.querySelector('#dragStatus').textContent=cancel||!g.target?'Move cancelled.':'Block placed.';
  };
  const up=e=>{if(e.pointerId===g.pointer) finish();}, cancelEvent=()=>finish(true), esc=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true);}};
  addEventListener('pointermove',move,{passive:false}); addEventListener('pointerup',up); addEventListener('pointercancel',cancelEvent); addEventListener('keydown',esc,true);
}
function sourceIcon(name) { return /mic/i.test(name)?'mic':/guitar|variax/i.test(name)?'guitar':'input'; }
export function renderChain(root) {
  if(isDragging()) return;
  const {items,setup}=S.st.preset,c=S.st.chain,get=id=>items.find(i=>i.id===id);
  const signature=JSON.stringify([c,setup.input1,setup.input2,items.map(i=>[i.id,i.type,i.model,i.group,i.active,i.empty,i.fs])]);
  if(signature===chainSignature && root.querySelector('.paths')) {
    root.querySelectorAll('.block').forEach(el=>el.classList.toggle('sel',Number(el.dataset.item)===S.sel));
    drawWires(); return;
  }
  chainSignature=signature;
  const inName=n=>n===0?'Same as 1':S.cat.input1.find(([v])=>v===n)?.[1]??`#${n}`;
  const row=(path,amp,cab,pre,post)=>h('div',{class:'path-row',dataset:{path}},
    h('div',{class:'path-label'},path==='A'?'Path A':'Path B',h('span',{},path==='A'?inName(setup.input1):inName(setup.input2))),
    Lane(pre,'Before',c[pre]),Block(get(amp)),Block(get(cab)),Lane(post,'After',c[post]));
  root.replaceChildren(
    h('div',{class:'io inputs',id:'chainInput'},
      h('div',{class:'input-source',dataset:{source:1}},icon(sourceIcon(inName(setup.input1))),h('b',{},'Input 1'),h('span',{class:'source'},inName(setup.input1))),
      h('div',{class:'input-source',dataset:{source:2}},icon(sourceIcon(inName(setup.input2===0?setup.input1:setup.input2))),h('b',{},'Input 2'),h('span',{class:'source'},inName(setup.input2)))),
    Lane('pre','Before · shared',c.pre),
    h('div',{class:'paths'},row('A',0,1,'aPre','aPost'),row('B',2,3,'bPre','bPost')),
    Lane('post','After · mix',c.post),h('div',{class:'io',id:'chainOutput'},icon('output'),h('b',{},'Output'),h('span',{},'Stereo')));
  resizeObserver?.disconnect(); resizeObserver=new ResizeObserver(()=>drawWires()); resizeObserver.observe(root);
  requestAnimationFrame(drawWires);
}
function drawWires() {
  const root=document.querySelector('#chain'); if(!root?.querySelector('.paths')) return;
  let svg=root.querySelector('.wires');
  if(!svg) { svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('wires');svg.setAttribute('aria-hidden','true');root.prepend(svg); }
  const bounds=root.getBoundingClientRect(); svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`); svg.replaceChildren();
  const node=id=>root.querySelector(`.block[data-item="${id}"]:not(.drag-origin)`);
  const lane=k=>{const l=root.querySelector(`[data-lane="${k}"]`),nodes=[...l.querySelectorAll('.block:not(.drag-origin),.drop-gap')];return nodes.length?nodes:[l];};
  const join=(a,b)=>{
    if(!a||!b)return;
    const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(),x=ar.right-bounds.left,y=ar.top+ar.height/2-bounds.top,u=br.left-bounds.left,v=br.top+br.height/2-bounds.top,curve=Math.max(16,(u-x)/2);
    const d=`M${x} ${y} C${x+curve} ${y} ${u-curve} ${v} ${u} ${v}`;
    const bypass=a.classList.contains('off')||b.classList.contains('off'), pathRow=b.closest('[data-path]')??a.closest('[data-path]'),color=pathRow?.dataset.path==='A'?'var(--path-a)':pathRow?.dataset.path==='B'?'var(--path-b)':'var(--io)';
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);path.setAttribute('stroke',color);path.style.setProperty('--wire-color',color);path.setAttribute('class',`connection ${bypass?'bypass':''}`);svg.append(path);

  };
  const sequence=nodes=>nodes.forEach((n,i)=>i&&join(nodes[i-1],n));
  const before=lane('pre'),after=lane('post');sequence([root.querySelector('[data-source="1"]'),...before]);join(root.querySelector('[data-source="2"]'),before[0]);sequence([...after,root.querySelector('#chainOutput')]);
  for(const [pre,amp,cab,post]of[['aPre',0,1,'aPost'],['bPre',2,3,'bPost']]) sequence([before.at(-1),...lane(pre),node(amp),node(cab),...lane(post),after[0]]);
}
export function flashItem(id) {
  const el=document.querySelector(`.block[data-item="${id}"]`);if(!el)return;
  el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');
}
