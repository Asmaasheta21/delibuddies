import * as THREE from 'three';
import { getMaterial, UNIT_CHUNKY_BOX, UNIT_ROUNDED_BOX } from '../world/Materials';
import type { CakePackage } from '../delivery/CakePackage';
export interface TrafficCar { readonly root: THREE.Group; readonly lane: number; readonly speed: number; readonly startX: number; }
export class TrafficSystem {
  readonly root = new THREE.Group(); private elapsed = 0; private readonly cars: TrafficCar[] = [];
  private readonly lastImpact = new Map<string, number>();
  readonly activeCount=6; readonly variantCount=6; readonly parkedCount=2;
  constructor() { this.root.name = 'DeterministicTraffic'; for (const [lane,z,color,speed,start] of [[-1,.9,'coral',3.1,-14],[1,-.9,'turquoise',-2.7,-5],[-1,-2.2,'butter',2.4,4],[1,2.2,'lavender',-3.4,13],[-1,3.2,'mint',2.1,-24],[1,-3.2,'terracotta',-2.2,24]] as const) this.addCar(lane,z,color,speed,start); this.addParked(-7,3.5,'navy'); this.addParked(8,-3.5,'cream'); }
  private addCar(lane:number,z:number,color:any,speed:number,startX:number):void { const g=new THREE.Group(); const body=new THREE.Mesh(UNIT_ROUNDED_BOX,getMaterial(color,{roughness:.65})); body.scale.set(1.1,.38,.7); body.position.y=.48; g.add(body); const roof=new THREE.Mesh(UNIT_CHUNKY_BOX,getMaterial('cream')); roof.scale.set(.62,.22,.58); roof.position.y=.85; g.add(roof); g.position.set(startX,.14,z); this.root.add(g); this.cars.push({root:g,lane,speed,startX}); }
  private addParked(x:number,z:number,color:any){const g=new THREE.Group();const b=new THREE.Mesh(UNIT_ROUNDED_BOX,getMaterial(color));b.scale.set(1.05,.3,.65);b.position.y=.4;g.add(b);g.position.set(x,.14,z);this.root.add(g);}
  update(dt:number, playerPosition:THREE.Vector3, cake:CakePackage|null, playerId:string, push?:(amount:number)=>void):void { this.elapsed += dt; for(const car of this.cars){ car.root.position.x = ((car.startX + car.speed*this.elapsed + 30) % 60) - 30; const dx=Math.abs(car.root.position.x-playerPosition.x), dz=Math.abs(car.root.position.z-playerPosition.z); if(dx<1.3&&dz<1.2){const last=this.lastImpact.get(playerId)??-Infinity;if(this.elapsed-last>.5){this.lastImpact.set(playerId,this.elapsed); const amount=car.speed>0?.35:-.35; if(cake) cake.impact(Math.abs(car.speed)>3?18:12); playerPosition.x += amount; push?.(amount);}} } }
  reset():void { this.elapsed=0; this.lastImpact.clear(); for(const car of this.cars) car.root.position.x=car.startX; }
}
