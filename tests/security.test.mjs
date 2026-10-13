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
