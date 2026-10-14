// Transporte USB do POD HD500 (0e41:414d): interface 1, bulk 0x01 (saída) / 0x81 (entrada), pacotes de 64 bytes.
// Cada pacote = [n][0][t][0] + até 60 bytes de dados (t=1 primeiro, t=4 continuação). Ver docs/protocol.md.
import { createRequire } from 'module';
import net from 'net';
import { EventEmitter } from 'events';
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

/** No macOS (e às vezes no Windows) o pedal chega sem configuração USB ativa e a interface 1 "não existe" até ativá-la. */
/** Socket do hd500audiod (driver de áudio do macOS): ele é o único dono do USB e repassa o canal de controle. */
const DAEMON_SOCK = process.env.HD500_CTRL_SOCK || '/var/run/hd500audiod.sock';
let daemonSock = null;
function connectDaemon() {
  if (process.platform !== 'darwin' && !process.env.HD500_CTRL_SOCK) return Promise.resolve(null);
  return new Promise(res => {
    const s = net.connect(DAEMON_SOCK);
    s.once('connect', () => { s.removeAllListeners('error'); res(s); });
    s.once('error', () => res(null));
  });
}

export async function prepareDevice() {
  daemonSock = await connectDaemon();
  if (daemonSock) return;
  const dev = findByIds(VID, PID);
  if (!dev) throw new PodNotFound();
  try {
    dev.open();
    if (!dev.configDescriptor) await new Promise((res, rej) => dev.setConfiguration(1, e => (e ? rej(e) : res())));
  } catch (e) { throw friendly(e); }
  finally { try { dev.close(); } catch {} }
}

/** Pontas "USB" falsas apoiadas no socket do daemon: pacotes (até 64 bytes) com prefixo de tamanho nos dois sentidos. */
function daemonEndpoints(sock) {
  const inEp = new EventEmitter(), pending = [];
  let acc = Buffer.alloc(0);
  inEp.startPoll = () => {}; inEp.stopPoll = cb => cb && cb();
  sock.on('data', d => { // quadros [tamanho][dados]
    acc = Buffer.concat([acc, d]);
    while (acc.length > 0 && acc.length > acc[0]) { const n = acc[0]; inEp.emit('data', Buffer.from(acc.subarray(1, 1 + n))); acc = acc.subarray(1 + n); }
  });
  sock.on('error', () => {}); sock.on('close', () => inEp.emit('error', new Error('daemon')));
  const outEp = { transfer: (pkt, cb) => sock.write(Buffer.concat([Buffer.from([pkt.length]), pkt]), e => cb(e || null)) };
  return { inEp, outEp, itf: { release: (_, cb) => cb && cb() }, dev: { reset: cb => { sock.end(); cb && cb(); }, close() { sock.destroy(); } } };
}

export function openDevice() {
  const viaDaemon = daemonSock ? daemonEndpoints(daemonSock) : null; daemonSock = null;
  const dev = viaDaemon ? viaDaemon.dev : findByIds(VID, PID);
  if (!dev) throw new PodNotFound();
  let itf;
  if (!viaDaemon) try {
    dev.open();
    itf = dev.interface(1);
    if (process.platform === 'linux' && itf.isKernelDriverActive()) itf.detachKernelDriver(); // o driver do kernel ocupa a interface de controle
    itf.claim();
  } catch (e) { try { dev.close(); } catch {} throw friendly(e); }
  if (viaDaemon) itf = viaDaemon.itf;
  const inEp = viaDaemon ? viaDaemon.inEp : itf.endpoint(0x81), outEp = viaDaemon ? viaDaemon.outEp : itf.endpoint(0x01);

  return createTransport({ inEp, outEp, itf, dev });
}

/** Ciclo de vida do transporte; endpoints injetáveis para testes sem hardware. */
export function createTransport({ inEp, outEp, itf, dev }) {
  const waiters = [], listeners = new Set();
  let cur = null, expected = 0, idle = null, closed = false;

  const deliver = () => {
    if (!cur) return;
    const m = cur; cur = null; expected = 0; clearTimeout(idle);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.res(m); }
    for (const l of listeners) { try { l(m); } catch (e) { console.error('listener:', e.message); } }
  };
  let failure = null;
  const cancel = error => {
    failure ??= error; clearTimeout(idle); cur = null; expected = 0;
    for (const w of [...waiters]) w.rej(failure);
  };
  inEp.on('data', b => {
    if (closed || failure) return;
    const n = b[0], t = b[2], data = b.subarray(4, 4 + n);
    if (b.length < 4 || (t === 1 && data.length < 2)) return;
    if (t === 1) { cur = Buffer.from(data); expected = ((data.readUInt16LE(0)) + 1) * 4; }
    else if (t === 4 && cur) cur = Buffer.concat([cur, data]);
    else return;
    clearTimeout(idle);
    if (cur.length >= expected) deliver(); else idle = setTimeout(() => { cur = null; expected = 0; }, 400); // mensagem incompleta (pacote perdido): descarta; quem pediu tenta de novo
  });
  inEp.on('error', e => cancel(e));
  inEp.startPoll(4, 64);

  const send = async frame => {
    for (const pkt of toPackets(frame)) {
      if (closed || failure) throw failure ?? new Error('transport closed');
      await new Promise((res, rej) => outEp.transfer(pkt, e => (e ? rej(e) : res())));
    }
  };
  // envia e espera uma resposta que satisfaça pred; pedidos são serializados (o pedal atende um por vez)
  let chain = Promise.resolve();
  const request = (frame, pred = () => true, ms = 2500) => {
    const run = async () => {
      if (closed || failure) throw failure ?? new Error('transport closed');
      return new Promise((res, rej) => {
        let t;
        const cleanup = () => { clearTimeout(t); const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); };
        const w = { pred, res: m => { cleanup(); res(m); }, rej: e => { cleanup(); rej(e); } };
        t = setTimeout(() => w.rej(new Error('the pedal did not answer in time')), ms);
        waiters.push(w);
        send(frame).catch(w.rej);
      });
    };
    const r = chain.then(run, run); chain = r.catch(() => {}); return r;
  };
  const close = () => new Promise(res => {
    if (closed) return res(); closed = true;
    cancel(new Error('transport closed')); listeners.clear();
    // o reset USB faz o kernel devolver a interface ao snd-usb-podhd (attachKernelDriver não funciona neste pedal)
    inEp.stopPoll(() => itf.release(false, () => dev.reset(() => { try { dev.close(); } catch {} res(); })));
  });
  return { send, request, close, get failed() { return !!failure && !closed; }, on: f => (listeners.add(f), () => listeners.delete(f)) };
}
