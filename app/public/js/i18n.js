// Tradução em tempo de execução. O código-fonte está em inglês; no modo português as strings conhecidas
// (tabela gerada em i18n-pt.js) são trocadas nos nós de texto, atributos e diálogos do navegador.
import { PT } from './i18n-pt.js';

export const langs = { en: 'English', pt: 'Português' };
const stored = (() => { try { return localStorage.getItem('hd500.lang'); } catch { return null; } })();
export const lang = stored ?? (navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en');
export function setLang(l) { try { localStorage.setItem('hd500.lang', l); } catch {} location.reload(); }
document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';

// regras: texto exato, ou modelo com ${...} (só quando há texto fixo suficiente para não confundir)
const exact = new Map(), rules = [];
const tokens = s => { const out = []; let last = 0; for (const m of s.matchAll(/\$\{(.*?)\}/g)) { if (m.index > last) out.push({ lit: s.slice(last, m.index) }); out.push({ expr: m[1] }); last = m.index + m[0].length; } if (last < s.length) out.push({ lit: s.slice(last) }); return out; };
for (const [en, pt] of Object.entries(PT)) {
  if (!en.includes('${')) { exact.set(en.trim(), pt.trim()); continue; }
  const et = tokens(en.trim()), pt_ = tokens(pt.trim()), lit = et.filter(t => t.lit).map(t => t.lit).join('');
  if (lit.trim().length < 6) continue;
  const exprs = et.filter(t => t.expr).map(t => t.expr);
  const re = new RegExp('^' + et.map(t => (t.lit != null ? t.lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '(.+?)')).join('') + '$', 's');
  rules.push({ re, render: g => pt_.map(t => (t.lit != null ? t.lit : g[exprs.indexOf(t.expr)] ?? '')).join('') });
}
export function tr(s) {
  if (lang !== 'pt' || typeof s !== 'string') return s;
  const t = s.trim(); if (!t) return s;
  const hit = exact.get(t); if (hit != null) return s.replace(t, hit);
  for (const r of rules) { const m = r.re.exec(t); if (m) return s.replace(t, r.render(m.slice(1))); }
  return s;
}

const ATTRS = ['title', 'placeholder', 'aria-label', 'data-hint'];
function walk(node) {
  if (node.nodeType === 3) { const v = tr(node.nodeValue); if (v !== node.nodeValue) node.nodeValue = v; return; }
  if (node.nodeType !== 1) return;
  for (const a of ATTRS) if (node.hasAttribute(a)) { const v = tr(node.getAttribute(a)); if (v !== node.getAttribute(a)) node.setAttribute(a, v); }
  for (const c of node.childNodes) walk(c);
}
if (lang === 'pt') {
  const ob = new MutationObserver(muts => {
    ob.disconnect();
    for (const m of muts) { if (m.type === 'childList') m.addedNodes.forEach(walk); else if (m.type === 'characterData') walk(m.target); else if (m.type === 'attributes') walk(m.target); }
    ob.observe(document.documentElement, cfg);
  });
  const cfg = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };
  walk(document.documentElement); ob.observe(document.documentElement, cfg);
  for (const fn of ['confirm', 'prompt', 'alert']) { const orig = window[fn].bind(window); window[fn] = (msg, ...rest) => orig(tr(String(msg)), ...rest); }
  document.title = tr(document.title);
}
