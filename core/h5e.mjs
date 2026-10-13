// Formato .h5e (preset exportado pelo editor oficial): 40 bytes de cabeçalho (big-endian) + corpo de 4096 bytes
// em que apenas alguns campos numéricos estão em big-endian (nomes e bytes soltos ficam como estão).
// Mapa dos campos conforme a rotina de conversão do POD HD500 Edit v2.27 (FUN_0040ff60).
export const H5E_HEADER = 40, BODY = 4096;

// offsets (no corpo) de palavras de 32 bits que são trocadas de endianness
function swappedWords() {
  const w = [0x20, 0x24, 0xd58];
  for (let i = 0; i < 2; i++) w.push(0xd48 + 8 * i, 0xd4c + 8 * i, 0xd5c + 4 * i, 0xd64 + 4 * i, 0xd6c + 4 * i, 0xd74 + 4 * i, 0xd7c + 4 * i);
  for (let it = 0; it < 12; it++) {
    const o = 0x28 + it * 256;
    w.push(o, o + 4);                         // tipo e posição
    for (let p = 0; p < 12; p++) for (let k = 0; k < 4; k++) w.push(o + 16 + p * 20 + 4 * k); // id, valor, mín, máx
  }
  return [...new Set(w)];
}
const WORDS = swappedWords();
const swap32 = (b, o) => { const t = b[o]; b[o] = b[o + 3]; b[o + 3] = t; const u = b[o + 1]; b[o + 1] = b[o + 2]; b[o + 2] = u; };

export const isH5E = buf => buf.length === H5E_HEADER + BODY && buf.toString('latin1', 0, 4) === 'H5EP';

// .h5e -> blob "PresetLoad" (4104 B, little-endian) usado pelo pedal
export function h5eToBlob(file) {
  if (!isH5E(file)) throw new Error('file is not a valid .h5e preset');
  const body = Buffer.from(file.subarray(H5E_HEADER));
  for (const o of WORDS) swap32(body, o);
  const head = Buffer.alloc(8); head.writeUInt16LE(0x0401, 0); head.writeUInt32LE(1073743882, 2); head.writeUInt16LE(0x0100, 6);
  return Buffer.concat([head, body]);
}

// blob -> .h5e (cabeçalho copiado de um arquivo de referência, se informado)
export function blobToH5e(blob, headerTemplate) {
  const body = Buffer.from(blob.subarray(8));
  for (const o of WORDS) swap32(body, o);
  const head = headerTemplate ? Buffer.from(headerTemplate.subarray(0, H5E_HEADER)) : Buffer.from('4835455000000001' + '7d010027' + '02230000' + '00140002' + '01300000' + '00'.repeat(16), 'hex');
  return Buffer.concat([head, body]);
}
