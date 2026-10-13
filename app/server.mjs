// Servidor local do editor: fala com o pedal por USB e serve a interface web (http://127.0.0.1:5230).
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { Pod, SETS, PRESETS_PER_SET } from '../core/device.mjs';
import { deviceVisible } from '../core/transport.mjs';
import { DemoPod } from './demo-device.mjs';
const DEMO = !!process.env.HD500_DEMO; // pedal simulado, sem hardware
import { Preset, catalog, chainOf, FS_NAMES, CTL_NAMES, INPUT1, INPUT2, INZ, LANES } from '../core/preset.mjs';
import * as Lib from '../core/library.mjs';
import { EditQueue, GestureHistory, FAST_EDITS } from './edit-flow.mjs';
import { parameterEdits } from './parameter-edits.mjs';
import { editKey } from './public/js/live-edits.js';

const PORT = Number(process.env.PORT ?? 5230);
// Backups live in the repo when run from source; the packaged app is read-only (asar), so it uses the user data dir.
const BACKUP_DIR = process.env.HD500_BACKUPS ?? (import.meta.url.includes('.asar')
  ? `${process.env.XDG_DATA_HOME ?? `${process.env.HOME ?? process.env.USERPROFILE}/.local/share`}/hd500-editor/backups`
  : new URL('../backups', import.meta.url).pathname);
const BACKUPS = new Lib.Backups(BACKUP_DIR);
const wait = ms => new Promise(r => setTimeout(r, ms));

let pod = null, preset = null, selection = { set: 0, preset: 0 }, setNames = [], slotNames = new Map(), lastError = null;
let loadedBody = null;
const same = (a, b) => a && b && Buffer.compare(a, b) === 0;
const queue = new EditQueue();
const hist = new GestureHistory(() => preset?.body, () => emit('history', status()));
const status = () => ({ dirty: !!preset && !same(preset.body, loadedBody), canUndo: hist.canUndo, canRedo: hist.canRedo });
const snapshot = () => { hist.push(); emit('history', status()); };
function resetHistory() { hist.reset(); loadedBody = Buffer.from(preset.body); }
const sent = new Map();
const isEcho = key => (sent.get(key) ?? 0) > Date.now();
const remember = b => sent.set(editKey(b), Date.now() + 600);

