// Modelo do preset do POD HD500: corpo de 4096 bytes (ver docs/protocol.md). Tudo little-endian.
import { readFileSync } from 'fs';

export const catalog = JSON.parse(readFileSync(new URL('../catalog/catalog.json', import.meta.url)));
// equipamento real em que cada modelo de amp se baseia (lista oficial da Line 6; nominativo, sem afiliação)
const ORIGINS = JSON.parse(readFileSync(new URL('../catalog/amp-origins.json', import.meta.url)));
for (const a of catalog.amps) if (ORIGINS[a.name]) a.basedOn = ORIGINS[a.name];
const ALL = [...catalog.amps, ...catalog.cabs, ...catalog.pedals];
const byType = new Map(ALL.map(e => [e.type, e]));

export const ITEM_ORDER = [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // ordem em que os itens aparecem no corpo
export const ITEM_BASE = 0x28, ITEM_SIZE = 256, PARAM_BASE = 16, PARAM_SIZE = 20, MAX_PARAMS = 12;
export const itemKind = id => (id === 0 || id === 2 ? 'amp' : id === 1 || id === 3 ? 'cab' : 'fx');
export const itemOffset = id => ITEM_BASE + ITEM_ORDER.indexOf(id) * ITEM_SIZE;
export const NO_AMP = 0x0007ffff, NO_CAB = 0x0007ffff, NO_FX = 0x020dffff;
export const isEmptyType = t => t === NO_AMP || t === NO_FX;

/** Ondas do circuito. posType: 0 = antes do ampli, 5 = depois; 1..4 = caminhos A/B (presets de ampli duplo). */
export const LANES = { pre: 0, aPre: 1, bPre: 2, aPost: 3, bPost: 4, post: 5 };

/** Footswitch de cada bloco (byte +12 do item). Tabela extraída do editor oficial. */
export const FS_NAMES = ['—', 'FS1', 'FS2', 'FS3', 'FS4', 'FS5', 'FS6', 'FS7', 'FS8', 'EXP toe'];
/** Controlador de um parâmetro (byte +16 da entrada). */
export const CTL_NAMES = ['—', 'EXP 1', 'EXP 2'];

// Entradas de áudio (valores crus do pedal; tabela do editor oficial)
export const INPUT1 = [[1, 'Guitar'], [2, 'Mic'], [3, 'Aux'], [5, 'Guitar+Aux'], [6, 'Guitar+Variax'], [7, 'Guitar+Aux+Variax'], [8, 'Variax'], [9, 'Variax Mags']];
export const INPUT2 = [[0, 'Same'], ...INPUT1];
export const INZ = ['Auto', '22K', '32K', '70K', '90K', '136K', '230K', '1M', '3.5M'].map((n, i) => [i, n]);

/** Ajustes "setup" do preset: id (comando 0x16) → deslocamento no corpo. Extraído da tabela do editor oficial. */
export const SETUP_MAP = JSON.parse(readFileSync(new URL('./setup_map.json', import.meta.url)));
const SETUP = new Map(SETUP_MAP.map(([id, off, size]) => [id, { id, off, size }]));
/** Nomes conhecidos (colaborações em core/setting_names.json). */
export const SETUP_NAMES = Object.fromEntries(Object.entries(JSON.parse(readFileSync(new URL('./setting_names.json', import.meta.url)))).map(([k, v]) => [Number(k), v]));

/** Mixer por preset (floats): nível em dB (−60 = mudo … +12) e pan (−1 … +1) dos caminhos A e B. Confirmado no pedal. */
export const MIXER = { levelA: 0x2c, levelB: 0x2d, panA: 0x2e, panB: 0x2f };
export const SETUP_CAB_ER = [0x32, 0x33], SETUP_CAB_MIC = [0x34, 0x35];
export const MICS = ['57 On XS', '57 Off XS', '409 Dyn', '421 Dyn', '4038 Rbn', '121 Rbn', '67 Cond', '87 Cond'];
export const DT_IDS = [[0x26, 0x27, 0x28], [0x29, 0x2a, 0x2b]];
export const DT_TOPOLOGY = ['I', 'II', 'III', 'IV'];

export class Preset {
  constructor(body) {
    if (body.length !== 4096) throw new Error(`preset body must be 4096 bytes (got ${body.length})`);
    this.body = Buffer.from(body);
  }
  static fromLoad(msg) { return new Preset(msg.subarray(8)); }
  clone() { return new Preset(this.body); }

  get name() { return this.body.toString('latin1', 0, 16).replace(/\0.*$/, '').trim(); }
  set name(v) { this.body.fill(0x20, 0, 16); this.body.write(String(v).slice(0, 16), 0, 'latin1'); }

  // --- setup ---
  setup(id) { const s = SETUP.get(id); if (!s) throw new Error(`unknown setting ${id}`); return s.size === 4 ? this.body.readUInt32LE(s.off) : this.body[s.off]; }
  setSetup(id, v) { const s = SETUP.get(id); if (!s) throw new Error(`unknown setting ${id}`); if (s.size === 4) this.body.writeUInt32LE(v >>> 0, s.off); else this.body[s.off] = v & 0xff; }
  get tempo() { return this.body.readFloatLE(0xd58); }

  // --- itens ---
  item(id) {
    const o = itemOffset(id), b = this.body, type = b.readUInt32LE(o), kind = itemKind(id), model = byType.get(type);
    const item = { id, kind, type, model: model?.name ?? `0x${type.toString(16)}`, basedOn: model?.basedOn ?? null, group: model?.group ?? null,
      empty: kind === 'fx' ? type === NO_FX : type === NO_AMP,
      active: b[o + 8] === 1, pos: b.readUInt16LE(o + 4), lane: b[o + 6], fs: b[o + 12], params: [] };
    for (let k = 0; k < MAX_PARAMS; k++) {
      const q = o + PARAM_BASE + k * PARAM_SIZE, pid = b.readUInt32LE(q);
      if (!pid) break;
      const meta = kind === 'cab' ? cabParamMeta(k, pid) : model?.params.find(p => p.id === pid) ?? { id: pid, name: `0x${pid.toString(16)}`, kind: 'percent' };
      item.params.push({ ...meta, index: k, value: b.readFloatLE(q + 4), lo: b.readFloatLE(q + 8), hi: b.readFloatLE(q + 12), ctl: b[q + 16] });
    }
    if (kind === 'cab') item.params.push(...this.cabExtras(id));
    if (kind === 'amp' && !item.empty) item.dt = this.dt(id === 0 ? 0 : 1);
    return item;
  }
  /** E.R. (reflexões iniciais) e modelo de microfone do cab: ajustes de preset, não parâmetros do item. */
  cabExtras(id) {
    const n = id === 1 ? 0 : 1, er = SETUP_CAB_ER[n], mic = SETUP_CAB_MIC[n];
    return [
      { id: `er${n}`, name: 'E.R.', kind: 'percent', index: 90 + n, value: this.body.readFloatLE(SETUP.get(er).off), lo: 0, hi: 0, ctl: 0, setup: er, float: true },
      { id: `mic${n}`, name: 'Microfone', kind: 'list', options: MICS, index: 92 + n, value: this.setup(mic), lo: 0, hi: 0, ctl: 0, setup: mic },
    ];
  }
  /** Dynamic Tone (amplificadores DT da Line 6): topologia I–IV, classe A/AB e modo Tri/Pent. */
  dt(n) { const [t, m, c] = DT_IDS[n]; return { topology: this.setup(t), mode: this.setup(m) ? 1 : 0, class: this.setup(c) ? 1 : 0, ids: { topology: t, mode: m, class: c } }; }
  setSetupFloat(id, v) { const s = SETUP.get(id); this.body.writeFloatLE(v, s.off); }
  get items() { return ITEM_ORDER.map(id => this.item(id)).sort((a, b) => a.id - b.id); }

  setItemActive(id, on) { this.body[itemOffset(id) + 8] = on ? 1 : 0; }
  setItemFs(id, fs) { this.body[itemOffset(id) + 12] = fs; }
  setItemPlace(id, pos, lane) { const o = itemOffset(id); this.body.writeUInt16LE(pos, o + 4); this.body[o + 6] = lane; }
  setParamValue(id, index, v) { this.body.writeFloatLE(v, itemOffset(id) + PARAM_BASE + index * PARAM_SIZE + 4); }
  setParamRange(id, index, lo, hi) { const q = itemOffset(id) + PARAM_BASE + index * PARAM_SIZE; this.body.writeFloatLE(lo, q + 8); this.body.writeFloatLE(hi, q + 12); }
  setParamCtl(id, index, ctl) { this.body[itemOffset(id) + PARAM_BASE + index * PARAM_SIZE + 16] = ctl; }

  /** Reordena os 8 efeitos: `order` = [{id, lane}] na ordem desejada (pos 0..7). */
  setFxOrder(order) { order.forEach(({ id, lane }, i) => this.setItemPlace(id, i, lane)); }

  toJSON() {
    const items = this.items;
    const f = id => this.body.readFloatLE(SETUP.get(id).off);
    return { name: this.name, tempo: this.tempo, trails: this.setup(0x38) === 1, mixer: { levelA: f(MIXER.levelA), levelB: f(MIXER.levelB), panA: f(MIXER.panA), panB: f(MIXER.panB) }, items, body: this.body.toString('base64'),
      setup: { input1: this.setup(0x36), input2: this.setup(0x37), inZ: this.setup(0x55) },
      settings: [...SETUP.values()].map(s => ({ id: s.id, name: SETUP_NAMES[s.id] ?? null, offset: s.off, size: s.size, float: s.size === 4, value: s.size === 4 ? this.body.readFloatLE(s.off) : this.setup(s.id) })) };
  }
}

const CAB_PARAMS = [['Low Cut', 'freq', 20, 500], ['Res Level', 'percent'], ['Thump', 'percent'], ['Decay', 'percent']];
function cabParamMeta(k, pid) { const [name, kind, min, max] = CAB_PARAMS[k] ?? [`P${k}`, 'percent']; return { id: pid, name, kind, min, max, cab: true }; }

// Ordem dos efeitos em cada faixa, para a interface
export function chainOf(preset) {
  const fx = preset.items.filter(i => i.kind === 'fx').sort((a, b) => a.pos - b.pos);
  const lane = n => fx.filter(i => i.lane === n);
  return { pre: lane(LANES.pre), aPre: lane(LANES.aPre), bPre: lane(LANES.bPre), aPost: lane(LANES.aPost), bPost: lane(LANES.bPost), post: lane(LANES.post) };
}
