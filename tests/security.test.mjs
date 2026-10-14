import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

// Exercise the real guard/routes without opening a socket or watching physical hardware.
process.env.HD500_DEMO = '1';
process.env.PORT = '5231';
const { handleRequest, stop } = await import('../app/server.mjs');
const port = 5231;
const call = (port, { method = 'GET', path = '/api/catalog', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  Object.assign(req, { method, url: path, headers: {
    host: `127.0.0.1:${port}`,
    ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])),
  } });
  const res = { headersSent: false, writeHead(status) { this.status = status; this.headersSent = true; },
    end(data) { resolve({ status: this.status, body: String(data) }); } };
  handleRequest(req, res).catch(reject);
});

test('o servidor local recusa Host estranho, Origin de outro site e POST sem cabeçalho próprio', async t => {
  t.after(stop);
  assert.equal((await call(port)).status, 200);                                                     // uso normal
  assert.equal((await call(port, { headers: { Host: 'evil.example' } })).status, 403);              // DNS rebinding
  assert.equal((await call(port, { headers: { Origin: 'https://evil.example' } })).status, 403);   // outro site
  const post = { method: 'POST', path: '/api/disconnect', body: '{}' };
  assert.equal((await call(port, post)).status, 403);                                               // form cross-site (sem preflight)
  assert.equal((await call(port, { ...post, headers: { 'x-hd500-editor': '1', Origin: `http://127.0.0.1:${port}` } })).status, 200);
});

test('a interface estática e o catálogo carregam sem pedal', async t => {
  t.after(stop);
  const home = await call(port, { path: '/' }); assert.equal(home.status, 200); assert.match(home.body, /HD500/);
  const cat = JSON.parse((await call(port)).body); assert.ok(cat.amps.length > 50 && cat.pedals.length > 100);
});

test('falha na leitura inicial libera a conexão e permite tentar novamente', async t => {
  const { DemoPod } = await import('../app/demo-device.mjs');
  const read = DemoPod.prototype.readCurrent, close = DemoPod.prototype.close;
  let closed = 0;
  t.after(async () => { DemoPod.prototype.readCurrent = read; DemoPod.prototype.close = close; await stop(); });
  DemoPod.prototype.readCurrent = async () => { throw new Error('initial read failed'); };
  DemoPod.prototype.close = async function() { closed++; return close.call(this); };
  const failed = await call(port, { path: '/api/state' });
  assert.equal(failed.status, 500); assert.match(failed.body, /initial read failed/);
  assert.equal(closed, 1);
  DemoPod.prototype.readCurrent = read;
  const recovered = JSON.parse((await call(port, { path: '/api/state' })).body);
  assert.equal(recovered.connected, true); assert.ok(recovered.preset); assert.equal(recovered.setNames.length, 8);
});

test('falha ao ler seleção não substitui o preset nem apaga seu histórico', async t => {
  const { DemoPod } = await import('../app/demo-device.mjs');
  const select = DemoPod.prototype.selection;
  t.after(async () => { DemoPod.prototype.selection = select; await stop(); });
  const initial = JSON.parse((await call(port, { path: '/api/state' })).body);
  const post = (path, body) => call(port, { method: 'POST', path: '/api/' + path, headers: { 'x-hd500-editor': '1' }, body: JSON.stringify(body) });
  await post('edit', { op: 'name', name: 'EDITADO' });
  DemoPod.prototype.selection = async () => { throw new Error('selection failed'); };
  assert.equal((await post('select', { set: 0, preset: 1 })).status, 500);
  const state = JSON.parse((await call(port, { path: '/api/state' })).body);
  assert.equal(state.preset.name, 'EDITADO'); assert.equal(state.selection.preset, initial.selection.preset); assert.equal(state.canUndo, true);
});

