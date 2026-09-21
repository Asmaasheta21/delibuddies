import * as THREE from 'three';
import { createEnvironmentGroup } from './Environment';
import { createBakery, createBuilding, createDestinationHouse } from './Buildings';
import {
  createBunting,
  createFountain,
  createLandmarkMarker,
  createMarketStall,
  createParkedCar,
  PropBatches,
  type CarSpec
} from './Props';
import { buildAlleyCrateSpec, buildMarketCrateSpec, scatterCrates } from './Obstacles';
import {
  getMaterial,
  PALETTE,
  UNIT_BOX,
  UNIT_CHUNKY_BOX,
  UNIT_CYLINDER,
  UNIT_ROUNDED_BOX,
  UNIT_SPHERE,
  type PaletteKey
} from './Materials';
import { WorldObjectCategory, type CollidablePlacement, type WorldLandmarks } from './WorldTypes';

export { WorldObjectCategory, type CollidablePlacement, type WorldLandmarks } from './WorldTypes';

/** District layout, in world units. Kept as one table so the whole map is legible in one place. */
const LAYOUT = {
  segA: { xCenter: 0, roadHalf: 3.5, walkWidth: 3, z0: 4, z1: 20 },
  segB: { xCenter: -2, roadHalf: 3.5, walkWidth: 3, z0: -24, z1: -4 },
  bakeryPlaza: { x0: -9, x1: 9, z0: 20, z1: 34 },
  intersection: { x0: -9, x1: 9, z0: -4, z1: 4 },
  destPlaza: { x0: -30, x1: 6, z0: -38, z1: -24 },
  market: { x0: -26, x1: -9, z0: -9, z1: 9 },
  park: { x0: 9, x1: 28, z0: -9, z1: 9 },
  alley: { x0: -32, x1: -27, z0: -24, z1: 27 },
  alleyConnector: { x0: -32, x1: -9, z0: 23, z1: 27 }
} as const;

const ROAD_Y = 0.04;
const WALK_Y = 0.16;
const PARK_Y = 0.14;
const MARKET_Y = 0.14;
const ALLEY_Y = 0.14;

function patch(x0: number, x1: number, z0: number, z1: number, color: PaletteKey, topY: number, roughness = 1): THREE.Mesh {
  const width = x1 - x0;
  const depth = z1 - z0;
  const mesh = new THREE.Mesh(UNIT_BOX, getMaterial(color, { roughness }));
  mesh.scale.set(width, 0.2, depth);
  mesh.position.set((x0 + x1) / 2, topY - 0.1, (z0 + z1) / 2);
  mesh.receiveShadow = true;
  return mesh;
}

export class City {
  readonly root = new THREE.Group();
  readonly landmarks: WorldLandmarks;

  private readonly collidables: CollidablePlacement[] = [];
  private readonly groundPlacements: CollidablePlacement[] = [];
  private readonly animators: Array<(delta: number) => void> = [];
  private readonly batches = new PropBatches();

  constructor() {
    this.root.name = 'City';
    this.root.add(createEnvironmentGroup());

    this.buildGround();
    this.buildBakeryArea();
    this.buildMainStreetA();
    this.buildIntersection();
    this.buildMainStreetB();
    this.buildDestinationArea();
    this.buildMarket();
    this.buildPark();
    this.buildAlley();

    this.root.add(this.batches.buildAll());
    this.collidables.push(...this.batches.collidables);
    // One-time bounds for explicitly tagged major overhangs, never foliage/details.
    this.root.updateMatrixWorld(true);
    this.root.traverse(object => {
      if (!object.userData.cameraObstacle) return;
      const box = new THREE.Box3().setFromObject(object);
      this.collidables.push({ position: box.getCenter(new THREE.Vector3()), rotationY: 0, halfExtents: box.getSize(new THREE.Vector3()).multiplyScalar(0.5), cameraOnly: true, category: WorldObjectCategory.SOLID_PROP });
    });

    const bakeryAnchor = this.createAnchor(-2.5, 27, 'butter');
    const destinationAnchor = this.createAnchor(-8, -30, 'mint');
    const spawnAnchor = this.createSpawnAnchor(-1.7, 24, Math.PI);
    this.landmarks = {
      bakeryPickupAnchor: bakeryAnchor,
      deliveryDestinationAnchor: destinationAnchor,
      playerSpawnAnchor: spawnAnchor
    };
  }

