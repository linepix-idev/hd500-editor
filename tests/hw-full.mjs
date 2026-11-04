// Bateria completa contra um pedal REAL (POD HD500 ou HD500X), via servidor do editor já conectado.
// Uso: HD500_URL=http://127.0.0.1:5230 node tests/hw-full.mjs
// Mexe no buffer de edição e restaura. Com HD500_WRITE=1 também grava na memória, mas só num slot de
// rascunho chamado "New Tone" (último encontrado); o conteúdo original volta pelo backup e é conferido byte a byte.
const BASE = (process.env.HD500_URL ?? 'http://127.0.0.1:5230').replace(/\/$/, '');
const WRITE = process.env.HD500_WRITE === '1';
const api = async (p, b) => {
  const r = await fetch(`${BASE}/api/${p}`, b === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) });
  const j = await r.json(); if (!r.ok) throw new Error(`${p}: ${j.error}`); return j;
};
const edit = (op, a = {}) => api('edit', { op, ...a });
const state = () => api('state');
const wait = ms => new Promise(r => setTimeout(r, ms));
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
let fails = 0, passes = 0;
const check = (n, c, extra = '') => { console.log(`${c ? '✔' : '✖'} ${n}${extra ? ` (${extra})` : ''}`); c ? passes++ : fails++; };
const step = async (n, fn) => { const t = Date.now(); try { await fn(); } catch (e) { check(`${n}: ${e.message}`, false); } console.log(`  · ${n}: ${Date.now() - t} ms`); };
const sig = p => JSON.stringify(p.items.map(i => [i.id, i.type, i.active, i.pos, i.lane, i.fs, i.params.map(x => +x.value.toFixed(4))]));

const diag = await api('diagnose');
const abTest = async st => {
  await api('select', st.selection); await edit('name', { name: 'HW A/B' });
  const on = await api('compare', { on: true }); check('A/B liga e mostra o salvo', on.comparing && on.preset.name === st.preset.name);
  const off = await api('compare', { on: false }); check('A/B volta à edição', !off.comparing && off.preset.name === 'HW A/B');
  await api('select', st.selection);
};
check('pedal visível e conectado', diag.visible && diag.connected, `${diag.platform}, driver ${diag.driver ?? '-'}`);
const st0 = await state(); const home = st0.selection; const sig0 = sig(st0.preset);
console.log(`preset inicial: ${home.set}:${home.preset} "${st0.preset.name}"`);

await step('A/B (comparar com o salvo)', () => abTest(st0));

await step('parâmetros (amp e efeito)', async () => {
  for (const it of st0.preset.items.filter(i => (i.kind === 'amp' || i.kind === 'fx') && !i.empty && i.params.some(x => x.kind === 'percent')).slice(0, 4)) {
    const p = it.params.find(x => x.kind === 'percent'); const v0 = p.value, v1 = v0 > 0.5 ? 0.25 : 0.75;
    await edit('param', { item: it.id, index: p.index, id: p.id, value: v1 });
    const got = (await api('reconnect', {})).preset.items.find(i => i.id === it.id).params.find(x => x.index === p.index).value;
    check(`${it.model} · ${p.name} chega ao pedal`, near(got, v1, 0.01), got.toFixed(3));
    await edit('param', { item: it.id, index: p.index, id: p.id, value: v0 });
  }
});

await step('bypass de bloco', async () => {
  const it = st0.preset.items.find(i => i.kind === 'fx' && !i.empty);
  await edit('active', { item: it.id, active: !it.active });
  check(`${it.model} liga/desliga`, (await api('reconnect', {})).preset.items.find(i => i.id === it.id).active === !it.active);
  await edit('active', { item: it.id, active: it.active });
});

await step('troca de modelo', async () => {
  const cat = await api('catalog'); const it = st0.preset.items.find(i => i.kind === 'fx' && !i.empty);
  const pool = (cat.pedals ?? []).filter(m => m.type !== it.type && m.name !== 'None' && m.group === cat.pedals.find(x => x.type === it.type)?.group);
  const alt = pool[Math.floor(pool.length / 2)];
  if (!alt) return check('catálogo de efeitos encontrado', false);
  await edit('model', { item: it.id, type: alt.type });
  check(`efeito ${it.model} → ${alt.name}`, (await state()).preset.items.find(i => i.id === it.id).type === alt.type);
  await edit('model', { item: it.id, type: it.type });
  check('efeito original de volta', (await state()).preset.items.find(i => i.id === it.id).type === it.type);
});

await step('mixer e tempo', async () => {
  const m0 = st0.preset.mixer, t0 = st0.preset.tempo;
  await edit('tempo', { bpm: 97 });
  check('tempo 97 BPM', near((await api('reconnect', {})).preset.tempo, 97, 0.05));
  await edit('tempo', { bpm: t0 });
  check('tempo restaurado', near((await api('reconnect', {})).preset.tempo, t0, 0.05));
  check('mixer legível', m0 && typeof m0.levelA === 'number');
});

