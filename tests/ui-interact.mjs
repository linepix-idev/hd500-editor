// Interações reais: knob por teclado, bypass e desfazer — confere no pedal pela API e restaura o estado.
import puppeteer from 'puppeteer-core';
const api = async (p, b) => (await fetch('http://127.0.0.1:5230/api/' + p, b ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) } : {})).json();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1500, height: 1000 } });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { localStorage.setItem('hd500.lang', 'en'); });
 const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5230/', { waitUntil: 'networkidle2' }); await page.waitForSelector('.block');
const wait = ms => new Promise(r => setTimeout(r, ms));
const val = async () => (await api('state')).preset.items.find(i => i.id === 0).params[0].value;
let ok = true; const check = (name, cond) => { console.log(cond ? '✔' : '✖', name); ok &&= cond; };

const v0 = await val();
await page.click('.block[data-item="0"] .nm'); await page.evaluate(() => document.querySelector('#inspector .knob svg').focus());
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');           // +0,05 cada
await wait(900);
const v1 = (await (async () => { await api('reconnect', {}); return val(); })());  // relê do pedal
check(`knob por teclado mexeu no pedal (${v0.toFixed(3)} → ${v1.toFixed(3)})`, Math.abs(v1 - v0) > 0.1 || v0 > 0.85);
await api('edit', { op: 'param', item: 0, index: 0, id: (await api('state')).preset.items[0].params[0].id, value: v0 }); await wait(300);

const on0 = (await api('state')).preset.items.find(i => i.id === 4).active;
await page.reload({ waitUntil: 'networkidle2' }); await page.waitForSelector('.block');
await page.click('.block[data-item="4"] .led'); await wait(700);
const on1 = (await api('state')).preset.items.find(i => i.id === 4).active;
check('LED alterna o bypass no pedal', on1 !== on0);
await page.click('.block[data-item="4"] .led'); await wait(500);
check('bypass restaurado', (await api('state')).preset.items.find(i => i.id === 4).active === on0);
// copiar e colar bloco: copia o Tape Echo (item 4) para o slot 5 e depois descarta recarregando o slot
const st = await api('state'); const t4 = st.preset.items.find(i => i.id === 4), t5 = st.preset.items.find(i => i.id === 5);
await page.reload({ waitUntil: 'networkidle2' }); await page.waitForSelector('.block');
const pick = async text => { await page.waitForSelector('.menu button'); const btns = await page.$$('.menu button'); for (const b of btns) { const t = await b.evaluate(e => e.textContent); if (t.startsWith(text)) { await b.click(); return true; } } return false; };
await page.click('.block[data-item="4"]', { button: 'right' }); check('menu: copiar bloco', await pick('Copy block'));
await page.click('.block[data-item="5"]', { button: 'right' }); check('menu: colar', await pick('Paste'));
await wait(2500);
const after = (await api('state')).preset.items.find(i => i.id === 5);
check(`colar traz o modelo e os valores (${after.model})`, after.type === t4.type && Math.abs(after.params[0].value - t4.params[0].value) < 0.01);
await api('select', { set: st.selection.set, preset: st.selection.preset });
check('slot recarregado, bloco 5 como antes', (await api('state')).preset.items.find(i => i.id === 5).type === t5.type);
check('sem erros na página', errs.length === 0);
await browser.close(); process.exit(ok ? 0 : 1);
