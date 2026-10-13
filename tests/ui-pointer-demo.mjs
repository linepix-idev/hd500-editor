// Deliberately opt in to demo-only mutations. Never run this against hardware.
// HD500_DEMO=1 node tests/ui-pointer-demo.mjs /tmp/hd500-ui
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launchUI, openUI, api, wait } from './browser.mjs';
assert.equal(process.env.HD500_DEMO, '1', 'Set HD500_DEMO=1 and use the simulated server on 5231.');
const out=process.argv[2]??'/tmp/hd500-ui';await mkdir(out,{recursive:true});
const initial=await api('state');assert.equal(initial.setNames[2],'Stage Set');assert.equal(initial.selection.set,2);
const browser=await launchUI(), errors=[];
let page;
try {
  page=await openUI(browser,errors);
  const reset=async()=>{await api('select',initial.selection);await wait(400);};
  const point=async selector=>{
    await page.$eval(selector,e=>e.scrollIntoView({block:'center',inline:'center'}));await wait(50);
    return page.$eval(selector,e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
  };
  const start=async id=>{const p=await point(`.block[data-item="${id}"]`);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+12,p.y+2,{steps:4});await page.waitForSelector('.drag-ghost');};
  const target=async(lane,index)=>{
    const selector=`.lane[data-lane="${lane}"]`;await page.$eval(selector,e=>e.scrollIntoView({block:'center',inline:'center'}));await wait(50);
    const p=await page.$eval(selector,(el,index)=>{const kids=[...el.querySelectorAll(':scope>.block:not(.drag-origin)')],node=kids[index]??kids.at(-1)??el,r=node.getBoundingClientRect();return{x:kids.length?(index<kids.length?r.left+3:r.right-3):r.left+r.width/2,y:r.top+r.height/2};},index);
    await page.mouse.move(p.x,p.y,{steps:16});await wait(250);
    assert.equal(await page.$eval('.lane.over',e=>e.dataset.lane),lane);
  };
  const place=async(id,lane,index)=>{await start(id);await target(lane,index);await page.mouse.up();await wait(750);const state=await api('state');assert.equal(state.chain[lane][index],id,`${id} at ${lane}[${index}]`);return state;};
  await reset();await place(5,'aPre',0);console.log('PASS: reorder in path A');
  await page.screenshot({path:`${out}/drag-reordered.png`});
  await reset();await place(4,'pre',0);console.log('PASS: path A → shared before');
  await reset();await place(4,'aPost',0);console.log('PASS: before → after amp');
  await reset();await place(4,'bPre',0);console.log('PASS: path A → path B');
  await reset();await place(4,'bPost',0);console.log('PASS: path B after');
  await reset();await place(4,'post',0);console.log('PASS: shared mix');
  await reset();await place(11,'bPre',0);console.log('PASS: empty slot moves');
  await reset();const before=(await api('state')).chain;await start(4);await target('bPost',0);
  await page.screenshot({path:`${out}/drag-preview.png`});await page.keyboard.press('Escape');await page.mouse.up();await wait(650);
  assert.deepEqual((await api('state')).chain,before);assert.equal(await page.$('.drag-ghost'),null);console.log('PASS: Escape leaves order unchanged');
  await page.click('[data-tab="fs"]');await start(4);const fs=await point('.fsbtn[data-fs="2"]');await page.mouse.move(fs.x,fs.y,{steps:18});await page.mouse.up();await wait(700);
  assert.equal((await api('state')).preset.items.find(i=>i.id===4).fs,2);console.log('PASS: pointer assigns footswitch');
  await reset();await start(4);const trash=await point('#chainTrash');await page.mouse.move(trash.x,trash.y,{steps:18});await page.mouse.up();await wait(800);
  assert((await api('state')).preset.items.find(i=>i.id===4).empty);console.log('PASS: pointer clears at trash');
  await reset();await page.click('.block[data-item="4"]');await page.keyboard.down('Alt');await page.keyboard.press('ArrowDown');await page.keyboard.up('Alt');await wait(700);
  assert.equal((await api('state')).chain.bPre[2],4);console.log('PASS: keyboard moves effect');
  // Touch uses the same pointer capture flow, with a touch pointer id.
  await reset();await page.setViewport({width:390,height:800,isMobile:true,hasTouch:true});
  const client=await page.createCDPSession(),touch=async(type,x,y)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  const from=await point('.block[data-item="4"]');await touch('touchStart',from.x,from.y);await touch('touchMove',from.x+14,from.y);await page.waitForSelector('.drag-ghost');
  const lanePoint=await point('.lane[data-lane="bPost"]');await touch('touchMove',lanePoint.x,lanePoint.y);await touch('touchEnd');await wait(800);
  assert.equal((await api('state')).chain.bPost[0],4);console.log('PASS: touch pointer moves across paths');
  assert.deepEqual(errors,[]);
} finally {await api('select',initial.selection);await browser.close();}
