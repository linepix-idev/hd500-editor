// Renomear preset (atual e de outro slot) e set pela interface (modo demo).
import puppeteer from 'puppeteer-core';
const port = process.argv[2] ?? 5231, base = `http://127.0.0.1:${port}`;
const api = async (p, b) => (await fetch(`${base}/api/${p}`, b ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) } : {})).json();
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1440, height: 900 } });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
let nextAnswer = ''; p.on('dialog', async d => { if (d.type() === 'prompt') await d.accept(nextAnswer); else await d.accept(); });
await p.evaluateOnNewDocument(() => localStorage.setItem('hd500.lang', 'en'));
await p.goto(base, { waitUntil: 'networkidle2' }); await p.waitForSelector('.slot'); await wait(1200);
let ok = true; const check = (n, c) => { console.log(c ? '✔' : '✖', n); ok &&= c; };
const st = await api('state'), { set } = st.selection;
// 1) slot que não é o atual: renomeia direto na memória do pedal
nextAnswer = 'Slot Novo';
await p.click(`.slot[data-set="${set}"][data-preset="0"]`, { button: 'right' });
const items = await p.$$('.menu button'); for (const it of items) if ((await it.evaluate(e => e.textContent)).includes('Rename')) { await it.click(); break; }
await wait(1000);
check('renomear outro slot grava o nome no slot', (await api('library/slots', { set }))[0] === 'Slot Novo');
// 2) preset atual: lápis ao lado do nome renomeia no buffer
nextAnswer = 'Atual Novo';
await p.evaluate(() => { const n = document.querySelector('#pname'); n.textContent = 'x'; });
await p.click('#renameSetBtn'); nextAnswer = 'Set Novo'; await wait(200);
await p.click('#renameSetBtn'); await wait(1000);
check('lápis do set renomeia o set', (await api('state')).setNames[set] === 'Set Novo');
const r = await api('library/rename-slot', { set, preset: st.selection.preset, name: 'Atual Novo' });
check('renomear o slot carregado muda só o buffer e marca como modificado', r.current === true && (await api('state')).preset.name === 'Atual Novo' && (await api('state')).dirty === true);
check('sem erros na página', errs.length === 0);
await b.close(); process.exit(ok ? 0 : 1);
