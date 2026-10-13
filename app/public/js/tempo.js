// Tap tempo + the always-visible tempo pill in the signal-chain toolbar.
import { h, fail } from './util.js';
import { S } from './store.js';
import { edit } from './params.js';
import { icon } from './icons.js';

let taps = [], pill = null, out = null, dot = null;
const clampBpm = v => Math.min(240, Math.max(30, v));

export function setTempo(bpm, { send = true } = {}) {
  const v = Math.round(clampBpm(bpm) * 10) / 10;
  if (S.st) S.st.preset.tempo = v;
  paint(v); document.dispatchEvent(new CustomEvent('tempo', { detail: v }));
  if (send) edit('tempo', { bpm: v }).catch(fail);
}

/** Average of the last intervals; a pause longer than 2 s starts a new count. */
export function tapTempo() {
  const now = performance.now();
  if (taps.length && now - taps.at(-1) > 2000) taps = [];
  taps.push(now); taps = taps.slice(-6);
  pill?.classList.remove('tapped'); void pill?.offsetWidth; pill?.classList.add('tapped');
  if (taps.length < 2) return;
  const gaps = taps.slice(1).map((t, i) => t - taps[i]);
  setTempo(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
}

function paint(bpm = S.st?.preset?.tempo) {
  if (!out || !Number.isFinite(bpm)) return;
  out.textContent = bpm.toFixed(1).replace(/\.0$/, '');
  dot?.style.setProperty('--beat', `${(60 / bpm).toFixed(3)}s`);
}

export function initTempoPill(toolbar) {
  if (!toolbar || pill) return;
  out = h('b', { class: 'tempo-bpm', title: 'Double-click to type a tempo' }, '120');
  dot = h('i', { class: 'tempo-dot', 'aria-hidden': 'true' });
  out.ondblclick = () => { const t = prompt('Tempo (BPM, 30–240)', out.textContent); if (t != null && t.trim() !== '' && !Number.isNaN(Number(t))) setTempo(Number(t)); };
  const tap = h('button', { class: 'tap-btn', type: 'button', title: 'Tap the tempo (T)', 'aria-label': 'Tap tempo', onClick: tapTempo }, 'Tap');
  pill = h('div', { class: 'tempo-pill', role: 'group', 'aria-label': 'Tempo' }, dot, out, h('span', { class: 'tempo-unit' }, 'BPM'), tap);
  toolbar.prepend(pill);
  S.listeners.add(() => paint());
  paint();
}
