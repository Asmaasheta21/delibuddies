import * as THREE from 'three';
import type { PackageState, PackageType } from './DeliveryTypes';
export abstract class PackageEntity {
  readonly root = new THREE.Group();
  state: PackageState = 'WORLD';
  carrierEntityId: string | null = null;
  condition = 100;
  readonly maxCondition = 100;
  constructor(readonly packageId: string, readonly packageType: PackageType, readonly displayName: string) {}
  get destroyed(): boolean { return this.state === 'DESTROYED' || this.condition <= 0; }
  damage(amount: number): number {
    if (this.destroyed) return 0;
    const before = this.condition;
    this.condition = THREE.MathUtils.clamp(this.condition - Math.max(0, amount), 0, this.maxCondition);
    if (this.condition === 0) this.state = 'DESTROYED';
    return before - this.condition;
  }
  reset(position: THREE.Vector3): void { this.state = 'WORLD'; this.carrierEntityId = null; this.condition = this.maxCondition; this.root.position.copy(position); }
}
