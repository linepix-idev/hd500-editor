// Painel do Mixer (modo demo): faders, pan, mute e trails chegam ao pedal simulado.
import puppeteer from 'puppeteer-core';
const port = process.argv[2] ?? 5231, base = `http://127.0.0.1:${port}`;
const api = async p => (await fetch(`${base}/api/${p}`)).json();
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1440, height: 900 } });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.evaluateOnNewDocument(() => localStorage.setItem('hd500.lang', 'en'));
await p.goto(base, { waitUntil: 'networkidle2' }); await p.waitForSelector('.block');
let ok = true; const check = (n, c) => { console.log(c ? '✔' : '✖', n); ok &&= c; };
await p.click('#openMixer'); await p.waitForSelector('.mx-fader');
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
await p.evaluate(() => document.querySelector('.mx-A .mx-fader').focus());
for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowDown');       // −3 dB (6 × 0,5)
await wait(700);
check('fader do caminho A chega ao estado (−3 dB)', (await api('state')).preset.mixer.levelA === -3);
await p.click('.mx-B .mx-mute'); await wait(700);
check('Mute do B vai para −60', (await api('state')).preset.mixer.levelB === -60);
await p.click('.mx-B .mx-mute'); await wait(700);
check('desmutar volta ao valor anterior', (await api('state')).preset.mixer.levelB === 0);
await p.click('.mx-trails .switch'); await wait(700);
check('Trails alterna', (await api('state')).preset.trails === false);
check('sem erros na página', errs.length === 0);
await b.close(); process.exit(ok ? 0 : 1);
