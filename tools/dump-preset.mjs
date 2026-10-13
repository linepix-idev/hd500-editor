// Mostra o preset atual (ou um slot) em JSON.   uso: node tools/dump-preset.mjs [set preset]
import { Pod } from '../core/device.mjs';
const pod = Pod.connect();
try {
  const [s, p] = [Number(process.argv[2]) - 1, Number(process.argv[3]) - 1];
  const preset = Number.isInteger(s) && Number.isInteger(p) && s >= 0 ? await pod.readSlot(s, p) : await pod.readCurrent();
  const j = preset.toJSON(); delete j.body; console.log(JSON.stringify(j, null, 1));
} finally { await pod.close(); process.exit(0); }
