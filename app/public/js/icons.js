// Local symbols. No font, sprite request or network dependency.
const paths = {
  save: 'M4 3h10l3 3v11H3V3h1 M6 3v5h8V3 M6 17v-6h8v6',
  undo: 'M7 4 3 8l4 4 M3 8h8a5 5 0 0 1 0 10', redo: 'M13 4l4 4-4 4 M17 8h-8a5 5 0 0 0 0 10',
  reread: 'M16 7a6.5 6.5 0 1 0 .3 6 M16 3v4h-4',
  import: 'M10 2v10 M6 8l4 4 4-4 M3 13v4h14v-4', export: 'M10 12V2 M6 6l4-4 4 4 M3 13v4h14v-4',
  library: 'M2 6V4h6l2 2h8v11H2V6 M2 8h16', input: 'M6 2v6h8V2 M4 8h12v4l-6 5-6-5V8 M10 17v2',
  guitar: 'M13 2l3 3 M14 4l-6 7 M9 8c-2-2-4 0-3 2-4-1-5 4-2 6s7 0 5-3c3 0 3-3 1-4',
  mic: 'M7 3a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V3 M4 8v1a6 6 0 0 0 12 0V8 M10 15v3 M7 18h6',
  output: 'M3 7h4l4-4v14l-4-4H3V7 M14 6q6 4 0 8',
  footswitch: 'M3 6h14v11H3V6 M7 6V4h6v2 M7 12h6 M10 9v6', expression: 'M6 2h8l2 16H4L6 2 M7 6h6 M7 9h6 M7 12h6',
  amp: 'M3 3h14v14H3V3 M3 7h14 M6 5h.1 M10 5h.1 M14 5h.1 M6 10l8 4 M6 14l8-4',
  cab: 'M4 2h12v16H4V2 M13 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M13 14a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  dynamics: 'M2 10h3l2-6 3 12 3-12 2 6h3', distortion: 'M2 13h4V6h4v8h4V7h4',
  modulation: 'M2 10c3-10 5 10 8 0s5 10 8 0', delay: 'M3 5v10 M7 7v6 M11 5v10 M15 7v6 M18 9v2',
  reverb: 'M4 8v4 M8 5v10 M12 3v14 M16 1v18', filter: 'M2 15h5l5-10h6', pitch: 'M3 13h3l3-6 3 6h5 M13 4h4 M15 2v4',
  eq: 'M4 2v16 M10 2v16 M16 2v16 M2 6h4 M8 13h4 M14 8h4',
  volume: 'M3 7h4l4-4v14l-4-4H3V7 M15 7v6 M18 5v10', wah: 'M2 14q8 0 8-8t8 0', loop: 'M4 5h12l-3-3 M16 5v6 M16 15H4l3 3 M4 15V9',
  trash: 'M3 5h14 M7 5V2h6v3 M5 5l1 13h8l1-13 M8 8v7 M12 8v7',
  copy: 'M7 7h10v11H7V7 M4 14H2V2h11v2', paste: 'M7 4H4v14h12V4h-3 M7 2h6v4H7V2',
  edit: 'M3 17l1-4 9-9 3 3-9 9-4 1 M12 5l3 3',
  mixer: 'M5 2v16 M10 2v16 M15 2v16 M3 7h4 M8 13h4 M13 5h4',
  settings: 'M10 2l2 3 3-1 1 3 3 2-3 2-1 4-3-1-2 3-2-3-3 1-1-4-3-2 3-2 1-3 3 1 2-3 M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  help: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M7 7a3 3 0 0 1 6 0c0 2-3 2-3 4 M10 14h.1',
  sun: 'M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M10 1v2 M10 17v2 M1 10h2 M17 10h2 M4 4l1 1 M15 15l1 1 M4 16l1-1 M15 5l1-1',
  moon: 'M17 12a8 8 0 1 1-9-10 7 7 0 0 0 9 10', globe: 'M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M2 10h16 M10 2c-5 4-5 12 0 16 5-4 5-12 0-16',
  eye: 'M1 10q9-12 18 0-9 12-18 0 M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0', power: 'M10 2v8 M6 4a7 7 0 1 0 8 0',
  left: 'M12 4l-6 6 6 6', right: 'M8 4l6 6-6 6', down: 'M4 7l6 6 6-6', up: 'M4 13l6-6 6 6',
  sidebar: 'M2 3h16v14H2V3 M7 3v14', search: 'M13 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M12 12l5 5',
  plus: 'M10 4v12 M4 10h12', close: 'M5 5l10 10 M15 5 5 15', more: 'M4 10h.1 M10 10h.1 M16 10h.1',
  check: 'M4 10l4 4 8-8', swap: 'M2 6h16l-3-3 M18 14H2l3 3', colors: 'M10 2a8 8 0 1 0 0 16c3 0 0-4 3-4h2c5 0 4-12-5-12 M6 6h.1 M10 5h.1 M14 7h.1 M5 11h.1',
};
export function icon(name, cls = '') {
  const ns = 'http://www.w3.org/2000/svg', el = document.createElementNS(ns, 'svg');
  for (const [k,v] of Object.entries({viewBox:'0 0 20 20',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false',class:`symbol ${cls}`})) el.setAttribute(k,v);
  const p = document.createElementNS(ns,'path'); p.setAttribute('d',paths[name] ?? paths.input); el.append(p); return el;
}
export const categoryIcon = it => it.kind !== 'fx' ? it.kind : ({'Dynamics':'dynamics','Distortion':'distortion','Modulation':'modulation','Delay':'delay','Reverb':'reverb','Filter':'filter','Pitch':'pitch','Preamp+EQ':'eq','Volume/Pan':'volume','Wah':'wah','FX Loop':'loop'})[it.group] ?? 'plus';
export function buttonIcon(el, name, label) { el.replaceChildren(icon(name), ...(label ? [document.createTextNode(label)] : [])); }
export function menuIcon(label) {
  return /clear|delete/i.test(label) ? 'trash' : /copy/i.test(label) ? 'copy' : /paste/i.test(label) ? 'paste' : /swap/i.test(label) ? 'swap' : /export/i.test(label) ? 'export' : /import/i.test(label) ? 'import' : /off|on/i.test(label) ? 'power' : /foot|controller/i.test(label) ? 'footswitch' : /model/i.test(label) ? 'amp' : /help/i.test(label) ? 'help' : /set|bundle|list/i.test(label) ? 'library' : /read|reconnect|discard/i.test(label) ? 'reread' : /English|Português/i.test(label) ? 'globe' : 'right';
}
