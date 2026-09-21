import * as THREE from 'three';
import { WorldObjectCategory, type CollidablePlacement } from './WorldTypes';
import {
  getMaterial,
  UNIT_CHUNKY_BOX,
  UNIT_CIRCLE,
  UNIT_CYLINDER,
  UNIT_ICOSA,
  UNIT_RING,
  UNIT_ROUNDED_BOX,
  UNIT_SPHERE,
  UNIT_TORUS,
  UNIT_TRIANGLE,
  UNIT_TRUNK,
  type PaletteKey
} from './Materials';

export interface InstancePlacement {
  position: THREE.Vector3;
  rotationY?: number;
  scale?: THREE.Vector3 | number;
}

/**
 * Collects placements and bakes them into a single InstancedMesh. Used for
 * every prop category that repeats a lot (trees, lamps, benches, planters,
 * crates) so a dense district costs a handful of draw calls instead of
 * hundreds of individual meshes.
 */
export class InstancedBuilder {
  private readonly placements: InstancePlacement[] = [];

  add(placement: InstancePlacement): this {
    this.placements.push(placement);
    return this;
  }

  get count(): number {
    return this.placements.length;
  }

  build(geometry: THREE.BufferGeometry, material: THREE.Material, options: { shadows?: boolean } = {}): THREE.InstancedMesh | null {
    if (this.placements.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, this.placements.length);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scaleVec = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);

    this.placements.forEach((placement, index) => {
      quaternion.setFromAxisAngle(up, placement.rotationY ?? 0);
      if (typeof placement.scale === 'number') {
        scaleVec.setScalar(placement.scale);
      } else if (placement.scale) {
        scaleVec.copy(placement.scale);
      } else {
        scaleVec.set(1, 1, 1);
      }
      matrix.compose(placement.position, quaternion, scaleVec);
      mesh.setMatrixAt(index, matrix);
    });

    mesh.castShadow = options.shadows ?? true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
}

/** One shared set of instanced batches for every repeated prop type in the district. */
export class PropBatches {
  readonly collidables: CollidablePlacement[] = [];
  readonly trunks = new InstancedBuilder();
  readonly foliageA = new InstancedBuilder();
  readonly foliageB = new InstancedBuilder();
  readonly foliageC = new InstancedBuilder();
  readonly lampPoles = new InstancedBuilder();
  readonly lampHeads = new InstancedBuilder();
  readonly lampArms = new InstancedBuilder();
  readonly benches = new InstancedBuilder();
  readonly benchLegs = new InstancedBuilder();
  readonly planterPots = new InstancedBuilder();
  readonly flowersPink = new InstancedBuilder();
  readonly flowersYellow = new InstancedBuilder();
  readonly flowersLavender = new InstancedBuilder();
  readonly crates = new InstancedBuilder();
  readonly carWheels = new InstancedBuilder();
  readonly bins = new InstancedBuilder();
  readonly binLids = new InstancedBuilder();
  readonly hedges = new InstancedBuilder();

  /** Chunky tapered trunk + 4 overlapping soft foliage blobs in 3 tone variants, irregular per-instance sizing. */
  addTree(x: number, z: number, scale = 1, variant: 'a' | 'b' | 'c' = 'a'): void {
    const jitter = Math.sin(x * 12.9898 + z * 78.233) * 0.5 + 0.5; // deterministic pseudo-random 0..1
    const treeScale = scale * (0.9 + jitter * 0.25);
    const trunkHeight = 1.05 * treeScale;
    this.trunks.add({
      position: new THREE.Vector3(x, trunkHeight / 2, z),
      scale: new THREE.Vector3(0.3 * treeScale, trunkHeight, 0.3 * treeScale)
    });

    const foliage = variant === 'a' ? this.foliageA : variant === 'b' ? this.foliageB : this.foliageC;
    const clusterY = trunkHeight + 0.6 * treeScale;
    const blobs: Array<[number, number, number, number]> = [
      [0, 0, 0, 1],
      [0.4, 0.4, -0.15, 0.68],
      [-0.36, 0.28, 0.3, 0.62],
      [0.05, 0.68, 0.32, 0.55]
    ];
    for (const [bx, by, bz, bs] of blobs) {
      foliage.add({
        position: new THREE.Vector3(x + bx * treeScale, clusterY + by * treeScale, z + bz * treeScale),
        rotationY: jitter * Math.PI * 2,
        scale: new THREE.Vector3(bs * treeScale, bs * 0.92 * treeScale, bs * treeScale)
      });
    }
  }

