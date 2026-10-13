import puppeteer from 'puppeteer-core';
export const UI_URL = process.env.HD500_UI_URL ?? 'http://127.0.0.1:5231';
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function launchUI(viewport = { width: 1440, height: 900 }) {
  return puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true, pipe: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], defaultViewport: viewport });
}
export async function openUI(browser, errors = [], { lang = 'en' } = {}) {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const { identifier } = await page.evaluateOnNewDocument(language => { localStorage.setItem('hd500.lang', language); localStorage.setItem('hd500.theme', 'dark'); }, lang);
  await page.goto(UI_URL, { waitUntil: 'networkidle2' }); await page.waitForSelector('.block[data-item="4"]');
  await page.removeScriptToEvaluateOnNewDocument(identifier);
  return page;
}
export async function api(path, body) {
  const response = await fetch(UI_URL + '/api/' + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'x-hd500-editor': '1' }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
}