test('undo/redo recusados pelo pedal preservam preset e posição do histórico', async t => {
  const { DemoPod } = await import('../app/demo-device.mjs');
  const apply = DemoPod.prototype.apply;
  t.after(async () => { DemoPod.prototype.apply = apply; await stop(); });
  const state = async () => JSON.parse((await call(port, { path: '/api/state' })).body);
  const post = body => call(port, { method: 'POST', path: '/api/edit', headers: { 'x-hd500-editor': '1' }, body: JSON.stringify(body) });
  const initial = await state();
  await post({ op: 'name', name: 'EDITADO' });
  DemoPod.prototype.apply = async () => { throw new Error('apply failed'); };
  assert.equal((await post({ op: 'undo' })).status, 500);
  let current = await state();
  assert.equal(current.preset.name, 'EDITADO'); assert.equal(current.canUndo, true); assert.equal(current.canRedo, false);
  DemoPod.prototype.apply = apply;
  assert.equal((await post({ op: 'undo' })).status, 200);
  DemoPod.prototype.apply = async () => { throw new Error('apply failed'); };
  assert.equal((await post({ op: 'redo' })).status, 500);
  current = await state();
  assert.equal(current.preset.name, initial.preset.name); assert.equal(current.canUndo, false); assert.equal(current.canRedo, true);
});

test('compare recusado preserva edições; sair da comparação recusado preserva o stash', async t => {
  const { DemoPod } = await import('../app/demo-device.mjs');
  const apply = DemoPod.prototype.apply;
  t.after(async () => { DemoPod.prototype.apply = apply; await stop(); });
  const state = async () => JSON.parse((await call(port, { path: '/api/state' })).body);
  const post = (path, body) => call(port, { method: 'POST', path: '/api/' + path, headers: { 'x-hd500-editor': '1' }, body: JSON.stringify(body) });
  const initial = await state();
  await post('edit', { op: 'name', name: 'EDITADO' });
  DemoPod.prototype.apply = async () => { throw new Error('apply failed'); };
  assert.equal((await post('compare', { on: true })).status, 500);
  let current = await state(); assert.equal(current.preset.name, 'EDITADO'); assert.equal(current.comparing, false);
  DemoPod.prototype.apply = apply;
  assert.equal((await post('compare', { on: true })).status, 200);
  DemoPod.prototype.apply = async () => { throw new Error('apply failed'); };
  for (const [path, body] of [['compare', { on: false }], ['edit', { op: 'name', name: 'OUTRO' }]]) {
    assert.equal((await post(path, body)).status, 500);
    current = await state(); assert.equal(current.preset.name, initial.preset.name); assert.equal(current.comparing, true);
  }
  DemoPod.prototype.apply = apply;
  assert.equal((await post('compare', { on: false })).status, 200);
  current = await state(); assert.equal(current.preset.name, 'EDITADO'); assert.equal(current.comparing, false);
});

test('ajustes globais recusam id/valor fora da faixa e aceitam o normal', async t => {
  t.after(stop);
  const h = { 'x-hd500-editor': '1', Origin: `http://127.0.0.1:${port}` };
  const post = body => call(port, { method: 'POST', path: '/api/globals', headers: h, body: JSON.stringify(body) });
  for (const bad of [{ id: -1, value: 1 }, { id: 0x100, value: 1 }, { id: 1.5, value: 1 }, { id: '2', value: 1 }, { id: 2, value: -1 }, { id: 2, value: 1e9 }, { id: 2, value: 'x' }, { id: 2, value: null }, {}])
    assert.notEqual((await post(bad)).status, 200, JSON.stringify(bad));
  assert.equal((await post({ id: 2, value: 440 })).status, 200);
});

