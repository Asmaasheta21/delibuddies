import * as THREE from 'three';
import { getMaterial, UNIT_CHUNKY_BOX, UNIT_ROUNDED_BOX } from '../world/Materials';
import type { RouteObstacle } from './ObstacleTypes';
import { WorldObjectCategory, type CollidablePlacement } from '../world/WorldTypes';
export class ObstacleSystem {
  readonly root = new THREE.Group(); readonly obstacles: RouteObstacle[] = [];
  constructor() {
    this.root.name = 'Stage6RouteObstacles';
    this.add('shortcut-crates', 'crate', new THREE.Vector3(-26, .38, 12), new THREE.Vector3(.7,.7,.7));
    this.add('shortcut-crates-2', 'crate', new THREE.Vector3(-23.5, .38, 10.5), new THREE.Vector3(.7,.7,.7));
    this.add('park-ramp', 'ramp', new THREE.Vector3(9, .16, -3), new THREE.Vector3(2.4,.28,1.5));
  }
  private add(id: string, kind: RouteObstacle['kind'], position: THREE.Vector3, size: THREE.Vector3): void {
    this.obstacles.push({id,kind,position,size});
    const mesh = new THREE.Mesh(kind === 'ramp' ? UNIT_ROUNDED_BOX : UNIT_CHUNKY_BOX, getMaterial(kind === 'ramp' ? 'mint' : 'crateWood', {roughness:.8}));
    mesh.position.copy(position); mesh.scale.copy(size); mesh.castShadow = mesh.receiveShadow = true; this.root.add(mesh);
  }
  reset(): void {}
  getCollidables(): CollidablePlacement[] { return this.obstacles.filter(o => o.kind !== 'ramp').map(o => ({ position:o.position.clone(), rotationY:0, halfExtents:o.size.clone().multiplyScalar(.5), category:WorldObjectCategory.SOLID_PROP })); }
}
