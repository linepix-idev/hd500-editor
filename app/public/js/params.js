import { h, api, fail, throttle, menu } from './util.js';
import { Knob } from './knob.js';
import { S } from './store.js';

export const NOTES = ['Whole', '1/2 (dot)', '1/2', '1/2 (3)', '1/4 (dot)', '1/4', '1/4 (3)', '8th (dot)', '8th', '8th (3)', '16 (dot)', '16', '16 (3)', '32 (dot)', '32', '32 (3)', '64 (dot)', '64', '64 (3)'];

/** Converte o valor normalizado (0..1) do pedal para a unidade do parâmetro. */
export function fmt(p, v) {
  const lerp = () => v * ((p.max ?? 1) - (p.min ?? 0)) + (p.min ?? 0);
  switch (p.kind) {
    case 'list': return p.options?.[Math.round(v)] ?? String(Math.round(v));
    case 'percent': return Math.round(v * 100) + '%';
    case 'freq': return Math.round(lerp()) + ' Hz';
    case 'freqk': return lerp().toFixed(1) + ' kHz';
    case 'range': return lerp().toFixed(1) + ' dB';
    case 'time': return Math.round(v * (p.maxMs ?? 1000)) + ' ms';
    case 'tempo': return v > 1 ? NOTES[Math.round(v) - 2] ?? '♪' : ((p.max ?? 0) >= 500 ? Math.round(lerp()) + ' ms' : lerp().toFixed(2) + ' Hz');
    default: return v.toFixed(2);
  }
}
export const edit = (op, args) => api('edit', { op, ...args });

function send(item, p, value) {
  p.value = value;
  throttle(`${item.id}:${p.id}:${p.index}`, () => {
    if (p.setup != null) return edit(p.float ? 'setupF' : 'setup', { id: p.setup, value }).catch(fail); // ajuste do preset (E.R., microfone)
    return edit(p.cab ? 'cabParam' : 'param', { item: item.id, index: p.index, id: p.id, value }).catch(fail);
  });
}

function ctlMenu(item, p) {
  return e => menu(e.clientX, e.clientY, [
    [`Controller: none${p.ctl === 0 ? ' ✓' : ''}`, () => edit('ctl', { item: item.id, index: p.index, ctl: 0, lo: p.value, hi: p.value }).catch(fail)],
    ...S.cat.ctl.slice(1).map((n, i) => [`Controller: ${n}${p.ctl === i + 1 ? ' ✓' : ''}`, () => edit('ctl', { item: item.id, index: p.index, ctl: i + 1, lo: p.ctl ? p.lo : 0, hi: p.ctl ? p.hi : 1 }).catch(fail)]),
  ]);
}

/** Controle de um parâmetro: knob, ou lista suspensa para parâmetros de opções. */
export function ParamControl(item, p, color) {
  if (p.kind === 'list' && p.options) {
    const sel = h('select', { 'aria-label': p.name, onChange: () => send(item, p, Number(sel.value)) }, p.options.map((o, i) => h('option', { value: i }, o)));
    sel.value = Math.round(p.value);
    const el = h('div', { class: 'knob listp', dataset: { pid: p.id, idx: p.index } }, sel, h('div', { class: 'lab' }, p.name));
    el.update = v => { sel.value = Math.round(v); };
    return el;
  }
  const badge = p.ctl ? (S.cat.ctl[p.ctl] ?? 'C').replace('EXP ', 'E') : null;
  const range = p.ctl ? [p.lo, p.hi] : null;
  const knob = Knob({
    label: p.name, value: Math.min(1, p.value), format: v => fmt(p, v), color, badge, range,
    title: `${p.name}${p.setup != null ? '' : p.ctl ? ` — controlled by ${S.cat.ctl[p.ctl]} (right-click to change)` : ' — right-click: assign to an expression pedal'}`,
    onInput: v => send(item, p, v), onContext: p.setup != null ? null : ctlMenu(item, p),
  });
  knob.dataset.pid = p.id; knob.dataset.idx = p.index;
  if (p.kind === 'tempo') { // atraso sincronizado ao tempo: lista de valores de nota
    const sync = h('select', { 'aria-label': `${p.name}: sync`, style: { marginTop: '4px', width: '92px', fontSize: '11px' }, onChange: () => { const n = Number(sync.value); if (n < 0) { send(item, p, 0.5); knob.update(0.5); } else { send(item, p, n + 2); knob.update(1); } } },
      h('option', { value: -1 }, 'Free'), NOTES.map((n, i) => h('option', { value: i }, '♪ ' + n)));
    sync.value = p.value > 1 ? Math.round(p.value) - 2 : -1;
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' }, dataset: { pid: p.id, idx: p.index } }, knob, sync);
    wrap.update = v => { knob.update(Math.min(1, v)); sync.value = v > 1 ? Math.round(v) - 2 : -1; };
    return wrap;
  }
  return knob;
}
