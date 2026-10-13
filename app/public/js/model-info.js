import { h, modal } from './util.js';
import { gearEl, micEl } from './gear.js';
import { modelName, modelDescription, parameterDescription, micModels } from './descriptions.js';
import { icon } from './icons.js';
import { lang, tr } from './i18n.js';

function sourceLabel(source) {
  if (/^tools\/sources\/pod-hd-model-gallery\.txt:[1-9]\d*$/.test(source)) return tr('Line 6 POD HD Model Gallery');
  if (/^catalog\/fx-origins\.json:[1-9]\d*$/.test(source)) return tr('Line 6 POD HD Model Gallery (origin list)');
  return source;
}

function displayedFacts(model) {
  const d = model.details;
  if (!d) return [];
  const identity = [d.maker, d.unit].filter(Boolean).join(' ');
  return (d.facts ?? []).filter(f => !identity || f.text !== `${modelName(model)} origin: ${identity}.`);
}

function sourcesEl(facts) {
  const groups = new Map();
  facts.forEach((fact, i) => {
    const label = sourceLabel(fact.source);
    if (!groups.has(label)) groups.set(label, { source: fact.source, numbers: [] });
    groups.get(label).numbers.push(i + 1);
  });
  return h('p', { class: 'origin-sources' }, h('strong', {}, tr('Source'), ': '),
    [...groups].map(([label, { source, numbers }], i) => h('span', {}, i ? '; ' : '',
      /^https?:\/\//.test(source) ? h('a', { href: source, target: '_blank', rel: 'noopener noreferrer' }, label) : label,
      ' ', numbers.map(n => `[${n}]`).join(''))));
}

export function showModelInfo(model, { onBack } = {}) {
  const name = modelName(model), desc = modelDescription(model), details = model.details;
  const facts = displayedFacts(model);
  const params = model.kind === 'cab' ? [...(model.params ?? []),
    ...['E.R.', 'Microphone'].filter(n => !(model.params ?? []).some(p => p.name === n || n === 'Microphone' && /Mic|Microfone/.test(p.name))).map(name => ({ name }))] : model.params ?? [];
  const content = h('article', { class: 'model-info' },
    h('div', { class: 'info-hero' }, model.kind === 'mic' ? micEl(name) : gearEl({ ...model, name, paramCount: params.length }),
      h('div', {}, h('span', { class: 'chip' }, tr(desc.group)), h('h2', {}, name),
        h('p', { class: 'based-on' }, model.basedOn ? tr(`Based on ${model.basedOn}`) : tr('Original gear not specified')))),
    h('p', {}, tr(desc.text)), desc.extra ? h('p', {}, tr(desc.extra)) : null,
    details ? h('section', { class: 'origin-details' },
      h('dl', { class: 'origin-identity' },
        h('div', {}, h('dt', {}, tr('Maker')), h('dd', {}, details.maker ?? tr('Not specified'))),
        h('div', {}, h('dt', {}, tr('Unit')), h('dd', {}, details.unit ?? tr('Not specified')))),
      details.original === true ? h('p', {}, tr('Line 6 original')) : null,
      details.notes ? h('p', { class: 'origin-notes' }, lang === 'pt' ? details.notes_pt : details.notes) : null,
      facts.length ? h('div', {}, h('h3', {}, tr('Documented facts')),
        h('ol', { class: 'origin-facts' }, facts.map(f => h('li', {}, lang === 'pt' ? f.text_pt : f.text))),
        sourcesEl(facts)) : null) : null,
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
