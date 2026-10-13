// Gestão da biblioteca do pedal: backups, pacotes (.hd500lib), cópia/troca/limpeza de slots e arquivos .h5e.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { Preset } from './preset.mjs';
import { SETS, PRESETS_PER_SET } from './device.mjs';
import { h5eToBlob, blobToH5e } from './h5e.mjs';

export const BLANK = new Preset(readFileSync(new URL('./blank_preset.bin', import.meta.url)));
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export class Backups {
  constructor(dir) { this.dir = dir; }
  save(set, preset, p, tag = 'antes') {
    mkdirSync(this.dir, { recursive: true });
    const f = `${this.dir}/set${set + 1}-preset${preset + 1}-${tag}-${stamp()}.bin`;
    writeFileSync(f, p.body); return f;
  }
  list() { try { return readdirSync(this.dir).filter(f => f.endsWith('.bin')).sort().reverse(); } catch { return []; } }
}

// --- pacote da biblioteca (JSON legível por qualquer ferramenta) ---------------------------
export async function exportBundle(pod, setIdx = [...Array(SETS).keys()], onProgress) {
  const sets = [];
  let done = 0; const total = setIdx.length * PRESETS_PER_SET;
  for (const s of setIdx) {
    const presets = [];
    for (let p = 0; p < PRESETS_PER_SET; p++) {
      const pr = await pod.readSlot(s, p);
      presets.push({ index: p, name: pr.name, body: pr.body.toString('base64') });
      onProgress?.(++done, total);
    }
    sets.push({ index: s, name: await pod.setName(s), presets });
  }
  return { format: 'hd500-bundle', version: 1, created: new Date().toISOString(), sets };
}
export const parseBundle = obj => {
  if (obj?.format !== 'hd500-bundle') throw new Error('file is not an HD500 Editor bundle');
  return obj;
};
/** Grava no pedal os presets do pacote. `map` = [{from:{set,preset}, to:{set,preset}}]; padrão: mesmo lugar. */
export async function importBundle(pod, bundle, { map = null, backups, onProgress, renameSets = false } = {}) {
  parseBundle(bundle);
  const jobs = map ?? bundle.sets.flatMap(s => s.presets.map(p => ({ from: { set: s.index, preset: p.index }, to: { set: s.index, preset: p.index } })));
  let n = 0;
  for (const j of jobs) {
    const src = bundle.sets.find(s => s.index === j.from.set)?.presets.find(p => p.index === j.from.preset);
    if (!src) continue;
    backups?.save(j.to.set, j.to.preset, await pod.readSlot(j.to.set, j.to.preset));
    await pod.writeSlot(j.to.set, j.to.preset, new Preset(Buffer.from(src.body, 'base64')));
    onProgress?.(++n, jobs.length);
  }
  if (renameSets) for (const s of bundle.sets) if (s.name) await pod.renameSet(s.index, s.name);
  return n;
}

// --- operações em slots ---------------------------------------------------------------------
export async function copySlot(pod, from, to, backups) {
  const src = await pod.readSlot(from.set, from.preset);
  backups?.save(to.set, to.preset, await pod.readSlot(to.set, to.preset));
  await pod.writeSlot(to.set, to.preset, src);
}
export async function swapSlots(pod, a, b, backups) {
  const [pa, pb] = [await pod.readSlot(a.set, a.preset), await pod.readSlot(b.set, b.preset)];
  backups?.save(a.set, a.preset, pa); backups?.save(b.set, b.preset, pb);
  await pod.writeSlot(a.set, a.preset, pb); await pod.writeSlot(b.set, b.preset, pa);
}
export async function clearSlot(pod, at, backups) {
  backups?.save(at.set, at.preset, await pod.readSlot(at.set, at.preset), 'limpo');
  await pod.writeSlot(at.set, at.preset, BLANK);
}

// --- .h5e (formato do editor oficial) -------------------------------------------------------
export const presetFromH5e = buf => new Preset(h5eToBlob(buf).subarray(8));
export const presetToH5e = (p, template) => blobToH5e(Buffer.concat([Buffer.alloc(8), p.body]), template);
