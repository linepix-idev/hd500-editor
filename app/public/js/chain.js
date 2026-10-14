import { gearEl, gearSpec } from './gear-spec.js';
import { h, api, fail, menu, toast } from './util.js';
import { pickModel } from './picker.js';
import { S, notify, GROUP_CLASS } from './store.js';
import { icon, categoryIcon } from './icons.js';
import { tr } from './i18n.js';

const LANE = { pre: 0, aPre: 1, bPre: 2, aPost: 3, bPost: 4, post: 5 };
const LANE_KEYS = ['pre', 'aPre', 'bPre', 'aPost', 'bPost', 'post'];

const EMPTY = { amp: 0x7ffff, cab: 0x7ffff, fx: 0x20dffff };
const edit = (op, a) => api('edit', { op, ...a });
const settle = async (id, type) => { for (let i = 0; i < 25; i++) { if (S.st.preset.items.find(x => x.id === id)?.type === type) return; await new Promise(r => setTimeout(r, 100)); } };

async function pasteBlock(it) {
  const c = S.clip; if (!c) return toast('Nothing copied yet.', true);
  if (c.kind !== it.kind) return toast(tr(`You can only paste ${tr(c.kind === 'fx' ? 'effects into effect slots' : c.kind === 'amp' ? 'amps into amp slots' : 'cabs into cab slots')}.`), true);
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
    title: it.empty ? tr('Empty — click to choose') : (it.basedOn ? tr(`${it.model} — based on ${it.basedOn}.`) + ' ' : '') + tr('Select block. Drag to move. Alt + arrows to reorder.'),
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
    it.empty ? null : h('div', { class: `node-tags ${it.fs && it.params.some(q => q.ctl) ? 'dual' : ''}` },
      it.fs ? h('span', { class: `tag tag-fs ${it.fs === 9 ? 'tag-toe' : ''}`, dataset: { fs: it.fs }, title: it.fs === 9 ? 'Expression pedal toe switch' : 'Footswitch' }, icon(it.fs === 9 ? 'expression' : 'footswitch'), it.fs === 9 ? 'Toe' : S.cat.fs[it.fs]) : null,
      ...[...new Set(it.params.filter(q => q.ctl).map(q => q.ctl))].map(c => h('span', { class: 'tag tag-exp', title: 'Expression pedal controller' }, icon('expression'), S.cat.ctl[c] ?? `EXP ${c}`))));
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
const NS='http://www.w3.org/2000/svg';
const GLYPH={
  guitar:{fill:'M10 9.6c1.4 0 2.3.8 2.3 1.9 0 .5-.2.9-.5 1.2.9.4 1.5 1.3 1.5 2.4 0 1.7-1.5 2.9-3.3 2.9s-3.3-1.2-3.3-2.9c0-1.1.6-2 1.5-2.4-.3-.3-.5-.7-.5-1.2 0-1.1.9-1.9 2.3-1.9z M9.2 1.6h1.6v2.6H9.2z',stroke:'M10 4.2v6',rot:35},
  mic:{fill:'M10 2.5a2.8 2.8 0 0 1 2.8 2.8v4.4a2.8 2.8 0 0 1-5.6 0V5.3A2.8 2.8 0 0 1 10 2.5z',stroke:'M4.6 9.2a5.4 5.4 0 0 0 10.8 0 M10 14.6v3 M7.2 17.6h5.6'},
  input:{fill:'M5 3h10v6.5a5 5 0 0 1-10 0z',stroke:'M7.6 3V1.5 M12.4 3V1.5 M10 14.5v3.5'},
  output:{fill:'M3 7.6h3.2L10.4 4v12l-4.2-3.6H3z',stroke:'M13.2 7.2a4 4 0 0 1 0 5.6 M15.6 5a7.2 7.2 0 0 1 0 10'},
};
function ioTile(kind){
  const g=GLYPH[kind]??GLYPH.input, svg=document.createElementNS(NS,'svg');
  for(const [k,v] of Object.entries({viewBox:'0 0 20 20',width:22,height:22,fill:'none','aria-hidden':'true',focusable:'false'})) svg.setAttribute(k,v);
  const f=document.createElementNS(NS,'path'); f.setAttribute('d',g.fill); f.setAttribute('fill','currentColor'); f.setAttribute('stroke','none');
  const st=document.createElementNS(NS,'path'); st.setAttribute('d',g.stroke); st.setAttribute('stroke','currentColor'); st.setAttribute('stroke-width','1.6'); st.setAttribute('stroke-linecap','round'); st.setAttribute('stroke-linejoin','round');
  if(g.rot) for(const e of [f,st]) e.setAttribute('transform',`rotate(${g.rot} 10 10)`);
  svg.append(f,st);
  return h('span',{class:`io-tile io-${kind}`},svg);
}
function sourceIcon(name) { return /mic/i.test(name)?'mic':/guitar|variax/i.test(name)?'guitar':'input'; }
export function renderChain(root) {
  if(isDragging()) return;
  const {items,setup}=S.st.preset,c=S.st.chain,get=id=>items.find(i=>i.id===id);
  const signature=JSON.stringify([c,setup.input1,setup.input2,items.map(i=>[i.id,i.type,i.model,i.group,i.active,i.empty,i.fs])]);
  if(signature===chainSignature && root.querySelector('.paths')) {
    root.querySelectorAll('.block').forEach(el=>el.classList.toggle('sel',Number(el.dataset.item)===S.sel));
    root.querySelector('#chainMixer')?.classList.toggle('sel',S.sel==='mixer');
    drawWires(); return;
  }
  chainSignature=signature;
  const inName=n=>n===0?'Same as 1':S.cat.input1.find(([v])=>v===n)?.[1]??`#${n}`;
  const row=(path,amp,cab,pre,post)=>h('div',{class:'path-row',dataset:{path}},
    h('div',{class:'path-label'},path==='A'?'Path A':'Path B',h('span',{},path==='A'?inName(setup.input1):inName(setup.input2))),
    Lane(pre,'Before',c[pre]),Block(get(amp)),Block(get(cab)),Lane(post,'After',c[post]));
  root.replaceChildren(
    h('div',{class:'io inputs',id:'chainInput'},
      h('div',{class:'input-source',dataset:{source:1}},ioTile(sourceIcon(inName(setup.input1))),h('b',{},'Input 1'),h('span',{class:'source'},inName(setup.input1))),
      h('div',{class:'input-source',dataset:{source:2}},ioTile(sourceIcon(inName(setup.input2===0?setup.input1:setup.input2))),h('b',{},'Input 2'),h('span',{class:'source'},inName(setup.input2)))),
    Lane('pre','Before · shared',c.pre),
    h('div',{class:'paths'},row('A',0,1,'aPre','aPost'),row('B',2,3,'bPre','bPost')),
    h('button',{class:`io mix-node ${S.sel==='mixer'?'sel':''}`,id:'chainMixer',type:'button',title:'Mixer: level and pan of paths A and B (M)','aria-label':'Open the mixer',onClick:()=>{ S.sel='mixer'; notify(); }},h('span',{class:'io-tile io-mixer'},icon('mixer')),h('b',{},'Mixer'),h('span',{},'A + B')),
    Lane('post','After · mix',c.post),h('div',{class:'io',id:'chainOutput'},ioTile('output'),h('b',{},'Output'),h('span',{},'Stereo')));
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
    const tile=e=>e.querySelector?.(':scope > .io-tile')??e,ar=tile(a).getBoundingClientRect(),br=tile(b).getBoundingClientRect(),x=ar.right-bounds.left,y=ar.top+ar.height/2-bounds.top,u=br.left-bounds.left,v=br.top+br.height/2-bounds.top,curve=Math.max(16,(u-x)/2);
    const d=`M${x} ${y} C${x+curve} ${y} ${u-curve} ${v} ${u} ${v}`;
    const bypass=a.classList.contains('off')||b.classList.contains('off'), pathRow=b.closest('[data-path]')??a.closest('[data-path]'),color=pathRow?.dataset.path==='A'?'var(--path-a)':pathRow?.dataset.path==='B'?'var(--path-b)':'var(--io)';
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);path.setAttribute('stroke',color);path.style.setProperty('--wire-color',color);path.setAttribute('class',`connection ${bypass?'bypass':''}`);svg.append(path);

  };
  const sequence=nodes=>nodes.forEach((n,i)=>i&&join(nodes[i-1],n));
  const before=lane('pre'),after=lane('post');sequence([root.querySelector('[data-source="1"]'),...before]);join(root.querySelector('[data-source="2"]'),before[0]);const mix=root.querySelector('#chainMixer');join(mix,after[0]);sequence([...after,root.querySelector('#chainOutput')]);
  for(const [pre,amp,cab,post]of[['aPre',0,1,'aPost'],['bPre',2,3,'bPost']]) sequence([before.at(-1),...lane(pre),node(amp),node(cab),...lane(post),mix]);
}
export function flashItem(id) {
  const el=document.querySelector(`.block[data-item="${id}"]`);if(!el)return;
  el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');
}
