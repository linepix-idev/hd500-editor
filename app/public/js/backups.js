// Backups sheet: every preset the editor overwrote is kept on disk; restore puts one back in its original slot.
import { h, api, fail, toast, modal } from './util.js';
import { presetLabel } from './store.js';
import { tr } from './i18n.js';
import { invalidate } from './panels.js';

const when = iso => { const d = new Date(iso); return Number.isNaN(+d) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };

export async function openBackups() {
  const body = h('div', { class: 'backups' }, h('p', { class: 'ios-footer' }, 'Loading…'));
  const close = modal('Backups', body);
  let list;
  try { list = await api('backups/detailed'); } catch (e) { fail(e); return; }
  const paint = () => body.replaceChildren(
    h('p', { class: 'ios-footer' }, 'Before the editor overwrites a preset in the pedal, it keeps a copy here. Restoring puts the copy back in its original slot (the current content of that slot is backed up first).'),
    list.length ? h('div', { class: 'ios-group' }, list.slice(0, 200).map(b => h('div', { class: 'row backup-row' },
      h('label', {}, h('b', {}, b.name || '—'), h('span', { class: 'dim' }, ` ${tr('Set')} ${b.set + 1} · ${presetLabel(b.preset)}`), h('small', { class: 'dim backup-when' }, when(b.at))),
      h('button', { class: 'tap-btn', type: 'button', onClick: async () => {
        if (!confirm(`${tr('Restore')} “${b.name}” → ${tr('Set')} ${b.set + 1} · ${presetLabel(b.preset)}?`)) return;
        try { const r = await api('backups/restore', { file: b.file }); invalidate(r.set); toast(`${tr('Restored')}: ${r.name}`); list = await api('backups/detailed'); paint(); } catch (e) { fail(e); }
      } }, 'Restore'))))
      : h('p', { class: 'ios-footer', style: { textAlign: 'center' } }, 'No backups yet.'));
  paint();
}
