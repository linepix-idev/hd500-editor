import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import * as M from '../core/protocol.mjs';
import { EventEmitter } from 'node:events';
import { createTransport, toPackets } from '../core/transport.mjs';
import { Preset, chainOf, FS_NAMES, LANES } from '../core/preset.mjs';
import { BLANK, presetToH5e, presetFromH5e } from '../core/library.mjs';
import { h5eToBlob, blobToH5e, isH5E } from '../core/h5e.mjs';

test('cabeçalho de mensagem: tamanho em palavras - 1, endereço 0x40, comando e cliente', () => {
  const q = M.queryPreset();
  assert.equal(q.toString('hex'), '02000a4001080000' + 'ffffffff'.replace(/(..)/g, '$1'));
  const sel = M.selectPreset(63);
  assert.equal(sel.length, 20);
  assert.equal(sel.readUInt32LE(0), 0x400a0004);       // 5 palavras
  assert.equal(sel[7], M.CMD.STATUS_SET);               // comando no byte 7
  assert.deepEqual([M.word(sel, 0), M.word(sel, 1), M.word(sel, 2)], [0, 8, 63]);
});

test('PresetSet: 4108 bytes, destino (set<<16)|preset ou 0xFFFFFFFF', () => {
  const body = Buffer.alloc(4096, 7);
  const slot = M.setPreset(body, 6, 63);
  assert.equal(slot.length, 4108);
  assert.equal(slot.readUInt32LE(0) & 0xffff, 1026);   // palavras - 1
  assert.equal(M.word(slot, 0), (6 << 16) | 63);
  assert.equal(M.word(M.applyPreset(body), 0), 0xffffffff);
  assert.equal(slot.subarray(12).equals(body), true);
});

test('pacotes USB: no máximo 60 bytes de dados por pacote de 64', () => {
  const f = M.setPreset(Buffer.alloc(4096), 0, 0);
  const pk = toPackets(f);
  assert.equal(pk.length, Math.ceil(4108 / 60));
  assert.ok(pk.every(p => p.length <= 64 && p[0] === p.length - 4));
  assert.equal(pk[0][2], 1); assert.ok(pk.slice(1).every(p => p[2] === 4));
  assert.equal(Buffer.concat(pk.map(p => p.subarray(4))).equals(f), true);
});

test('renomear set: 16 bytes de nome após o índice', () => {
  const f = M.renameSet(2, 'LAB');
  assert.equal(f[7], M.CMD.SET_NAME); assert.equal(M.word(f, 0), 2);
  assert.equal(f.subarray(12, 28).toString('latin1'), 'LAB'.padEnd(16));
});

test('modelo de preset: nome, footswitch, posições e faixas', () => {
  const p = BLANK.clone();
  p.name = 'MEU PRESET';
  assert.equal(p.name, 'MEU PRESET');
  p.setItemFs(4, 5); assert.equal(p.item(4).fs, 5); assert.equal(FS_NAMES[5], 'FS5');
  p.setFxOrder([4, 5, 6, 7, 8, 9, 10, 11].map((id, i) => ({ id, lane: i < 3 ? LANES.pre : LANES.post })));
  const c = chainOf(p);
  assert.deepEqual(c.pre.map(i => i.id), [4, 5, 6]); assert.deepEqual(c.post.map(i => i.id), [7, 8, 9, 10, 11]);
  p.setSetup(0x36, 7); assert.equal(p.setup(0x36), 7);
  assert.equal(p.body.length, 4096);
});

test('.h5e: ida e volta preserva o corpo e o cabeçalho', () => {
  const file = presetToH5e(BLANK);
  assert.equal(file.length, 40 + 4096); assert.ok(isH5E(file));
  assert.equal(presetFromH5e(file).body.equals(BLANK.body), true);
  const edited = BLANK.clone(); edited.name = 'X';
  edited.body.writeUInt32LE(0x3f100003, 0x28 + 16); edited.setParamValue(0, 0, 0.123);   // um parâmetro de ponto flutuante
  edited.body.writeUInt16LE(0x1234, 0x28 + 4); edited.body.writeFloatLE(97.5, 0xd58);   // posição (16 bits) e tempo
  const back = presetFromH5e(presetToH5e(edited, file));
  assert.equal(back.body.equals(edited.body), true); assert.equal(back.name, 'X');
  assert.ok(Math.abs(back.item(0).params[0].value - 0.123) < 1e-6);
});

test('.h5e real (se existir em ~/Documentos): decodifica com modelos reconhecidos', { skip: !existsSync(process.env.H5E_SAMPLE ?? '') }, () => {
  const p = presetFromH5e(readFileSync(process.env.H5E_SAMPLE));
  assert.ok(p.items.filter(i => !i.empty).every(i => !i.model.startsWith('0x')));
});

function fakeTransport(transfer = (_, cb) => cb(null)) {
  const inEp = new EventEmitter(); inEp.startPoll = () => {}; inEp.stopPoll = cb => cb();
  return { inEp, transport: createTransport({ inEp, outEp: { transfer }, itf: { release: (_, cb) => cb() }, dev: { reset: cb => cb(), close() {} } }) };
}

test('transporte: falha de envio cancela a espera e permite o próximo pedido', async () => {
  let calls = 0;
  const { transport, inEp } = fakeTransport((_, cb) => cb(++calls === 1 ? new Error('send failed') : null));
  await assert.rejects(transport.request(M.queryPreset(), () => true, 20), /send failed/);
  const next = transport.request(M.queryPreset(), () => true, 100);
  await new Promise(r => setImmediate(r));
  inEp.emit('data', toPackets(M.queryPreset())[0]);
  assert.deepEqual(await next, M.queryPreset());
  await new Promise(r => setTimeout(r, 30)); // o timer antigo não pode rejeitar depois
  await transport.close();
});

test('transporte: desconexão e fechamento rejeitam pedidos ativos e enfileirados', async () => {
  for (const disconnect of [true, false]) {
    const { transport, inEp } = fakeTransport();
    const a = transport.request(M.queryPreset()), b = transport.request(M.queryPreset());
    const results = Promise.allSettled([a, b]);
    await new Promise(r => setImmediate(r));
    if (disconnect) inEp.emit('error', new Error('USB disconnected'));
    else await transport.close();
    assert((await results).every(r => r.status === 'rejected'));
    await assert.rejects(transport.send(M.queryPreset()), /disconnected|closed/);
    await transport.close();
  }
});

test('transporte: pacotes truncados são descartados sem derrubar o leitor', async () => {
  const { transport, inEp } = fakeTransport();
  const response = transport.request(M.queryPreset(), () => true, 100);
  await new Promise(r => setImmediate(r));
  for (const packet of [Buffer.alloc(0), Buffer.from([1, 0, 1, 0, 0]), Buffer.from([60, 0, 1, 0, 0])]) {
    assert.doesNotThrow(() => inEp.emit('data', packet));
  }
  inEp.emit('data', toPackets(M.queryPreset())[0]);
  assert.deepEqual(await response, M.queryPreset());
  await transport.close();
});
