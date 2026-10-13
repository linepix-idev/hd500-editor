import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { start, stop } from '../app/server.mjs';

const call = (port, { method = 'GET', path = '/api/catalog', headers = {}, body } = {}) => new Promise((res, rej) => {
  const r = http.request({ host: '127.0.0.1', port, method, path, headers }, resp => { let d = ''; resp.on('data', c => (d += c)); resp.on('end', () => res({ status: resp.statusCode, body: d })); });
  r.on('error', rej); if (body) r.write(body); r.end();
});

test('o servidor local recusa Host estranho, Origin de outro site e POST sem cabeçalho próprio', async t => {
  const port = await start(Number(process.env.PORT ?? 0)); t.after(stop);
  assert.equal((await call(port)).status, 200);                                                     // uso normal
  assert.equal((await call(port, { headers: { Host: 'evil.example' } })).status, 403);              // DNS rebinding
  assert.equal((await call(port, { headers: { Origin: 'https://evil.example' } })).status, 403);   // outro site
  const post = { method: 'POST', path: '/api/disconnect', body: '{}' };
  assert.equal((await call(port, post)).status, 403);                                               // form cross-site (sem preflight)
  assert.equal((await call(port, { ...post, headers: { 'x-hd500-editor': '1', Origin: `http://127.0.0.1:${port}` } })).status, 200);
});

test('a interface estática e o catálogo carregam sem pedal', async t => {
  const port = await start(Number(process.env.PORT ?? 0)); t.after(stop);
  const home = await call(port, { path: '/' }); assert.equal(home.status, 200); assert.match(home.body, /HD500/);
  const cat = JSON.parse((await call(port)).body); assert.ok(cat.amps.length > 50 && cat.pedals.length > 100);
});