const clients = new Set();
const emit = (ev, data) => clients.forEach(r => r.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
const view = () => ({ connected: !!pod, dirty: !!preset && !same(preset.body, loadedBody), canUndo: hist.idx > 0, canRedo: hist.idx < hist.list.length - 1, selection, setNames, preset: preset?.toJSON(), chain: preset ? Object.fromEntries(Object.entries(chainOf(preset)).map(([k, v]) => [k, v.map(i => i.id)])) : null });

async function connect() {
  if (pod) return;
  try { pod = DEMO ? new DemoPod() : Pod.connect(); lastError = null; } catch (e) { pod = null; lastError = e.message; throw e; }
  // alterações feitas no painel do pedal
  pod.on('param', ({ item, id, value }) => {
    if (isEcho(`param:${item}:${id}`)) return;
    const it = preset?.items.find(i => i.id === item), p = it?.params.find(p => p.id === id);
    if (p) { preset.setParamValue(item, p.index, value); emit('param', { item, id, value }); }
  });
  pod.on('active', ({ item, active }) => { if (isEcho(`active:${item}`)) return; preset?.setItemActive(item, active); emit('active', { item, active }); });
  pod.on('unknown', ev => emit('unknown', ev));
  pod.on('setup', ({ id, value, vtype }) => { // ajuste mexido no painel do pedal: serve para descobrir o que cada id faz
    if (isEcho(`setup:${id}`)) return;
    try { vtype === 1 ? preset?.setSetupFloat(id, value) : preset?.setSetup(id, value); } catch {}
    emit('setup', { id, value, vtype });
  });
  let t = null;
  pod.on('selection', () => { clearTimeout(t); t = setTimeout(() => queue.enqueue(() => refresh()).catch(() => {}), 300); });
  await refresh(true);
}
async function refresh(first = false) {
  preset = await pod.readCurrent();
  selection = await pod.selection();
  if (first || !setNames.length) setNames = await pod.setNames();
  sent.clear(); resetHistory();
  emit('state', view());
}
async function drop() { try { await pod?.close(); } catch {} pod = null; preset = null; }

// Alterações sem comando próprio (footswitch, controlador, ordem dos blocos, nome…) substituem todo o buffer de edição.
// Relemos o buffer antes, para não sobrescrever o que mudou no painel do pedal nesse meio tempo.
async function mutate(fn) { preset = await pod.readCurrent(); fn(preset); await pod.apply(preset); await wait(200); emit('state', view()); }
async function pushAll() { await pod.apply(preset); await wait(200); emit('state', view()); }

const edits = {
  ...parameterEdits(() => preset, () => pod),
  undo: async () => { if (hist.idx > 0) { hist.idx--; preset = new Preset(hist.list[hist.idx]); await pod.apply(preset); emit('state', view()); } },
  redo: async () => { if (hist.idx < hist.list.length - 1) { hist.idx++; preset = new Preset(hist.list[hist.idx]); await pod.apply(preset); emit('state', view()); } },
  model: async ({ item, type }) => { await pod.model(item, type); await wait(300); preset = await pod.readCurrent(); emit('state', view()); },
  midi: async ({ index, bytes }) => mutate(p => bytes.forEach((v, k) => (p.body[0xd84 + index * 6 + k] = v))),
  fs: async ({ item, fs }) => mutate(p => p.setItemFs(item, fs)),
  ctl: async ({ item, index, ctl, lo, hi }) => mutate(p => { p.setParamCtl(item, index, ctl); if (lo != null) p.setParamRange(item, index, lo, hi); }),
  name: async ({ name }) => mutate(p => { p.name = name; }),
  chain: async ({ order }) => mutate(p => p.setFxOrder(order)),                   // [{id, lane}] na ordem 0..7
  raw: async ({ offset, value }) => mutate(p => { p.body[offset] = value; }),
};

// O servidor escuta só em 127.0.0.1, mas qualquer página aberta no navegador pode tentar falar com ele.
// Defesas: o Host precisa ser local (contra DNS rebinding) e todo POST exige um cabeçalho próprio (força preflight CORS, que não permitimos).
const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
function guard(req) {
  if (!LOCAL_HOST.test(req.headers.host ?? '')) return 'host not allowed';
  const origin = req.headers.origin;
  if (origin && !LOCAL_HOST.test(new URL(origin).host)) return 'origin not allowed';
  if (req.method !== 'GET' && req.headers['x-hd500-editor'] !== '1') return 'missing X-HD500-Editor header';
  return null;
}
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const MAX_BODY = 64 * 1024 * 1024; // um pacote com a biblioteca inteira tem ~3 MB
const readBody = req => new Promise((res, rej) => {
  const c = []; let n = 0;
  req.on('data', d => { n += d.length; if (n > MAX_BODY) { rej(new Error('request body too large')); req.destroy(); } else c.push(d); });
  req.on('end', () => { try { res(c.length ? JSON.parse(Buffer.concat(c).toString()) : {}); } catch { rej(new Error('invalid JSON')); } });
});
const progress = (what) => (done, total) => emit('progress', { what, done, total });

const routes = {
  'GET /api/catalog': async () => ({ ...catalog, fs: FS_NAMES, ctl: CTL_NAMES, input1: INPUT1, input2: INPUT2, inZ: INZ, lanes: LANES, sets: SETS, presets: PRESETS_PER_SET }),
  'GET /api/state': async () => { await connect(); return view(); },
  'POST /api/reconnect': async () => { await drop(); await wait(1500); await connect(); return view(); },
  'POST /api/disconnect': async () => { await drop(); emit('state', view()); return { ok: true }; },
  'POST /api/edit': async b => {
    hist.before(b);
    if (FAST_EDITS.has(b.op)) remember(b);
    await edits[b.op](b);
    if (FAST_EDITS.has(b.op)) remember(b);
    if (b.op !== 'undo' && b.op !== 'redo') hist.after(b);
    return { ok: true };
  },
  'POST /api/select': async ({ set, preset: p }) => { await pod.select(set, p); await refresh(); return view(); },
  'POST /api/save': async () => {
    const live = await pod.readCurrent();
    BACKUPS.save(selection.set, selection.preset, await pod.readSlot(selection.set, selection.preset));
    await pod.writeSlot(selection.set, selection.preset, live);
    await refresh(); return view();
  },
  // --- biblioteca ---
  'POST /api/library/slots': async ({ set }) => {
    const names = await pod.slotNames(set, progress('Lendo set ' + (set + 1))); slotNames.set(set, names); return names;
  },
  'POST /api/library/list': async () => { // nomes de todos os presets, para imprimir/compartilhar a lista
    const sets = []; for (let i = 0; i < SETS; i++) sets.push({ name: setNames[i] ?? (await pod.setName(i)), presets: await pod.slotNames(i, (d, t) => emit('progress', { what: 'Lendo nomes', done: i * t + d, total: SETS * t })) });
    return { sets };
  },
  // renomeia um preset de qualquer slot (o corpo do preset guarda o nome). O slot carregado é renomeado só no buffer: salve para gravar.
  'POST /api/library/rename-slot': async ({ set, preset: p, name }) => {
    const n = String(name ?? '').trim().slice(0, 16); if (!n) throw new Error('empty name');
    if (set === selection.set && p === selection.preset) { await edits.name({ name: n }); snapshot(); return { current: true }; }
    const sl = await pod.readSlot(set, p); BACKUPS.save(set, p, sl); sl.name = n; await pod.writeSlot(set, p, sl); return { current: false };
  },
  'POST /api/library/rename-set': async ({ set, name }) => { await pod.renameSet(set, name); setNames = await pod.setNames(); emit('state', view()); return setNames; },
  'POST /api/library/export': async ({ sets }) => Lib.exportBundle(pod, sets, progress('Exportando')),
  'POST /api/library/import': async ({ bundle, map, renameSets }) => ({ written: await Lib.importBundle(pod, bundle, { map, renameSets, backups: BACKUPS, onProgress: progress('Gravando') }) }),
  'POST /api/library/copy': async ({ from, to }) => { await Lib.copySlot(pod, from, to, BACKUPS); return { ok: true }; },
  // mover = inserir: o preset vai para outra posição do mesmo set e os do meio se deslocam (como no editor oficial)
  'POST /api/library/move': async ({ set, from, to }) => {
    if (from === to) return { ok: true };
    const lo = Math.min(from, to), hi = Math.max(from, to), cur = [];
    for (let i = lo; i <= hi; i++) { const sl = await pod.readSlot(set, i); BACKUPS.save(set, i, sl, 'mover'); cur.push(sl); }
    const moved = from < to ? [...cur.slice(1), cur[0]] : [cur[cur.length - 1], ...cur.slice(0, -1)];
    for (let k = 0; k < moved.length; k++) { await pod.writeSlot(set, lo + k, moved[k]); emit('progress', { what: 'Moving', done: k + 1, total: moved.length }); }
    return { ok: true };
  },
  'POST /api/library/swap': async ({ a, b }) => { await Lib.swapSlots(pod, a, b, BACKUPS); return { ok: true }; },
  'POST /api/library/clear': async ({ at }) => { await Lib.clearSlot(pod, at, BACKUPS); return { ok: true }; },
  'POST /api/library/export-h5e': async ({ set, preset: p }) => {
    const pr = set == null ? preset : await pod.readSlot(set, p);
    return { name: pr.name, data: Lib.presetToH5e(pr).toString('base64') };
  },
  'POST /api/library/import-h5e': async ({ data, to }) => {
    const p = Lib.presetFromH5e(Buffer.from(data, 'base64'));
    if (!to) { preset = p; await pushAll(); return view(); }          // só no buffer de edição
    BACKUPS.save(to.set, to.preset, await pod.readSlot(to.set, to.preset));
    await pod.writeSlot(to.set, to.preset, p); return { ok: true };
  },
  'GET /api/backups': async () => BACKUPS.list(),
  'GET /api/globals': async () => pod.globals(),
  'POST /api/globals': async ({ id, value }) => { await pod.setGlobal(id, value); return { ok: true }; },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
export async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://x'), key = `${req.method} ${url.pathname}`;
  try {
    const denied = guard(req); if (denied) return json(res, 403, { error: denied });
    if (key === 'GET /api/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); res.write('\n'); clients.add(res); req.on('close', () => clients.delete(res)); return; }
    if (routes[key]) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const editing = key === 'POST /api/edit';
      if (editing && !edits[body.op]) throw new Error(`unknown operation: ${body.op}`);
      if (editing && body.gesture != null && !['start', 'move', 'end'].includes(body.gesture)) throw new Error('invalid gesture');
      const run = async () => {
        const needsPod = !/catalog|reconnect|disconnect|backups|state$/.test(key);
        if (needsPod) await connect();
        return routes[key](body);
      };
      const operation = queue.enqueue(run, editing && FAST_EDITS.has(body.op) ? body : null);
      if (editing && FAST_EDITS.has(body.op)) {
        // Acknowledge acceptance without waiting for USB. Ordered failures arrive
        // on the event stream; the client never blocks a knob on a response.
        operation.catch(error => emit('edit-error', { error: error.message, op: body.op }));
        return json(res, 200, { ok: true });
      }
      return json(res, 200, await operation);
    }
    const f = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (f.includes('..')) return json(res, 400, { error: 'invalid path' });
    const data = readFileSync(new URL(`./public/${f}`, import.meta.url)); // lê antes: ENOENT não pode vir depois do writeHead
    res.writeHead(200, { 'content-type': MIME[f.slice(f.lastIndexOf('.'))] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (res.headersSent) return res.end();
    json(res, e.code === 'ENOENT' ? 404 : 500, { error: e.message });
  }
}
const server = createServer(handleRequest);

// conecta sozinho ao ligar o pedal e solta ao desconectar o cabo
let watching = null, connecting = false;
function watch() {
  watching = setInterval(async () => {
    try {
      const here = DEMO || deviceVisible();
      if (pod && !here) { await queue.enqueue(async () => { await drop(); emit('state', view()); }); }
      else if (!pod && here && clients.size && !connecting) { connecting = true; try { await queue.enqueue(async () => { await connect(); emit('state', view()); }); } catch {} connecting = false; }
    } catch {}
  }, 2500);
}
export const start = (port = PORT) => new Promise((res, rej) => { server.once('error', rej); server.listen(port, '127.0.0.1', () => { watch(); res(server.address().port); }); });
export async function stop() { clearInterval(watching); await drop(); server.close(); }

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) { // executado direto: node app/server.mjs
  start().then(p => console.log(`HD500 Editor em http://127.0.0.1:${p}`));
  const bye = async () => { await stop(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye); process.on('uncaughtException', e => { console.error(e); bye(); }); process.on('unhandledRejection', e => console.error(e));
}
