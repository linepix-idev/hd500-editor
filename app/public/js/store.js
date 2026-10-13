// Estado compartilhado da interface.
export const S = { cat: null, st: null, sel: 4, tab: 'setup', pressed: new Set(), listeners: new Set() };
export const onChange = f => S.listeners.add(f);
export const notify = () => S.listeners.forEach(f => f());
export const item = id => S.st?.preset?.items.find(i => i.id === id);
export const GROUP_CLASS = g => 'g-' + (g ?? 'none').replace(/[^a-zA-Z0-9]+/g, '-');
export const presetLabel = (p) => `${Math.floor(p / 4) + 1}${'ABCD'[p % 4]}`; // 1A..16D, como no pedal
