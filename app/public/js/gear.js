// Original flat gear silhouettes, readable at 32px and 64px.
import { STY } from './gear-styles.js';
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg = (art, name) => `<svg viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${esc(name)}">${art}</svg>`;
const rect = (x,y,w,h,r,color) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${color}"/>`;
const dot = (x,y,r,color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const dots = (n,y,color) => Array.from({length:n},(_,i)=>dot(32+(i-(n-1)/2)*10,y,3,color)).join('');
const featureColor = color => { const n=parseInt(color.slice(1),16); return ((n>>16&255)*.299+(n>>8&255)*.587+(n&255)*.114)>150?'#404044':'#ececef'; };
const baseKey = n => n.replace(/ Preamp$/, '').replace(/ (Normal|Bright|Vibrato|Clean|Crunch|OD|TB)$/, '').replace(/^Plexi Lead 100.*/, 'Plexi Lead 100').replace(/^Solo 100.*/, 'Solo 100');
function amp(name) {
  const st=STY.amps[baseKey(name)] ?? STY.amps[name.replace(/ Preamp$/,'')] ?? {tolex:'#292a2e',grille:'#77736b',panel:'#c5c2b9',controls:4};
  const combo=st.layout==='combo', y=combo?10:17, h=combo?46:32;
  return rect(4,y,56,h,6,st.tolex)+rect(9,y+5,46,11,3,st.panel)+rect(9,y+20,46,h-25,2,st.grille)+dots(Math.min(5,st.controls??4),y+10.5,featureColor(st.panel));
}
function pedal(name,group) {
  const st=STY.pedals[name] ?? {color:'#8b8d93',body:group==='Wah'||group==='Volume/Pan'?'treadle':'boss',feature:'switch'};
  const wide=['muff','rat','echo','spring','rack','loop'].includes(st.body);
  const body=st.body==='round'?dot(32,32,26,st.color):rect(wide?6:15,wide?15:5,wide?52:34,wide?34:54,7,st.color);
  const feature=st.body==='treadle'?rect(24,14,16,36,5,'#343437'):st.feature==='knobs'?dots(Math.min(3,st.controls??3),32,featureColor(st.color)):dot(32,wide?36:43,7,featureColor(st.color));
  return body+feature;
}
function cab(name) {
  const count=Math.min(4,Number(/^(\d)/.exec(name)?.[1]??1));
  const speakers=count===1?dot(32,32,15,'#747578'):count===2?dot(20,32,9,'#747578')+dot(44,32,9,'#747578'):[20,44].flatMap(x=>[20,44].map(y=>dot(x,y,9,'#747578'))).join('');
  return rect(4,6,56,52,6,'#343437')+speakers;
}
export function gearIcon({kind,name='',group=''}) { return svg(kind==='amp'?amp(name):kind==='cab'?cab(name):pedal(name,group),name); }
export const micIcon = name => svg(rect(23,5,18,31,9,/Rbn/.test(name)?'#b09b7d':'#92949a')+rect(29,36,6,17,3,'#55565b')+rect(21,52,22,5,2,'#55565b'),name);
const host = art => { const el=document.createElement('span'); el.className='gear'; el.setAttribute('aria-hidden','true'); el.innerHTML=art; return el; };
export const gearEl = spec => host(gearIcon(spec));
export const micEl = name => host(micIcon(name));