  addLamp(x: number, z: number): void {
    const poleHeight = 2.7;
    this.lampPoles.add({
      position: new THREE.Vector3(x, poleHeight / 2, z),
      scale: new THREE.Vector3(0.13, poleHeight, 0.13)
    });
    this.lampArms.add({
      position: new THREE.Vector3(x, poleHeight - 0.05, z),
      rotationY: 0,
      scale: new THREE.Vector3(0.4, 0.09, 0.09)
    });
    this.lampHeads.add({
      position: new THREE.Vector3(x, poleHeight + 0.2, z),
      scale: new THREE.Vector3(0.38, 0.34, 0.38)
    });
  }

  addBench(x: number, z: number, rotationY = 0): void {
    this.collidables.push({ position: new THREE.Vector3(x, 0.52, z), rotationY, halfExtents: new THREE.Vector3(0.75, 0.52, 0.33), category: WorldObjectCategory.SOLID_PROP });
    this.benches.add({
      position: new THREE.Vector3(x, 0.5, z),
      rotationY,
      scale: new THREE.Vector3(1.5, 0.16, 0.6)
    });
    const back = new THREE.Vector3(0, 0.25, -0.26).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    this.benches.add({
      position: new THREE.Vector3(x + back.x, 0.78, z + back.z),
      rotationY,
      scale: new THREE.Vector3(1.5, 0.54, 0.14)
    });
    for (const side of [-0.62, 0.62]) {
      const offset = new THREE.Vector3(side, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
      this.benchLegs.add({
        position: new THREE.Vector3(x + offset.x, 0.22, z + offset.z),
        rotationY,
        scale: new THREE.Vector3(0.16, 0.44, 0.56)
      });
    }
  }

  addPlanter(x: number, z: number, scale = 1): void {
    this.collidables.push({ position: new THREE.Vector3(x, 0.32 * scale, z), rotationY: 0, halfExtents: new THREE.Vector3(0.41 * scale, 0.32 * scale, 0.41 * scale), category: WorldObjectCategory.SOLID_PROP });
    this.planterPots.add({
      position: new THREE.Vector3(x, 0.32 * scale, z),
      scale: new THREE.Vector3(0.82 * scale, 0.64 * scale, 0.82 * scale)
    });
    const batches = [this.flowersPink, this.flowersYellow, this.flowersLavender];
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + x * 0.3;
      const fx = x + Math.cos(angle) * 0.3 * scale;
      const fz = z + Math.sin(angle) * 0.3 * scale;
      const batch = batches[Math.floor(Math.abs(x + z * 1.7)) % batches.length] ?? this.flowersPink;
      batch.add({
        position: new THREE.Vector3(fx, 0.7 * scale, fz),
        scale: new THREE.Vector3(0.2 * scale, 0.2 * scale, 0.2 * scale)
      });
    }
  }

  addCrate(x: number, z: number, rotationY = 0, scale = 1): void {
    this.crates.add({
      position: new THREE.Vector3(x, 0.35 * scale, z),
      rotationY,
      scale: new THREE.Vector3(0.7 * scale, 0.7 * scale, 0.7 * scale)
    });
  }

  /** Squat rounded bin with a domed lid — street-furniture density filler. */
  addBin(x: number, z: number): void {
    this.bins.add({
      position: new THREE.Vector3(x, 0.28, z),
      scale: new THREE.Vector3(0.42, 0.56, 0.42)
    });
    this.binLids.add({
      position: new THREE.Vector3(x, 0.58, z),
      scale: new THREE.Vector3(0.24, 0.16, 0.24)
    });
  }

