// Gera as imagens do README com o pedal simulado:  HD500_DEMO=1 PORT=5231 node app/server.mjs  e depois  node tests/screenshots.mjs docs/img
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? 'docs/img';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1440, height: 860 } });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { localStorage.setItem('hd500.lang', 'en'); });

// anonimiza: nomes de presets/sets são da biblioteca pessoal de quem tira as imagens
const anonymize = () => page.evaluate(() => {
  const names = ['Clean Strat', 'Edge of Breakup', 'Blues Lead', 'Crunch Rhythm', 'Acoustic Mic', 'Ambient Pad', 'High Gain', 'Funk Clean'];
  document.querySelectorAll('.slot').forEach((s, i) => { const sp = s.querySelector('span'); if (sp && sp.textContent !== '—') sp.textContent = names[i % names.length]; });
  document.querySelectorAll('#setSel option').forEach((o, i) => { o.textContent = `${i + 1} · Set ${i + 1}`; });
  const pn = document.querySelector('#pname'); if (pn) pn.textContent = 'ACOUSTIC MIC'; const pm = document.querySelector('#pnum'); if (pm) pm.textContent = 'Set 3 · 1A';
  const nm = document.querySelector('#tabBody input[aria-label="Preset name"]'); if (nm) nm.value = 'Acoustic Mic';
});
const wait = ms => new Promise(r => setTimeout(r, ms));
await page.goto('http://127.0.0.1:5231/', { waitUntil: 'networkidle2' }); await page.waitForSelector('.block');
await page.click(".block[data-item=\"5\"] .nm"); await wait(300);
await anonymize(); await page.screenshot({ path: `${out}/editor.png` });
await page.click('[data-tab="fs"]'); await page.click('.block[data-item="4"] .nm'); await wait(300);
await anonymize(); await page.screenshot({ path: `${out}/footswitches.png` });
await page.click('[data-tab="library"]'); await wait(3500);
await anonymize(); await page.screenshot({ path: `${out}/library.png` });
await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await wait(300);
await anonymize(); await page.screenshot({ path: `${out}/light.png` });
await browser.close();
