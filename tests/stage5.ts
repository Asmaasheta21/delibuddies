import assert from 'node:assert/strict';
import { CakePackage } from '../src/delivery/CakePackage';
import { InteractionSystem } from '../src/interaction/InteractionSystem';
import { PackageDamageSystem, impactSeverity, severityDamage } from '../src/delivery/PackageDamageSystem';
import * as THREE from 'three';

const cake = new CakePackage('test', new THREE.Vector3(0, 0, 0));
const interaction = new InteractionSystem(); interaction.register(cake);
const snap = { moveX:0, moveY:0, running:false, jumpPressed:false, pausePressed:false, interactPressed:false, cameraDeltaX:0, cameraDeltaY:0 };
assert.equal(interaction.update(new THREE.Vector3(1,0,0),'actor',snap),cake);
assert.equal(interaction.update(new THREE.Vector3(3,0,0),'actor',snap),null);
snap.interactPressed=true; interaction.update(new THREE.Vector3(1,0,0),'actor',snap); assert.equal(cake.state,'CARRIED'); assert.equal(cake.carrierEntityId,'actor');
assert.equal(cake.damage(200),100); assert.equal(cake.condition,0); assert.equal(cake.destroyed,true); assert.equal(cake.damage(4),0);
assert.equal(impactSeverity(.5),null); assert.equal(impactSeverity(2),'soft'); assert.equal(impactSeverity(3),'normal'); assert.equal(impactSeverity(5),'hard'); assert.equal(severityDamage('major'),15);
const reset = new CakePackage('reset',new THREE.Vector3()); reset.damage(20); reset.reset(new THREE.Vector3(2,0,3)); assert.equal(reset.condition,100); assert.equal(reset.state,'WORLD');
const damaged = new CakePackage('cooldown',new THREE.Vector3()); const damage = new PackageDamageSystem(); assert.equal(damage.applyCollision(damaged,3),5); assert.equal(damage.applyCollision(damaged,3),0);
const visual = new CakePackage('visual',new THREE.Vector3()); assert.equal(visual.visualState,'PERFECT'); visual.damage(35);assert.equal(visual.visualState,'TILTED_FROSTING');visual.damage(25);assert.equal(visual.visualState,'LOST_CANDLE');visual.damage(25);assert.equal(visual.visualState,'CROOKED');visual.damage(10);assert.equal(visual.visualState,'DISASTER');
console.log('PASS Stage 5 deterministic interaction/damage tests');