  /** Low rounded hedge blob — park/street greenery filler, cheaper than a full tree. */
  addHedge(x: number, z: number, scale = 1): void {
    this.hedges.add({
      position: new THREE.Vector3(x, 0.28 * scale, z),
      rotationY: Math.sin(x * 3.1 + z) * Math.PI,
      scale: new THREE.Vector3(0.6 * scale, 0.5 * scale, 0.5 * scale)
    });
  }

  addCarWheel(x: number, y: number, z: number): void {
    this.carWheels.add({
      position: new THREE.Vector3(x, y, z),
      rotationY: Math.PI / 2,
      scale: new THREE.Vector3(0.26, 0.14, 0.26)
    });
  }

  buildAll(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'PropBatches';

    const add = (mesh: THREE.InstancedMesh | null): void => {
      if (mesh) group.add(mesh);
    };

    add(this.trunks.build(UNIT_TRUNK, getMaterial('trunk', { roughness: 0.9 })));
    add(this.foliageA.build(UNIT_SPHERE, getMaterial('foliageA', { roughness: 0.8 })));
    add(this.foliageB.build(UNIT_SPHERE, getMaterial('foliageB', { roughness: 0.8 })));
    add(this.foliageC.build(UNIT_SPHERE, getMaterial('foliageC', { roughness: 0.8 })));
    add(this.lampPoles.build(UNIT_CYLINDER, getMaterial('lampPole', { roughness: 0.5, metalness: 0.2 })));
    add(this.lampArms.build(UNIT_CYLINDER, getMaterial('lampPole', { roughness: 0.5, metalness: 0.2 })));
    add(
      this.lampHeads.build(
        UNIT_SPHERE,
        getMaterial('lampGlow', { roughness: 0.4, emissive: 'lampGlow', emissiveIntensity: 0.6 })
      )
    );
    add(this.benches.build(UNIT_CHUNKY_BOX, getMaterial('benchSeat', { roughness: 0.75 })));
    add(this.benchLegs.build(UNIT_ROUNDED_BOX, getMaterial('brownTrim', { roughness: 0.7 })));
    add(this.planterPots.build(UNIT_CHUNKY_BOX, getMaterial('terracotta', { roughness: 0.8 })));
    add(this.flowersPink.build(UNIT_ICOSA, getMaterial('flowerPink', { roughness: 0.6 })));
    add(this.flowersYellow.build(UNIT_ICOSA, getMaterial('flowerYellow', { roughness: 0.6 })));
    add(this.flowersLavender.build(UNIT_ICOSA, getMaterial('flowerLavender', { roughness: 0.6 })));
    add(this.crates.build(UNIT_CHUNKY_BOX, getMaterial('crateWood', { roughness: 0.85 })));
    add(this.carWheels.build(UNIT_CYLINDER, getMaterial('tireDark', { roughness: 0.8 })));
    add(this.bins.build(UNIT_CHUNKY_BOX, getMaterial('binColor', { roughness: 0.7 })));
    add(this.binLids.build(UNIT_SPHERE, getMaterial('binColor', { roughness: 0.6 })));
    add(this.hedges.build(UNIT_SPHERE, getMaterial('hedge', { roughness: 0.85 })));

    return group;
  }
}