test('importar bundle valida o lote inteiro antes da primeira escrita', async () => {
  const { importBundle } = await import('../core/library.mjs');
  const { Preset } = await import('../core/preset.mjs');
  const writes = [], pod = { readSlot: async () => new Preset(Buffer.alloc(4096)), writeSlot: async (s, p) => writes.push([s, p]) };
  const ok = Buffer.alloc(4096).toString('base64'), short = Buffer.alloc(10).toString('base64');
  const bundle = body2 => ({ format: 'hd500-bundle', sets: [{ index: 0, presets: [{ index: 0, body: ok }, { index: 1, body: body2 }] }] });
  await assert.rejects(importBundle(pod, bundle(short)));                   // 2º corpo inválido
  await assert.rejects(importBundle(pod, bundle(ok), { map: [{ from: { set: 0, preset: 0 }, to: { set: 0, preset: 0 } }, { from: { set: 0, preset: 1 }, to: { set: 9, preset: 99 } }] })); // destino fora
  assert.equal(writes.length, 0);                                           // nada gravado
  assert.equal(await importBundle(pod, bundle(ok)), 2);
  assert.equal(writes.length, 2);
});

test('MCP desligado no app bloqueia a IA (x-hd500-actor: ai) e religa sem reiniciar', async t => {
  const h = { 'x-hd500-editor': '1', Origin: `http://127.0.0.1:${port}` }, ai = { ...h, 'x-hd500-actor': 'ai' };
  const post = (enabled, headers = h) => call(port, { method: 'POST', path: '/api/mcp', headers, body: JSON.stringify({ enabled }) });
  t.after(async () => { await post(true); await stop(); });
  assert.equal((await call(port, { path: '/api/state', headers: ai })).status, 200);       // ligado por padrão
  assert.equal((await post('x')).status, 500);                                              // só booleano
  assert.equal((await post(false)).status, 200);
  assert.equal((await call(port, { path: '/api/state', headers: ai })).status, 403);       // IA bloqueada
  assert.equal((await call(port, { method: 'POST', path: '/api/edit', headers: ai, body: '{"op":"undo"}' })).status, 403);
  assert.equal((await call(port, { path: '/api/catalog', headers: ai })).status, 200);     // descoberta continua
  assert.equal(JSON.parse((await call(port, { path: '/api/mcp', headers: ai })).body).enabled, false);
  assert.equal((await call(port, { path: '/api/state', headers: h })).status, 200);        // a UI não é afetada
  assert.equal((await post(false, ai)).status, 403);                                        // a IA não se religa sozinha
  assert.equal((await post(true)).status, 200);
  assert.equal((await call(port, { path: '/api/state', headers: ai })).status, 200);
});

test('assistente de driver: diagnóstico com forma estável, classificação de erro e instalação só pela janela do app', async t => {
  t.after(stop);
  const { classifyError, UDEV_RULE } = await import('../core/driver.mjs');
  const { readFileSync } = await import('node:fs');
  assert.equal(classifyError('On Windows the pedal must use the WinUSB driver on this interface'), 'driver');
  assert.equal(classifyError('No permission to access the pedal. Install the project\'s udev rule'), 'permission');
  assert.equal(classifyError('The pedal is in use by another program.'), 'busy');
  assert.equal(classifyError('POD HD500 not found (USB cable?)'), 'notfound');
  assert.equal(classifyError('boom'), 'other'); assert.equal(classifyError(null), null);
  assert.equal(UDEV_RULE, readFileSync(new URL('../99-line6-hd500.rules', import.meta.url), 'utf8').split('\n').find(l => l.startsWith('SUBSYSTEM')), 'regra embutida igual ao arquivo do repositório');
  assert.ok(readFileSync(new URL('../build/linux/after-install.sh', import.meta.url), 'utf8').includes(UDEV_RULE), 'regra do .deb igual ao arquivo do repositório');
  const h = { 'x-hd500-editor': '1', Origin: `http://127.0.0.1:${port}` };
  const d = JSON.parse((await call(port, { path: '/api/diagnose', headers: h })).body);
  for (const k of ['platform', 'visible', 'kind', 'udev', 'driver', 'daemon', 'canAssist']) assert.ok(k in d, `diagnose.${k}`);
  assert.equal((await call(port, { method: 'POST', path: '/api/driver/install', headers: { ...h, 'x-hd500-actor': 'ai' }, body: '{}' })).status, 403); // a IA não instala driver
});
