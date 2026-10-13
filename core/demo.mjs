// Pedal simulado em memória: permite abrir a interface, tirar capturas de tela e desenvolver sem o hardware.
// Uso: HD500_DEMO=1 npm start
import { EventEmitter } from 'events';
import { Preset, catalog, itemOffset, ITEM_BASE, PARAM_BASE, PARAM_SIZE, LANES } from './preset.mjs';
import { BLANK } from './library.mjs';
import { SETS, PRESETS_PER_SET } from './device.mjs';

const find = (list, name) => list.find(m => m.name === name) ?? list[1];
function setModel(p, id, model) {
  const o = itemOffset(id);
  p.body.writeUInt32LE(model.type, o);
  for (let k = 0; k < 12; k++) p.body.fill(0, o + PARAM_BASE + k * PARAM_SIZE, o + PARAM_BASE + (k + 1) * PARAM_SIZE);
  model.params.slice(0, 12).forEach((prm, k) => {
    const q = o + PARAM_BASE + k * PARAM_SIZE; const v = prm.kind === 'list' ? 0 : 0.5;
    p.body.writeUInt32LE(prm.id, q); p.body.writeFloatLE(v, q + 4); p.body.writeFloatLE(v, q + 8); p.body.writeFloatLE(v, q + 12);
  });
  p.body[o + 11] = 1;
}
function make(name, { amp, cab, fx = [], input1 = 1, input2 = 0 }) {
  const p = BLANK.clone(); p.name = name;
  setModel(p, 0, find(catalog.amps, amp)); p.setItemActive(0, true); setModel(p, 1, find(catalog.cabs, cab)); p.setItemActive(1, true);
  fx.forEach(([model, lane, fs], i) => { const id = 4 + i; setModel(p, id, find(catalog.pedals, model)); p.setItemActive(id, true); p.setItemFs(id, fs ?? 0); p.setItemPlace(id, i, lane); });
  for (let i = fx.length; i < 8; i++) p.setItemPlace(4 + i, i, LANES.post);
  p.setSetup(0x36, input1); p.setSetup(0x37, input2); p.setSetup(0x55, 7);
  return p;
}
const P = LANES.pre, A = LANES.aPre, B = LANES.bPre, E = LANES.post;
const LIB = [
  ['Clean Strat', { amp: 'Blackface Double Normal', cab: '212 Blackface Double', fx: [['Tube Comp', P, 1], ['Opto Tremolo', A, 2], ['Analog Echo', E, 5], ['Hall', E, 6]] }],
  ['Edge of Breakup', { amp: 'Tweed B-Man Bright', cab: '410 Tweed', fx: [['Tube Comp', P, 1], ['Tape Echo', E, 5], ['Plate', E, 6]] }],
  ['Blues Lead', { amp: 'Brit J-45 Bright', cab: '412 Uber', fx: [['Red Comp', P], ['Color Drive', P, 4], ['Tape Echo', E, 5], ['Spring', E, 6]] }],
  ['Crunch Rhythm', { amp: 'Hiway 100', cab: '412 Hiway', fx: [['Noise Gate', P], ['Studio EQ', E]] }],
  ['Acoustic Mic', { amp: 'Amp Disabled', cab: 'No Cab', input1: 1, input2: 2, fx: [['Boost Comp', A, 1], ['Tape Echo', A, 5], ['4 Band Shift EQ', B], ['Studio EQ', B], ['Analog W/Mod', E, 6], ['Hall', E, 7]] }],
  ['Ambient Pad', { amp: 'Class A-15', cab: '212 Silver Bell', fx: [['Dual Phaser', P, 2], ['Digital Delay', E, 5], ['Hall', E, 6]] }],
  ['High Gain', { amp: 'Super O', cab: '412 Uber', fx: [['Noise Gate', P], ['Boost Comp', P, 1], ['Digital Delay', E, 5]] }],
];

export class DemoPod extends EventEmitter {
  constructor() {
    super();
    this.slots = Array.from({ length: SETS }, (_, s) => Array.from({ length: PRESETS_PER_SET }, (_, i) => (s === 2 && i < LIB.length ? make(...LIB[i]) : BLANK.clone())));
    this.names = Array.from({ length: SETS }, (_, i) => (i === 2 ? 'Stage Set' : `Set ${i + 1}`));
    this.sel = { set: 2, preset: 4 }; this.buffer = this.slots[2][4].clone();
  }
  close() { return Promise.resolve(); }
  async readCurrent() { return this.buffer.clone(); }
  async readSlot(s, p) { return this.slots[s][p].clone(); }
  async selection() { return { ...this.sel }; }
  async setName(s) { return this.names[s]; }
  async setNames() { return [...this.names]; }
  async slotNames(s, onProgress) { onProgress?.(PRESETS_PER_SET, PRESETS_PER_SET); return this.slots[s].map((p, i) => (p.name === 'New Tone' && i >= LIB.length ? 'New Tone' : p.name)); }
  async select(s, p) { if (s != null) this.sel.set = s; if (p != null) this.sel.preset = p; this.buffer = this.slots[this.sel.set][this.sel.preset].clone(); }
  async writeSlot(s, p, pr) { this.slots[s][p] = pr.clone(); }
  async apply(pr) { this.buffer = pr.clone(); }
  async renameSet(s, n) { this.names[s] = n.trim(); }
  async param(item, id, v) { const it = this.buffer.items.find(i => i.id === item); const q = it?.params.find(p => p.id === id); if (q) this.buffer.setParamValue(item, q.index, v); }
  async paramRange() {}
  async active(item, on) { this.buffer.setItemActive(item, on); }
  async model(item, type) { const m = [...catalog.amps, ...catalog.cabs, ...catalog.pedals].find(x => x.type === type); if (m) setModel(this.buffer, item, m); }
  async setup(id, v, vtype) { try { vtype === 1 ? this.buffer.setSetupFloat(id, Buffer.from(new Uint32Array([v]).buffer).readFloatLE(0)) : this.buffer.setSetup(id, v); } catch {} }
  #globals = new Map([[2, 440], [11, 32], [13, 1]]);
  async globals() { return [...this.#globals].map(([id, value]) => ({ id, value })); }
  async setGlobal(id, value) { this.#globals.set(id, value); }
}
