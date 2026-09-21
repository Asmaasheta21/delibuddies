import * as THREE from 'three';
import {
  getMaterial,
  getSignTexture,
  PALETTE,
  type PaletteKey,
  UNIT_CHUNKY_BOX,
  UNIT_CYLINDER,
  UNIT_EMBLEM,
  UNIT_PLANE,
  UNIT_ROUNDED_BOX,
  UNIT_SPHERE,
  UNIT_TRIANGLE
} from './Materials';

export interface SignSpec {
  text: string;
  bgColor?: string;
  textColor?: string;
  emblemColor?: PaletteKey;
}

export interface AwningSpec {
  color: PaletteKey;
  stripeColor?: PaletteKey;
}

export interface BuildingSpec {
  width: number;
  depth: number;
  height: number;
  wallColor: PaletteKey;
  roofColor: PaletteKey;
  trimColor?: PaletteKey;
  doorColor?: PaletteKey;
  windowColor?: PaletteKey;
  floors?: number;
  windowsPerFloor?: number;
  awning?: AwningSpec;
  sign?: SignSpec;
  balconies?: boolean;
  outline?: boolean;
}

/**
 * Layered windows: a dark recess, a trim frame and a glass pane sitting proud
 * of the frame — three shallow depth steps instead of one flat rectangle
 * glued to the wall, so hero storefronts read as built-up rather than printed on.
 */
function addWindows(group: THREE.Group, spec: BuildingSpec): void {
  const floors = spec.floors ?? 2;
  const perFloor = spec.windowsPerFloor ?? Math.max(2, Math.floor(spec.width / 1.6));
  const glassMaterial = getMaterial(spec.windowColor ?? 'windowGlass', { roughness: 0.3, metalness: 0.1 });
  const litMaterial = getMaterial('windowLit', { roughness: 0.35, emissive: 'windowLit', emissiveIntensity: 0.4 });
  const frameMaterial = getMaterial('windowFrame', { roughness: 0.75 });
  const recessMaterial = getMaterial('navy', { roughness: 0.95 });

  const usableWidth = spec.width - 1;
  const startY = spec.height / floors;
  const wallZ = spec.depth / 2;

  for (let floor = 0; floor < floors; floor += 1) {
    const y = startY * (floor + 0.72);
    for (let i = 0; i < perFloor; i += 1) {
      const t = perFloor === 1 ? 0.5 : i / (perFloor - 1);
      const x = -usableWidth / 2 + t * usableWidth;
      const isLit = (floor + i) % 5 === 0;

      const recess = new THREE.Mesh(UNIT_ROUNDED_BOX, recessMaterial);
      recess.scale.set(0.66, 0.68, 0.1);
      recess.position.set(x, y, wallZ - 0.03);
      group.add(recess);

      const frame = new THREE.Mesh(UNIT_ROUNDED_BOX, frameMaterial);
      frame.scale.set(0.6, 0.62, 0.08);
      frame.position.set(x, y, wallZ + 0.01);
      group.add(frame);

      const pane = new THREE.Mesh(UNIT_ROUNDED_BOX, isLit ? litMaterial : glassMaterial);
      pane.scale.set(0.48, 0.5, 0.05);
      pane.position.set(x, y, wallZ + 0.07);
      group.add(pane);
    }
  }
}

function addDoor(group: THREE.Group, spec: BuildingSpec): number {
  const doorWidth = Math.min(1.1, spec.width * 0.28);
  const wallZ = spec.depth / 2;

  const recess = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('navy', { roughness: 0.95 }));
  recess.scale.set(doorWidth + 0.24, 1.9, 0.18);
  recess.position.set(0, 0.95, wallZ - 0.06);
  group.add(recess);

  const door = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial(spec.doorColor ?? 'doorBrown', { roughness: 0.6 }));
  door.scale.set(doorWidth, 1.72, 0.1);
  door.position.set(0, 0.86, wallZ + 0.01);
  door.castShadow = true;
  group.add(door);

  const knob = new THREE.Mesh(UNIT_SPHERE, getMaterial('goldenYellow', { roughness: 0.4, metalness: 0.3 }));
  knob.scale.setScalar(0.05);
  knob.position.set(doorWidth * 0.3, 0.86, wallZ + 0.07);
  group.add(knob);

  return doorWidth;
}

