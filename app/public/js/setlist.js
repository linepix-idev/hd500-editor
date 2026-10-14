// Setlist: print (or save as PDF from the print dialog) and CSV export of a set's preset names.
import { h, api, fail, toast, modal, download } from './util.js';
import { S, presetLabel } from './store.js';
import { tr } from './i18n.js';

export async function openSetlist() {
  const sets = S.st?.setNames ?? []; let set = S.st?.selection?.set ?? 0, names = null, request = 0;
  const sheet = h('div', { class: 'setlist-sheet' });
  const pick = h('select', { 'aria-label': 'Set', onChange: async () => { set = Number(pick.value); await load(); } }, sets.map((n, i) => h('option', { value: i, selected: i === set }, `${i + 1} · ${n}`)));
  const draw = () => sheet.replaceChildren(
    h('h2', { class: 'setlist-title' }, `${sets[set] ?? ''}`), h('p', { class: 'setlist-sub' }, `${tr('Set')} ${set + 1} · HD500`),
    h('div', { class: 'setlist-grid' }, Array.from({ length: 16 }, (_, bank) => h('div', { class: 'setlist-bank' },
      h('h4', {}, `${tr('Bank')} ${bank + 1}`),
      ...Array.from({ length: 4 }, (_, k) => { const i = bank * 4 + k; return h('div', { class: 'setlist-item' }, h('b', {}, presetLabel(i)), h('span', {}, names?.[i] ?? '…')); })))));
  const load = async () => { const id = ++request; names = null; draw(); try { const result = await api('library/slots', { set }); if (id !== request) return; names = result; draw(); } catch (e) { if (id === request) fail(e); } };
  const csv = () => download(`hd500-set${set + 1}.csv`, ['slot,name', ...names.map((n, i) => `${presetLabel(i)},"${String(n).replace(/"/g, '""')}"`)].join('\n'), 'text/csv');
  modal('Setlist', h('div', {}, h('div', { class: 'ios-group setlist-controls' }, h('div', { class: 'row' }, h('label', {}, 'Set'), pick),
    h('div', { class: 'row' }, h('label', {}, 'Export'), h('span', { class: 'setlist-actions' }, h('button', { class: 'tap-btn', type: 'button', onClick: () => names ? window.print() : toast('Still reading the set…') }, 'Print / PDF'), h('button', { class: 'tap-btn', type: 'button', onClick: () => names ? csv() : toast('Still reading the set…') }, 'CSV')))), sheet));
  await load();
}
