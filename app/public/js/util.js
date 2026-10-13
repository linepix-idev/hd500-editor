import { icon, menuIcon } from './icons.js';
// Utilidades de interface (sem dependências).
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [property, value] of Object.entries(v)) {
        if (property.startsWith('--')) el.style.setProperty(property, value);
        else el.style[property] = value;
      }
    }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export async function api(path, body) {
  const r = await fetch('/api/' + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `error ${r.status}`);
  return j;
}

export function toast(msg, isErr = false, ms = 3200) {
  const box = $('#toast'), el = h('div', { class: isErr ? 'err' : '' }, msg);
  box.append(el); setTimeout(() => el.remove(), ms);
}
export const fail = e => { console.error(e); toast(e.message ?? String(e), true, 5000); };

// agrupa chamadas frequentes (knobs): envia no máximo a cada `ms`, sempre com o último valor
const timers = new Map();
export function throttle(key, fn, ms = 45) {
  const t = timers.get(key) ?? { last: 0, timer: null };
  timers.set(key, t); clearTimeout(t.timer);
  t.timer = setTimeout(() => { t.last = Date.now(); fn(); }, Math.max(0, ms - (Date.now() - t.last)));
}

let closeMenu = null;
export function menu(x, y, entries) {
  closeMenu?.();
  const previous=document.activeElement;
  const m=h('div',{class:'menu',role:'menu'},entries.filter(Boolean).map(([label,fn])=>h('button',{role:'menuitem',class:/clear|delete/i.test(label)?'destructive':'',onClick:()=>{close();Promise.resolve().then(fn).catch(fail);}},icon(menuIcon(label)),h('span',{},label))));
  const close=()=>{m.remove();removeEventListener('pointerdown',off,true);removeEventListener('keydown',keys,true);previous?.isConnected&&previous.focus({preventScroll:true});if(closeMenu===close)closeMenu=null;};
  const off=e=>{if(!m.contains(e.target))close();};
  const keys=e=>{
    const btns=[...m.querySelectorAll('button')],index=btns.indexOf(document.activeElement);
    if(e.key==='Escape'||e.key==='Tab'){close();if(e.key==='Escape')e.preventDefault();e.stopPropagation();}
    else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();btns[e.key==='Home'?0:e.key==='End'?btns.length-1:(index+(e.key==='ArrowDown'?1:btns.length-1))%btns.length]?.focus();}
  };
  document.body.append(m);const r=m.getBoundingClientRect();
  m.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';m.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';
  addEventListener('pointerdown',off,true);addEventListener('keydown',keys,true);closeMenu=close;m.querySelector('button')?.focus();return m;
}
let closeModal = null;
export function modal(title, body, { onClose } = {}) {
  closeModal?.(); closeMenu?.();
  const root=$('#modal'),previous=document.activeElement,background=[$('#top'),$('.app-layout')];
  const close=()=>{root.hidden=true;root.replaceChildren();background.forEach(x=>x.inert=false);removeEventListener('keydown',keys,true);previous?.isConnected&&previous.focus({preventScroll:true});onClose?.();if(closeModal===close)closeModal=null;};
  const keys=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
    if(e.key==='Tab'){
      const nodes=[...root.querySelectorAll('button,input,select,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length),first=nodes[0],last=nodes.at(-1);
      if(e.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){e.preventDefault();first?.focus();}
    }
  };
  root.replaceChildren(h('div',{class:'dlg',role:'dialog','aria-modal':'true','aria-label':title},
    h('header',{},h('h3',{},title),h('button',{class:'icon','aria-label':'Close',onClick:close},icon('close'))),h('div',{class:'bd'},body)));
  root.hidden=false;background.forEach(x=>x.inert=true);addEventListener('keydown',keys,true);closeModal=close;
  root.onclick=e=>{if(e.target===root)close();};root.querySelector('input,button')?.focus();return close;
}

export function download(name, data, type = 'application/octet-stream') {
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type })), download: name }); document.body.append(a); a.click(); a.remove();
}
export const b64ToBytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const bytesToB64 = u8 => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
export function pickFile(accept) {
  return new Promise(res => {
    const inp = $('#filePick'); inp.value = ''; inp.accept = accept ?? '';
    inp.onchange = () => res(inp.files[0] ?? null); inp.click();
  });
}

/** Delayed, keyboard-accessible tooltips. Native titles are restored on dismissal. */
export function initTooltips() {
  let owner, tip, timer, title, describedBy;
  const clear = () => {
    clearTimeout(timer); tip?.remove(); tip = null;
    if (owner) {
      if (title) owner.setAttribute('title', title);
      if (describedBy) owner.setAttribute('aria-describedby', describedBy);
      else owner.removeAttribute('aria-describedby');
    }
    owner = null;
  };
  const schedule = e => {
    const target = e.target.closest?.('[title]');
    if (!target || !target.getAttribute('title') || e.type === 'pointerover' && e.pointerType === 'touch') return;
    if (target === owner) return;
    clear(); owner = target; title = target.getAttribute('title'); describedBy = target.getAttribute('aria-describedby');
    target.removeAttribute('title');
    timer = setTimeout(() => {
      if (!target.isConnected) return clear();
      tip = h('div', { class: 'tooltip', id: 'hd500-tooltip', role: 'tooltip' }, title);
      document.body.append(tip); target.setAttribute('aria-describedby', [describedBy, tip.id].filter(Boolean).join(' '));
      const r = target.getBoundingClientRect(), t = tip.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(r.left + r.width/2 - t.width/2, innerWidth-t.width-8))+'px';
      tip.style.top = (r.bottom+t.height+16 <= innerHeight ? r.bottom+8 : Math.max(8,r.top-t.height-8))+'px';
    }, 500);
  };
  document.addEventListener('pointerover', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('pointerout', e => { if(owner?.contains(e.target) && !owner.contains(e.relatedTarget)) clear(); });
  document.addEventListener('focusout', clear);
  document.addEventListener('pointerdown', clear);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') clear(); }, true);
  addEventListener('scroll', clear, true);
  addEventListener('resize', clear);
}
