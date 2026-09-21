import * as THREE from 'three';

/**
 * Shared world-object categories. Every solid thing the city places (buildings,
 * lamps, crates, trees, market stalls...) is tagged with one of these so Stage 4
 * can walk a flat list of placements instead of traversing unnamed meshes to
 * figure out what should block the player.
 */
export enum WorldObjectCategory {
  BUILDING = 'BUILDING',
  SOLID_PROP = 'SOLID_PROP',
  DECORATIVE_PROP = 'DECORATIVE_PROP',
  ROAD = 'ROAD',
  SIDEWALK = 'SIDEWALK',
  LANDMARK = 'LANDMARK'
}

/** A future collider: an oriented box in world space, independent of whether it was rendered via InstancedMesh or an individual Object3D. */
export interface CollidablePlacement {
  cameraOnly?: boolean;
  shape?: 'cylinder';
  position: THREE.Vector3;
  rotationY: number;
  halfExtents: THREE.Vector3;
  category: WorldObjectCategory;
}

export interface WorldLandmarks {
  bakeryPickupAnchor: THREE.Object3D;
  deliveryDestinationAnchor: THREE.Object3D;
  /** Where the player character stands when a delivery run begins, near the bakery. */
  playerSpawnAnchor: THREE.Object3D;
}
