import { h, modal } from './util.js';
import { gearEl, micEl } from './gear.js';
import { modelName, modelDescription, parameterDescription, micModels } from './descriptions.js';
import { icon } from './icons.js';
import { tr } from './i18n.js';

export function showModelInfo(model, { onBack } = {}) {
  const name = modelName(model), desc = modelDescription(model);
  const params = model.kind === 'cab' ? [...(model.params ?? []),
    ...['E.R.', 'Microphone'].filter(n => !(model.params ?? []).some(p => p.name === n || n === 'Microphone' && /Mic|Microfone/.test(p.name))).map(name => ({ name }))] : model.params ?? [];
  const content = h('article', { class: 'model-info' },
    h('div', { class: 'info-hero' }, model.kind === 'mic' ? micEl(name) : gearEl({ ...model, name, paramCount: params.length }),
      h('div', {}, h('span', { class: 'chip' }, tr(desc.group)), h('h2', {}, name),
        h('p', { class: 'based-on' }, model.basedOn ? tr(`Based on ${model.basedOn}`) : tr('Original gear not specified')))),
    h('p', {}, tr(desc.text)), desc.extra ? h('p', {}, tr(desc.extra)) : null,
    params.length ? h('section', {}, h('h3', {}, 'What the parameters do'),
      h('dl', { class: 'parameter-guide' }, params.map(p => h('div', {}, h('dt', {}, /Microfone/.test(p.name) ? 'Microphone' : p.name), h('dd', {}, tr(parameterDescription(p.name))))))) : null,
    model.kind === 'cab' ? h('section', {}, h('h3', {}, 'Microphones'),
      h('div', { class: 'mic-info-list' }, micModels.map(m => h('button', { onClick: () => showModelInfo(m, { onBack: () => showModelInfo(model, { onBack }) }) }, micEl(m.name), m.name, icon('help'))))) : null,
    onBack ? h('button', { class: 'info-back', onClick: () => { close(); onBack(); } }, icon('left'), 'Back to models') : null);
  const close = modal(tr(`Info — ${name}`), content);
}
export function infoButton(model, options) {
  return h('button', { class: 'model-info-button', title: tr(`Model info — ${modelName(model)}`), 'aria-label': tr(`Model info — ${modelName(model)}`), onClick: () => showModelInfo(model, options) }, h('span', { 'aria-hidden': 'true' }, 'i'));
}
