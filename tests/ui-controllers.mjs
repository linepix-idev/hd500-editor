// Painel de Controladores, FS com vários blocos e atribuição automática de Wah/Volume (modo demo).
import puppeteer from 'puppeteer-core';
const port = process.argv[2] ?? 5231, base = `http://127.0.0.1:${port}`;
const api = async (p, b) => (await fetch(`${base}/api/${p}`, b ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) } : {})).json();
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1440, height: 1100 } });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.evaluateOnNewDocument(() => localStorage.setItem('hd500.lang', 'en'));
await p.goto(base, { waitUntil: 'networkidle2' }); await p.waitForSelector('.block'); await wait(800);
let ok = true; const check = (n, c) => { console.log(c ? '✔' : '✖', n); ok &&= c; };
const item = async id => (await api('state')).preset.items.find(i => i.id === id);
// 1) painel de controladores
await p.click('[data-tab="controllers"]'); await p.waitForSelector('.ctl-list');
const blockOpts = await p.$$eval('select[aria-label="Block"] option', os => os.map(o => ({ v: o.value, t: o.textContent })));
const echo = blockOpts.find(o => o.t === 'Tape Echo');
await p.select('select[aria-label="Block"]', echo.v);
const mix = await p.$$eval('select[aria-label="Parameter"] option', os => os.find(o => o.textContent === 'Mix')?.value);
await p.select('select[aria-label="Parameter"]', mix);
await p.evaluate(() => [...document.querySelectorAll('#tabBody .primary')].find(x => x.textContent === 'Assign').click()); await wait(900);
const te = await item(Number(echo.v)); const pm = te.params.find(x => x.name === 'Mix');
check('atribuir Mix do Tape Echo ao EXP 1', pm.ctl === 1);
check('a atribuição aparece na lista', (await p.$$eval('.ctl-row .ctl-name', ns => ns.map(n => n.textContent))).some(t => t.includes('Tape Echo')));
// 2) FS com dois blocos: cada um inverte o seu estado
const fs1 = (await api('state')).preset.items.filter(i => i.fs === 5 && !i.empty);
await api('edit', { op: 'fs', item: 6, fs: 5 }); await api('edit', { op: 'active', item: 6, active: false }); await wait(500);
const before = [(await item(6)).active, (await item(5)).active]; // 5 = Tape Echo(FS5) ligado, 6 = outro desligado
await p.click('[data-tab="fs"]'); await p.waitForSelector('.fsbtn'); await p.click('.fsbtn[data-fs="5"]'); await wait(900);
const after = [(await item(6)).active, (await item(5)).active];
check('FS com vários blocos: cada bloco inverte (um liga, o outro desliga)', after[0] === !before[0] && after[1] === !before[1]);
// 3) Wah ganha EXP 1
await p.click('.block[data-item="9"]'); await p.keyboard.press('Enter'); await wait(300);
await p.evaluate(() => document.querySelector('.model-title')?.click()); await p.waitForSelector('.models button');
await p.type('input[type="search"]', 'Chrome'); await wait(300);
await p.evaluate(() => [...document.querySelectorAll('.models button')].find(x => x.textContent.trim() === 'Chrome').click()); await wait(2200);
const w = await item(9);
check('modelo Wah recebe Position no EXP 1 automaticamente', w.group === 'Wah' && w.params[0].ctl === 1);
check('sem erros na página', errs.length === 0);
await b.close(); process.exit(ok ? 0 : 1);
