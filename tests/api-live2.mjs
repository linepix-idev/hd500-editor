// Real-pedal checks for live editing (edit buffer only; restores everything). Usage: PORT=<app port> node tests/api-live2.mjs
const PORT = process.env.PORT ?? 5230;
const api = async (p, b) => { const r = await fetch(`http://127.0.0.1:${PORT}/api/` + p, b === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };
const edit = (op, a) => api('edit', { op, ...a });
const fresh = async () => (await api('reconnect', {})).preset ?? (await api('state')).preset;
const wait = ms => new Promise(r => setTimeout(r, ms));
let ok = true; const check = (n, c, extra = '') => { console.log(c ? '✔' : '✖', n, extra); ok &&= c; };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;

const p0 = await fresh(); const fx = p0.items.find(i => i.kind === 'fx' && !i.empty); const par = fx.params.find(p => p.setup == null && !p.cab);
console.log(`preset "${p0.name}", block ${fx.model} (item ${fx.id}), param ${par.name}`);
const v0 = par.value, t0 = p0.tempo, panA0 = p0.mixer.panA, act0 = fx.active;

// 1. a whole drag as one gesture (start, 25 moves, end)
const args = v => ({ item: fx.id, index: par.index, id: par.id, value: v });
const tStart = Date.now();
await api('edit', { op: 'param', ...args(v0), gesture: 'start' });
for (let k = 1; k <= 25; k++) await api('edit', { op: 'param', ...args(v0 + (0.8 - v0) * k / 25), gesture: 'move' });
await api('edit', { op: 'param', ...args(0.8), gesture: 'end' });
check('drag of 25 moves accepted', true, `(${Math.round((Date.now() - tStart) / 26)} ms per request)`);
// 2. one undo reverts the whole drag (undo BEFORE re-reading the pedal: a re-read resets the undo history)
const st = await api('state'); const vServer = st.preset.items.find(i => i.id === fx.id).params.find(q => q.index === par.index).value;
check('server holds the final value of the drag', near(vServer, 0.8), `(${vServer.toFixed(3)})`);
await edit('undo', {}); let p = await fresh();
const v2 = p.items.find(i => i.id === fx.id).params.find(q => q.index === par.index).value;
check('a single undo reverts the whole drag', near(v2, v0), `(read ${v2.toFixed(3)}, was ${v0.toFixed(3)})`);

// 3. tempo and mixer pan
// tempo is live-only on the pedal (not part of the stored buffer we can read back): check it by eye with MANUAL_TEMPO=1
await edit('tempo', { bpm: 133.3 }); check('tempo command accepted', true);
if (process.env.MANUAL_TEMPO) { console.log('  -> the pedal should now show ~133.3 BPM (10 s)'); await wait(10000); }
await edit('tempo', { bpm: t0 });
await edit('setupF', { id: 0x2e, value: 0.4 }); p = await fresh(); check('pan A reaches the pedal', near(p.mixer.panA, 0.4, 0.02), `(read ${p.mixer.panA.toFixed(3)})`);
await edit('setupF', { id: 0x2e, value: panA0 });

// 4. block on/off
await edit('active', { item: fx.id, active: !act0 }); p = await fresh(); check('block bypass toggles on the pedal', p.items.find(i => i.id === fx.id).active === !act0);
await edit('active', { item: fx.id, active: act0 });

// restore and compare
await edit('param', { ...args(v0) }); await wait(300); p = await fresh();
check('everything restored', near(p.mixer.panA, panA0) && p.items.find(i => i.id === fx.id).active === act0 && near(p.items.find(i => i.id === fx.id).params.find(q => q.index === par.index).value, v0));
console.log(ok ? '\nAll real-pedal live checks passed.' : '\nSome checks FAILED.'); process.exit(ok ? 0 : 1);