function addAwning(group: THREE.Group, spec: BuildingSpec, doorWidth: number): void {
  if (!spec.awning) return;
  const awningMaterial = getMaterial(spec.awning.color, { roughness: 0.7 });
  const canopyY = spec.height * 0.6;
  const canopyDepth = 0.85;
  const canopyZ = spec.depth / 2 + 0.42;

  const canopy = new THREE.Mesh(UNIT_CHUNKY_BOX, awningMaterial);
  canopy.scale.set(doorWidth * 1.6, 0.18, canopyDepth);
  canopy.position.set(0, canopyY, canopyZ);
  canopy.castShadow = true;
  canopy.userData.cameraObstacle = true;
  group.add(canopy);

  const strutMaterial = getMaterial(spec.trimColor ?? 'brownTrim', { roughness: 0.6 });
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(UNIT_CYLINDER, strutMaterial);
    strut.rotation.z = side * 0.5;
    strut.scale.set(0.045, canopyDepth * 0.6, 0.045);
    strut.position.set(side * doorWidth * 0.55, canopyY - 0.28, spec.depth / 2 + 0.2);
    group.add(strut);
  }

  const frontZ = canopyZ + canopyDepth / 2;
  const frontY = canopyY - 0.17;
  const stripeMaterial = getMaterial(spec.awning.stripeColor ?? 'cream', { roughness: 0.8 });
  const stripeCount = Math.max(3, Math.round(doorWidth * 1.6));
  for (let i = 0; i < stripeCount; i += 1) {
    const t = stripeCount === 1 ? 0.5 : i / (stripeCount - 1);
    const x = (t - 0.5) * doorWidth * 1.5;
    const scallop = new THREE.Mesh(UNIT_TRIANGLE, i % 2 === 0 ? awningMaterial : stripeMaterial);
    scallop.scale.set(0.4, 0.3, 1);
    scallop.position.set(x, frontY, frontZ);
    group.add(scallop);
  }
}

/**
 * Projecting hanging sign: a thick pill-like box mounted on a bracket rod,
 * clear of both the awning below and the roof above by construction (not by
 * hand-tuned offsets), with a small sculpted emblem instead of a flat logo.
 * Fixes the earlier mirrored-text bug permanently — the printed artwork lives
 * on its own single-sided plane, never on a box face.
 */
function addSign(group: THREE.Group, spec: BuildingSpec): void {
  if (!spec.sign) return;
  const bg = spec.sign.bgColor ?? PALETTE.cream;
  const textColor = spec.sign.textColor ?? PALETTE.navy;

  const boardWidth = Math.min(spec.width * 0.62, 2.1);
  const boardHeight = 0.66;
  const awningY = spec.awning ? spec.height * 0.6 : spec.height * 0.42;
  const awningTop = awningY + 0.65;
  const roofBottom = spec.height + 0.05;
  const y = Math.min(awningTop + boardHeight * 0.5 + 0.25, roofBottom - boardHeight * 0.5 - 0.1);
  const wallZ = spec.depth / 2;
  const z = wallZ + 0.55;

  const bracket = new THREE.Mesh(UNIT_CYLINDER, getMaterial(spec.trimColor ?? 'brownTrim', { roughness: 0.6, metalness: 0.15 }));
  bracket.rotation.x = Math.PI / 2;
  bracket.scale.set(0.05, z - wallZ, 0.05);
  bracket.position.set(0, y + 0.22, (wallZ + z) / 2);
  group.add(bracket);

  const backing = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial(spec.trimColor ?? spec.roofColor, { roughness: 0.7 }));
  backing.scale.set(boardWidth, boardHeight, 0.22);
  backing.position.set(0, y, z);
  backing.castShadow = true;
  group.add(backing);

  const texture = getSignTexture(spec.sign.text, bg, textColor);
  const faceMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0 });
  const faceWidth = boardWidth * 0.86;
  const faceHeight = boardHeight * 0.72;

  for (const side of [1, -1]) {
    const face = new THREE.Mesh(UNIT_PLANE, faceMaterial);
    face.scale.set(faceWidth, faceHeight, 1);
    face.position.set(0, y, z + side * 0.115);
    face.rotation.y = side === 1 ? 0 : Math.PI;
    group.add(face);
  }

  const emblem = new THREE.Mesh(UNIT_EMBLEM, getMaterial(spec.sign.emblemColor ?? 'emblemGold', { roughness: 0.45, metalness: 0.1 }));
  emblem.scale.setScalar(0.16);
  emblem.position.set(-boardWidth / 2 + 0.22, y + boardHeight / 2 - 0.05, z + 0.14);
  emblem.castShadow = true;
  group.add(emblem);
}

