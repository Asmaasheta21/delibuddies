import * as THREE from 'three';
import type { Interactable } from '../interaction/InteractionTypes';
import type { CakePackage } from './CakePackage';
export class DeliveryZone implements Interactable {
  readonly interactionId='destination-delivery'; readonly displayLabel='DELIVER'; readonly interactionPosition:THREE.Vector3; deliveryReady=false; deliveryPrepared=false;
  constructor(position:THREE.Vector3){this.interactionPosition=position.clone();}
  canInteract(actorPosition:THREE.Vector3):boolean {return actorPosition.distanceTo(this.interactionPosition)<2.2;}
  update(actorPosition:THREE.Vector3,cake:CakePackage|null):void {this.deliveryReady=this.canInteract(actorPosition)&&!!cake&&cake.state==='CARRIED'&&!cake.destroyed;}
  interact():boolean {if(!this.deliveryReady)return false;this.deliveryPrepared=true;return true;}
  reset():void{this.deliveryReady=false;this.deliveryPrepared=false;}
}
