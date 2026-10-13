// API de alto nível do POD HD500 sobre o transporte USB.
import { EventEmitter } from 'events';
import { openDevice } from './transport.mjs';
import * as M from './protocol.mjs';
import { Preset } from './preset.mjs';

const wait = ms => new Promise(r => setTimeout(r, ms));
export const SETS = 8, PRESETS_PER_SET = 64;

export class Pod extends EventEmitter {
  static connect() { return new Pod(openDevice()); }
  constructor(dev) {
    super();
    this.dev = dev;
    dev.on(m => this.#onMessage(m));
  }
  close() { return this.dev.close(); }

  // eventos originados no painel do pedal (knobs, footswitches, troca de preset)
  #onMessage(m) {
    switch (M.cmdOf(m)) {
      case M.CMD.PARAM: this.emit('param', { item: M.word(m, 1), id: M.word(m, 3), value: m.readFloatLE(24) }); break;
      case M.CMD.ACTIVE: this.emit('active', { item: M.word(m, 1), active: M.word(m, 2) > 0 }); break;
      case M.CMD.SETUP: { const vtype = M.word(m, 1); this.emit('setup', { id: M.word(m, 2), vtype, value: vtype === 1 ? m.readFloatLE(20) : M.word(m, 3) }); break; }
      case M.CMD.ALERT: case M.CMD.PRESET_SELECTED: case M.CMD.SET_SELECTED: this.emit('selection'); break;
      case M.CMD.PRESET_LOAD: break; // chega como resposta a consultas; quem pediu já a recebe pelo request()
      case M.CMD.STATUS_RESP: this.emit('status', { id: M.word(m, 1), value: M.word(m, 2) }); break; // resposta a pedido nosso, ou aviso do pedal
      case M.CMD.PRESET_SET_ACK: case M.CMD.SET_LOAD: case M.CMD.SET_NAME_ACK: break; // respostas a pedidos nossos
      default: { // mensagem que o editor ainda não entende: útil para descobrir recursos novos
        const words = []; for (let o = 8; o + 4 <= Math.min(m.length, 40); o += 4) words.push(m.readUInt32LE(o));
        this.emit('unknown', { cmd: M.cmdOf(m), words, length: m.length });
      }
    }
  }

  // --- leitura --- (consultas são idempotentes: uma resposta perdida/truncada é refeita uma vez)
  async #twice(fn) { try { return await fn(); } catch (e) { if (!/não respondeu|did not answer/.test(e.message)) throw e; return fn(); } }
  async readCurrent() { return this.#twice(async () => Preset.fromLoad(await this.dev.request(M.queryPreset(), M.isPresetLoad, 2500))); }
  async readSlot(set, preset) { return this.#twice(async () => Preset.fromLoad(await this.dev.request(M.queryPreset(preset, set), M.isPresetLoad, 2500))); }
  async status(id) { return M.word(await this.dev.request(M.queryStatus(id), m => M.cmdOf(m) === M.CMD.STATUS_RESP && M.word(m, 1) === id), 2); }
  async selection() { return { set: await this.status(M.STATUS.SET), preset: await this.status(M.STATUS.PRESET) }; }
  async setName(set) { return M.setNameOf(await this.dev.request(M.querySet(set), M.is(M.CMD.SET_LOAD), 2500)); }
  async setNames() { const out = []; for (let i = 0; i < SETS; i++) out.push(await this.setName(i)); return out; }
  async slotNames(set, onProgress) {
    const out = [];
    for (let i = 0; i < PRESETS_PER_SET; i++) { out.push((await this.readSlot(set, i)).name); onProgress?.(i + 1, PRESETS_PER_SET); }
    return out;
  }

  // --- seleção e gravação ---
  async select(set, preset) {
    if (set != null) { await this.dev.send(M.selectSet(set)); await wait(250); }
    if (preset != null) { await this.dev.send(M.selectPreset(preset)); await wait(350); }
  }
  async #ack(frame, cmd, what) {
    const ack = await this.dev.request(frame, M.isAck(cmd), 5000);
    if (M.word(ack, 0) !== 0) throw new Error(`the pedal refused ${what} (status ${M.word(ack, 0)})`);
  }
  /** Grava na memória permanente do pedal (flash). */
  writeSlot(set, preset, p) { return this.#ack(M.setPreset(p.body, set, preset), M.CMD.PRESET_SET_ACK, 'the preset write'); }
  /** Substitui apenas o buffer de edição (nada é gravado). */
  apply(p) { return this.#ack(M.applyPreset(p.body), M.CMD.PRESET_SET_ACK, 'the preset'); }
  renameSet(set, name) { return this.#ack(M.renameSet(set, name), M.CMD.SET_NAME_ACK, 'the set name'); }

  // --- ajustes globais do pedal (fora dos presets): ids de status 0..0x25. Só 2 (afinação) e os de seleção têm significado conhecido.
  globals(ids = [0, 1, 2, 8, 9, ...Array.from({ length: 0x29 - 0xb + 1 }, (_, i) => 0xb + i)]) {
    return ids.reduce((p, id) => p.then(async out => { try { out.push({ id, value: await this.status(id) }); } catch {} return out; }), Promise.resolve([]));
  }
  setGlobal(id, value) { return this.dev.send(M.frame(M.CMD.STATUS_SET, [0, id, value])); }

  // --- edição ao vivo (buffer de edição) ---
  param(item, id, value) { return this.dev.send(M.setParam(item, id, value)); }
  paramRange(item, id, lo, hi) { return this.dev.send(M.setParamMin(item, id, lo)).then(() => this.dev.send(M.setParamMax(item, id, hi))); }
  active(item, on) { return this.dev.send(M.setActive(item, on)); }
  model(item, type) { return this.dev.send(M.setModel(item, type)); }
  setup(id, value, vtype = 0) { return this.dev.send(M.setSetup(id, value, vtype)); }
}
