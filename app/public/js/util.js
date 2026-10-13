// Utilidades de interface (sem dependências).
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
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

export function menu(x, y, entries) {
  document.querySelectorAll('.menu').forEach(m => m.remove());
  const m = h('div', { class: 'menu', role: 'menu' }, entries.filter(Boolean).map(([label, fn]) => h('button', { role: 'menuitem', onClick: () => { m.remove(); fn(); } }, label)));
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  const off = e => { if (!m.contains(e.target)) { m.remove(); removeEventListener('pointerdown', off, true); } };
  setTimeout(() => addEventListener('pointerdown', off, true));
  return m;
}

export function modal(title, body, { onClose } = {}) {
  const root = $('#modal');
  const close = () => { root.hidden = true; root.replaceChildren(); onClose?.(); removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  root.replaceChildren(h('div', { class: 'dlg', role: 'dialog', 'aria-label': title },
    h('header', {}, h('h3', {}, title), h('button', { class: 'icon', 'aria-label': 'Close', onClick: close }, '✕')),
    h('div', { class: 'bd' }, body)));
  root.hidden = false; addEventListener('keydown', esc);
  root.onclick = e => { if (e.target === root) close(); };
  return close;
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
