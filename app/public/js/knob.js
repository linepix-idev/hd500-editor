import { h, clamp } from './util.js';

const R = 28, C = 34, A0 = -135, A1 = 135;
const polar = deg => { const r = (deg - 90) * Math.PI / 180; return [C + R * Math.cos(r), C + R * Math.sin(r)]; };
const arc = (a, b) => { const [x0, y0] = polar(a), [x1, y1] = polar(b); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

/** Knob rotativo 0..1. Arraste na vertical (Shift = fino), roda do mouse, setas, duplo clique para digitar. */
export function Knob({ label, value, format, onStart, onInput, onCommit, color, badge, range, onContext, title, bipolar = false }) {
  let v = clamp(value, 0, 1);
  const root = h('div', { class: 'knob', style: color ? { '--c': color } : null, title: title ?? label });
  const s = svg('svg', { viewBox: '0 0 68 68', role: 'slider', tabindex: 0, 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 1 });
  const trk = svg('path', { class: 'trk', d: arc(A0, A1) }), val = svg('path', { class: 'val', d: arc(A0, A1), pathLength: 1 }), ptr = svg('line', { class: 'ptr', x1: C, y1: C, x2: C, y2: C });
  const rng = svg('path', { class: 'rng', d: '' });
  const tick = bipolar ? svg('line', { class: 'ctr', x1: C, y1: C - R - 5, x2: C, y2: C - R + 5 }) : null;
  s.append(trk, ...(tick ? [tick] : []), rng, val, ptr);
  const rd = h('div', { class: 'rd' }), lab = h('div', { class: 'lab' }, label);
  root.append(s, rd, lab);
  if (badge) root.append(h('span', { class: 'ctlb' }, badge));

  function paint() {
    const a = A0 + (A1 - A0) * v;
    if (bipolar) { // arc grows from the 12 o'clock centre towards the side the sound moves to
      const mid = (A0 + A1) / 2; val.removeAttribute('pathLength'); val.style.strokeDasharray = 'none';
      val.setAttribute('d', Math.abs(a - mid) < 0.5 ? '' : arc(Math.min(mid, a), Math.max(mid, a))); val.style.opacity = '1';
    } else { val.style.strokeDasharray = `${v.toFixed(4)} 1`; val.style.opacity = v > 0.002 ? '1' : '0'; }
    const [x, y] = polar(a), k = 0.55; ptr.setAttribute('x1', C + (x - C) * k); ptr.setAttribute('y1', C + (y - C) * k); ptr.setAttribute('x2', x); ptr.setAttribute('y2', y);
    if (range) { const [lo, hi] = range; rng.setAttribute('d', arc(A0 + (A1 - A0) * Math.min(lo, hi), A0 + (A1 - A0) * Math.max(lo, hi) + 0.01)); }
    s.setAttribute('aria-valuenow', v.toFixed(3)); s.setAttribute('aria-valuetext', format(v)); rd.textContent = format(v);
  }
  const set = (nv, commit) => { v = clamp(nv, 0, 1); paint(); onInput(v); if (commit) onCommit?.(v); };

  let drag = null;
  s.addEventListener('pointerdown', e => { if (e.button !== 0) return; s.setPointerCapture(e.pointerId); drag = { y: e.clientY, v, moved: false }; root.dataset.dragging = 'true'; onStart?.(); e.preventDefault(); });
  s.addEventListener('pointermove', e => { if (!drag) return; const sens = e.shiftKey ? 900 : 180, next = clamp(drag.v + (drag.y - e.clientY) / sens, 0, 1); if(next === v) return; drag.moved = true; set(next); });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved; drag = null; root.removeAttribute('data-dragging'); onCommit?.(v);
    if (moved) root.dispatchEvent(new Event('knobend', { bubbles: true }));
  };
  s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end); s.addEventListener('lostpointercapture', end);
  s.addEventListener('wheel', e => { e.preventDefault(); set(v - Math.sign(e.deltaY) * (e.shiftKey ? 0.004 : 0.02), true); }, { passive: false });
  s.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(v + step, true); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(v - step, true); e.preventDefault(); }
    else if (e.key === 'Home') { set(0, true); e.preventDefault(); } else if (e.key === 'End') { set(1, true); e.preventDefault(); }
  });
  s.addEventListener('dblclick', () => { if (bipolar) { set(0.5, true); return; } const t = prompt(`${label} (0 to 100%)`, Math.round(v * 100)); if (t != null && t.trim() !== '' && !Number.isNaN(Number(t))) set(Number(t) / 100, true); });
  if (onContext) root.addEventListener('contextmenu', e => { e.preventDefault(); onContext(e); });
  paint();
  root.update = nv => { if (!drag) { v = clamp(nv, 0, 1); paint(); } };
  return root;
}