export function createFountain(): { group: THREE.Group; update: (delta: number) => void } {
  const group = new THREE.Group();

  const rim = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial('turquoise', { roughness: 0.55 }));
  rim.scale.set(2.1, 0.4, 2.1);
  rim.position.y = 0.2;
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  const basin = new THREE.Mesh(UNIT_CYLINDER, getMaterial('cream', { roughness: 0.7 }));
  basin.scale.set(1.6, 0.34, 1.6);
  basin.position.y = 0.24;
  basin.receiveShadow = true;
  group.add(basin);

  const water = new THREE.Mesh(UNIT_CIRCLE, getMaterial('water', { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2;
  water.scale.setScalar(1.4);
  water.position.y = 0.42;
  group.add(water);

  const midTier = new THREE.Mesh(UNIT_CYLINDER, getMaterial('powderBlue', { roughness: 0.55 }));
  midTier.scale.set(0.7, 0.3, 0.7);
  midTier.position.y = 0.6;
  midTier.castShadow = true;
  group.add(midTier);

  const midWater = new THREE.Mesh(UNIT_CIRCLE, getMaterial('water', { roughness: 0.15, transparent: true, opacity: 0.9 }));
  midWater.rotation.x = -Math.PI / 2;
  midWater.scale.setScalar(0.58);
  midWater.position.y = 0.76;
  group.add(midWater);

  const pedestal = new THREE.Mesh(UNIT_CYLINDER, getMaterial('turquoise', { roughness: 0.5 }));
  pedestal.scale.set(0.26, 0.65, 0.26);
  pedestal.position.y = 1.08;
  pedestal.castShadow = true;
  group.add(pedestal);

  const crown = new THREE.Mesh(UNIT_SPHERE, getMaterial('cream', { roughness: 0.4 }));
  crown.scale.set(0.24, 0.2, 0.24);
  crown.position.y = 1.44;
  group.add(crown);

  const spray = new THREE.Mesh(UNIT_TORUS, getMaterial('water', { roughness: 0.25, transparent: true, opacity: 0.75 }));
  spray.scale.setScalar(0.28);
  spray.position.y = 1.6;
  spray.rotation.x = Math.PI / 2;
  group.add(spray);

  const update = (delta: number): void => {
    spray.rotation.z += delta * 1.6;
    spray.position.y = 1.56 + Math.sin(performance.now() * 0.002) * 0.05;
  };

  return { group, update };
}

/** Soft glowing floor ring + gently bobbing icon — future pickup/destination marker. */
export function createLandmarkMarker(color: PaletteKey): { group: THREE.Group; update: (delta: number) => void } {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    UNIT_RING,
    getMaterial(color, { roughness: 0.4, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.75 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.scale.setScalar(1.1);
  ring.position.y = 0.03;
  group.add(ring);

  const icon = new THREE.Mesh(UNIT_ICOSA, getMaterial(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.4 }));
  icon.scale.setScalar(0.4);
  icon.position.y = 1.4;
  icon.castShadow = true;
  group.add(icon);

  let time = Math.random() * Math.PI * 2;
  const update = (delta: number): void => {
    time += delta;
    icon.position.y = 1.4 + Math.sin(time * 1.6) * 0.12;
    icon.rotation.y += delta * 0.8;
    ring.rotation.z += delta * 0.15;
  };

  return { group, update };
}

export interface CarSpec {
  bodyColor: PaletteKey;
  position: { x: number; z: number };
  rotationY: number;
}

export function createParkedCar(spec: CarSpec, batches: PropBatches): THREE.Group {
  const group = new THREE.Group();
  group.position.set(spec.position.x, 0, spec.position.z);
  group.rotation.y = spec.rotationY;

  const body = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial(spec.bodyColor, { roughness: 0.55, metalness: 0.15 }));
  body.scale.set(1.7, 0.55, 0.85);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('windowGlass', { roughness: 0.3, metalness: 0.2 }));
  cabin.scale.set(0.95, 0.4, 0.72);
  cabin.position.set(-0.1, 0.78, 0);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelY = 0.22;
  const wheelXOffsets = [0.55, -0.55];
  const wheelZOffsets = [0.42, -0.42];
  for (const wx of wheelXOffsets) {
    for (const wz of wheelZOffsets) {
      const world = new THREE.Vector3(wx, wheelY, wz)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotationY)
        .add(new THREE.Vector3(spec.position.x, 0, spec.position.z));
      batches.addCarWheel(world.x, world.y, world.z);
    }
  }

  return group;
}

export interface MarketStallSpec {
  canopyColor: PaletteKey;
  accentColor: PaletteKey;
}

