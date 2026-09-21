import * as THREE from 'three';
import { getMaterial, UNIT_CIRCLE, UNIT_SPHERE } from './Materials';

export const SKY_COLOR = '#bfe6ff';
export const FOG_NEAR = 34;
export const FOG_FAR = 95;

const GROUND_RADIUS = 70;

/** Distant, cheap silhouettes that give the presentation camera a horizon to read depth from. */
function createBackgroundDepth(): THREE.Group {
  const group = new THREE.Group();
  const hillMaterial = getMaterial('hill', { roughness: 1 });
  const hillShadowMaterial = getMaterial('hillShadow', { roughness: 1 });
  const cloudMaterial = getMaterial('cloud', { roughness: 1, transparent: true, opacity: 0.85 });

  const hillPlacements: Array<{ x: number; z: number; scale: number; dark: boolean }> = [
    { x: -58, z: -14, scale: 20, dark: false },
    { x: 48, z: -42, scale: 24, dark: true },
    { x: -38, z: 52, scale: 17, dark: true },
    { x: 62, z: 24, scale: 19, dark: false }
  ];

  // Smooth spheres, heavily buried and flattened, so they read as soft rounded
  // hills peeking over the horizon rather than sharp low-poly shards.
  for (const hill of hillPlacements) {
    const mesh = new THREE.Mesh(UNIT_SPHERE, hill.dark ? hillShadowMaterial : hillMaterial);
    mesh.position.set(hill.x, -hill.scale * 0.92, hill.z);
    mesh.scale.set(hill.scale, hill.scale * 0.65, hill.scale);
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    group.add(mesh);
  }

  const cloudPlacements: Array<{ x: number; y: number; z: number; scale: number }> = [
    { x: -20, y: 24, z: -20, scale: 5 },
    { x: 10, y: 27, z: -35, scale: 6.5 },
    { x: 30, y: 23, z: 5, scale: 4.5 },
    { x: -35, y: 26, z: 15, scale: 5.5 }
  ];

  for (const cloud of cloudPlacements) {
    const mesh = new THREE.Mesh(UNIT_SPHERE, cloudMaterial);
    mesh.position.set(cloud.x, cloud.y, cloud.z);
    mesh.scale.set(cloud.scale, cloud.scale * 0.45, cloud.scale * 0.7);
    group.add(mesh);
  }

  return group;
}

/**
 * Lights + base ground + horizon dressing. Returns a group meant to be added
 * once at the root of the world; `SKY_COLOR`/fog constants are applied to
 * the THREE.Scene directly by Game.ts since background/fog are scene-level
 * properties rather than objects that can be parented into a group.
 */
export function createEnvironmentGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Environment';

  const hemisphere = new THREE.HemisphereLight(0xfff3d6, 0x8fb0a0, 1.05);
  group.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff1d0, 1.7);
  sun.position.set(24, 34, 18);
  sun.target.position.set(-4, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -46;
  sun.shadow.camera.right = 46;
  sun.shadow.camera.top = 46;
  sun.shadow.camera.bottom = -46;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0018;
  group.add(sun);
  group.add(sun.target);

  const fillLight = new THREE.DirectionalLight(0xbcd9ff, 0.28);
  fillLight.position.set(-20, 14, -18);
  group.add(fillLight);

  const ground = new THREE.Mesh(UNIT_CIRCLE, getMaterial('grassDark', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.scale.setScalar(GROUND_RADIUS);
  ground.receiveShadow = true;
  ground.position.y = -0.02;
  group.add(ground);

  group.add(createBackgroundDepth());

  return group;
}
