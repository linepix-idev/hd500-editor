// Ícones de amp, cab, microfone e pedal — versão "equipamento real" (arte original, vetor).
// Cada modelo ganha o gabinete na cor do aparelho que imita (ex.: Screamer verde, Red Comp vermelho).
import { STY } from './gear-styles.js';

// ── cor ──
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
const lighten = (c, t) => mix(c, '#ffffff', t), darken = (c, t) => mix(c, '#000000', t);
const lum = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

let uid = 0;
const SVG = (inner, defs, label) => `<svg viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}" stroke-linecap="round" stroke-linejoin="round"><defs>${defs}</defs>${inner}</svg>`;
const grad = (id, c, t = 0.22, b = 0.22) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(c, t)}"/><stop offset="0.55" stop-color="${c}"/><stop offset="1" stop-color="${darken(c, b)}"/></linearGradient>`;
const metal = id => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="0.5" stop-color="#aeb4bd"/><stop offset="1" stop-color="#6c727c"/></linearGradient>`;
const LED = (x, y) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#ff5a4d" stroke="#7a1d17" stroke-width=".6"/>`;

const KN = { white: ['#f2f2f0', '#2a2a2a'], black: ['#26272b', '#e9e9e9'], chrome: ['url(#mt)', '#2a2a2a'], cream: ['#e8dcc0', '#3a2a1a'] };
function knob(x, y, r, tone = 'black', a = -50) {
  const [f, p] = KN[tone] ?? KN.black, t = (a - 90) * Math.PI / 180;
  return `<circle cx="${x}" cy="${y}" r="${r + 0.9}" fill="#000" opacity=".28"/><circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="#000" stroke-opacity=".45" stroke-width=".7"/><path d="M${x} ${y}l${(r * 0.85 * Math.cos(t)).toFixed(2)} ${(r * 0.85 * Math.sin(t)).toFixed(2)}" stroke="${p}" stroke-width="1.3"/>`;
}
const row = (n, x0, x1, y, r, tone) => Array.from({ length: n }, (_, i) => knob(n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (n - 1), y, r, tone, -65 + i * 40)).join('');

