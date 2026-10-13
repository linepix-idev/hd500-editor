// Salva a biblioteca inteira (8 sets × 64 presets) em um pacote .hd500lib.   uso: node tools/backup-all.mjs [arquivo]
import { writeFileSync } from 'fs';
import { Pod } from '../core/device.mjs';
import { exportBundle } from '../core/library.mjs';

const out = process.argv[2] ?? `hd500-biblioteca-${new Date().toISOString().slice(0, 10)}.hd500lib`;
const pod = Pod.connect();
try {
  const b = await exportBundle(pod, undefined, (d, t) => process.stdout.write(`\r${d}/${t} presets`));
  writeFileSync(out, JSON.stringify(b)); console.log(`\nsalvo em ${out}`);
} finally { await pod.close(); process.exit(0); }
