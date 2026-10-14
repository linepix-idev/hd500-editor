// Regressão: depois de desconectar e reconectar, a biblioteca precisa ser redesenhada (servidor demo em :5231).
import { launchUI, UI_URL, wait } from './browser.mjs';
const post = p => fetch(`${UI_URL}/api/${p}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: '{}' });
const browser = await launchUI({ width: 1440, height: 900 });
const page = await browser.newPage(); await page.goto(UI_URL); await page.waitForSelector('#libraryList .slot');
const slots = () => page.$$eval('#libraryList .slot', e => e.length);
const before = await slots();
await post('disconnect'); await page.waitForFunction(() => document.querySelector('#chain .placeholder, #chain .connect-help'), { timeout: 5000 });
if (await slots() !== 0) throw new Error('lista deveria estar vazia desconectado');
await page.waitForSelector('#chain .connect-help .cstep', { timeout: 5000 });   // assistente completo, não só o aviso simples
const box = await page.$eval('#chain .connect-help', e => e.getBoundingClientRect().width);
if (box < 200) throw new Error(`assistente de conexão espremido (${box}px)`);
await post('reconnect'); await page.waitForSelector('#libraryList .slot', { timeout: 8000 });
const after = await slots(); if (after !== before) throw new Error(`biblioteca não voltou inteira: ${after} != ${before}`);
await browser.close(); console.log(`UI reconnect ok (${after} presets)`);
