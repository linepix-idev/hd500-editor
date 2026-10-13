// Mensagens do POD HD500. Cabeçalho de 2 palavras + payload; ver docs/protocol.md.
export const CMD = {
  PRESET_QUERY: 0x00, PRESET_LOAD: 0x01, PRESET_SET: 0x02, PRESET_SET_ACK: 0x03,
  TYPE: 0x11, ACTIVE: 0x13, SETUP: 0x16, STATUS_SET: 0x20, STATUS_QUERY: 0x21, STATUS_RESP: 0x22, ALERT: 0x23,
  PRESET_SELECTED: 0x27, SET_QUERY: 0x28, SET_LOAD: 0x29, SET_NAME: 0x2a, SET_NAME_ACK: 0x2b, SET_SELECTED: 0x2c,
  PARAM: 0x2d, PARAM_MIN: 0x2e, PARAM_MAX: 0x2f,
};
export const STATUS = { PRESET: 8, SET: 9 };
export const CURRENT = 0xFFFFFFFF;           // destino do PresetSet = só buffer de edição
export const BODY = 4096;

/** Monta uma mensagem: palavras de payload (u32) e, opcionalmente, bytes extras e/ou o corpo de 4096 B. */
export function frame(cmd, words = [], { bytes = null, body = null } = {}) {
  const extra = bytes ? Math.ceil(bytes.length / 4) : 0;
  const n = 2 + words.length + extra + (body ? BODY / 4 : 0);
  const b = Buffer.alloc(n * 4);
  b.writeUInt32LE((((n - 1) & 0xffff) | 0x000a0000 | (0x40 << 24)) >>> 0, 0);
  b.writeUInt32LE(((cmd << 24) | (0x08 << 8) | 0x01) >>> 0, 4);
  words.forEach((w, i) => b.writeUInt32LE(w >>> 0, 8 + 4 * i));
  let o = 8 + 4 * words.length;
  if (bytes) { bytes.copy(b, o); o += extra * 4; }
  if (body) body.copy(b, o);
  return b;
}
export const cmdOf = m => m[7];
export const word = (m, i) => m.readUInt32LE(8 + 4 * i);
export const is = (cmd, extra = () => true) => m => cmdOf(m) === cmd && extra(m);

export const f32 = v => { const x = Buffer.alloc(4); x.writeFloatLE(v); return x.readUInt32LE(0); };

// --- construtores ---------------------------------------------------------------
export const queryPreset = (preset = 0xFFFF, set = 0xFFFF) => frame(CMD.PRESET_QUERY, [((set & 0xffff) << 16 | (preset & 0xffff)) >>> 0]);
export const setPreset = (body, set, preset) => frame(CMD.PRESET_SET, [(((set & 0xffff) << 16) | (preset & 0xffff)) >>> 0], { body }); // grava no slot
export const applyPreset = body => frame(CMD.PRESET_SET, [CURRENT], { body });                                                          // só no buffer de edição
export const selectSet = s => frame(CMD.STATUS_SET, [0, STATUS.SET, s]);
export const selectPreset = p => frame(CMD.STATUS_SET, [0, STATUS.PRESET, p]);
export const queryStatus = id => frame(CMD.STATUS_QUERY, [id]);
export const querySet = s => frame(CMD.SET_QUERY, [s]);
export const renameSet = (s, name) => frame(CMD.SET_NAME, [s], { bytes: Buffer.from(name.padEnd(16).slice(0, 16), 'latin1') });
export const setParam = (item, id, value) => frame(CMD.PARAM, [0, item, 1, id, f32(value)]);
export const setParamMin = (item, id, value) => frame(CMD.PARAM_MIN, [0, item, 1, id, f32(value)]);
export const setParamMax = (item, id, value) => frame(CMD.PARAM_MAX, [0, item, 1, id, f32(value)]);
export const setActive = (item, on) => frame(CMD.ACTIVE, [0, item, on ? 1 : 0]);
export const setModel = (item, type) => frame(CMD.TYPE, [0, item, type]);
export const setSetup = (id, value, vtype = 0) => frame(CMD.SETUP, [0, vtype, id, value]);

// --- leitura --------------------------------------------------------------------
export const isPresetLoad = is(CMD.PRESET_LOAD);
export const isAck = cmd => is(cmd, m => m.length === 12);
export const bodyOf = m => m.subarray(8);
export const setNameOf = m => m.subarray(12).toString('latin1').replace(/\0.*$/, '').trim();