function addBalconies(group: THREE.Group, spec: BuildingSpec): void {
  if (!spec.balconies) return;
  const floors = spec.floors ?? 2;
  const railMaterial = getMaterial(spec.trimColor ?? 'terracotta', { roughness: 0.7 });
  for (let floor = 1; floor < floors; floor += 1) {
    const y = (spec.height / floors) * floor + 0.1;
    const ledge = new THREE.Mesh(UNIT_ROUNDED_BOX, railMaterial);
    ledge.scale.set(spec.width * 0.5, 0.2, 0.55);
    ledge.userData.cameraObstacle = true;
    ledge.position.set(0, y, spec.depth / 2 + 0.32);
    ledge.castShadow = true;
    group.add(ledge);

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(UNIT_CYLINDER, railMaterial);
      post.scale.set(0.05, 0.4, 0.05);
      post.position.set((side * spec.width * 0.5) / 2, y + 0.2, spec.depth / 2 + 0.55);
      group.add(post);
    }
  }
}

/** Rounded parapet cap sitting above the roof slab — softens the roofline silhouette. */
function addParapet(group: THREE.Group, spec: BuildingSpec): void {
  const cap = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial(spec.roofColor, { roughness: 0.68 }));
  cap.scale.set(spec.width + 0.2, 0.22, spec.depth + 0.2);
  cap.position.y = spec.height + 0.42;
  cap.castShadow = true;
  group.add(cap);
}

/**
 * Generic pastel shop/apartment factory. Local space: footprint centered on
 * the origin, base at y = 0, front face (door/sign/awning) toward +Z.
 * Callers position and rotate the returned group to fit the district layout.
 */
export function createBuilding(spec: BuildingSpec): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial(spec.wallColor));
  body.scale.set(spec.width, spec.height, spec.depth);
  body.position.y = spec.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const trim = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial(spec.trimColor ?? spec.roofColor, { roughness: 0.75 }));
  trim.scale.set(spec.width + 0.1, 0.34, spec.depth + 0.1);
  trim.position.y = 0.18;
  trim.receiveShadow = true;
  group.add(trim);

  const roof = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial(spec.roofColor, { roughness: 0.7 }));
  roof.scale.set(spec.width + 0.5, 0.42, spec.depth + 0.5);
  roof.position.y = spec.height + 0.2;
  roof.castShadow = true;
  roof.userData.cameraObstacle = true;
  group.add(roof);

  addParapet(group, spec);

  const doorWidth = addDoor(group, spec);

  addWindows(group, spec);
  addAwning(group, spec, doorWidth);
  addSign(group, spec);
  addBalconies(group, spec);

  if (spec.outline) {
    const edges = new THREE.EdgesGeometry(UNIT_ROUNDED_BOX);
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: PALETTE.outline }));
    outline.scale.copy(body.scale);
    outline.position.copy(body.position);
    group.add(outline);
  }

  return group;
}

/**
 * Bakery: the mission's future pickup landmark, and the strongest visual
 * anchor near the player start. A large display window with visible pastry
 * shapes behind the glass, a sculpted bun/frosting-swirl icon instead of a
 * flat logo, and a wider chunky curved canopy than a standard shop.
 */
