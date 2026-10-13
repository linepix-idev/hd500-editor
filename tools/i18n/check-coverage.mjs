#!/usr/bin/env node
// A small lexical scan of UI call sites, without dependencies or executing browser code.
// Dynamic catalog/server values and strings reached only through variables need separate review.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const attrs = new Set(['title', 'aria-label', 'placeholder', 'data-hint']);
const technical = new Set(['i', 'id', 'offset', 'Echoplex', 'Pan', 'Tap', 'Trails', 'Mixer', 'Stereo', 'Multi', 'Wah', 'Amp', 'Cab', 'EXP', 'BPM', 'MIDI', 'MIDI byte', 'dB', 'Hz', 'ms', 'Q', 'E.R.', '0x']);
for (const [name, d] of Object.entries(JSON.parse(readFileSync(resolve(root, 'catalog/fx-origins.details.json'), 'utf8')))) {
  for (const token of [name, d.maker, d.unit]) if (token && !/\s/.test(token)) technical.add(token);
}

// Balanced tokens keep callbacks, attributes and nested h() calls out of text arguments.
function tokenize(source) {
  let pos = 0;
  function sequence(end) {
    const out = [];
    while (pos < source.length) {
      const start = pos, c = source[pos];
      if (c === end) { pos++; break; }
      if (/\s/.test(c)) { pos++; continue; }
      if (source.startsWith('//', pos)) { pos = source.indexOf('\n', pos); if (pos < 0) pos = source.length; continue; }
      if (source.startsWith('/*', pos)) { const close = source.indexOf('*/', pos + 2); pos = close < 0 ? source.length : close + 2; continue; }
      if (c === '"' || c === "'" || c === '`') {
        pos++; let value = '', expressions = [];
        while (pos < source.length && source[pos] !== c) {
          if (source[pos] === '\\') {
            pos++; const escaped = source[pos++];
            value += ({ n: '\n', r: '\r', t: '\t' })[escaped] ?? escaped; continue;
          }
          if (c === '`' && source.startsWith('${', pos)) {
            pos += 2; const from = pos; expressions.push(sequence('}'));
            value += '${' + source.slice(from, pos - 1) + '}'; continue;
          }
          value += source[pos++];
        }
        pos++; out.push({ type: 'string', value, expressions, start }); continue;
      }
      // Regex literals contain punctuation that must not affect argument balancing.
      const prev = out.at(-1);
      if (c === '/' && (!prev || prev.type !== 'group' && ['=', ':', ',', '?', '!', '&&', '||', 'return', '=>'].includes(prev.value))) {
        pos++; let bracket = false;
        while (pos < source.length) {
          const ch = source[pos++];
          if (ch === '\\') { pos++; continue; }
          if (ch === '[') bracket = true;
          if (ch === ']') bracket = false;
          if (ch === '/' && !bracket) break;
        }
        while (/[a-z]/i.test(source[pos] ?? '') && pos < source.length) pos++;
        out.push({ type: 'regex', value: source.slice(start, pos), start }); continue;
      }
      if ('([{'.includes(c)) { pos++; out.push({ type: 'group', value: c, children: sequence({ '(': ')', '[': ']', '{': '}' }[c]), start }); continue; }
      const match = /^(?:[\w$]+|===|!==|==|!=|=>|\?\?|\?\.|&&|\|\||\.\.\.)/.exec(source.slice(pos));
      const value = match?.[0] ?? c; pos += value.length;
      out.push({ type: /^\w|^\$/.test(value) ? 'word' : 'punct', value, start });
    }
    return out;
  }
  return sequence();
}
const split = tokens => {
  const result = [[]];
  for (const token of tokens) { if (token.value === ',' && token.type === 'punct') result.push([]); else result.at(-1).push(token); }
  return result;
};

