// Grava um backup (.bin de 4096 bytes) ou um preset .h5e num slot do pedal.
// uso: node tools/restore.mjs <arquivo> <set 1-8> <preset 1-64>        (feche o editor antes: só um programa usa o pedal)
import { readFileSync } from 'fs';
import { Pod } from '../core/device.mjs';
import { Preset } from '../core/preset.mjs';
import { presetFromH5e, Backups } from '../core/library.mjs';
import { isH5E } from '../core/h5e.mjs';

const [file, set, preset] = [process.argv[2], Number(process.argv[3]) - 1, Number(process.argv[4]) - 1];
if (!file || !(set >= 0 && set < 8) || !(preset >= 0 && preset < 64)) { console.error('uso: node tools/restore.mjs <arquivo.bin|.h5e> <set 1-8> <preset 1-64>'); process.exit(1); }
const raw = readFileSync(file);
const p = isH5E(raw) ? presetFromH5e(raw) : new Preset(raw.length === 4104 ? raw.subarray(8) : raw);
const pod = Pod.connect();
try {
  new Backups(new URL('../backups', import.meta.url).pathname).save(set, preset, await pod.readSlot(set, preset));
  await pod.writeSlot(set, preset, p);
  console.log(`"${p.name}" gravado no set ${set + 1}, preset ${preset + 1}.`);
} finally { await pod.close(); process.exit(0); }
