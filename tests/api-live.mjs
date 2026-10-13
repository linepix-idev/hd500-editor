// Testes contra o pedal real (via servidor em :5230). Só mexem no buffer de edição e restauram tudo.
import { readFileSync, existsSync } from 'fs';
const api = async (p, b) => { const r = await fetch('http://127.0.0.1:5230/api/' + p, b === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };
const edit = (op, a) => api('edit', { op, ...a });
const item = async id => (await api('state')).preset.items.find(i => i.id === id);
let ok = true; const check = (n, c) => { console.log(c ? '✔' : '✖', n); ok &&= c; };
const st0 = await api('state'); const name0 = st0.preset.name;

// footswitch por bloco (comando que reaplica o buffer inteiro)
const fs0 = (await item(4)).fs;
await edit('fs', { item: 4, fs: fs0 === 7 ? 8 : 7 }); check('atribuição de footswitch muda no pedal', (await item(4)).fs !== fs0);
await edit('fs', { item: 4, fs: fs0 }); check('footswitch restaurado', (await item(4)).fs === fs0);

// ordem dos blocos
const order0 = st0.preset.items.filter(i => i.kind === 'fx').sort((a, b) => a.pos - b.pos).map(i => ({ id: i.id, lane: i.lane }));
const swapped = order0.slice(); [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
await edit('chain', { order: swapped.map(o => ({ ...o })) });
const after = (await api('state')).preset.items.filter(i => i.kind === 'fx').sort((a, b) => a.pos - b.pos).map(i => i.id);
check('reordenar blocos reflete no pedal', after[0] === swapped[0].id && after[1] === swapped[1].id);
await edit('chain', { order: order0 });
check('ordem restaurada', (await api('state')).preset.items.filter(i => i.kind === 'fx').sort((a, b) => a.pos - b.pos).map(i => i.id).join() === order0.map(o => o.id).join());

// entrada, tempo e nome no buffer
const in2 = st0.preset.setup.input2;
await edit('setup', { id: 0x37, value: in2 === 0 ? 1 : 0 }); check('Input 2 muda', (await api('reconnect', {})).preset.setup.input2 !== in2);
await edit('setup', { id: 0x37, value: in2 });
await edit('name', { name: 'TESTE API' }); check('nome muda no buffer', (await api('state')).preset.name === 'TESTE API');

// desfazer
await edit('undo', {}); await edit('undo', {});
// importar .h5e (se houver exemplo) apenas no buffer, depois descartar recarregando o slot
const sample = process.env.H5E_SAMPLE;
if (sample && existsSync(sample)) {
  const s = await api('library/import-h5e', { data: readFileSync(sample).toString('base64'), to: null });
  check('importar .h5e carrega no buffer', s.preset.name !== name0 && s.dirty);
}
const back = await api('select', { set: st0.selection.set, preset: st0.selection.preset });
check('recarregar o slot descarta as edições', back.preset.name === name0 && !back.dirty);
check('estado final igual ao inicial', JSON.stringify(back.preset.items.map(i => [i.id, i.type, i.active, i.pos, i.lane, i.fs])) === JSON.stringify(st0.preset.items.map(i => [i.id, i.type, i.active, i.pos, i.lane, i.fs])));
process.exit(ok ? 0 : 1);
