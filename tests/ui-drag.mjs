// Arrastar nós com o ponteiro (modo demo; não toca no pedal): mover entre faixas e cancelar com Esc.
//   HD500_DEMO=1 PORT=5231 node app/server.mjs   e depois   node tests/ui-drag.mjs [porta]
import puppeteer from 'puppeteer-core';
const port = process.argv[2] ?? 5231, base = `http://127.0.0.1:${port}`;
const api = async (p, b) => (await fetch(`${base}/api/${p}`, b ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) } : {})).json();
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.evaluateOnNewDocument(() => localStorage.setItem('hd500.lang', 'en'));
await page.goto(base, { waitUntil: 'networkidle2' }); await page.waitForSelector('.block'); await wait(800);
let ok = true; const check = (n, c) => { console.log(c ? '✔' : '✖', n); ok &&= c; };
const center = async sel => { const r = await page.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }); return r; };
const drag = async (fromSel, to, { cancel = false } = {}) => {
  const a = await center(fromSel); await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(a.x + (to.x - a.x) * i / 14, a.y + (to.y - a.y) * i / 14); await wait(16); }
  await wait(200); if (cancel) { await page.keyboard.press('Escape'); await page.mouse.up(); } else await page.mouse.up();
  await wait(900);
};
const lanes = async () => (await api('state')).chain;
const before = await lanes();
const moving = before.aPre[0];                       // primeiro efeito do caminho A
const target = await page.$eval('[data-lane="bPost"]', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
await drag(`.block[data-item="${moving}"]`, target, { cancel: true });
check('Esc cancela: nada muda', JSON.stringify(await lanes()) === JSON.stringify(before));
await drag(`.block[data-item="${moving}"]`, target);
const after = await lanes();
check(`arrastar move o bloco ${moving} para a faixa B depois`, after.bPost.includes(moving) && !after.aPre.includes(moving));
await api('edit', { op: 'undo' }); await wait(500);
check('desfazer volta ao estado anterior', JSON.stringify(await lanes()) === JSON.stringify(before));
check('sem erros na página', errs.length === 0);
await browser.close(); process.exit(ok ? 0 : 1);
