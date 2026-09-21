import * as THREE from 'three';
import { getMaterial, UNIT_CYLINDER, UNIT_SPHERE, UNIT_TORUS, UNIT_CONE } from '../world/Materials';
import { PackageEntity } from './Package';
import type { Interactable } from '../interaction/InteractionTypes';
import { DELIVERY_CONFIG } from '../config/delivery';

function part(g: THREE.BufferGeometry, color: Parameters<typeof getMaterial>[0], scale: THREE.Vector3, y: number, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(g, getMaterial(color, { roughness: 0.65 })); m.scale.copy(scale); m.position.set(0, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
export class CakePackage extends PackageEntity implements Interactable {
  readonly interactionId: string; readonly displayLabel = 'PICK UP'; readonly interactionPosition = new THREE.Vector3();
  private wobble = 0; private wobbleVelocity = 0; private cooldown = 0; private readonly home = new THREE.Vector3();
  private lowerLayer!: THREE.Mesh; private upperLayer!: THREE.Mesh; private frosting!: THREE.Mesh;
  private readonly candles: THREE.Object3D[] = [];
  constructor(id: string, position: THREE.Vector3) {
    super(id, 'cake', 'Birthday Cake'); this.interactionId = id; this.reset(position); this.buildVisual();
  }
  override reset(position: THREE.Vector3): void { super.reset(position); this.interactionPosition.copy(position); }
  private buildVisual(): void {
    this.root.name = 'CakePackage';
    this.root.add(part(UNIT_CYLINDER, 'cream', new THREE.Vector3(0.7, 0.06, 0.7), 0.06));
    this.lowerLayer=part(UNIT_CYLINDER, 'coral', new THREE.Vector3(0.58, 0.18, 0.58), 0.25);this.root.add(this.lowerLayer);
    this.upperLayer=part(UNIT_CYLINDER, 'butter', new THREE.Vector3(0.48, 0.16, 0.48), 0.52);this.root.add(this.upperLayer);
    this.frosting=part(UNIT_TORUS, 'cream', new THREE.Vector3(0.5, 0.12, 0.5), 0.48);this.root.add(this.frosting);
    for (const x of [-0.28, 0, 0.28]) { const candle = new THREE.Group(); const stem=part(UNIT_CYLINDER, 'mint', new THREE.Vector3(0.045, 0.18, 0.045), 0); const flame=part(UNIT_CONE, 'emblemGold', new THREE.Vector3(0.08, 0.14, 0.08), .28); candle.position.set(0,.88,x);candle.add(stem,flame);this.candles.push(candle);this.root.add(candle); }
    for (const x of [-0.35, 0.35]) this.root.add(part(UNIT_SPHERE, 'flowerPink', new THREE.Vector3(0.1, 0.1, 0.1), 0.7, x));
  }
  canInteract(actorPosition: THREE.Vector3): boolean { return this.state === 'WORLD' && actorPosition.distanceTo(this.interactionPosition) <= DELIVERY_CONFIG.pickupRange; }
  interact(entityId: string): boolean { if (this.state !== 'WORLD') return false; this.state = 'CARRIED'; this.carrierEntityId = entityId; return true; }
  detach(position: THREE.Vector3): void { if (this.state === 'CARRIED') { this.state = 'WORLD'; this.carrierEntityId = null; this.root.position.copy(position); } }
  impact(severity: number): number { if (this.cooldown > 0) return 0; this.cooldown = DELIVERY_CONFIG.collisionCooldown; return this.damage(severity); }
  get visualState(): 'PERFECT'|'TILTED_FROSTING'|'LOST_CANDLE'|'CROOKED'|'DISASTER' { if(this.condition<=5)return'DISASTER';if(this.condition<=20)return'CROOKED';if(this.condition<=45)return'LOST_CANDLE';if(this.condition<=70)return'TILTED_FROSTING';return'PERFECT'; }
  private applyConditionVisual():void {const damage=1-this.condition/100;this.frosting.rotation.z=damage*.22;this.upperLayer.rotation.z=this.condition<=20?.22:damage*.08;this.upperLayer.position.x=this.condition<=20?.1:0;this.candles[0]!.visible=this.condition>45;this.candles[1]!.rotation.z=this.condition<=70?.22:0;this.lowerLayer.scale.y=this.condition<=5?.1:.18;}
  update(dt: number, carried: boolean, anchor?: THREE.Object3D, stress = 0): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.applyConditionVisual();
    if (this.destroyed) { this.root.rotation.z = 0.45; this.root.scale.set(0.9, 0.55, 0.9); }
    if (carried && anchor) {
      if (this.root.parent !== anchor) anchor.add(this.root);
      this.home.set(0, 0.08, 0.08);
      this.wobbleVelocity += (stress * 0.035 - this.wobble * 7) * dt;
      this.wobbleVelocity *= Math.exp(-7 * dt); this.wobble += this.wobbleVelocity;
      this.wobble = THREE.MathUtils.clamp(this.wobble, -0.22, 0.22);
      this.root.position.lerp(this.home, 1 - Math.exp(-dt * 12)); this.root.rotation.z = this.wobble; this.root.rotation.x = -this.wobble * 0.55;
    } else if (!carried && this.root.parent !== anchor) { this.root.position.y = 0; }
  }
}
