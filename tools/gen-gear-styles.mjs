// Gera app/public/js/gear-styles.js a partir de catalog/gear-styles.json (fonte editável pela comunidade).
import { readFileSync, writeFileSync } from 'fs';
const j = JSON.parse(readFileSync(new URL('../catalog/gear-styles.json', import.meta.url)));
delete j._doc;
writeFileSync(new URL('../app/public/js/gear-styles.js', import.meta.url), `// Gerado por tools/gen-gear-styles.mjs — edite catalog/gear-styles.json.\nexport const STY = ${JSON.stringify(j, null, 1)};\n`);
console.log('modelos:', Object.keys(j.pedals).length, 'pedais,', Object.keys(j.amps).length, 'amps');
