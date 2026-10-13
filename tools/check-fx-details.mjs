#!/usr/bin/env node
// A deliberately cheap provenance check, not a substitute for reading the cited model's column.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJSON = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const allowedFiles = new Set([
  'tools/sources/pod-hd-model-gallery.txt', 'catalog/fx-origins.json',
  'catalog/fx-origins.manual.json', 'catalog/catalog.json',
]);
const words = text => new Set(text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? []);

export function checkFxDetails(details, pedals = readJSON('catalog/catalog.json').pedals) {
  const errors = [], sources = new Map();
  if (!details || typeof details !== 'object' || Array.isArray(details)) return ['Details must be an object'];
  const names = new Set(pedals.map(p => p.name));
  for (const name of Object.keys(details)) if (!names.has(name)) errors.push(`Unknown model: ${name}`);
  for (const pedal of pedals) {
    const name = pedal.name, d = details[name];
    if (!d || typeof d !== 'object' || Array.isArray(d)) { errors.push(`${name}: missing details`); continue; }
    for (const key of ['maker', 'unit', 'kind', 'notes']) {
      if (d[key] !== null && (typeof d[key] !== 'string' || !d[key].trim())) errors.push(`${name}: ${key} must be a nonempty string or null`);
    }
    if (d.kind !== (pedal.group?.toLowerCase() ?? null)) errors.push(`${name}: kind must come from the catalog group`);
    if (typeof d.notes === 'string' && [...d.notes].length > 160) errors.push(`${name}: notes exceed 160 characters`);
    if (![true, false, null].includes(d.original)) errors.push(`${name}: original must be true, false or null`);
    if (!Array.isArray(d.facts)) { errors.push(`${name}: facts must be an array`); continue; }
    let explicitOriginal = false;
    for (const [index, fact] of d.facts.entries()) {
      const label = `${name} fact ${index + 1}`;
      if (!fact || typeof fact.text !== 'string' || !fact.text.trim()) { errors.push(`${label}: missing text`); continue; }
      if (typeof fact.source !== 'string' || !fact.source.trim()) { errors.push(`${label}: missing source`); continue; }
      if (/^https?:\/\//.test(fact.source)) {
        try { const url = new URL(fact.source); if (!url.hostname || url.username || url.password) throw new Error(); }
        catch { errors.push(`${label}: invalid URL`); }
        // URL facts require human review against the official/Wikipedia page; no network is used here.
        continue;
      }
      const citation = /^(.*):([1-9]\d*)$/.exec(fact.source);
      if (!citation || !allowedFiles.has(citation[1])) { errors.push(`${label}: expected an allowed source file:line or URL`); continue; }
      const [, path, number] = citation;
      if (!sources.has(path)) {
        try { sources.set(path, readFileSync(resolve(root, path), 'utf8').split('\n')); }
        catch { sources.set(path, null); }
      }
      const lines = sources.get(path);
      // split on LF: form feeds in pdftotext are part of a line, not extra lines.
      const line = lines?.[Number(number) - 1];
      if (!lines) { errors.push(`${label}: source file does not exist: ${path}`); continue; }
      if (line === undefined || (Number(number) === lines.length && line === '')) { errors.push(`${label}: source line does not exist: ${fact.source}`); continue; }
      const lineWords = words(line);
      const overlap = [...words(fact.text)].filter(word => lineWords.has(word));
      if (overlap.length < 3) errors.push(`${label}: cited line shares fewer than 3 distinct words (${overlap.join(', ')})`);
      if (path === 'tools/sources/pod-hd-model-gallery.txt' && /\bLine 6 original\b/i.test(line) && /\bLine 6 original\b/i.test(fact.text)) explicitOriginal = true;
    }
    if (d.original === true && !explicitOriginal) errors.push(`${name}: original=true requires an explicit gallery citation`);
    if ((d.maker !== null || d.unit !== null || d.notes !== null || d.original !== null) && !d.facts.length) errors.push(`${name}: non-generic details require cited facts`);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const details = readJSON(process.argv[2] ?? 'catalog/fx-origins.details.json');
    const errors = checkFxDetails(details);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log(`FX details: ${Object.keys(details).length} models, ${Object.values(details).reduce((sum, d) => sum + d.facts.length, 0)} cited facts checked.`);
  } catch (error) { console.error(`FX details: ${error.message}`); process.exitCode = 1; }
}
