// Regressão visual: node tools/visual-snapshot.mjs <dir>  (servidor demo em :5231, CHROME=caminho do Chrome)
// Gera PNGs + manifest.json (sha256). Compare dois diretórios com: node tools/visual-snapshot.mjs --diff <a> <b>
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const [a, b, c] = process.argv.slice(2);
if (a === '--diff') {
  const A = JSON.parse(readFileSync(`${b}/manifest.json`)), B = JSON.parse(readFileSync(`${c}/manifest.json`));
  const bad = Object.keys({ ...A, ...B }).filter(k => A[k] !== B[k]);
  console.log(bad.length ? `DIFERENTES (${bad.length}/${Object.keys(A).length}):\n` + bad.join('\n') : `IGUAIS (${Object.keys(A).length} capturas)`);
  process.exit(bad.length ? 1 : 0);
}
const out = a; mkdirSync(out, { recursive: true });
const URL_ = process.env.HD500_UI_URL ?? 'http://127.0.0.1:5231', wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const manifest = {};
for (const [w, h] of [[390, 844], [820, 1100], [1440, 900]]) for (const theme of ['dark', 'light']) {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(t => { try { localStorage.setItem('hd500.theme', t); } catch {} }, theme);
  await page.goto(URL_); await page.waitForSelector('.block'); await wait(1200);
  const shot = async name => { const buf = await page.screenshot({ fullPage: true }); const key = `${w}-${theme}-${name}`; writeFileSync(`${out}/${key}.png`, buf); manifest[key] = createHash('sha256').update(buf).digest('hex'); };
  await shot('default');
  if (w >= 800) { await page.$eval('#sidebarToggle', e => e.click()); await wait(500); await shot('sidebar-closed'); }
  else { await page.$eval('#sidebarToggle', e => e.click()); await wait(500); await shot('drawer'); }
  await page.keyboard.press('Escape'); await page.goto(URL_); await page.waitForSelector('.block'); await wait(800);
  await page.$eval('#help', e => e.click()); await wait(400); await shot('help');
  await page.close();
}
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 1)); await browser.close(); console.log(`ok ${Object.keys(manifest).length} capturas em ${out}`);
