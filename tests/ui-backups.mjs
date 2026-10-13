// Demo-only: the backups sheet lists a backup made by a library write and restores it.
import assert from 'node:assert/strict';
import { launchUI, openUI, api, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO, '1'); assert.equal(process.env.PORT, '5231'); assert.ok(process.env.HD500_BACKUPS, 'set HD500_BACKUPS to a scratch dir');
const browser = await launchUI();
try {
  const page = await openUI(browser); const st = await api('state'), sel = st.selection;
  const other = { set: sel.set, preset: (sel.preset + 1) % 64 };
  await api('library/copy', { from: sel, to: other });               // overwrites `other` -> backup of its old content
  const list = await api('backups/detailed'); assert.ok(list.length >= 1, 'a backup exists');
  assert.ok(list[0].file.startsWith(`set${other.set + 1}-preset${other.preset + 1}-`), 'named after the slot');
  page.on('dialog', d => d.accept());
  await page.click('#fileMenu'); await wait(200);
  await page.evaluate(() => [...document.querySelectorAll('[role=menuitem], .menu button, #menu *')].find(e => /Backups/.test(e.textContent))?.click());
  await page.waitForSelector('.backups .backup-row');
  await page.click('.backups .backup-row button'); await wait(800);
  const after = await api('backups/detailed'); assert.ok(after.length > list.length, 'restoring backs up the slot first');
  console.log('Backups sheet passed.');
} finally { await browser.close(); }