export function createMarketStall(spec: MarketStallSpec): THREE.Group {
  const group = new THREE.Group();

  const poleMaterial = getMaterial('brownTrim', { roughness: 0.8 });
  const poleOffsets: Array<[number, number]> = [
    [-0.9, -0.6],
    [0.9, -0.6],
    [-0.9, 0.6],
    [0.9, 0.6]
  ];
  for (const [px, pz] of poleOffsets) {
    const pole = new THREE.Mesh(UNIT_CYLINDER, poleMaterial);
    pole.scale.set(0.08, 1.5, 0.08);
    pole.position.set(px, 0.75, pz);
    pole.castShadow = true;
    group.add(pole);
  }

  const canopyMaterial = getMaterial(spec.canopyColor, { roughness: 0.65 });
  const slopeLeft = new THREE.Mesh(UNIT_CHUNKY_BOX, canopyMaterial);
  slopeLeft.scale.set(1.3, 0.14, 1.5);
  slopeLeft.position.set(-0.5, 1.65, 0);
  slopeLeft.rotation.z = 0.32;
  slopeLeft.castShadow = true;
  group.add(slopeLeft);

  const slopeRight = new THREE.Mesh(UNIT_CHUNKY_BOX, canopyMaterial);
  slopeRight.scale.set(1.3, 0.14, 1.5);
  slopeRight.position.set(0.5, 1.65, 0);
  slopeRight.rotation.z = -0.32;
  slopeRight.castShadow = true;
  group.add(slopeRight);

  const ridgeCap = new THREE.Mesh(UNIT_CYLINDER, getMaterial(spec.accentColor, { roughness: 0.6 }));
  ridgeCap.rotation.z = Math.PI / 2;
  ridgeCap.scale.set(0.1, 1.6, 0.1);
  ridgeCap.position.set(0, 1.95, 0);
  group.add(ridgeCap);

  // Small hanging placard under the canopy ridge — reads as a stall sign
  // without needing per-stall text.
  const placard = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial('cream', { roughness: 0.75 }));
  placard.scale.set(0.55, 0.32, 0.08);
  placard.position.set(0, 1.55, 0.76);
  placard.castShadow = true;
  group.add(placard);
  const placardDot = new THREE.Mesh(UNIT_SPHERE, getMaterial(spec.accentColor, { roughness: 0.5 }));
  placardDot.scale.setScalar(0.09);
  placardDot.position.set(0, 1.55, 0.81);
  group.add(placardDot);

  const table = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial('cream', { roughness: 0.8 }));
  table.scale.set(1.8, 0.7, 1);
  table.position.y = 0.35;
  table.castShadow = true;
  table.receiveShadow = true;
  group.add(table);

  const basketColors: PaletteKey[] = [spec.canopyColor, spec.accentColor];
  for (const [bx, bz] of [[-0.75, -0.55] as const, [0.78, -0.5] as const]) {
    const basket = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial('crateWood', { roughness: 0.85 }));
    basket.scale.set(0.4, 0.32, 0.4);
    basket.position.set(bx, 0.9, bz);
    basket.castShadow = true;
    group.add(basket);
    const pile = new THREE.Mesh(UNIT_SPHERE, getMaterial(basketColors[Math.abs(bx) > 0.7 ? 0 : 1] ?? 'coral', { roughness: 0.6 }));
    pile.scale.setScalar(0.22);
    pile.position.set(bx, 1.12, bz);
    group.add(pile);
  }

  const goodsColors: PaletteKey[] = [spec.accentColor, 'coral', 'butter', 'mint'];
  for (let i = 0; i < 5; i += 1) {
    const goods = new THREE.Mesh(UNIT_SPHERE, getMaterial(goodsColors[i % goodsColors.length] ?? 'coral', { roughness: 0.6 }));
    goods.scale.setScalar(0.16 + Math.random() * 0.06);
    goods.position.set(-0.7 + i * 0.35, 0.78, (i % 2 === 0 ? 0.15 : -0.15));
    group.add(goods);
  }

  return group;
}

export function createBunting(startX: number, endX: number, y: number, z: number, colors: PaletteKey[]): THREE.Group {
  const group = new THREE.Group();
  const flagCount = 7;
  for (let i = 0; i < flagCount; i += 1) {
    const t = i / (flagCount - 1);
    const x = THREE.MathUtils.lerp(startX, endX, t);
    const sag = Math.sin(t * Math.PI) * 0.35;
    const color = colors[i % colors.length] ?? 'coral';
    const flag = new THREE.Mesh(UNIT_TRIANGLE, getMaterial(color, { roughness: 0.75 }));
    flag.scale.set(0.28, 0.32, 1);
    flag.position.set(x, y - sag, z);
    group.add(flag);
  }
  return group;
}
