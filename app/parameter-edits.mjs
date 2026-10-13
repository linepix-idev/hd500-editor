// Fast edit commands shared by the server and demo regression tests.
// Accessors keep this bound to the current preset after selection/undo.
const floatWord = value => { const b = Buffer.alloc(4); b.writeFloatLE(value); return b.readUInt32LE(); };
const CAB_SETUP = [[0x57, 0x59, 0x5b, 0x5d], [0x58, 0x5a, 0x5c, 0x5e]];
export function parameterEdits(current, device) {
  return {
    param: async ({ item, index, id, value }) => { current().setParamValue(item, index, value); await device().param(item, id, value); },
    cabParam: async ({ item, index, value }) => { current().setParamValue(item, index, value); await device().setup(CAB_SETUP[(item - 1) / 2][index], floatWord(value), 1); },
    setup: async ({ id, value }) => { current().setSetup(id, value); await device().setup(id, value); },
    setupF: async ({ id, value }) => { current().setSetupFloat(id, value); await device().setup(id, floatWord(value), 1); },
    tempo: async ({ bpm }) => { current().body.writeFloatLE(bpm, 0xd58); await device().setup(0x17, floatWord(bpm), 1); },
    active: async ({ item, active }) => { current().setItemActive(item, active); await device().active(item, active); },
    range: async ({ item, index, lo, hi }) => { const id = current().items.find(it => it.id === item)?.params.find(p => p.index === index)?.id; current().setParamRange(item, index, lo, hi); await device().paramRange(item, id, lo, hi); },
  };
}
