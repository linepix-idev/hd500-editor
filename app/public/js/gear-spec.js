import { gearEl as make } from './gear.js';
export const gearEl = make;
/** Dados do item da cadeia para escolher a ilustração (amp, cab ou pedal). */
export const gearSpec = it => ({ kind: it.kind, name: it.model, group: it.group ?? '', paramCount: it.params?.length ?? 3 });
