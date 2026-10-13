import { h, api, fail, toast } from './util.js';
import { S, notify, GROUP_CLASS } from './store.js';
import { ParamControl, edit, fmt } from './params.js';
import { pickModel } from './picker.js';
import { icon, categoryIcon } from './icons.js';

const GROUP_COLOR = g => `var(--g-${({ 'Preamp+EQ': 'preamp', 'Volume/Pan': 'volume', 'FX Loop': 'fx' })[g] ?? (g ?? 'none').toLowerCase()})`;

let inspectedKey = null;
export function renderInspector(root) {
  const it = S.st.preset.items.find(i => i.id === S.sel);
  if (!it) { root.replaceChildren(h('div', { class: 'placeholder' }, 'Select a block in the signal chain.')); return; }
  const key = `${it.id}:${it.type}`;
  if(root.querySelector('.knob[data-dragging]') && key === inspectedKey) return;
  if(inspectedKey != null && key !== inspectedKey && !matchMedia('(prefers-reduced-motion: reduce)').matches) root.animate([{ opacity: .7, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
  inspectedKey = key;
  const color = it.kind === 'amp' ? 'var(--amp)' : it.kind === 'cab' ? 'var(--cab)' : GROUP_COLOR(it.group);
  const kindName = it.kind === 'amp' ? `Amp ${it.id === 0 ? 'A' : 'B'}` : it.kind === 'cab' ? `Cab ${it.id === 1 ? 'A' : 'B'}` : `Effect ${it.id - 3}`;
  const fsSel = h('select', { 'aria-label': 'Footswitch', onChange: () => edit('fs', { item: it.id, fs: Number(fsSel.value) }).catch(fail) },
    S.cat.fs.map((n, i) => h('option', { value: i }, n === '—' ? 'No footswitch' : n)));
  fsSel.value = it.fs;

  const head = h('div', { class: 'insp-head', style: { '--c': color } },
    h('span', { class: 'category-tile' }, icon(categoryIcon(it))),
    h('div', { class: 'insp-title' }, h('span', { class: 'chip' }, kindName),
      h('button', { class: 'model-title', title: 'Change model…', 'aria-label': 'Change model…', onClick: () => pickModel(it) }, it.empty ? 'Choose model…' : it.model, icon('down'))),
    it.kind === 'fx' && !it.empty ? h('label', { class: 'fs-assign', title: 'Footswitch' }, icon('footswitch'), fsSel) : null,
    !it.empty ? h('button', { class: 'switch', role: 'switch', 'aria-label': 'Block enabled', 'aria-checked': String(it.active), title: 'Toggle (bypass)', onClick: () => { it.active = !it.active; notify(); api('edit', { op: 'active', item: it.id, active: it.active }).catch(fail); } }) : null);

  if (it.empty) { root.replaceChildren(head, h('div', { class: 'placeholder' }, icon('plus'), 'This slot is empty. Choose a model to start.')); return; }
  const knobs = h('div', { class: 'knobs', style: { '--c': color } }, it.params.map(p => ParamControl(it, p, color)));
  const ctls = it.params.filter(p => p.ctl);
  const dt = it.kind === 'amp' && it.dt ? DtRow(it) : null;
  const ctlBox = ctls.length ? h('div', { class: 'controller-range', style: { marginTop: '16px' } }, h('h3', { style: { fontSize: '13px', margin: '0 0 6px' } }, 'Controllers (expression pedal)'),
    ...ctls.map(p => RangeRow(it, p))) : null;
  root.replaceChildren(...[head, it.params.length ? knobs : h('div', { class: 'placeholder' }, 'No parameters.'), dt, ctlBox].filter(Boolean));
}

// Dynamic Tone: ajustes dos amplificadores DT (topologia, classe, modo) — valem para qualquer amp, mas só soam diferente nos modelos DT
function DtRow(it) {
  const mk = (label, key, opts, map) => {
    const sel = h('select', { 'aria-label': label, onChange: () => { const raw = Number(sel.value); it.dt[key] = raw ? (key === 'topology' ? raw : 1) : 0; api('edit', { op: 'setup', id: it.dt.ids[key], value: key === 'topology' ? raw : raw ? 127 : 0 }).catch(fail); } },
      opts.map((o, i) => h('option', { value: i }, o)));
    sel.value = it.dt[key]; return h('label', { class: 'dim' }, `${label} `, sel);
  };
  return h('div', { class: 'row', style: { marginTop: '14px', gap: '16px' }, title: 'Dynamic Tone (Line 6 DT25/DT50 amplifiers)' },
    h('b', { style: { fontSize: '12px' } }, 'Dynamic Tone'), mk('Topology', 'topology', ['I', 'II', 'III', 'IV']), mk('Class', 'class', ['A', 'A/B']), mk('Mode', 'mode', ['Tri', 'Pent']));
}

function RangeRow(it, p) {
  const out = h('span', { class: 'dim', style: { minWidth: '120px' } });
  const mk = (which) => { const i = h('input', { type: 'range', min: 0, max: 1, step: 0.005, value: p[which], 'aria-label': `${p.name} ${which === 'lo' ? 'heel' : 'toe'}`,
    onInput: () => { p[which] = Number(i.value); paint(); clearTimeout(i._t); i._t = setTimeout(() => edit('range', { item: it.id, index: p.index, lo: p.lo, hi: p.hi }).catch(fail), 120); } }); return i; };
  const lo = mk('lo'), hi = mk('hi');
  const paint = () => { out.textContent = `${fmt(p, p.lo)} → ${fmt(p, p.hi)}`; };
  paint();
  return h('div', { class: 'row' }, h('label', {}, `${p.name} · ${S.cat.ctl[p.ctl]}`), h('small', { class: 'dim' }, 'heel'), lo, h('small', { class: 'dim' }, 'toe'), hi, out);
}

// atualiza um knob sem redesenhar (alterações vindas do pedal)
export function patchParam(item, id, value) {
  const el = document.querySelector(`#inspector [data-pid="${id}"]`);
  if (el && S.sel === item) el.update?.(value);
}
