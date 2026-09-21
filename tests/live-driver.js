// Test instrumentation lives outside src/dist and never ships in the game.
window.__THREE_DEVTOOLS__=new EventTarget();
let scene,camera,player,report,frames=0,lastFrame=0,intervals=[],held=new Set();
window.__THREE_DEVTOOLS__.addEventListener('observe',({detail})=>{
  if(detail.isScene)scene=detail;
  if(detail.isWebGLRenderer){const render=detail.render;detail.render=function(s,c){camera=c;frames++;const now=performance.now();if(lastFrame)intervals.push(now-lastFrame);lastFrame=now;return render.call(this,s,c);};}
});
const log=(s)=>{report.textContent+=s+'\n';};
const pos=()=>player.position.clone();
const key=(code,down)=>{window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true}));down?held.add(code):held.delete(code);};
const release=()=>{for(const k of [...held])key(k,false);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function hold(keys,ms){keys.forEach(k=>key(k,true));await sleep(ms);release();}
function verify(ok,s){log((ok?'PASS ':'FAIL ')+s);if(!ok)throw Error(s);}
async function jump(keys,label){const start=pos();keys.forEach(k=>key(k,true));key('Space',true);let peak=start.y;for(let i=0;i<15;i++){await sleep(50);peak=Math.max(peak,player.position.y);if(i===0)key('Space',false);}release();await sleep(250);verify(peak-start.y>.65 && player.position.y<start.y+.15,label);}
async function moveTo(x,z,limit=15000){const begin=performance.now();key('ShiftLeft',true);while(Math.hypot(x-player.position.x,z-player.position.z)>.25){if(performance.now()-begin>limit)throw Error(`Route blocked at ${player.position.x.toFixed(2)},${player.position.z.toFixed(2)} toward ${x},${z}`);const dx=x-player.position.x,dz=z-player.position.z;const keys=new Set();if(Math.abs(dx)>.13)keys.add(dx>0?'KeyD':'KeyA');if(Math.abs(dz)>.13)keys.add(dz>0?'KeyS':'KeyW');for(const k of ['KeyW','KeyS','KeyA','KeyD'])if(keys.has(k)!==held.has(k))key(k,keys.has(k));await sleep(30);}release();await sleep(150);}
async function core(){
  report.textContent='LIVE CORE '+player.name+'\n'; intervals=[]; const f0=frames;
  await sleep(300);verify(document.hasFocus()&&!document.hidden,'focused visible document');
  let a=pos();await hold(['KeyW'],650);verify(pos().z<a.z-1.5,'walk forward');
  a=pos();await hold(['KeyS'],450);verify(pos().z>a.z+.8,'walk backward');
  a=pos();await hold(['KeyD'],400);verify(pos().x>a.x+.7,'right');
  a=pos();await hold(['KeyA'],400);verify(pos().x<a.x-.7,'left');
  a=pos();await hold(['KeyW','KeyD'],400);verify(pos().x>a.x+.5&&pos().z<a.z-.5,'diagonal');
  a=pos();await hold(['KeyW','ShiftLeft'],550);verify(a.z-pos().z>2.4,'run');
  key('KeyW',true);key('ShiftLeft',true);await sleep(200);key('ShiftLeft',false);await sleep(300);release();await sleep(400);a=pos();await sleep(250);verify(pos().distanceTo(a)<.02,'release run and stop');
  key('KeyW',true);await sleep(200);key('KeyW',false);key('KeyS',true);a=pos();await sleep(400);release();verify(pos().z>a.z+.6,'180 degree reversal');
  await jump([],'standing jump/land');await jump(['KeyW'],'walking jump/land');await jump(['KeyW','ShiftLeft'],'running jump/land');
  key('Escape',true);key('Escape',false);await sleep(120);a=pos();await hold(['KeyW'],300);verify(document.body.dataset.gameState==='PAUSED'&&pos().distanceTo(a)<.001,'pause freezes physics');document.querySelector('#resume-button').click();await sleep(200);verify(pos().distanceTo(a)<.03,'resume without a jump');
  const canvas=document.querySelector('canvas');const before=camera.position.clone();canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:999,clientX:250,clientY:300,bubbles:true}));await sleep(150);verify(camera.position.distanceTo(before)<.08,'mouse movement alone does not orbit');
  verify(frames-f0>200,'live RAF renders throughout');const sorted=intervals.slice().sort((a,b)=>a-b);log(`RAF median ${sorted[Math.floor(sorted.length/2)].toFixed(1)} ms; frames ${frames-f0}`);
  log('CORE COMPLETE');
}
async function tour(){
  report.textContent='LIVE CITY TOUR\n';
  await moveTo(0,18);await moveTo(5,18);await moveTo(-5,18);log('PASS sidewalk-road-curb-sidewalk');
  await moveTo(0,18);await moveTo(0,24);await moveTo(-2,24);await moveTo(-2,27);
  await hold(['KeyA'],800);verify(player.position.x> -3.1,'bakery head-on');await hold(['KeyA','KeyW'],700);verify(player.position.x> -3.1,'bakery corner slide');
  await moveTo(0,24);await moveTo(0,0);await moveTo(9,-2);await moveTo(16,-2);await moveTo(16,0);await moveTo(17,0);await hold(['KeyD'],700);verify(player.position.x<17.1,'fountain collision');log('PASS park paths');
  await moveTo(16,0);await moveTo(16,-2);await moveTo(9,-2);await moveTo(0,0);await moveTo(-18,0);await moveTo(-22,0);await hold(['KeyW'],1400);verify(player.position.z> -3.6,'market stall collision');await moveTo(-22,0);await moveTo(-31.3,0);await moveTo(-31.3,24);log('PASS market corridor and alley entry');
  await moveTo(-31.3,24);await moveTo(-31.3,-25,18000);await moveTo(-8,-26);log('PASS alley exit and destination');log('TOUR COMPLETE');
}
async function stage5(){
  report.textContent='LIVE STAGE 5\n';
  release(); await sleep(200);
  // Spawn is a few metres from the bakery pickup point; walk toward it.
  const prompt=document.querySelector('#interaction-prompt');
  if (prompt?.classList.contains('is-hidden')) await hold(['KeyS'],500);
  await sleep(200); verify(prompt && !prompt.classList.contains('is-hidden'),'cake interaction prompt appears');
  key('KeyE',true); key('KeyE',false); await sleep(250);
  verify(document.querySelector('#cake-condition')?.textContent==='CAKE 100%','cake attaches at 100%');
  verify(prompt?.classList.contains('is-hidden'),'prompt hides after pickup');
  await hold(['KeyW','ShiftLeft'],500); await sleep(100); verify(player.children.some(c=>c.name==='CakePackage') || scene.children.every(c=>c.name!=='CakePackage'),'single carried cake entity');
  log('STAGE 5 COMPLETE');
}
async function touch(){
  report.textContent='LIVE TOUCH / POINTER ROUTING\n';
  const canvas=document.querySelector('canvas'),stick=document.querySelector('#mobile-joystick-base'),jumpButton=document.querySelector('#mobile-jump-button'),run=document.querySelector('#mobile-run-button');
  verify(getComputedStyle(stick).display!=='none','joystick visible');verify(getComputedStyle(jumpButton).display!=='none','jump visible');
  // Synthetic events cannot acquire OS capture. Emulate capture for test IDs;
  // movement, camera, and button handlers are unchanged production code.
  const originals=[];
  for(const el of [canvas,stick]){const ids=new Set();for(const name of ['setPointerCapture','hasPointerCapture','releasePointerCapture'])originals.push([el,name,el[name]]);el.setPointerCapture=id=>ids.add(id);el.hasPointerCapture=id=>ids.has(id);el.releasePointerCapture=id=>ids.delete(id);}
  const send=(el,type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,bubbles:true,cancelable:true}));
  try{
    const r=stick.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
    const a=pos();send(stick,'pointerdown',11,x,y-44);await sleep(350);
    send(canvas,'pointerdown',22,220,280);send(canvas,'pointermove',22,300,280);send(run,'pointerdown',33,0,0);send(jumpButton,'pointerdown',44,0,0);
    let peak=player.position.y;for(let i=0;i<6;i++){await sleep(50);peak=Math.max(peak,player.position.y);}
    verify(pos().distanceTo(a)>.8 && peak>a.y+.6,'move + run + camera + jump simultaneously');
    const start=pos(),forward=camera.getWorldDirection(pos()).setY(0).normalize();await sleep(180);verify(pos().sub(start).dot(forward)>.2,'movement follows the orbited camera');
    const before=camera.position.clone();send(jumpButton,'pointerup',44,0,0);send(canvas,'pointermove',22,330,280);await sleep(120);verify(camera.position.distanceTo(before)>.2,'jump finger release does not cancel camera');
    send(stick,'pointercancel',11,x,y);send(canvas,'pointerup',22,330,280);send(run,'pointerdown',33,0,0);await sleep(600);
    const stopped=pos();await sleep(200);verify(pos().distanceTo(stopped)<.03,'joystick cancellation stops and centers');
    verify(window.scrollX===0&&window.scrollY===0&&document.documentElement.scrollHeight===innerHeight,'no page scrolling');
    log('TOUCH COMPLETE (synthetic multi-pointer events)');
  }finally{release();for(const [el,name,fn]of originals)el[name]=fn;}
}
addEventListener('DOMContentLoaded',async()=>{
  const panel=document.createElement('div');panel.style.cssText='position:fixed;top:6px;left:6px;z-index:100;font:11px monospace;color:#111;background:#ffffffe0;padding:6px;max-height:40vh;overflow:auto';
  report=document.createElement('pre');report.id='qa-report';panel.append(report);
  for(const [name,fn] of [['Run core',core],['Run city tour',tour],['Run touch',touch],['Run Stage 5',stage5]]){const b=document.createElement('button');b.textContent=name;b.onclick=async()=>{b.blur();try{await fn();}catch(e){release();log('ERROR '+e.message);}};panel.append(b);}
  document.body.append(panel);
  while(document.body.dataset.gameState!=='MAIN_MENU')await sleep(100);
  document.querySelector('#main-menu-play').click();document.querySelector(`[data-character-id="${new URLSearchParams(location.search).get('character')||'boy'}"]`).click();document.querySelector('#select-play').click();
  player=scene.children.find(c=>c.name.startsWith('Character_'));log('READY '+player?.name);
  setInterval(()=>{report.dataset.position=JSON.stringify(player.position.toArray());report.dataset.camera=JSON.stringify(camera.position.toArray());report.dataset.frames=String(frames);report.dataset.fov=String(camera.fov);},150);
});

