// One place that decides whether an edit may reach the pedal. The pedal does not validate what it receives: an out-of-range
// microphone index once froze it until it was power-cycled. Every edit (UI, MCP, scripts) passes through `sanitize` first:
// numbers must be finite, values are clamped to the parameter's real range, ids/items/models must exist.
import { INPUT1, INPUT2, INZ, MICS, MIXER, SETUP_CAB_ER, SETUP_CAB_MIC, DT_IDS, SETUP_MAP, itemKind, catalog } from '../core/preset.mjs';

const TEMPO_NOTES = 19;                                   // note values 2..20 on "tempo" parameters (see NOTES in the UI)
const num = (v, what) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`${what}: not a number`); return n; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const int = (v, lo, hi, what) => clamp(Math.round(num(v, what)), lo, hi);
const itemId = (v, lo = 0, hi = 11) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`item ${v} is not valid`); return n; };
const oneOf = (v, list, what) => { const n = Number(v); if (!list.includes(n)) throw new Error(`${what}: ${v} is not one of ${list.join(', ')}`); return n; };

// Known settings → how to clamp them. Floats are sent with setupF, everything else with setup.
const FLOAT = new Map([[MIXER.levelA, [-60, 12]], [MIXER.levelB, [-60, 12]], [MIXER.panA, [-1, 1]], [MIXER.panB, [-1, 1]], [SETUP_CAB_ER[0], [0, 1]], [SETUP_CAB_ER[1], [0, 1]]]);
const INT = new Map([
  [0x36, v => oneOf(v, INPUT1.map(x => x[0]), 'input 1')], [0x37, v => oneOf(v, INPUT2.map(x => x[0]), 'input 2')], [0x55, v => oneOf(v, INZ.map(x => x[0]), 'guitar impedance')],
  [0x38, v => int(v, 0, 1, 'trails')], [SETUP_CAB_MIC[0], v => int(v, 0, MICS.length - 1, 'microphone')], [SETUP_CAB_MIC[1], v => int(v, 0, MICS.length - 1, 'microphone')],
  ...DT_IDS.flat().map((id, k) => [id, v => int(v, 0, k % 3 === 0 ? 3 : 127, 'DT setting')]),
]);
const cabOf = id => ({ 1: 0, 3: 1 })[id];

/** Validates and clamps `b` (the body of POST /api/edit) in place. `preset` may be null before the first connection. */
export function sanitize(b, preset) {
  const op = b.op;
  switch (op) {
    case 'param': {
      b.item = itemId(b.item); b.index = int(b.index, 0, 11, 'param index');
      const p = preset?.item(b.item).params[b.index];
      if (preset && !p) throw new Error(`block ${b.item} has no parameter ${b.index}`);
      if (p && Number(b.id) !== p.id) throw new Error('parameter id does not match the block (stale view?)');
      const v = num(b.value, 'value');
      b.value = !p ? clamp(v, 0, 1) : p.kind === 'list' ? clamp(Math.round(v), 0, (p.options?.length ?? 1) - 1) : p.kind === 'tempo' ? clamp(v, 0, TEMPO_NOTES + 1) : clamp(v, 0, 1);
      return b;
    }
    case 'cabParam': b.item = itemId(b.item, 1, 3); if (cabOf(b.item) == null) throw new Error('item is not a cab'); b.index = int(b.index, 0, 3, 'cab parameter'); b.value = clamp(num(b.value, 'value'), 0, 1); return b;
    case 'setup': case 'setupF': {
      const id = int(b.id, 0, 255, 'setting id'), v = num(b.value, 'value'); b.id = id;
      if (FLOAT.has(id)) { const [lo, hi] = FLOAT.get(id); b.op = 'setupF'; b.value = clamp(v, lo, hi); return b; }
      if (INT.has(id)) { b.op = 'setup'; b.value = INT.get(id)(v); return b; }
      const s = SETUP_MAP[id]; if (!s) throw new Error(`setting ${id} is unknown`);
      if (op === 'setup') b.value = s[2] === 4 ? clamp(Math.round(v), 0, 0xffffffff) : clamp(Math.round(v), 0, 255); else b.value = clamp(v, -1e6, 1e6);
      return b;
    }
    case 'tempo': b.bpm = clamp(num(b.bpm, 'bpm'), 30, 240); return b;
    case 'active': b.item = itemId(b.item); b.active = !!b.active; return b;
    case 'fs': b.item = itemId(b.item, 4, 11); b.fs = int(b.fs, 0, 9, 'footswitch'); return b;
    case 'ctl': case 'range': {
      b.item = itemId(b.item); b.index = int(b.index, 0, 11, 'param index');
      const p = preset?.item(b.item).params[b.index], hi = p?.kind === 'list' ? (p.options?.length ?? 2) - 1 : p?.kind === 'tempo' ? TEMPO_NOTES + 1 : 1;
      if (op === 'ctl') b.ctl = int(b.ctl, 0, 2, 'controller');
      for (const k of ['lo', 'hi']) if (b[k] != null) b[k] = clamp(num(b[k], k), 0, hi);
      return b;
    }
    case 'name': b.name = String(b.name ?? '').replace(/[^\x20-\x7e¡-ÿ]/g, '').slice(0, 16); if (!b.name.trim()) throw new Error('name is empty'); return b;
    case 'chain': {
      if (!Array.isArray(b.order) || b.order.length !== 8) throw new Error('chain needs the 8 effect blocks');
      b.order = b.order.map(o => ({ id: itemId(o.id, 4, 11), lane: int(o.lane, 0, 5, 'lane') }));
      if (new Set(b.order.map(o => o.id)).size !== 8) throw new Error('chain lists a block twice'); return b;
    }
    case 'model': {
      b.item = itemId(b.item); const t = Number(b.type), list = { amp: catalog.amps, cab: catalog.cabs, fx: catalog.pedals }[itemKind(b.item)];
      if (!list.some(m => m.type === t)) throw new Error(`model type ${b.type} does not exist for this block`); b.type = t; return b;
    }
    case 'midi': b.index = int(b.index, 0, 13, 'MIDI record'); if (!Array.isArray(b.bytes) || b.bytes.length !== 6) throw new Error('MIDI record needs 6 bytes'); b.bytes = b.bytes.map(x => int(x, 0, 255, 'MIDI byte')); return b;
    case 'raw': b.offset = int(b.offset, 0, 4095, 'offset'); b.value = int(b.value, 0, 255, 'byte'); return b;
    case 'undo': case 'redo': return b;
    default: throw new Error(`unknown operation: ${op}`);
  }
}
