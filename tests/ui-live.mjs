// Demo-only browser check: hear a drag before release, keep its DOM, undo once.
import assert from 'node:assert/strict';
import { launchUI, openUI, api, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO,'1');
assert.equal(process.env.PORT,'5231');
const initial=await api('state'),browser=await launchUI();
try {
  await api('select',initial.selection);
  const errors=[],page=await openUI(browser,errors);
  await page.click('.block[data-item="4"] .nm');
  const selector='#inspector .knob svg[role="slider"]';
  const before=(await api('state')).preset.items.find(it=>it.id===4).params[0].value;
  const point=await page.$eval(selector,e=>{const r=e.getBoundingClientRect();window.liveKnob=e;return{x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x,point.y-36,{steps:20});
  await wait(150);
  assert((await api('state')).preset.items.find(it=>it.id===4).params[0].value>before+.15,'pedal changes before release');
  assert(await page.evaluate(()=>window.liveKnob.isConnected),'drag does not replace the knob');
  await page.mouse.up();await wait(150);await api('edit',{op:'undo'});await wait(150);
  assert.equal((await api('state')).preset.items.find(it=>it.id===4).params[0].value,before,'one undo restores whole drag');
  await page.click('#live');assert.equal(await page.$eval('#live',e=>e.getAttribute('aria-pressed')),'false');
  const p2=await page.$eval(selector,e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.mouse.move(p2.x,p2.y);await page.mouse.down();await page.mouse.move(p2.x,p2.y-36,{steps:20});await wait(100);
  assert.equal((await api('state')).preset.items.find(it=>it.id===4).params[0].value,before,'Live off waits for release');
  await page.mouse.up();await wait(150);
  assert((await api('state')).preset.items.find(it=>it.id===4).params[0].value>before+.15);
  assert.deepEqual(errors,[]);console.log('Live drag, stable DOM, gesture undo and release-only mode passed.');
} finally {await api('select',initial.selection);await browser.close();}
