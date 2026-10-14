// Varre a interface em vários estados atrás de texto vazado ("null", "undefined", "[object Object]", "NaN") — servidor demo em :5231.
import { launchUI, UI_URL, wait } from './browser.mjs';
const post = p => fetch(`${UI_URL}/api/${p}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: '{}' });
const browser = await launchUI({ width: 1440, height: 900 });
const page = await browser.newPage(); await page.goto(UI_URL); await page.waitForSelector('.block');
const bad = [];
const scan = async label => { const t = await page.evaluate(() => document.body.innerText); const m = t.match(/(?<![A-Za-z])(null|undefined|NaN)+(?![A-Za-z])|\[object \w+\]/); if (m) bad.push(`${label}: "${m[0]}"`); };
const close = async () => { await page.keyboard.press('Escape'); await wait(200); };
await scan('inicial');
for (const [id, label] of [['pedalSettings', 'configurações'], ['help', 'ajuda'], ['fileMenu', 'arquivo'], ['language', 'idioma']]) {
  await page.$eval('#' + id, e => e.click()); await wait(500); await scan(label); await close();
}
for (const tab of ['controllers', 'fs', 'setup']) { await page.$eval('#tab-' + tab, e => e.click()); await wait(200); await scan('aba ' + tab); }
await page.$eval('.block', e => e.click()); await wait(200); await scan('bloco');
await post('disconnect'); await page.waitForSelector('#chain .connect-help .cstep', { timeout: 5000 }); await scan('assistente de conexão');
await post('reconnect'); await wait(800);
await browser.close();
if (bad.length) { console.error('Texto vazado:\n' + bad.join('\n')); process.exit(1); }
console.log('UI leaks ok');