  getCollidablePlacements(): readonly CollidablePlacement[] {
    return this.collidables;
  }

  getGroundPlacements(): readonly CollidablePlacement[] {
    return this.groundPlacements;
  }

  update(delta: number): void {
    for (const animate of this.animators) animate(delta);
  }

  // ---------------------------------------------------------------------
  // Ground
  // ---------------------------------------------------------------------

  private buildGround(): void {
    const L = LAYOUT;
    // Match the existing circular environment lawn, including connecting gaps.
    this.groundPlacements.push({ position: new THREE.Vector3(0, -0.12, 0), rotationY: 0, halfExtents: new THREE.Vector3(70, 0.1, 70), shape: 'cylinder', category: WorldObjectCategory.SIDEWALK });

    // Main Street segment A (south, safe route past the bakery frontage).
    this.addGroundZone(-L.segA.roadHalf, L.segA.roadHalf, L.segA.z0, L.segA.z1, 'asphalt', ROAD_Y, WorldObjectCategory.ROAD);
    this.addGroundZone(-L.segA.roadHalf - L.segA.walkWidth, -L.segA.roadHalf, L.segA.z0, L.segA.z1, 'sidewalk', WALK_Y);
    this.addGroundZone(L.segA.roadHalf, L.segA.roadHalf + L.segA.walkWidth, L.segA.z0, L.segA.z1, 'sidewalk', WALK_Y);

    // Main Street segment B (north, jogs west toward the destination).
    const bXc = L.segB.xCenter;
    this.addGroundZone(bXc - L.segB.roadHalf, bXc + L.segB.roadHalf, L.segB.z0, L.segB.z1, 'asphalt', ROAD_Y, WorldObjectCategory.ROAD);
    this.addGroundZone(
      bXc - L.segB.roadHalf - L.segB.walkWidth,
      bXc - L.segB.roadHalf,
      L.segB.z0,
      L.segB.z1,
      'sidewalk',
      WALK_Y
    );
    this.addGroundZone(bXc + L.segB.roadHalf, bXc + L.segB.roadHalf + L.segB.walkWidth, L.segB.z0, L.segB.z1, 'sidewalk', WALK_Y);

    this.addGroundZone(L.bakeryPlaza.x0, L.bakeryPlaza.x1, L.bakeryPlaza.z0, L.bakeryPlaza.z1, 'plaza', WALK_Y);
    this.addGroundZone(L.intersection.x0, L.intersection.x1, L.intersection.z0, L.intersection.z1, 'plaza', WALK_Y);
    this.addGroundZone(L.destPlaza.x0, L.destPlaza.x1, L.destPlaza.z0, L.destPlaza.z1, 'plaza', WALK_Y);
    this.addGroundZone(L.market.x0, L.market.x1, L.market.z0, L.market.z1, 'marketSand', MARKET_Y);
    this.addGroundZone(L.park.x0, L.park.x1, L.park.z0, L.park.z1, 'grass', PARK_Y);
    this.addGroundZone(L.alley.x0, L.alley.x1, L.alley.z0, L.alley.z1, 'alleyStone', ALLEY_Y);
    this.addGroundZone(L.alleyConnector.x0, L.alleyConnector.x1, L.alleyConnector.z0, L.alleyConnector.z1, 'alleyStone', ALLEY_Y);

    this.addCrosswalk(0, LAYOUT.intersection.z0 + 0.5, LAYOUT.segA.roadHalf);
    this.addCurb(-L.segA.roadHalf, L.segA.z0, L.segA.z1);
    this.addCurb(L.segA.roadHalf, L.segA.z0, L.segA.z1);
    this.addCurb(bXc - L.segB.roadHalf, L.segB.z0, L.segB.z1);
    this.addCurb(bXc + L.segB.roadHalf, L.segB.z0, L.segB.z1);
    this.addDrains();
  }

