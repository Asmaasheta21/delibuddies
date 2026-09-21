import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from './PhysicsWorld';
import type { CollidablePlacement } from '../world/WorldTypes';

const UP_AXIS = new THREE.Vector3(0, 1, 0);
const rotationScratch = new THREE.Quaternion();

/**
 * Builds fixed (static) cuboid colliders from a flat list of placements —
 * the same shape City.ts already produces for buildings/solid props and
 * ground zones. Only gameplay-relevant geometry ever reaches this: decorative
 * meshes (flowers, signs, foliage, crosswalk stripes...) never appear in a
 * CollidablePlacement list in the first place, so this module never has to
 * filter them back out.
 */
export function buildStaticColliders(physics: PhysicsWorld, placements: readonly CollidablePlacement[]): void {
  for (const placement of placements) {
    rotationScratch.setFromAxisAngle(UP_AXIS, placement.rotationY);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(placement.position.x, placement.position.y, placement.position.z)
      .setRotation({ x: rotationScratch.x, y: rotationScratch.y, z: rotationScratch.z, w: rotationScratch.w });
    const body = physics.world.createRigidBody(bodyDesc);

    const colliderDesc = placement.shape === 'cylinder' ? RAPIER.ColliderDesc.cylinder(placement.halfExtents.y, placement.halfExtents.x) : RAPIER.ColliderDesc.cuboid(
      placement.halfExtents.x,
      placement.halfExtents.y,
      placement.halfExtents.z
    );
    if (placement.cameraOnly) colliderDesc.setSensor(true);
    physics.world.createCollider(colliderDesc, body);
  }
}
