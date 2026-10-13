// No USB or listener: use the exact client scheduler/server commands with DemoPod.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoPod } from '../app/demo-device.mjs';
import { Preset } from '../core/preset.mjs';
import { LiveEdits } from '../app/public/js/live-edits.js';
import { EditQueue, GestureHistory } from '../app/edit-flow.mjs';
import { parameterEdits } from '../app/parameter-edits.mjs';
assert.equal(process.env.HD500_DEMO ?? '1', '1', 'Only DemoPod is permitted');
assert.equal(process.env.PORT ?? '5231', '5231', 'Only demo port 5231 is permitted');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function fixture() {
  const pod = new DemoPod(); let preset = await pod.readCurrent();
  const control = preset.items.find(it => it.id === 4).params[0];
  const args = value => ({ item: 4, index: control.index, id: control.id, value });
  const before = control.value, frames = [], calls = [], queue = new EditQueue();
  const history = new GestureHistory(() => preset.body);
  const edits = parameterEdits(() => preset, () => pod);
  const run = async body => { history.before(body); await edits[body.op](body); history.after(body); };
  // Prove the drag doesn't read or apply a whole preset. Restore for undo below.
  const apply = pod.apply.bind(pod), read = pod.readCurrent.bind(pod);
  pod.apply = () => { throw new Error('full preset apply during a move'); };
  pod.readCurrent = () => { throw new Error('full preset read during a move'); };
  const send = async body => { calls.push(body); await queue.enqueue(() => run(body), body); };
  const scheduler = new LiveEdits(send, { frame: f => frames.push(f), onError: e => { throw e; } });
  const frame = async () => { frames.splice(0).forEach(f => f()); await tick(); };
  const finish = async () => { const done = scheduler.flush(); for (let i=0; scheduler.pending && i<50; i++) await frame(); assert.equal(scheduler.pending,false); await done; await queue.drain(); };
  const value = () => preset.items.find(it => it.id === 4).params[0].value;
  return { pod, args, before, frames, calls, queue, history, edits, run, scheduler, frame, finish, value, undo: async () => { history.before({op:'undo'}); history.idx--; preset = new Preset(history.list[history.idx]); await apply(preset); return read(); } };
}

test('DemoPod: 200 rapid moves coalesce, last value wins, one undo restores the whole drag', async () => {
  const f = await fixture();
  f.scheduler.begin('param',f.args(f.before));
  for(let i=0;i<100;i++) f.scheduler.move('param',f.args(i/200));
  await f.frame();
  for(let i=100;i<200;i++) f.scheduler.move('param',f.args(i/200));
  f.scheduler.end('param',f.args(.997));
  await f.finish();
  assert.equal(f.calls.length,2, 'one coalesced start and one guaranteed end');
  assert.deepEqual(f.calls.map(c=>c.gesture),['start','end']);
  assert(Math.abs(f.value()-.997)<1e-6);
  assert(Math.abs(f.pod.buffer.items.find(it=>it.id===4).params[0].value-.997)<1e-6);
  assert.equal(f.history.list.length,2);
  const restored = await f.undo();
  assert.equal(restored.items.find(it=>it.id===4).params[0].value,f.before);
  assert.equal(f.history.canUndo,false);
});

test('in-flight limit is one per parameter and a release survives a slow request', async () => {
  const gate=deferred(),frames=[],calls=[]; let active=0,max=0;
  const live=new LiveEdits(async b=>{calls.push(b); max=Math.max(max,++active); if(calls.length===1)await gate.promise; active--;},{frame:f=>frames.push(f)});
  const args=v=>({item:4,index:0,id:1,value:v});
  live.move('param',args(.1));frames.splice(0).forEach(f=>f());await tick();
  for(let i=0;i<200;i++) live.move('param',args(i/200));
  live.end('param',args(.999));
  assert.equal(calls.length,1);gate.resolve();await tick();
  frames.splice(0).forEach(f=>f());await tick();
  assert.equal(max,1);assert.equal(calls.at(-1).value,.999);assert.equal(calls.at(-1).gesture,'end');
  await live.flush();
});

test('Live off sends no move, then applies the final value on release', async () => {
  const f=await fixture(); f.scheduler.setLive(false);
  for(let i=0;i<200;i++)f.scheduler.move('param',f.args(i/200));
  await f.frame();assert.equal(f.calls.length,0);assert.equal(f.value(),f.before);
  f.scheduler.end('param',f.args(.93));await f.finish();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].gesture,'end');assert(Math.abs(f.value()-.93)<1e-6);
  assert.equal(f.history.list.length,2);
});

test('server coalesces queued moves and keeps gesture end/save ordering', async () => {
  const f=await fixture(),gate=deferred(),jobs=[];
  f.queue.enqueue(()=>gate.promise);
  const start={op:'param',...f.args(.1),gesture:'start'};
  jobs.push(f.queue.enqueue(()=>f.run(start),start));
  for(let i=0;i<200;i++){const b={op:'param',...f.args(i/200),gesture:'move'};jobs.push(f.queue.enqueue(()=>f.run(b),b));}
  const end={op:'param',...f.args(.999),gesture:'end'};
  jobs.push(f.queue.enqueue(()=>f.run(end),end));
  let saved;
  jobs.push(f.queue.enqueue(()=>{saved=f.pod.buffer.clone();}));
  assert.equal(f.queue.jobs.length,4,'start + latest move + end + save barrier');
  gate.resolve();await Promise.all(jobs);
  assert(Math.abs(saved.items.find(it=>it.id===4).params[0].value-.999)<1e-6);
  assert.equal(f.history.list.length,2);
  assert.equal((await f.undo()).items.find(it=>it.id===4).params[0].value,f.before);
});