  /**
   * Creates a walkable ground rectangle both visually (a mesh) and physically
   * (a flat static collider matching the same top surface Y) — the small
   * height differences between zones (road 0.04 vs sidewalk 0.16, a 0.12 gap)
   * are exactly what Stage 4's character-controller auto-step is meant to
   * absorb, so each zone keeps its real Y instead of collapsing to one plane.
   */
  private addGroundZone(
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    color: PaletteKey,
    topY: number,
    category: WorldObjectCategory = WorldObjectCategory.SIDEWALK
  ): void {
    this.root.add(patch(x0, x1, z0, z1, color, topY));
    this.groundPlacements.push({
      position: new THREE.Vector3((x0 + x1) / 2, topY - 0.1, (z0 + z1) / 2),
      rotationY: 0,
      halfExtents: new THREE.Vector3((x1 - x0) / 2, 0.1, (z1 - z0) / 2),
      category
    });
  }

  /** Chunky rounded curb lip bridging the road-to-sidewalk height step, run-length sized. */
  private addCurb(x: number, z0: number, z1: number): void {
    this.groundPlacements.push({ position: new THREE.Vector3(x, WALK_Y - 0.03, (z0 + z1) / 2), rotationY: 0, halfExtents: new THREE.Vector3(0.15, 0.13, (z1 - z0) / 2), category: WorldObjectCategory.SIDEWALK });
    const curb = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial('sidewalkPanel', { roughness: 0.85 }));
    curb.scale.set(0.3, 0.26, z1 - z0);
    curb.position.set(x, WALK_Y - 0.03, (z0 + z1) / 2);
    curb.receiveShadow = true;
    curb.castShadow = true;
    this.root.add(curb);
  }

  /** Small stylized drain covers dotting the road — original geometry, no texture. */
  private addDrains(): void {
    const drainMaterial = getMaterial('tireDark', { roughness: 0.7, metalness: 0.2 });
    const spots: Array<[number, number]> = [
      [1.6, 8],
      [-1.6, 16],
      [LAYOUT.segB.xCenter + 1.6, -10],
      [LAYOUT.segB.xCenter - 1.6, -18]
    ];
    for (const [x, z] of spots) {
      const drain = new THREE.Mesh(UNIT_CYLINDER, drainMaterial);
      drain.scale.set(0.34, 0.02, 0.34);
      drain.position.set(x, ROAD_Y + 0.011, z);
      this.root.add(drain);
    }
  }

  private addCrosswalk(centerX: number, centerZ: number, roadHalf: number): void {
    const stripeMaterial = getMaterial('asphaltLine', { roughness: 0.9 });
    const stripeCount = 6;
    for (let i = 0; i < stripeCount; i += 1) {
      const x = centerX - roadHalf + 0.6 + i * ((roadHalf * 2 - 1.2) / (stripeCount - 1));
      const stripe = new THREE.Mesh(UNIT_BOX, stripeMaterial);
      stripe.scale.set(0.45, 0.02, 2.4);
      stripe.position.set(x, ROAD_Y + 0.011, centerZ);
      stripe.receiveShadow = true;
      this.root.add(stripe);
    }
  }

  // ---------------------------------------------------------------------
  // Bakery start area
  // ---------------------------------------------------------------------

  private buildBakeryArea(): void {
    const bakery = createBakery();
    bakery.position.set(-5, 0, 27);
    bakery.rotation.y = Math.PI / 2;
    this.root.add(bakery);
    this.registerBuilding(-5, 27, Math.PI / 2, 4.6, 3.6, 3.6);

    const companion = createBuilding({
      width: 3.6,
      depth: 3.2,
      height: 3.2,
      wallColor: 'powderBlue',
      roofColor: 'navy',
      trimColor: 'cream',
      doorColor: 'doorBrown',
      floors: 1,
      windowsPerFloor: 2,
      awning: { color: 'lavender', stripeColor: 'cream' },
      sign: { text: 'Cafe Foam', bgColor: PALETTE.cream, textColor: PALETTE.navy }
    });
    companion.position.set(6, 0, 28);
    companion.rotation.y = -Math.PI / 2;
    this.root.add(companion);
    this.registerBuilding(6, 28, -Math.PI / 2, 3.6, 3.2, 3.2);

    this.batches.addLamp(-8, 22);
    this.batches.addLamp(8, 22);
    this.batches.addLamp(0, 32);
    this.batches.addPlanter(-2.6, 21.5, 1.1);
    this.batches.addPlanter(4, 22, 1.1);
    this.addTreeWithCollider(-8.5, 30, 1.1, 'a');
    this.addTreeWithCollider(8.5, 32, 1, 'b');
    this.batches.addBench(3, 31, Math.PI);

    const car1 = createParkedCar({ bodyColor: 'carRed', position: { x: -7.5, z: 30 }, rotationY: 0 }, this.batches);
    this.root.add(car1);
    const car2 = createParkedCar({ bodyColor: 'carBlue', position: { x: 8, z: 24 }, rotationY: Math.PI }, this.batches);
    this.root.add(car2);

    const bunting = createBunting(-7, 7, 3.4, 25.5, ['coral', 'butter', 'mint', 'lavender']);
    this.root.add(bunting);
  }

  // ---------------------------------------------------------------------
  // Main Street segment A
  // ---------------------------------------------------------------------

  private buildMainStreetA(): void {
    const grocery = createBuilding({
      width: 4,
      depth: 3.2,
      height: 3.4,
      wallColor: 'butter',
      roofColor: 'terracotta',
      trimColor: 'cream',
      doorColor: 'doorTeal',
      floors: 1,
      windowsPerFloor: 3,
      awning: { color: 'mint', stripeColor: 'cream' },
      sign: { text: 'Green Basket Grocer', bgColor: PALETTE.cream, textColor: PALETTE.navy }
    });
    grocery.position.set(-8, 0, 10);
    grocery.rotation.y = Math.PI / 2;
    this.root.add(grocery);
    this.registerBuilding(-8, 10, Math.PI / 2, 4, 3.2, 3.4);

    const apartmentsWest = createBuilding({
      width: 4.4,
      depth: 3.4,
      height: 5.4,
      wallColor: 'peach',
      roofColor: 'roofPlum',
      trimColor: 'cream',
      doorColor: 'doorBrown',
      floors: 3,
      windowsPerFloor: 3,
      balconies: true
    });
    apartmentsWest.position.set(-8.2, 0, 17);
    apartmentsWest.rotation.y = Math.PI / 2;
    this.root.add(apartmentsWest);
    this.registerBuilding(-8.2, 17, Math.PI / 2, 4.4, 3.4, 5.4);

    const deliveryShop = createBuilding({
      width: 4,
      depth: 3.2,
      height: 3.4,
      wallColor: 'mint',
      roofColor: 'navy',
      trimColor: 'cream',
      doorColor: 'terracotta',
      floors: 1,
      windowsPerFloor: 2,
      awning: { color: 'butter', stripeColor: 'cream' },
      sign: { text: 'Zoomies Delivery', bgColor: PALETTE.cream, textColor: PALETTE.navy }
    });
    deliveryShop.position.set(8, 0, 10);
    deliveryShop.rotation.y = -Math.PI / 2;
    this.root.add(deliveryShop);
    this.registerBuilding(8, 10, -Math.PI / 2, 4, 3.2, 3.4);

    const apartmentsEast = createBuilding({
      width: 4.4,
      depth: 3.4,
      height: 4.6,
      wallColor: 'lavender',
      roofColor: 'roofTeal',
      trimColor: 'cream',
      doorColor: 'doorBrown',
      floors: 2,
      windowsPerFloor: 3,
      balconies: true
    });
    apartmentsEast.position.set(8.2, 0, 17);
    apartmentsEast.rotation.y = -Math.PI / 2;
    this.root.add(apartmentsEast);
    this.registerBuilding(8.2, 17, -Math.PI / 2, 4.4, 3.4, 4.6);

    for (const z of [6, 9, 13, 16, 19]) {
      this.batches.addLamp(z % 2 === 0 ? -6.8 : 6.8, z);
    }
    this.addTreeWithCollider(-6.7, 7, 0.9, 'b');
    this.addTreeWithCollider(6.7, 14, 1, 'a');
    this.addTreeWithCollider(-6.7, 14, 0.95, 'a');
    this.addTreeWithCollider(6.7, 19, 0.9, 'b');
    this.batches.addBench(-5.6, 9, Math.PI / 2);
    this.batches.addBench(5.6, 15, -Math.PI / 2);
    this.batches.addPlanter(-6, 12, 0.9);
    this.batches.addPlanter(6, 8, 0.9);
  }

  // ---------------------------------------------------------------------
  // Intersection / crosswalk plaza
  // ---------------------------------------------------------------------

  private buildIntersection(): void {
    this.batches.addLamp(-8, 0);
    this.batches.addLamp(8, 0);
    this.batches.addPlanter(-6.5, -3, 1);
    this.batches.addPlanter(6.5, 3, 1);
    this.batches.addBench(0, -3.4, 0);
  }

  // ---------------------------------------------------------------------
  // Main Street segment B
  // ---------------------------------------------------------------------

  private buildMainStreetB(): void {
    const deliveryDepot = createBuilding({
      width: 4.2,
      depth: 3.4,
      height: 3.6,
      wallColor: 'coral',
      roofColor: 'navy',
      trimColor: 'cream',
      doorColor: 'doorTeal',
      floors: 1,
      windowsPerFloor: 2,
      awning: { color: 'butter', stripeColor: 'cream' },
      sign: { text: 'Riverside Flats', bgColor: PALETTE.cream, textColor: PALETTE.navy }
    });
    deliveryDepot.position.set(-10.5, 0, -12);
    deliveryDepot.rotation.y = Math.PI / 2;
    this.root.add(deliveryDepot);
    this.registerBuilding(-10.5, -12, Math.PI / 2, 4.2, 3.4, 3.6);

    const apartmentsB1 = createBuilding({
      width: 4.4,
      depth: 3.4,
      height: 5.8,
      wallColor: 'mint',
      roofColor: 'roofPlum',
      trimColor: 'cream',
      doorColor: 'doorBrown',
      floors: 3,
      windowsPerFloor: 3,
      balconies: true
    });
    apartmentsB1.position.set(-10.5, 0, -19);
    apartmentsB1.rotation.y = Math.PI / 2;
    this.root.add(apartmentsB1);
    this.registerBuilding(-10.5, -19, Math.PI / 2, 4.4, 3.4, 5.8);

    const apartmentsB2 = createBuilding({
      width: 4.2,
      depth: 3.2,
      height: 4.4,
      wallColor: 'butter',
      roofColor: 'roofTeal',
      trimColor: 'cream',
      doorColor: 'doorBrown',
      floors: 2,
      windowsPerFloor: 3,
      balconies: true
    });
    apartmentsB2.position.set(6.5, 0, -12);
    apartmentsB2.rotation.y = -Math.PI / 2;
    this.root.add(apartmentsB2);
    this.registerBuilding(6.5, -12, -Math.PI / 2, 4.2, 3.2, 4.4);

    const apartmentsB3 = createBuilding({
      width: 4,
      depth: 3.2,
      height: 3.6,
      wallColor: 'coral',
      roofColor: 'navy',
      trimColor: 'cream',
      doorColor: 'doorBrown',
      floors: 1,
      windowsPerFloor: 2
    });
    apartmentsB3.position.set(6.5, 0, -19);
    apartmentsB3.rotation.y = -Math.PI / 2;
    this.root.add(apartmentsB3);
    this.registerBuilding(6.5, -19, -Math.PI / 2, 4, 3.2, 3.6);

    for (const z of [-6, -10, -14, -18, -22]) {
      this.batches.addLamp(z % 4 === 0 ? -8.8 : 4.8, z);
    }
    this.addTreeWithCollider(-8.7, -8, 1, 'a');
    this.addTreeWithCollider(4.7, -16, 0.95, 'b');
    this.addTreeWithCollider(-8.7, -16, 0.9, 'b');
    this.addTreeWithCollider(4.7, -22, 1, 'a');
    this.batches.addBench(-7.6, -10, Math.PI / 2);
    this.batches.addBench(3.6, -20, -Math.PI / 2);
    this.batches.addPlanter(-8, -6, 0.9);
    this.batches.addPlanter(4, -8, 0.9);
  }

  // ---------------------------------------------------------------------
  // Destination
  // ---------------------------------------------------------------------

  private buildDestinationArea(): void {
    const house = createDestinationHouse();
    house.position.set(-8, 0, -32);
    this.root.add(house);
    this.registerBuilding(-8, -32, 0, 5, 4, 3.8);

    this.batches.addLamp(-14, -30);
    this.batches.addLamp(-2, -30);
    this.batches.addPlanter(-11.5, -27, 1.1);
    this.batches.addPlanter(-4.5, -27, 1.1);
    this.addTreeWithCollider(-15, -34, 1.1, 'a');
    this.addTreeWithCollider(2, -35, 1, 'b');
    this.batches.addBench(-1, -34, Math.PI);

    const car3 = createParkedCar({ bodyColor: 'carYellow', position: { x: 2, z: -30 }, rotationY: Math.PI / 2 }, this.batches);
    this.root.add(car3);
    const car4 = createParkedCar({ bodyColor: 'carCream', position: { x: -20, z: -33 }, rotationY: -Math.PI / 2 }, this.batches);
    this.root.add(car4);
  }

  // ---------------------------------------------------------------------
  // Market
  // ---------------------------------------------------------------------

  private buildMarket(): void {
    const stallConfigs: Array<{ x: number; z: number; rotationY: number; canopy: PaletteKey; accent: PaletteKey }> = [
      { x: -22, z: -4.5, rotationY: 0, canopy: 'coral', accent: 'butter' },
      { x: -22, z: 4.5, rotationY: Math.PI, canopy: 'mint', accent: 'coral' },
      { x: -15, z: -4.5, rotationY: 0, canopy: 'lavender', accent: 'mint' },
      { x: -15, z: 4.5, rotationY: Math.PI, canopy: 'butter', accent: 'lavender' },
      { x: -18.5, z: 7.5, rotationY: Math.PI, canopy: 'turquoise', accent: 'dustyRose' },
      { x: -18.5, z: -7.5, rotationY: 0, canopy: 'dustyRose', accent: 'turquoise' }
    ];

    for (const config of stallConfigs) {
      const stall = createMarketStall({ canopyColor: config.canopy, accentColor: config.accent });
      stall.position.set(config.x, MARKET_Y, config.z);
      stall.rotation.y = config.rotationY;
      this.root.add(stall);
      this.collidables.push({
        position: new THREE.Vector3(config.x, MARKET_Y + 0.75, config.z),
        rotationY: config.rotationY,
        halfExtents: new THREE.Vector3(1, 0.75, 0.75),
        category: WorldObjectCategory.SOLID_PROP
      });
    }

    for (const x of [-25, -12]) {
      this.addTreeWithCollider(x, -7.5, 0.85, 'b');
      this.addTreeWithCollider(x, 7.5, 0.85, 'a');
    }
    this.batches.addLamp(-25, 0);
    this.batches.addLamp(-12, 0);
    this.batches.addBin(-25.5, 5.5);
    this.batches.addBin(-11.5, -5.5);
    for (const [x, z, s] of [[-20, 5.8, 0.8], [-17, -6.2, 0.75], [-24, -2, 0.7]] as const) {
      this.batches.addCrate(x, z, x + z, s);
      this.collidables.push({
        position: new THREE.Vector3(x, MARKET_Y + 0.35 * s, z),
        rotationY: x + z,
        halfExtents: new THREE.Vector3(0.35 * s, 0.35 * s, 0.35 * s),
        category: WorldObjectCategory.SOLID_PROP
      });
    }

    this.collidables.push(...scatterCrates(this.batches, buildMarketCrateSpec(), MARKET_Y));
  }

  // ---------------------------------------------------------------------
  // Park
  // ---------------------------------------------------------------------

  private buildPark(): void {
    const fountain = createFountain();
    fountain.group.position.set(19, PARK_Y, 0);
    this.root.add(fountain.group);
    this.animators.push(fountain.update);
    this.collidables.push({
      position: new THREE.Vector3(19, PARK_Y + 0.4, 0),
      shape: 'cylinder',
      rotationY: 0,
      halfExtents: new THREE.Vector3(1.8, 0.4, 1.8),
      category: WorldObjectCategory.SOLID_PROP
    });

    const path = patch(17, 21, -9, 9, 'plaza', PARK_Y + 0.001, 0.9);
    this.root.add(path);
    const pathCross = patch(9, 28, -1.5, 1.5, 'plaza', PARK_Y + 0.001, 0.9);
    this.root.add(pathCross);

    const treeSpots: Array<[number, number, 'a' | 'b' | 'c']> = [
      [11, -7, 'a'],
      [11, 7, 'b'],
      [26, -7, 'b'],
      [26, 7, 'a'],
      [24, -3, 'c'],
      [24, 4, 'c'],
      [14, -8, 'c'],
      [21, 8, 'b']
    ];
    for (const [x, z, variant] of treeSpots) {
      this.addTreeWithCollider(x, z, 1, variant);
    }

    for (const [x, z] of [[13, -1.5], [24, 1.5], [17, -8.5], [21, -8.5]] as const) {
      this.batches.addHedge(x, z, 1);
    }

    this.batches.addBench(14, -4, Math.PI / 2);
    this.batches.addBench(14, 4, Math.PI / 2);
    this.batches.addBench(24, -5.5, 0);
    this.batches.addPlanter(11, 0, 1.1);
    this.batches.addPlanter(27, 0, 1.1);
    this.batches.addPlanter(19, 5.5, 1);
    this.batches.addLamp(12, -6);
    this.batches.addLamp(12, 6);
    this.batches.addLamp(27, -6);
    this.batches.addLamp(27, 6);
    this.batches.addBin(15, 2);
    this.batches.addBin(23, -1.5);
  }

  // ---------------------------------------------------------------------
  // Alley shortcut
  // ---------------------------------------------------------------------

  private buildAlley(): void {
    const utilityWallMaterial = getMaterial('alleyStone', { roughness: 0.95 });
    const pipeMaterial = getMaterial('binColor', { roughness: 0.55, metalness: 0.25 });
    const acMaterial = getMaterial('sidewalkPanel', { roughness: 0.6, metalness: 0.15 });
    for (const z of [18, 10, 2, -6, -14, -22]) {
      const facade = new THREE.Mesh(UNIT_ROUNDED_BOX, utilityWallMaterial);
      facade.scale.set(1.6, 3.4, 3.2);
      facade.position.set(-33.2, 1.7, z);
      facade.castShadow = true;
      facade.receiveShadow = true;
      this.root.add(facade);
      this.registerBuilding(-33.2, z, 0, 1.6, 3.2, 3.4);

      // Chunky exterior pipe running up the back wall — enclosure detail.
      const pipe = new THREE.Mesh(UNIT_CYLINDER, pipeMaterial);
      pipe.scale.set(0.1, 3, 0.1);
      pipe.position.set(-32.3, 1.6, z + 1.3);
      this.root.add(pipe);
    }

    // A couple of wall-mounted AC units and a back door for a lived-in feel.
    const ac1 = new THREE.Mesh(UNIT_CHUNKY_BOX, acMaterial);
    ac1.scale.set(0.6, 0.4, 0.34);
    ac1.position.set(-32.2, 2.4, 6);
    ac1.castShadow = true;
    this.root.add(ac1);
    const ac2 = new THREE.Mesh(UNIT_CHUNKY_BOX, acMaterial);
    ac2.scale.set(0.6, 0.4, 0.34);
    ac2.position.set(-32.2, 2.1, -10);
    ac2.castShadow = true;
    this.root.add(ac2);

    const backDoor = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('doorBrown', { roughness: 0.65 }));
    backDoor.scale.set(0.9, 1.6, 0.1);
    backDoor.position.set(-32.35, 0.8, -6);
    this.root.add(backDoor);

    // A short string of small warm lights slung across the corridor.
    const bulbMaterial = getMaterial('lampGlow', { roughness: 0.4, emissive: 'lampGlow', emissiveIntensity: 0.7 });
    for (let i = 0; i < 6; i += 1) {
      const z = 14 - i * 2.2;
      const sag = Math.sin((i / 5) * Math.PI) * 0.3;
      const bulb = new THREE.Mesh(UNIT_SPHERE, bulbMaterial);
      bulb.scale.setScalar(0.09);
      bulb.position.set(-29.5, 3.2 - sag, z);
      this.root.add(bulb);
    }

    this.collidables.push(...scatterCrates(this.batches, buildAlleyCrateSpec(), ALLEY_Y));

    this.batches.addLamp(-29.5, 20);
    this.batches.addLamp(-29.5, 4);
    this.batches.addLamp(-29.5, -12);
    this.batches.addBin(-29.8, 16);
    this.batches.addBin(-29.8, -8);
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  private addTreeWithCollider(x: number, z: number, scale: number, variant: 'a' | 'b' | 'c'): void {
    this.batches.addTree(x, z, scale, variant);
    this.collidables.push({
      position: new THREE.Vector3(x, 0.5 * scale, z),
      shape: 'cylinder',
      rotationY: 0,
      halfExtents: new THREE.Vector3(0.22 * scale, 0.55 * scale, 0.22 * scale),
      category: WorldObjectCategory.SOLID_PROP
    });
  }

  private registerBuilding(
    x: number,
    z: number,
    rotationY: number,
    width: number,
    depth: number,
    height: number
  ): void {
    this.collidables.push({
      position: new THREE.Vector3(x, height / 2, z),
      rotationY,
      halfExtents: new THREE.Vector3(width / 2, height / 2, depth / 2),
      category: WorldObjectCategory.BUILDING
    });
  }

  private createAnchor(x: number, z: number, color: PaletteKey): THREE.Object3D {
    const marker = createLandmarkMarker(color);
    marker.group.position.set(x, 0, z);
    this.root.add(marker.group);
    this.animators.push(marker.update);

    const anchor = new THREE.Object3D();
    anchor.name = 'WorldAnchor';
    anchor.position.set(x, 0, z);
    anchor.userData.category = WorldObjectCategory.LANDMARK;
    this.root.add(anchor);
    return anchor;
  }

  /** Plain (unmarked) anchor — used for spawn/reference points that shouldn't glow like a mission landmark. */
  private createSpawnAnchor(x: number, z: number, rotationY: number): THREE.Object3D {
    const anchor = new THREE.Object3D();
    anchor.name = 'PlayerSpawnAnchor';
    anchor.position.set(x, WALK_Y + 0.025, z);
    anchor.rotation.y = rotationY;
    anchor.userData.category = WorldObjectCategory.LANDMARK;
    this.root.add(anchor);
    return anchor;
  }
}

// Referenced only for type shape re-export convenience to callers of createParkedCar.
export type { CarSpec };
