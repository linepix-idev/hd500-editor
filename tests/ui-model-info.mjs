// Read-only model help and geometry checks against HD500_DEMO=1 PORT=5231.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launchUI, openUI, api, wait } from './browser.mjs';
const out = process.argv[2] ?? '/tmp/hd500-ui'; await mkdir(out, { recursive: true });
const browser = await launchUI();
try {
  const errors = [], page = await openUI(browser, errors), before = (await api('state')).preset;
  await page.click('.block[data-item="5"] .nm');
  await page.click('#inspector .model-info-button'); await page.waitForSelector('.model-info');
  assert.match(await page.$eval('.model-info', e=>e.textContent), /Maestro EP-3 Echoplex/);
  assert.match(await page.$eval('.parameter-guide', e=>e.textContent), /Mix/);
  await page.screenshot({path:`${out}/model-info-effect.png`});
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#inspector .model-info-button', e=>e===document.activeElement), true);
  await page.click('#inspector .model-title');
  await page.type('.dlg input[type="search"]', 'Ibanez');
  assert.equal(await page.$$eval('.models .model-choice', es=>es.length), 1);
  await page.click('.models .model-info-button'); await page.waitForSelector('.model-info');
  assert.match(await page.$eval('.model-info',e=>e.textContent), /Ibanez Tube Screamer/);
  await page.click('.info-back');
  assert.equal(await page.$eval('.dlg input[type="search"]',e=>e.value), 'Ibanez');
  await page.$eval('.dlg input[type="search"]',e=>{e.value='rhythmic';e.dispatchEvent(new Event('input'));});
  assert(await page.$$eval('.models .model-choice',es=>es.length)>0, 'Descriptions are searchable');
  await page.keyboard.press('Escape');
  await page.click('.block[data-item="0"]');await page.click('#inspector .model-title');
  await page.type('.dlg input[type="search"]','Twin');await page.click('.models .model-info-button');
  assert.match(await page.$eval('.model-info',e=>e.textContent),/Fender Twin Reverb/);
  await page.keyboard.press('Escape');
  await page.click('.block[data-item="1"]'); await page.click('#inspector .model-info-button');
  await page.waitForSelector('.mic-info-list');
  assert.equal(await page.$$eval('.mic-info-list button',es=>es.length),8);
  await page.click('.mic-info-list button'); assert.match(await page.$eval('.model-info',e=>e.textContent), /Dynamic/);
  await page.keyboard.press('Escape');
  await page.click('#inspector .model-title');
  await page.evaluate(()=>[...document.querySelectorAll('.dlg .bd > button')].find(e=>e.textContent==='Microphones').click());
  assert.equal(await page.$$eval('.models .model-choice',es=>es.length),8);
  await page.click('.models .model-info-button'); await page.waitForSelector('.model-info');
  await page.keyboard.press('Escape');
  await page.click('.block[data-item="4"]');
  for (const theme of ['dark','light']) for(const zoom of [.5,.67,.75,.8,.9,1,1.1,1.25,1.5,1.75,2]) {
    await page.evaluate(({theme,zoom})=>{document.documentElement.dataset.theme=theme;document.body.style.zoom=zoom;},{theme,zoom});
    await wait(250);
    const checks=await page.$$eval('[role="switch"]',es=>es.map(e=>{
      const original=e.getAttribute('aria-checked'), results=[];
      for(const on of [false,true]) {
        e.setAttribute('aria-checked',String(on));
        // Disable transitions while measuring the settled endpoints.
        const style=document.createElement('style');style.textContent='[role="switch"]::after{transition:none!important}';document.head.append(style);
        const b=getComputedStyle(e),track=getComputedStyle(e,'::before'),thumb=getComputedStyle(e,'::after');
        const number=s=>parseFloat(s)||0, tx=thumb.transform==='none'?0:new DOMMatrix(thumb.transform).m41;
        const left=number(thumb.left)+tx-number(track.left), right=number(track.width)-left-number(thumb.width);
        results.push({on,left,right,inset:number(b.getPropertyValue('--thumb-inset')),width:number(b.width),height:number(b.height),vertical:(number(track.height)-number(thumb.height))/2});
        style.remove();
      }
      e.setAttribute('aria-checked',original);return results;
    }).flat());
    for(const c of checks) {
      assert(c.width>=44 && c.height>=44,'44px switch target');
      assert(Math.abs((c.on?c.right:c.left)-c.inset)<.1,`${theme} ${zoom}: equal endpoint inset`);
      assert(Math.abs(c.vertical-c.inset)<.1,'Thumb fills track height with equal inset');
    }
    await page.screenshot({path:`${out}/switch-${theme}-${Math.round(zoom*100)}.png`});
  }
  await page.evaluate(()=>document.body.style.zoom='1');
  for(const width of [1440,1100,900,390]) {
    await page.setViewport({width,height:900}); await wait(250);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow at ${width}`);
    const clipped=await page.$$eval('.block .nm,.block .grp,.knob .lab,.fs-chip',es=>es.filter(e=>e.getClientRects().length && (e.scrollWidth>e.clientWidth+1 || e.scrollHeight>e.clientHeight+1)).map(e=>e.textContent));
    assert.deepEqual(clipped,[],`Readable labels at ${width}`);
  }
  const smallText=await page.$$eval('body *',es=>es.filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml' && e.getClientRects().length && [...e.childNodes].some(n=>n.nodeType===3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize)<11).map(e=>e.textContent));
  assert.deepEqual(smallText,[],'No text below 11px');
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  assert.equal(await page.$eval('[role="switch"]',e=>getComputedStyle(e,'::after').transitionDuration),'0s');
  await page.setViewport({width:1440,height:900});
  await page.evaluate(()=>localStorage.setItem('hd500.lang','pt')); await page.reload({waitUntil:'networkidle2'});
  await page.waitForSelector('.block[data-item="5"]');await page.click('.block[data-item="5"] .nm');
  await page.click('#inspector .model-info-button');await page.waitForSelector('.parameter-guide');
  assert.match(await page.$eval('.model-info',e=>e.textContent),/O que os parâmetros fazem/);
  assert.deepEqual((await api('state')).preset,before,'Info navigation never edits the preset');
  assert.deepEqual(errors,[]);console.log('Model info, origins, translated descriptions, zoom, switches and responsive labels passed.');
} finally {await browser.close();}
