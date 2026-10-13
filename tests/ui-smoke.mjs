// Teste de fumaça da interface (precisa do servidor em http://127.0.0.1:5230 e do Chrome instalado).
import puppeteer from 'puppeteer-core';
const out = process.argv[2] ?? '/tmp';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1500, height: 1000 } });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { localStorage.setItem('hd500.lang', 'en'); });

const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:5230/', { waitUntil: 'networkidle2' });
await page.waitForSelector('.block');
const shot = n => page.screenshot({ path: `${out}/${n}.png` });
await shot('t1-home');
for (const tab of ['fs', 'library', 'advanced']) { await page.click(`[data-tab="${tab}"]`); await new Promise(r => setTimeout(r, 400)); await shot('t2-' + tab); }
await page.click('[data-tab="setup"]');
await page.click('.block[data-item="4"] .nm'); await shot('t3-select');
await page.click('#inspector .insp-head button'); await new Promise(r => setTimeout(r, 300)); await shot('t4-picker');
await page.keyboard.press('Escape');
await page.click('.block[data-item="0"] .nm'); await shot('t5-amp');
await page.click('.block[data-item="1"] .nm'); await shot('t6-cab');
await page.click('[data-tab="advanced"]'); await new Promise(r => setTimeout(r, 300)); await shot('t7-advanced');
console.log('erros de página:', errors.length ? errors : 'nenhum');
await browser.close();
