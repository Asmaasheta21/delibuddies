import * as THREE from 'three';import type { CakePackage } from '../delivery/CakePackage';import { WorldEvent } from './WorldEvent';import { selectWorldEvent } from './WorldEventRegistry';import type { EventBonusLine,WorldEventMapMetadata } from './WorldEventTypes';
export class WorldEventManager {readonly root=new THREE.Group();private active:WorldEvent|null=null;private runIndex=0;constructor(){this.root.name='WorldEvents';}
 selectRun(runIndex:number){this.runIndex=runIndex;this.active?.dispose();this.root.clear();const definition=selectWorldEvent(runIndex);this.active=definition?new WorldEvent(definition):null;if(this.active)this.root.add(this.active.root);return this.active?.mapMetadata??null;}
 update(dt:number,player:THREE.Vector3,cake:CakePackage|null){this.active?.update(dt,player,cake);}reset(){this.active?.reset();}get metadata():WorldEventMapMetadata|null{return this.active?.mapMetadata??null;}get selectedRun(){return this.runIndex;}
 qualify(visited:ReadonlySet<string>):EventBonusLine|null{const d=this.active?.definition;return d&&visited.has(d.affectedRoute)?{label:d.challengeLabel,amount:d.bonus}:null;}
 get entityCount(){return this.active?1:0;}
 get activePosition(){return this.active?.root.position.clone()??null;}
}