test('separate quick gestures retain their ends; failed requests still drain', async () => {
  const frames=[],calls=[],errors=[];
  const live=new LiveEdits(async b=>{calls.push(b);if(calls.length===1)throw new Error('offline');},{frame:f=>frames.push(f),onError:e=>errors.push(e.message)});
  const args=v=>({item:4,index:0,id:1,value:v});
  live.move('param',args(.1));live.end('param',args(.2));live.move('param',args(.3));live.end('param',args(.4));
  const done=live.flush();for(let i=0;i<10&&live.pending;i++){frames.splice(0).forEach(f=>f());await tick();}
  await done;assert.deepEqual(calls.map(c=>c.value),[.2,.4]);assert.deepEqual(errors,['offline']);
});

test('flush finishes a previously sent gesture and echo suppression expires', async () => {
  const frames=[],calls=[];let time=0;
  const live=new LiveEdits(async b=>calls.push(b),{frame:f=>frames.push(f),now:()=>time});
  live.move('setupF',{id:44,value:-12});frames.splice(0).forEach(f=>f());await tick();
  const done=live.flush();frames.splice(0).forEach(f=>f());await tick();await done;
  assert.deepEqual(calls.map(c=>c.gesture),['start','end']);
  assert(live.ignores('setup:44'));time=601;assert.equal(live.ignores('setup:44'),false);
});

test('mixer, setup, tempo and bypass use lightweight DemoPod commands', async () => {
  const f=await fixture();
  for(const b of [{op:'setupF',id:44,value:-7.5},{op:'setupF',id:46,value:.25},{op:'setup',id:54,value:2},{op:'tempo',bpm:138},{op:'active',item:4,active:false}]) await f.run({...b,gesture:'end'});
  assert.equal(f.pod.buffer.toJSON().mixer.levelA,-7.5);
  assert.equal(f.pod.buffer.toJSON().mixer.panA,.25);
  assert.equal(f.pod.buffer.toJSON().setup.input1,2);
  assert.equal(f.pod.buffer.tempo,138);
  assert.equal(f.pod.buffer.items.find(it=>it.id===4).active,false);
});


test('high-refresh frames are capped near 60 sends per second', async () => {
  const frames=[],calls=[]; let time=0;
  const live=new LiveEdits(async b=>calls.push({time,...b}),{frame:f=>frames.push(f),now:()=>time});
  for(let i=0;i<200;i++) {
    time=i*5; live.move('setupF',{id:44,value:i}); frames.splice(0).forEach(f=>f()); await tick();
  }
  live.end('setupF',{id:44,value:200}); frames.splice(0).forEach(f=>f()); await tick(); await live.flush();
  assert(calls.length<=60,`${calls.length} sends at 200Hz input`);
  assert.equal(calls.at(-1).value,200);
});

test('expression range sliders use ordered lightweight commands in the demo adapter', async () => {
  const f=await fixture();
  await f.run({op:'range',item:4,index:0,lo:.1,hi:.9,gesture:'start'});
  await f.run({op:'range',item:4,index:0,lo:.2,hi:.8,gesture:'end'});
  const p=f.pod.buffer.items.find(it=>it.id===4).params[0];
  assert(Math.abs(p.lo-.2)<1e-6);assert(Math.abs(p.hi-.8)<1e-6);assert.equal(f.history.list.length,2);
});


test('demo HTTP handler acknowledges immediately and undo restores 200 moves in one step', async () => {
  // In-process HTTP streams exercise the real routes without opening a socket.
  process.env.HD500_DEMO='1'; process.env.PORT='5231';
  const { Readable } = await import('node:stream');
  const { handleRequest, stop } = await import('../app/server.mjs');
  const request = (path, body) => new Promise((resolve,reject) => {
    const req=Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    Object.assign(req,{url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:5231','x-hd500-editor':'1'}});
    const res={headersSent:false,writeHead(code){this.code=code;this.headersSent=true;},end(data){resolve({code:this.code,...JSON.parse(data)});}};
    handleRequest(req,res).catch(reject);
  });
  const initial=await request('state'), p=initial.preset.items.find(it=>it.id===4).params[0];
  const original={param:DemoPod.prototype.param,readCurrent:DemoPod.prototype.readCurrent,apply:DemoPod.prototype.apply};
  const gate=deferred();let sends=0,reads=0,applies=0;
  DemoPod.prototype.param=async function(...args){sends++;if(sends===1)await gate.promise;return original.param.apply(this,args);};
  DemoPod.prototype.readCurrent=async function(){reads++;return original.readCurrent.call(this);};
  DemoPod.prototype.apply=async function(...args){applies++;return original.apply.apply(this,args);};
  const body=(value,gesture)=>({op:'param',item:4,index:p.index,id:p.id,value,gesture});
  try {
    assert.equal((await request('edit',body(.1,'start'))).ok,true,'accepted while the device command is blocked');
    await Promise.all(Array.from({length:200},(_,i)=>request('edit',body(i/200,'move'))));
    await request('edit',body(.998,'end'));
    assert.equal(sends,1,'moves queue while the start is in flight');
    gate.resolve();const final=await request('state');
    assert.equal(sends,3,'start, one coalesced move, final end');
    assert(Math.abs(final.preset.items.find(it=>it.id===4).params[0].value-.998)<1e-6);
    assert.equal(reads,0);assert.equal(applies,0);assert(final.canUndo);
    await request('edit',{op:'undo'});const restored=await request('state');
    assert.equal(restored.preset.items.find(it=>it.id===4).params[0].value,p.value);
    assert.equal(restored.canUndo,false);assert.equal(applies,1);assert.equal(reads,0);
  } finally {gate.resolve();Object.assign(DemoPod.prototype,original);await stop();}
});
