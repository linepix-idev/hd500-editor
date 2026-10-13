import { h, api, fail, modal, toast } from './util.js';
import { S, GROUP_CLASS, presetLabel } from './store.js';

/** Escolha de modelo (amp, cab ou efeito) para um bloco. */
export function pickModel(item) {
  const list = item.kind === 'amp' ? S.cat.amps : item.kind === 'cab' ? S.cat.cabs : S.cat.pedals;
  const q = h('input', { type: 'search', placeholder: 'Search model…', 'aria-label': 'Search model' });
  const grid = h('div', { class: 'models' });
  let close;
  const draw = () => {
    const term = q.value.trim().toLowerCase(), groups = new Map();
    for (const m of list) { if (term && !m.name.toLowerCase().includes(term) && !(m.group ?? '').toLowerCase().includes(term)) continue; const g = m.group ?? (item.kind === 'amp' ? 'Amps' : 'Cabs'); (groups.get(g) ?? groups.set(g, []).get(g)).push(m); }
    grid.replaceChildren(...[...groups].flatMap(([g, ms]) => [
      h('h4', { class: GROUP_CLASS(g === 'Amps' || g === 'Cabs' ? null : g) }, g),
      ...ms.map(m => h('button', { class: `${GROUP_CLASS(m.group)} ${m.type === item.type ? 'cur' : ''}`, onClick: () => { close(); api('edit', { op: 'model', item: item.id, type: m.type }).catch(fail); } }, m.name)),
    ]));
  };
  q.addEventListener('input', draw); draw();
  close = modal(`Model — ${item.kind === 'amp' ? 'Amp' : item.kind === 'cab' ? 'Cab' : 'Effect'}`, [q, grid]);
  q.focus();
}

/** Escolha de preset (set + posição) com os nomes lidos do pedal. */
export function pickPreset(onPick, { title = 'Choose preset', set: set0 } = {}) {
  let set = set0 ?? S.st.selection.set, names = null;
  const sel = h('select', { 'aria-label': 'Set' }, S.st.setNames.map((n, i) => h('option', { value: i }, `${i + 1} · ${n}`)));
  sel.value = set;
  const grid = h('div', { class: 'slots', style: { maxHeight: '55vh' } });
  const bar = h('div', { class: 'bar', hidden: true }, h('i'));
  const draw = () => grid.replaceChildren(...Array.from({ length: S.cat.presets }, (_, i) =>
    h('button', { class: `slot ${set === S.st.selection.set && i === S.st.selection.preset ? 'cur' : ''}`, onClick: () => { close(); onPick(set, i); } },
      h('i', {}, presetLabel(i)), h('span', {}, names ? names[i] : '…'))));
  const load = async () => {
    set = Number(sel.value); names = null; draw(); bar.hidden = false;
    try { names = await api('library/slots', { set }); } catch (e) { fail(e); }
    bar.hidden = true; draw();
  };
  sel.onchange = load;
  const close = modal(title, [h('div', { class: 'row' }, sel, h('span', { class: 'dim' }, 'names read from the pedal')), bar, grid]);
  load();
}
export function pickDestination(title, cb) { pickPreset((s, p) => cb({ set: s, preset: p }), { title }); }
