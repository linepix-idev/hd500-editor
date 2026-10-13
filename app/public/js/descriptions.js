import { DESCRIPTIONS as D } from './descriptions-data.js';

export const micModels = D.micModels.map(name => ({ kind: 'mic', name, params: [] }));
export const modelName = model => model.name ?? model.model ?? '';
export const parameterDescription = name => D.parameters[/Microfone/.test(name) ? 'Microphone' : name] ?? D.fallback;
export function modelDescription(model) {
  const name = modelName(model);
  if (/^(Amp Disabled|None)$/.test(name)) return { group: model.kind === 'amp' ? 'Amp' : 'Effect', text: D.disabled };
  if (model.kind === 'mic') {
    const family = /Rbn/.test(name) ? 'ribbon' : /Cond/.test(name) ? 'condenser' : 'dynamic';
    return { group: { dynamic: 'Dynamic', ribbon: 'Ribbon', condenser: 'Condenser' }[family],
      text: D.mics[family], extra: /Off XS/.test(name) ? D.mics.offAxis : '' };
  }
  if (model.kind === 'amp') {
    const family = Object.entries(D.ampFamilies).find(([, prefixes]) => prefixes.some(p => name.includes(p)))?.[0] ?? 'crunch';
    return { group: { clean: 'Clean', crunch: 'Crunch', highGain: 'High gain', bass: 'Bass amp', acoustic: 'Acoustic' }[family],
      text: D.amps[family], extra: /Preamp$/.test(name) ? D.amps.preamp : '' };
  }
  if (model.kind === 'cab') {
    const count = /^(\d)(?:x)?\d/.exec(name)?.[1] ?? '1';
    return { group: 'Cabinet', text: D.cabs[/No Cab/.test(name) ? 'none' : count === '1' ? 'single' : count === '2' || name.startsWith('6x9') ? 'dual' : 'quad'] };
  }
  return { group: model.group ?? 'Effect', text: D.groups[model.group] ?? D.fallback };
}
export function modelSearchText(model, translate = s => s) {
  const desc = modelDescription(model);
  return [modelName(model), model.basedOn, translate(desc.group), translate(desc.text), translate(desc.extra),
    ...(model.params ?? []).flatMap(p => [p.name, translate(parameterDescription(p.name))])].filter(Boolean).join(' ');
}