export function createBakery(): THREE.Group {
  const group = createBuilding({
    width: 4.6,
    depth: 3.6,
    height: 3.6,
    wallColor: 'bakeryWall',
    roofColor: 'bakeryTrim',
    trimColor: 'terracotta',
    doorColor: 'doorTeal',
    floors: 1,
    windowsPerFloor: 1,
    awning: { color: 'coral', stripeColor: 'cream' },
    sign: { text: 'Sweet Crumb Bakery', bgColor: PALETTE.cream, textColor: PALETTE.navy, emblemColor: 'emblemGold' },
    outline: true
  });

  // Large display window: recess + frame + glass, wider than a standard
  // window, with a few simple pastry silhouettes suggested behind the glass.
  const wallZ = 3.6 / 2;
  const displayX = -1.15;
  const recess = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('navy', { roughness: 0.95 }));
  recess.scale.set(1.7, 1.5, 0.14);
  recess.position.set(displayX, 1.35, wallZ - 0.04);
  group.add(recess);

  const frame = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('terracotta', { roughness: 0.7 }));
  frame.scale.set(1.6, 1.4, 0.1);
  frame.position.set(displayX, 1.35, wallZ + 0.01);
  group.add(frame);

  const glass = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('windowGlass', { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55 }));
  glass.scale.set(1.44, 1.24, 0.05);
  glass.position.set(displayX, 1.35, wallZ + 0.14);
  group.add(glass);

  const shelf = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('cream', { roughness: 0.8 }));
  shelf.scale.set(1.5, 0.08, 0.5);
  shelf.position.set(displayX, 0.9, wallZ - 0.05);
  group.add(shelf);

  const pastryColors: PaletteKey[] = ['coral', 'butter', 'terracotta', 'flowerPink'];
  for (let i = 0; i < 4; i += 1) {
    const pastry = new THREE.Mesh(UNIT_SPHERE, getMaterial(pastryColors[i % pastryColors.length] ?? 'coral', { roughness: 0.6 }));
    pastry.scale.set(0.22, 0.16, 0.2);
    pastry.position.set(displayX - 0.6 + i * 0.42, 1.0, wallZ - 0.02);
    group.add(pastry);
  }

  // Sculpted bun + frosting-swirl icon replacing the old flat cupcake motif —
  // mounted where the generic sign's emblem sits, reinforced with its own base.
  const motif = new THREE.Group();
  const plaque = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial('cream', { roughness: 0.7 }));
  plaque.scale.set(0.46, 0.46, 0.1);
  motif.add(plaque);
  const bun = new THREE.Mesh(UNIT_SPHERE, getMaterial('terracotta', { roughness: 0.55 }));
  bun.scale.set(0.18, 0.13, 0.06);
  bun.position.set(0, -0.02, 0.08);
  motif.add(bun);
  const swirl = new THREE.Mesh(UNIT_EMBLEM, getMaterial('bakeryTrim', { roughness: 0.5 }));
  swirl.scale.setScalar(0.12);
  swirl.position.set(0, 0.09, 0.1);
  swirl.rotation.z = 0.4;
  motif.add(swirl);
  motif.position.set(1.55, 3.28, wallZ + 0.58);
  group.add(motif);

  return group;
}

/** Destination house: the delivery target, given a special roof + outline pop. */
export function createDestinationHouse(): THREE.Group {
  const group = createBuilding({
    width: 5,
    depth: 4,
    height: 3.8,
    wallColor: 'destinationWall',
    roofColor: 'destinationTrim',
    trimColor: 'destinationTrim',
    doorColor: 'terracotta',
    floors: 2,
    windowsPerFloor: 3,
    awning: { color: 'mint', stripeColor: 'cream' },
    sign: { text: 'Maple Hollow Home', bgColor: PALETTE.cream, textColor: PALETTE.navy, emblemColor: 'flowerPink' },
    outline: true
  });

  const roofCap = new THREE.Mesh(UNIT_CHUNKY_BOX, getMaterial('destinationTrim', { roughness: 0.65 }));
  roofCap.scale.set(3, 1.1, 2.1);
  roofCap.position.set(0, 4.6, -0.35);
  roofCap.castShadow = true;
  roofCap.userData.cameraObstacle = true;
  group.add(roofCap);

  const chimney = new THREE.Mesh(UNIT_ROUNDED_BOX, getMaterial('navy'));
  chimney.scale.set(0.4, 1.1, 0.4);
  chimney.position.set(1.4, 4.9, -0.4);
  chimney.castShadow = true;
  group.add(chimney);

  return group;
}
