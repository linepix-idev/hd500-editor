// MCP liga/desliga dentro de Configurações do pedal (servidor demo em :5231).
import { launchUI, UI_URL, wait } from './browser.mjs';
const api = (p, b) => fetch(`${UI_URL}/api/${p}`, b ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(b) } : {}).then(r => r.json());
const browser = await launchUI({ width: 1440, height: 900 });
const page = await browser.newPage(); await page.goto(UI_URL); await page.waitForSelector('.block');
if (await page.$('#mcpBtn')) throw new Error('o botão MCP não deve mais existir na barra');
await api('mcp', { enabled: true });
await page.click('#pedalSettings'); await page.waitForSelector('.mcp-row .switch');
const on = () => page.$eval('.mcp-row .switch', e => e.getAttribute('aria-checked'));
if (await on() !== 'true') throw new Error('deveria abrir ligado');
if ((await page.$eval('.globals', e => e.textContent)).includes('null')) throw new Error('texto "null" solto nas configurações');
await page.click('.mcp-row .switch'); await wait(400);
if (await on() !== 'false' || (await api('mcp')).enabled !== false) throw new Error('clique deveria desligar');
const ai = await fetch(`${UI_URL}/api/state`, { headers: { 'x-hd500-actor': 'ai' } }); if (ai.status !== 403) throw new Error('IA deveria estar bloqueada');
await api('mcp', { enabled: true }); await wait(500);
if (await on() !== 'true') throw new Error('interruptor deveria sincronizar com mudança externa');
await page.screenshot({ path: process.env.SHOT ?? '/dev/null' });
await browser.close(); console.log('UI MCP ok');