await step('rajada: 300 movimentos de knob', async () => {
  const it = st0.preset.items.find(i => (i.kind === 'amp' || i.kind === 'fx') && !i.empty && i.params.some(x => x.kind === 'percent')); const p = it.params.find(x => x.kind === 'percent');
  const v0 = p.value, t = Date.now(); let errs = 0;
  const mv = (value, gesture) => edit('param', { item: it.id, index: p.index, id: p.id, value, gesture }).catch(() => errs++);
  await mv(0, 'start'); // como o app: arrasto = start, moves (coalescidos), end; em ondas de 50 (300 conexões de uma vez derrubam túneis/proxies, não o pedal)
  for (let w = 0; w < 6; w++) await Promise.all(Array.from({ length: 50 }, (_, k) => mv(((w * 50 + k) % 100) / 100, 'move')));
  await mv(0.42, 'end');
  const got = (await api('reconnect', {})).preset.items.find(i => i.id === it.id).params.find(x => x.index === p.index).value;
  check('rajada sem erro de transporte', errs === 0, `${errs} erros, ${Date.now() - t} ms`);
  check('último valor vence', near(got, 0.42, 0.01), got.toFixed(3));
  await edit('param', { item: it.id, index: p.index, id: p.id, value: v0 });
});

await step('preset inteiro: nome, footswitch, ordem', async () => {
  await edit('name', { name: 'HW TEST 500' });
  check('nome (preset inteiro ~4 KB)', (await api('reconnect', {})).preset.name === 'HW TEST 500');
  const fx = st0.preset.items.find(i => i.kind === 'fx' && !i.empty);
  await edit('fs', { item: fx.id, fs: fx.fs === 7 ? 8 : 7 });
  check('footswitch', (await api('reconnect', {})).preset.items.find(i => i.id === fx.id).fs !== fx.fs);
  const order0 = st0.preset.items.filter(i => i.kind === 'fx').sort((a, b) => a.pos - b.pos).map(i => ({ id: i.id, lane: i.lane }));
  const sw = order0.slice(); [sw[0], sw[1]] = [sw[1], sw[0]];
  await edit('chain', { order: sw });
  const after = (await api('reconnect', {})).preset.items.filter(i => i.kind === 'fx').sort((a, b) => a.pos - b.pos).map(i => i.id);
  check('ordem dos blocos', after[0] === sw[0].id && after[1] === sw[1].id);
});


await step('descartar recarregando o slot', async () => {
  const back = await api('select', { set: home.set, preset: home.preset });
  check('buffer igual ao inicial', back.preset.name === st0.preset.name && sig(back.preset) === sig0 && !back.dirty);
});

await step('5 reconexões seguidas', async () => {
  let ok = 0; for (let i = 0; i < 5; i++) { const s = await api('reconnect', {}); if (s.connected && s.preset.name === st0.preset.name) ok++; }
  check('reconecta sempre', ok === 5, `${ok}/5`);
});

await step('troca de preset ida e volta', async () => {
  const other = { set: home.set, preset: (home.preset + 1) % 64 };
  const s1 = await api('select', other); check('seleciona outro preset', s1.selection.preset === other.preset);
  const s2 = await api('select', home); check('volta ao inicial', sig(s2.preset) === sig0);
});

await step('biblioteca inteira (512 nomes)', async () => {
  const { sets } = await api('library/list', {});
  check('8 sets × 64 presets', sets.length === 8 && sets.every(s => s.presets.length === 64));
});

await step('ajustes globais', async () => {
  const g = await api('globals'); check('globais respondem (afinação de referência 440)', g.find(x => x.id === 2)?.value === 440, `${g.length} ids`);
});

if (WRITE) await step('gravação na memória (slot de rascunho)', async () => {
  const { sets } = await api('library/list', {});
  let at = null; for (let s = 7; s >= 0 && !at; s--) { const i = sets[s].presets.lastIndexOf('New Tone'); if (i >= 0) at = { set: s, preset: i }; }
  if (!at) return check('slot "New Tone" encontrado', false);
  console.log(`  slot de rascunho: ${at.set}:${at.preset}`);
  const orig = (await api('library/export-h5e', at)).data;
  // 1) salvar pelo fluxo normal do app
  await api('select', at); await edit('name', { name: 'HW SAVE OK' }); const saved = await api('save', {});
  check('salvar grava na memória', saved.preset.name === 'HW SAVE OK' && !saved.dirty);
  // 2) renomear um slot que não está carregado
  await api('select', home);
  await api('library/rename-slot', { ...at, name: 'HW RENAME OK' });
  check('renomear slot fora do buffer', (await api('library/slots', { set: at.set }))[at.preset] === 'HW RENAME OK');
  // 3) restaurar o original pelo backup mais antigo deste slot nesta execução
  const bks = (await api('backups/detailed')).filter(b => b.set === at.set && b.preset === at.preset && b.name === 'New Tone');
  const first = bks.sort((a, b) => a.at.localeCompare(b.at)).at(-1); // o mais recente com o conteúdo original
  await api('backups/restore', { file: first.file });
  const now = (await api('library/export-h5e', at)).data;
  check('slot de rascunho restaurado byte a byte', now === orig);
});

const end = await api('select', home);
check('estado final = inicial', end.preset.name === st0.preset.name && sig(end.preset) === sig0 && !end.dirty);
console.log(`\n${passes} ok, ${fails} falhas`);
process.exit(fails ? 1 : 0);
