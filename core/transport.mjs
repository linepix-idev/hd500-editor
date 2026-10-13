// Transporte USB do POD HD500 (0e41:414d): interface 1, bulk 0x01 (saída) / 0x81 (entrada), pacotes de 64 bytes.
// Cada pacote = [n][0][t][0] + até 60 bytes de dados (t=1 primeiro, t=4 continuação). Ver docs/protocol.md.
import { createRequire } from 'module';
const { findByIds } = createRequire(import.meta.url)('usb');

export const VID = 0x0e41, PID = 0x414d, CHUNK = 60;

/** O pedal está ligado ao computador? (não abre o dispositivo) */
export const deviceVisible = () => !!findByIds(VID, PID);

function friendly(e) {
  const m = String(e.message);
  if (/ACCESS/.test(m)) return new Error(process.platform === 'linux'
    ? 'No permission to access the pedal. Install the project\'s udev rule (see the README) and re-plug the USB cable.'
    : 'No permission to access the pedal. Close other programs using the POD HD500 (e.g. the official editor).');
  if (/BUSY/.test(m)) return new Error('The pedal is in use by another program. Close the official Line 6 editor and try again.');
  if (/NOT_SUPPORTED|NO_DEVICE|NOT_FOUND/.test(m) && process.platform === 'win32')
    return new Error('On Windows the pedal must use the WinUSB driver on this interface (use Zadig; see the README).');
  return e;
}
export class PodNotFound extends Error { constructor() { super('POD HD500 not found (USB cable? udev rule? another program using the pedal?)'); } }

/** Divide uma mensagem em pacotes USB de 64 bytes: [n][0][t][0] + até 60 bytes (t=1 primeiro, t=4 demais). */
export function toPackets(frame) {
  const out = [];
  for (let o = 0, t = 1; o < frame.length; o += CHUNK, t = 4) {
    const p = frame.subarray(o, o + CHUNK);
    out.push(Buffer.concat([Buffer.from([p.length, 0, t, 0]), p]));
  }
  return out;
}

export function openDevice() {
  const dev = findByIds(VID, PID);
  if (!dev) throw new PodNotFound();
  let itf;
  try {
    dev.open();
    itf = dev.interface(1);
    if (process.platform === 'linux' && itf.isKernelDriverActive()) itf.detachKernelDriver(); // o driver do kernel ocupa a interface de controle
    itf.claim();
  } catch (e) { try { dev.close(); } catch {} throw friendly(e); }
  const inEp = itf.endpoint(0x81), outEp = itf.endpoint(0x01);

  const waiters = [], listeners = new Set();
  let cur = null, expected = 0, idle = null, closed = false;

  const deliver = () => {
    if (!cur) return;
    const m = cur; cur = null; expected = 0; clearTimeout(idle);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); }
    for (const l of listeners) l(m);
  };
  inEp.startPoll(4, 64);
  inEp.on('data', b => {
    const n = b[0], t = b[2], data = b.subarray(4, 4 + n);
    if (t === 1) { deliver(); cur = Buffer.from(data); expected = ((data.readUInt16LE(0)) + 1) * 4; }
    else if (t === 4 && cur) cur = Buffer.concat([cur, data]);
    else return;
    clearTimeout(idle);
    if (cur.length >= expected) deliver(); else idle = setTimeout(deliver, 150); // mensagem truncada: entrega o que veio
  });
  inEp.on('error', () => {});

  const send = async frame => {
    for (const pkt of toPackets(frame)) await new Promise((res, rej) => outEp.transfer(pkt, e => (e ? rej(e) : res())));
  };
  // envia e espera uma resposta que satisfaça pred; pedidos são serializados (o pedal atende um por vez)
  let chain = Promise.resolve();
  const request = (frame, pred = () => true, ms = 2500) => {
    const run = async () => {
      let w;
      const p = new Promise((res, rej) => {
        const t = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); rej(new Error('the pedal did not answer in time')); }, ms);
        w = { pred, res: m => { clearTimeout(t); res(m); } };
        waiters.push(w);
      });
      await send(frame);
      return p;
    };
    const r = chain.then(run, run); chain = r.catch(() => {}); return r;
  };
  const close = () => new Promise(res => {
    if (closed) return res(); closed = true;
    // o reset USB faz o kernel devolver a interface ao snd-usb-podhd (attachKernelDriver não funciona neste pedal)
    inEp.stopPoll(() => itf.release(false, () => dev.reset(() => { try { dev.close(); } catch {} res(); })));
  });
  return { send, request, close, on: f => (listeners.add(f), () => listeners.delete(f)) };
}