// símbolos na placa de nome (traço escuro)
const GLYPH = {
  comp: 'M-7 2h14M-5 -1h10', gate: 'M-8 3h5v-5h6v5h5', drive: 'M-8 2q4-8 8 0t8 0', fuzz: 'M-8 3l3-6 3 6 3-6 3 6 2-3',
  mod: 'M-8 1q4-7 8 0t8 0', delay: 'M-7 -3v6M-3 -5v10M1 -3v6M5 -1v2', verb: 'M-7 3a7 7 0 0 1 14 0M-4 3a4 4 0 0 1 8 0', pitch: 'M-6 3l4-5 4 5M2 0l4-5',
  filter: 'M-8 -2h6l3 5h7', eq: 'M-6 -4v8M0 -2v6M6 -5v9',
};
const plate = (cx, y, w, h, c, glyph) => { const light = lum(c) > 0.55, pc = light ? darken(c, .12) : lighten(c, .78), gc = light ? '#1d1f24' : '#1d1f24';
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="2" fill="${pc}" stroke="#000" stroke-opacity=".25" stroke-width=".6"/>${glyph ? `<path transform="translate(${cx},${y + h / 2})" d="${GLYPH[glyph]}" fill="none" stroke="${gc}" stroke-width="1.5"/>` : ''}`; };
const sw = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r + 1.2}" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#mt)" stroke="#444" stroke-width=".7"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="#8a9099" opacity=".7"/>`;

// ── pedais ──
function pedal(style, n, glyph, id) {
  n = style.controls ?? n;
  const { color: c, body, knob: kt } = style, g = `url(#${id}b)`, edge = darken(c, .45);
  const defs = grad(id + 'b', c) + metal('mt');
  let s = '';
  switch (body) {
    case 'mxr': s = `<rect x="16" y="4" width="32" height="56" rx="5" fill="${g}" stroke="${edge}" stroke-width="1.4"/>${LED(32, 9)}${row(Math.min(n, 3), 23, 41, 17, 3.6, kt)}${plate(32, 26, 24, 10, c, style.script ? null : glyph)}${sw(32, 48, 5)}`; break;
    case 'rat': s = `<rect x="8" y="10" width="48" height="47" rx="4" fill="${g}" stroke="${edge}" stroke-width="1.4"/>${row(Math.min(n,4), 17,47,20,3.8,kt)}<rect x="13" y="29" width="38" height="10" rx="1" fill="#eee9d9"/>${plate(32,30,26,8,c,glyph)}${LED(43,45)}${sw(29,48,4.5)}`; break;
    case 'muff': s = `<rect x="7" y="12" width="50" height="46" rx="5" fill="${g}" stroke="${edge}" stroke-width="1.4"/>${LED(32, 17)}${row(3, 17, 47, 28, 5.2, kt)}${plate(32, 37, 22, 6, c, glyph)}<path d="M11 35h42v8H11z" fill="${style.stripe ?? '#ae2929'}"/>${sw(32, 50, 4)}`; break;
    case 'round': s = `<circle cx="32" cy="32" r="26" fill="${g}" stroke="${edge}" stroke-width="1.4"/><circle cx="32" cy="32" r="22" fill="none" stroke="url(#mt)" stroke-width="2"/>${row(2, 23, 41, 20, 3.4, kt)}${plate(32, 29, 18, 7, c, glyph)}${sw(32, 46, 5)}`; break;
    case 'tall': s = `<rect x="17" y="3" width="30" height="58" rx="4" fill="${g}" stroke="${edge}" stroke-width="1.4"/>${LED(32, 8)}${row(Math.min(n, 3), 23, 41, 17, 3.2, kt)}${plate(32, 26, 22, 11, c, glyph)}${sw(32, 49, 5)}<path d="M20 6v52M44 6v52" stroke="#fff" stroke-opacity=".12" stroke-width="1"/>`; break;
    case 'echo': s = `<rect x="5" y="13" width="54" height="40" rx="4" fill="${g}" stroke="${edge}" stroke-width="1.4"/>${[19, 45].map(x => `<circle cx="${x}" cy="27" r="9" fill="#17181b" stroke="url(#mt)" stroke-width="1.6"/><circle cx="${x}" cy="27" r="2.4" fill="url(#mt)"/><path d="M${x} 18v4M${x - 8} 27h4M${x + 4} 27h4" stroke="#aeb4bd" stroke-width="1.2"/>`).join('')}<path d="M19 36q13 5 26 0" fill="none" stroke="#2a1d14" stroke-width="2"/>${row(4, 14, 50, 46, 2.6, kt)}`; break;
    case 'spring': s = `<rect x="4" y="20" width="56" height="26" rx="4" fill="${g}" stroke="${edge}" stroke-width="1.4"/><path d="M9 33h5l2-6 4 12 4-12 4 12 4-12 4 12 4-12 4 12 2-6h5" fill="none" stroke="url(#mt)" stroke-width="1.8"/><circle cx="8" cy="40" r="1.6" fill="#17181b"/><circle cx="56" cy="40" r="1.6" fill="#17181b"/>`; break;
    case 'rack': s = `<rect x="3" y="22" width="58" height="22" rx="2" fill="${g}" stroke="${edge}" stroke-width="1.4"/><rect x="3" y="22" width="6" height="22" fill="${darken(c, .25)}"/><rect x="55" y="22" width="6" height="22" fill="${darken(c, .25)}"/><circle cx="6" cy="27" r="1.2" fill="#000" opacity=".6"/><circle cx="6" cy="39" r="1.2" fill="#000" opacity=".6"/><circle cx="58" cy="27" r="1.2" fill="#000" opacity=".6"/><circle cx="58" cy="39" r="1.2" fill="#000" opacity=".6"/>${row(Math.min(Math.max(n, 3), 6), 17, 47, 33, 2.8, kt)}${LED(50, 28)}`; break;
    case 'loop': s = `<rect x="8" y="20" width="48" height="24" rx="5" fill="${g}" stroke="${edge}" stroke-width="1.4"/><circle cx="17" cy="32" r="4" fill="#17181b" stroke="url(#mt)" stroke-width="1.6"/><circle cx="47" cy="32" r="4" fill="#17181b" stroke="url(#mt)" stroke-width="1.6"/><path d="M22 32h20" stroke="#cfd4db" stroke-width="2" stroke-dasharray="3 3"/>`; break;
    case 'treadle': s = `<path d="M15 57L21 11q1-5 6-5h10q5 0 6 5l6 46q0 2-3 2H18q-3 0-3-2z" fill="${g}" stroke="${edge}" stroke-width="1.4"/><path d="M23 17h18M22 23h20M21 29h22M20 35h24M19 41h26M18 47h28" stroke="#101114" stroke-width="2.4" opacity=".75"/><path d="M23 17h18M22 23h20M21 29h22M20 35h24M19 41h26M18 47h28" stroke="#fff" stroke-width=".6" opacity=".25" transform="translate(0 -1)"/><circle cx="32" cy="55" r="1.6" fill="#101114"/>`; break;
    default: { // boss: gabinete compacto
      const k = Math.min(n, 4);
      s = `<rect x="13" y="4" width="38" height="56" rx="5" fill="${g}" stroke="${edge}" stroke-width="1.4"/><path d="M13 36h38" stroke="#000" stroke-opacity=".25"/>${LED(32, 9)}${row(k, k === 1 ? 32 : 21, 43, 18, 3.2, kt)}${plate(32, 26, 26, 8, c, glyph)}<rect x="19" y="40" width="26" height="16" rx="3" fill="#28292b" stroke="#111" stroke-width=".8"/><path d="M23 44h18M23 48h18M23 52h18" stroke="#777" stroke-opacity=".4"/>`;
    }
  }
  if (style.script) s += '<path d="M22 30q1-5 3-1t3-1q2-3 3 1t3-1q2-3 4 0" fill="none" stroke="#262018" stroke-width="1.1"/>';
  return [s, defs];
}

// ── amps ──
function ampBody(st, id, rack) {
  const { tolex, grille, panel, trim, layout, grilleType, knob: kt } = st, T = `url(#${id}t)`, defs = grad(id + 't', tolex, .12, .3) + metal('mt') + `<pattern id="${id}g" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 1.5h3" stroke="${darken(grille, .35)}" stroke-width=".8"/></pattern>`;
  const pat = (x, y, w, h) => {
    const base = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${grille}" stroke="${darken(grille, .5)}" stroke-width=".8"/>`;
    switch (grilleType) {
      case 'tweed': return base + Array.from({ length: Math.floor(h / 3.4) }, (_, i) => `<path d="M${x} ${y + 2 + i * 3.4}h${w}" stroke="${darken(grille, .3)}" stroke-width="1.2"/>`).join('');
      case 'silver': return base + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="url(#${id}g)"/>`;
      case 'diamond': { let d = ''; for (let i = -h; i < w + h; i += 5) d += `<path d="M${x + i} ${y}l${h} ${h}M${x + i + h} ${y}l${-h} ${h}" stroke="${darken(grille, .5)}" stroke-width=".8"/>`; return `<clipPath id="${id}c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/></clipPath>` + base + `<g clip-path="url(#${id}c)">${d}</g>`; }
      case 'diamond-plate': return base + Array.from({ length: Math.floor(h / 4) }, (_, r) => Array.from({ length: Math.floor(w / 5) }, (_, c) => `<path d="M${x + 3 + c * 5 + (r % 2) * 2.5} ${y + 3 + r * 4}l1.6 0" stroke="${darken(grille, .4)}" stroke-width="1.2"/>`).join('')).join('');
      case 'basket': return base + Array.from({ length: Math.floor(w / 3.5) }, (_, i) => `<path d="M${x + 2 + i * 3.5} ${y}v${h}" stroke="${darken(grille, .4)}" stroke-width=".8"/>`).join('') + Array.from({ length: Math.floor(h / 3.5) }, (_, i) => `<path d="M${x} ${y + 2 + i * 3.5}h${w}" stroke="${darken(grille, .4)}" stroke-width=".8"/>`).join('');
      default: return base;
    }
  };
  const handle = `<path d="M24 12v-3q0-2 2-2h12q2 0 2 2v3" fill="none" stroke="${darken(tolex, .2)}" stroke-width="2.4"/><path d="M24 12v-3q0-2 2-2h12q2 0 2 2v3" fill="none" stroke="${lighten(tolex, .35)}" stroke-width=".7"/>`;
  if (rack) return [`<rect x="3" y="22" width="58" height="22" rx="2" fill="${T}" stroke="${darken(tolex, .5)}" stroke-width="1.4"/><rect x="9" y="25" width="46" height="16" rx="1.5" fill="${panel}" stroke="${darken(panel, .35)}" stroke-width=".8"/>${row(6, 15, 49, 33, 2.6, kt)}<circle cx="6" cy="27" r="1.2" fill="#000" opacity=".6"/><circle cx="6" cy="39" r="1.2" fill="#000" opacity=".6"/><circle cx="58" cy="27" r="1.2" fill="#000" opacity=".6"/><circle cx="58" cy="39" r="1.2" fill="#000" opacity=".6"/>`, defs];
  if (layout === 'metalHead') return [`${handle}<rect x="3" y="14" width="58" height="36" rx="3" fill="${T}" stroke="#111" stroke-width="1.4"/>${pat(6,17,52,16)}<rect x="6" y="35" width="52" height="11" rx="1.5" fill="${panel}"/>${row(st.controls ?? 6,12,52,40,2.5,kt)}<path d="M6 34h52" stroke="${trim}"/>`,defs];
  if (layout === 'combo') return [`${handle}<rect x="5" y="12" width="54" height="44" rx="4" fill="${T}" stroke="${darken(tolex, .55)}" stroke-width="1.4"/><rect x="8" y="15" width="48" height="9" rx="1.5" fill="${panel}" stroke="${darken(panel, .35)}" stroke-width=".8"/>${row(st.controls ?? 6, 14, 50, 19.5, 2.2, kt)}${pat(9, 28, 46, 24)}<path d="M8.5 27.5h47v25.5h-47z" fill="none" stroke="${trim}" stroke-width="1.2" opacity=".9"/><circle cx="8" cy="54" r="1.4" fill="${trim}"/><circle cx="56" cy="54" r="1.4" fill="${trim}"/>`, defs];
  return [`${handle}<rect x="3" y="14" width="58" height="34" rx="3" fill="${T}" stroke="${darken(tolex, .55)}" stroke-width="1.4"/><rect x="6" y="17" width="52" height="13" rx="1.5" fill="${panel}" stroke="${darken(panel, .35)}" stroke-width=".8"/>${row(st.controls ?? 7, 12, 52, 23.5, 2.4, kt)}<rect x="6" y="33" width="52" height="11" rx="1.5" fill="${grille === tolex ? darken(grille, .1) : grille}" stroke="${darken(grille, .5)}" stroke-width=".8"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${10 + i * 4} 35v7" stroke="${darken(grille, .5)}" stroke-width=".9" opacity=".7"/>`).join('')}<path d="M6 17h52" stroke="${trim}" stroke-width="1" opacity=".9"/><rect x="8" y="48" width="7" height="3" rx="1" fill="#0c0c0e"/><rect x="49" y="48" width="7" height="3" rx="1" fill="#0c0c0e"/>`, defs];
}
const baseKey = n => n.replace(/ Preamp$/, '').replace(/ (Normal|Bright|Vibrato|Clean|Crunch|OD|TB)$/, '').replace(/^Plexi Lead 100.*/, 'Plexi Lead 100').replace(/^Solo 100.*/, 'Solo 100');
const ampStyle = name => { const k = baseKey(name); return STY.amps[k] ?? STY.amps[name.replace(/ Preamp$/, '')] ?? { tolex: '#222428', grille: '#2a2c31', panel: '#9aa0a8', trim: '#c0c4cc', layout: 'head', grilleType: 'none', knob: 'black' }; };

// ── cabs ──
function cab(name, id) {
  const m = /^(\d)(?:x)?(\d+)/.exec(name), oval = name.startsWith('6x9'), c = '#2a2c31';
  const count = oval ? 2 : m ? Number(m[1]) : 1, cols = count >= 4 ? 2 : count, rows = count >= 4 ? Math.ceil(count / 2) : 1;
  const defs = grad(id + 'k', '#33363c', .12, .35) + metal('mt') + `<radialGradient id="${id}s"><stop offset="0" stop-color="#8a8f98"/><stop offset=".6" stop-color="#3b3e45"/><stop offset="1" stop-color="#1b1c20"/></radialGradient>`;
  const w = count === 1 ? 38 : count >= 8 ? 34 : 50, h = count === 2 ? 32 : 46;
  const x = (64-w)/2, y = (64-h)/2, cw = w / cols, ch = h / rows;
  let sp = '';
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { const cx = x + cw * (q + .5), cy = y + ch * (r + .5), rad = Math.min(cw, ch) * 0.4; sp += oval ? `<ellipse cx="${cx}" cy="${cy}" rx="${rad * .75}" ry="${rad * 1.25}" fill="url(#${id}s)" stroke="#000" stroke-width=".8"/><ellipse cx="${cx}" cy="${cy}" rx="${rad * .25}" ry="${rad * .4}" fill="#14151a"/>` : `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#${id}s)" stroke="#000" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="${rad * .3}" fill="#14151a"/><circle cx="${cx}" cy="${cy}" r="${rad * .72}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width=".8"/>`; }
  return [`<rect x="${x-3}" y="${y-3}" width="${w+6}" height="${h+6}" rx="4" fill="url(#${id}k)" stroke="#0d0d10" stroke-width="1.4"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#1a1b1f"/>${sp}${Array.from({ length: Math.floor(h / 4.6) }, (_, i) => `<path d="M${x} ${y + 3 + i * 4.6}h${w}" stroke="#000" stroke-opacity=".25" stroke-width=".7"/>`).join('')}${[x-1,w+x+1].map(cx => [y-1,y+h+1].map(cy => `<circle cx="${cx}" cy="${cy}" r="1" fill="url(#mt)"/>`).join('')).join('')}`, defs];
}

// ── microfones ──
const MICS = {
  dyn: id => [`<path d="M25 6h14v16H25z" fill="url(#${id}m)" stroke="#111" stroke-width="1"/><path d="M26 10h12M26 14h12M26 18h12" stroke="#111" stroke-width=".8" opacity=".6"/><path d="M26 22h12l-2 7H28z" fill="url(#mt)" stroke="#555" stroke-width=".8"/><path d="M29 29h6v21q0 4-3 4t-3-4z" fill="#26272b" stroke="#111" stroke-width="1"/>`, `<linearGradient id="${id}m" x1="0" x2="1"><stop offset="0" stop-color="#7d838d"/><stop offset=".5" stop-color="#dfe3e8"/><stop offset="1" stop-color="#6c727c"/></linearGradient>` + metal('mt')],
  rib: id => [`<rect x="22" y="5" width="20" height="32" rx="6" fill="url(#${id}m)" stroke="#111" stroke-width="1"/>${Array.from({ length: 7 }, (_, i) => `<path d="M${26 + i * 2} 9v24" stroke="#111" stroke-width=".8" opacity=".55"/>`).join('')}<path d="M32 37v9M24 52h16" stroke="#26272b" stroke-width="3"/><circle cx="32" cy="46" r="2.4" fill="url(#mt)"/>`, `<linearGradient id="${id}m" x1="0" x2="1"><stop offset="0" stop-color="#5b4a3a"/><stop offset=".5" stop-color="#b79a74"/><stop offset="1" stop-color="#4f3f31"/></linearGradient>` + metal('mt')],
  cond: id => [`<rect x="22" y="4" width="20" height="28" rx="7" fill="url(#${id}m)" stroke="#111" stroke-width="1"/><path d="M24 11h16M24 15h16M24 19h16M24 23h16" fill="none" stroke="#111" stroke-width=".8" opacity=".55"/><path d="M32 32v11M26 52h12" stroke="#26272b" stroke-width="3"/><path d="M22 36q10 8 20 0" fill="none" stroke="url(#mt)" stroke-width="2"/>`, `<radialGradient id="${id}m"><stop offset="0" stop-color="#f2f4f6"/><stop offset=".6" stop-color="#b5bac2"/><stop offset="1" stop-color="#6c727c"/></radialGradient>` + metal('mt')],
};
const micKind = n => /Rbn/.test(n) ? 'rib' : /Cond/.test(n) ? 'cond' : 'dyn';

// ── API ──
const GROUP_COLOR = { Dynamics: '#e07a5f', Distortion: '#f0566a', Modulation: '#3ec1a8', Delay: '#5b8def', Reverb: '#9b6bff', Filter: '#f2b84b', Pitch: '#f06ec2', 'Preamp+EQ': '#7fd36b', 'Volume/Pan': '#a6adbb', Wah: '#ffa94d', 'FX Loop': '#7d8696' };
const GLYPH_BY_GROUP = { Dynamics: 'comp', Distortion: 'drive', Modulation: 'mod', Delay: 'delay', Reverb: 'verb', Pitch: 'pitch', Filter: 'filter', 'Preamp+EQ': 'eq' };
export function gearIcon({ kind, name = '', group = '', paramCount = 3 }) {
  const id = 'g' + (uid++);
  let s, defs;
  if (kind === 'amp') [s, defs] = ampBody(ampStyle(name), id, /Preamp$/.test(name));
  else if (kind === 'cab') [s, defs] = cab(name, id);
  else {
    const low = name.toLowerCase();
    const glyph = group === 'Dynamics' && /gate/.test(low) ? 'gate' : group === 'Distortion' && /fuzz|buzz|octave/.test(low) ? 'fuzz' : GLYPH_BY_GROUP[group] ?? 'drive';
    const st = STY.pedals[name] ?? { color: GROUP_COLOR[group] ?? '#7d8696', body: group === 'Wah' || group === 'Volume/Pan' ? 'treadle' : group === 'FX Loop' ? 'loop' : 'boss', knob: 'black' };
    [s, defs] = pedal(st, Math.min(paramCount, 5), glyph, id);
  }
  return SVG(s, defs, name);
}
export const micIcon = name => { const id = 'g' + (uid++); const [s, d] = MICS[micKind(name)](id); return SVG(/121/.test(name) ? `<g transform="translate(12 0) scale(.625 1)">${s}</g>` : s, d, name); };

// elemento DOM pronto para usar nos blocos
const host = svg => { const el = document.createElement('span'); el.className = 'gear'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = svg; return el; };
export const gearEl = spec => host(gearIcon(spec));
export const micEl = name => host(micIcon(name));
