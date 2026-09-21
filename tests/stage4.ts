import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { buildStaticColliders } from '../src/physics/ColliderBuilder';
import { PlayerPhysics } from '../src/player/PlayerPhysics';
import { City } from '../src/world/City';
import { Character } from '../src/player/Character';
import { Player } from '../src/player/Player';
import { ThirdPersonCamera } from '../src/camera/ThirdPersonCamera';

// Signs only: physics tests do not rasterize textures or pretend to test visuals.
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({ measureText: (s: string) => ({ width: s.length * 20 }) }, { get: (o, k) => o[k] ?? (() => {}) }) }) } as any;
const city = new City();
const physics = await PhysicsWorld.create();
buildStaticColliders(physics, city.getCollidablePlacements());
buildStaticColliders(physics, city.getGroundPlacements());
physics.world.updateSceneQueries();
const p = new PlayerPhysics(physics, new THREE.Vector3(0, 0.2, 24));
const v = new THREE.Vector2();
const results: string[] = [];
function check(name: string, f: () => void) { f(); results.push(name); console.log('PASS', name); }
function tick(n = 1, x = 0, z = 0) { v.set(x, z); for (let i = 0; i < n; i++) physics.advance(1 / 60, dt => p.step(dt, v)); }
function at(x: number, z: number, y = 0.5) { p.teleport(new THREE.Vector3(x, y, z)); tick(60); }
check('all named ground zones support the capsule', () => {
  for (const [x,z,y] of [[0,12,.04],[-5,18,.16],[0,24,.16],[18,4,.141],[16,6,.14],[-18,0,.14],[-29,0,.14],[-8,-26,.16],[0,40,-.02]]) {
    at(x,z); assert(p.isGrounded(), `${x},${z}`); assert(Math.abs(p.getFootPosition().y-y)<.05);
  }
});
check('walk/run speeds and stop without sliding', () => {
  at(0,24); tick(60,0,-3.6); assert(Math.abs(p.getHorizontalSpeed()-3.6)<.03);
  tick(60,0,-5.8); assert(Math.abs(p.getHorizontalSpeed()-5.8)<.03);
  tick(30); assert(p.getHorizontalSpeed()<.01);
});
check('actual curb lips traversed both ways', () => {
  at(0,18); tick(90,3.6,0); assert(p.getFootPosition().x>4.8); assert(p.isGrounded());
  tick(160,-3.6,0); assert(p.getFootPosition().x< -3.9); assert(p.isGrounded());
});
check('bakery head-on blocks movement and stops animation speed', () => {
  at(-2,27); tick(90,-3.6,0); assert(p.getFootPosition().x> -3.1); assert(p.getHorizontalSpeed()<.02); assert(p.isGrounded());
});
check('wall slides at an angle without becoming ground', () => {
  at(-2,27); tick(30,-3.6,-2); assert(p.getFootPosition().z<26.3); assert(p.getFootPosition().x> -3.1);
});
check('benches, planters, fountain, stall and trunk block', () => {
  for (const [x,z,dx,dz,limit,axis] of [
    [3,29,0,3.6,30.4,'z'],[4,20,0,3.6,21.3,'z'],[19,-4,0,3.6,-2.0,'z'],
    [-22,-2,0,-3.6,-3.5,'negativeZ'],[11,-5,0,-3.6,-6.6,'negativeZ']
  ] as const) {
    at(x,z); tick(90,dx,dz); const f=p.getFootPosition();
    assert(axis==='negativeZ' ? f.z>limit : f.z<limit, `${x},${z}: ${f.z}`);
    if(x!==11) assert(p.getHorizontalSpeed()<.02, `${x},${z}: speed ${p.getHorizontalSpeed()}`);
  }
});
check('rotated crate blocks face-on and never autosteps', () => {
  const dx=Math.sin(-26), dz=Math.cos(-26);
  at(-24+dx*1.3,-2+dz*1.3);
  tick(55,-dx*3.6,-dz*3.6);
  const f=p.getFootPosition();
  assert(Math.hypot(f.x+24,f.z+2)>.5);
  assert(f.y<.23); assert(p.getHorizontalSpeed()<.03);
});
check('coyote jump after leaving the edge; no midair jump after teleport', () => {
  at(69,0); let steps=0;
  while(p.isGrounded()&&steps++<90)tick(1,5.8,0);
  assert(!p.isGrounded()); tick(3,5.8,0); const y=p.getFootPosition().y;
  p.requestJump(); tick(5,5.8,0); assert(p.getFootPosition().y>y+.3);
  p.teleport(new THREE.Vector3(0,5,24)); p.requestJump();tick(5); assert(p.getFootPosition().y<5);
});
check('jump standing, walking and running; no double jump; stable landing', () => {
  for (const speed of [0,3.6,5.8]) {
    at(0,24); p.requestJump(); let peak=0, air=false, previousY=p.getFootPosition().y;
    for (let i=0;i<70;i++) { if(i===10)p.requestJump(); tick(1,0,-speed); peak=Math.max(peak,p.getFootPosition().y); air ||= !p.isGrounded(); if(i===11)assert(p.getFootPosition().y-previousY<.065); previousY=p.getFootPosition().y; }
    assert(air); assert(peak>.95 && peak<1.3, `peak ${peak}`); assert(p.isGrounded());
  }
});
check('jump buffer before landing fires once', () => {
  at(0,24); p.requestJump(); tick(34); p.requestJump(); let airborneAgain=false;
  for(let i=0;i<16;i++){tick(); if(i>5 && p.getFootPosition().y>.6)airborneAgain=true;} assert(airborneAgain);
});
check('fixed step is render-rate independent and clamps long pauses', () => {
  const run=(hz:number)=>{at(0,24);physics.resetTime();for(let i=0;i<hz*2;i++)physics.advance(1/hz,dt=>p.step(dt,new THREE.Vector2(0,-3.6)));return p.getFootPosition().z;};
  assert(Math.abs(run(30)-run(144))<.07); let steps=0; physics.resetTime(); physics.advance(100,()=>steps++); assert(steps<=5);
});
check('camera basis, own-collider exclusion, close-wall obstruction and recovery', () => {
  at(0,24); const cam=new THREE.PerspectiveCamera(50,16/9,.1,300); const follow=new ThirdPersonCamera(cam,physics);
  follow.reset(new THREE.Vector3(0,.18,24),Math.PI); assert(follow.getRight(new THREE.Vector3()).x>.99);
  assert(cam.position.distanceTo(new THREE.Vector3(0,1.48,24))>6);
  follow.reset(new THREE.Vector3(-2.7,.18,27),Math.PI/2); assert(cam.position.x> -3.3);
  for(let i=0;i<180;i++)follow.update(1/60,new THREE.Vector3(0,.18,24));
  assert(cam.position.distanceTo(new THREE.Vector3(0,1.48,24))>5.9);
});
check('both rigs: walk versus run, opposite limbs, jump/fall/land', () => {
  for (const id of ['boy','girl'] as const) {
    const c=new Character({entityId:id,characterId:id});
    const a=c.animation; const rig=(a as any).rig;
    const input={planarSpeed:3.6,topSpeed:3.6,isRunning:false,grounded:true,verticalVelocity:0,justLanded:false};
    for(let i=0;i<45;i++)a.updateLocomotion(1/60,input);
    assert.equal(a.getState(),'WALK'); assert(rig.leftArmPivot.rotation.x*rig.leftLegPivot.rotation.x<0);
    assert(rig.rightArmPivot.rotation.x*rig.leftLegPivot.rotation.x>0);
    a.updateLocomotion(1/60,{...input,planarSpeed:5.8,topSpeed:5.8,isRunning:true}); assert.equal(a.getState(),'RUN');
    a.updateLocomotion(1/60,{...input,grounded:false,verticalVelocity:6}); assert.equal(a.getState(),'JUMP');
    a.updateLocomotion(1/60,{...input,grounded:false,verticalVelocity:-3}); assert.equal(a.getState(),'FALL');
    a.updateLocomotion(1/60,{...input,justLanded:true}); assert.equal(a.getState(),'LAND');
    for(let i=0;i<60;i++)a.updateLocomotion(1/60,{...input,planarSpeed:0,isRunning:true}); assert.equal(a.getState(),'IDLE');
  }
});
p.dispose();
check('kill-plane and invalid-coordinate recovery', () => {
  const c=new Character({entityId:'recovery',characterId:'boy'}); const follow=new ThirdPersonCamera(new THREE.PerspectiveCamera(50,1,.1,300),physics);
  const player=new Player(physics,c,new THREE.Vector3(0,.2,24),Math.PI,follow);
  for(let i=0;i<60;i++)physics.advance(1/60,player.fixedUpdate);
  const body=(player as any).physics;
  body.teleport(new THREE.Vector3(0,-20,24)); physics.advance(1/60,player.fixedUpdate); assert(body.getFootPosition().y>0);
  body.body.setTranslation({x:NaN,y:0,z:24},true); physics.advance(1/60,player.fixedUpdate); assert(Number.isFinite(body.getFootPosition().x));
  player.dispose();
});
console.log(JSON.stringify({passed:results.length,colliders:physics.world.colliders.len()},null,2));
physics.dispose();



