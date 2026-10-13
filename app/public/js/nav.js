import { api, fail } from './util.js';
import { S, notify } from './store.js';

/** Troca de preset/set. Trocar descarta o buffer de edição, então pede confirmação se houver alterações não salvas. */
export function selectSlot(set, preset) {
  if (S.st?.dirty && !confirm('This preset has unsaved changes. Switching presets will discard them. Continue?')) { notify(); return null; }
  return api('select', { set, preset }).catch(fail);
}