export function extractVisibleStrings(source) {
  const found = new Map();
  const add = token => {
    const text = token.value.trim();
    if (text) found.set(`${token.start}:${text}`, { text, line: source.slice(0, token.start).split('\n').length });
  };
  function textExpression(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'string') {
        if (!['===', '!==', '==', '!='].includes(tokens[i - 1]?.value) && !['===', '!==', '==', '!='].includes(tokens[i + 1]?.value)) add(t);
        // Literal alternatives within a template expression can also be visible.
        t.expressions.forEach(textExpression);
      } else if (t.type === 'group' && t.value !== '{') {
        const previous = tokens[i - 1];
        const isCall = t.value === '(' && (previous?.type === 'word' || previous?.type === 'group');
        if (!isCall || previous?.value === 'tr') textExpression(t.children);
      }
    }
  }
  function visit(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i], next = tokens[i + 1];
      if (attrs.has(t.value) && next?.value === ':') {
        const rest = tokens.slice(i + 2), end = rest.findIndex(x => x.type === 'punct' && x.value === ',');
        textExpression(end < 0 ? rest : rest.slice(0, end));
      }
      if (t.type === 'word' && next?.type === 'group' && next.value === '(') {
        const args = split(next.children);
        if (t.value === 'h') args.slice(2).forEach(textExpression);
        if (['toast', 'modal', 'tr', 'confirm', 'prompt', 'alert'].includes(t.value)) textExpression(args[0] ?? []);
        if (t.value === 'menu') menuLabels(args[2] ?? []);
      }
      if (t.children) visit(t.children);
      if (t.expressions) t.expressions.forEach(visit);
    }
  }
  function menuLabels(tokens) {
    for (const t of tokens) {
      if (t.type !== 'group') continue;
      if (t.value === '[') {
        const parts = split(t.children);
        // A menu entry is [label, callback]; the outer array has more entries.
        if (parts.length === 2 && parts[1].some(x => x.value === '=>' || x.type === 'word')) textExpression(parts[0]);
      }
      menuLabels(t.children);
    }
  }
  visit(tokenize(source));
  return [...found.values()];
}

// Same template-literal shape as the runtime translator; expression variable names differ
// between call sites. Tiny fragments, identifiers used in diagnostics, units and URLs
// don't need translation. Ordinary one-word UI labels (Close, Loading, etc.) still do.
export function needsTranslation(text) {
  const fixed = text.replace(/\$\{.*?\}/gs, '').trim().replace(/\s+/g, ' ');
  if (!/[A-Za-z]/.test(fixed) || technical.has(fixed)) return false;
  if (/^(?:https?:\/\/|catalog\/|tools\/|[.#][\w-]|(?:EXP|FS)\b|(?:cmd )?0x|[A-Z] \+ [A-Z]$)/.test(fixed)) return false;
  if (/^(?:[a-z]+[A-Z]\w*|[\w.-]+\.(?:js|json|mjs|h5e)|b[0-5](?: b[0-5])*)$/.test(fixed)) return false;
  return true;
}
const shape = text => text.replace(/\$\{.*?\}/gs, '${…}');
export function checkCoverage() {
  const pairs = JSON.parse(readFileSync(resolve(root, 'tools/i18n/pairs.json'), 'utf8'));
  const known = new Set(pairs.map(([, en]) => shape(en.trim())));
  const missing = new Map(); let scanned = 0;
  for (const file of readdirSync(resolve(root, 'app/public/js')).filter(f => f.endsWith('.js') && !['i18n.js', 'i18n-pt.js'].includes(f)).sort()) {
    for (const item of extractVisibleStrings(readFileSync(resolve(root, 'app/public/js', file), 'utf8'))) {
      if (!needsTranslation(item.text)) continue;
      scanned++;
      if (known.has(shape(item.text))) continue;
      if (!missing.has(item.text)) missing.set(item.text, []);
      missing.get(item.text).push(`${file}:${item.line}`);
    }
  }
  return { scanned, missing };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { scanned, missing } = checkCoverage();
  for (const [text, locations] of missing) console.log(`  ${JSON.stringify(text)} — ${locations.join(', ')}`);
  console.log(`UI i18n coverage: ${missing.size} missing translations (${scanned} visible literals scanned; report only).`);
}
