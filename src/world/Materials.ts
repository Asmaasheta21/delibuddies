import * as THREE from 'three';

/**
 * DeliBuddies world palette. Every world module pulls colors from here so
 * the district reads as one consistent, pleasant color system instead of
 * ad-hoc hex values scattered across factories.
 */
export const PALETTE = {
  sky: '#bfe6ff',
  cream: '#fff6e8',
  peach: '#ffbf94',
  coral: '#f97c5d',
  warmOrange: '#f6934a',
  butter: '#ffd35e',
  goldenYellow: '#ffc23c',
  mint: '#8fdcc0',
  turquoise: '#5cc2be',
  powderBlue: '#9fd3ee',
  lavender: '#c3a8ec',
  dustyRose: '#e895a3',
  terracotta: '#dd6a43',
  brick: '#c1502f',
  navy: '#453a56',
  brownTrim: '#6b4630',
  asphalt: '#54505f',
  asphaltLine: '#efe8da',
  sidewalk: '#eddcc2',
  sidewalkPanel: '#e4cfae',
  plaza: '#f2e3c9',
  grass: '#a9dd8a',
  grassDark: '#8fce78',
  hedge: '#7abf72',
  marketSand: '#eec283',
  alleyStone: '#c7b9cf',
  windowGlass: '#bfe3f2',
  windowFrame: '#5c4a3a',
  windowLit: '#ffd873',
  roofRed: '#e2725a',
  roofTeal: '#5fada2',
  roofPlum: '#9c6fac',
  roofButter: '#f0ab3c',
  doorBrown: '#8a5535',
  doorTeal: '#3f8a86',
  crateWood: '#cc9c5c',
  crateWoodDark: '#a97a42',
  water: '#7fcbe8',
  cloud: '#fffaf0',
  hill: '#93c58a',
  hillShadow: '#78b076',
  lampPole: '#f0e6d2',
  lampGlow: '#ffdf8c',
  binColor: '#8fa088',
  benchSeat: '#e2825f',
  trunk: '#a5754a',
  trunkDark: '#8f6440',
  foliageA: '#7bcf8e',
  foliageB: '#5fbf80',
  foliageC: '#98d992',
  carRed: '#ef6f5e',
  carYellow: '#ffc94d',
  carBlue: '#78b9e8',
  carCream: '#fff0d4',
  tireDark: '#39323e',
  bakeryWall: '#ffcf9e',
  bakeryTrim: '#e07a4c',
  destinationWall: '#bfe9d6',
  destinationTrim: '#4a9c85',
  flowerPink: '#ff85ac',
  flowerYellow: '#ffd351',
  flowerLavender: '#b98cec',
  emblemGold: '#f4b942',
  outline: '#43384f',
  hairMidnight: '#3a3450',
  hairChestnut: '#8a4a3a',
  blush: '#ffb3c6',
  mouthBerry: '#c9506b',
  eyeDark: '#3a3245'
} as const;

export type PaletteKey = keyof typeof PALETTE;

export interface MaterialOptions {
  roughness?: number;
  metalness?: number;
  emissive?: PaletteKey;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/** Returns a shared, cached material for a palette color + option set. */
export function getMaterial(key: PaletteKey, options: MaterialOptions = {}): THREE.MeshStandardMaterial {
  const cacheKey = [
    key,
    options.roughness ?? 0.85,
    options.metalness ?? 0.03,
    options.emissive ?? '',
    options.emissiveIntensity ?? 0,
    options.transparent ?? false,
    options.opacity ?? 1,
    options.side ?? THREE.FrontSide
  ].join('|');

  const cached = materialCache.get(cacheKey);
  if (cached) return cached;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE[key]),
    roughness: options.roughness ?? 0.85,
    metalness: options.metalness ?? 0.03,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide
  });

  if (options.emissive) {
    material.emissive = new THREE.Color(PALETTE[options.emissive]);
    material.emissiveIntensity = options.emissiveIntensity ?? 1;
  }

  materialCache.set(cacheKey, material);
  return material;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

const signTextureCache = new Map<string, THREE.CanvasTexture>();

/** Small canvas-rendered signboard texture, cached by its full content key. */
export function getSignTexture(text: string, bgColor: string, textColor: string): THREE.CanvasTexture {
  const cacheKey = `${text}|${bgColor}|${textColor}`;
  const cached = signTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable for sign texture');

  ctx.fillStyle = bgColor;
  roundRectPath(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 28);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapLines(ctx, text, canvas.width - 48);
  const lineHeight = 46;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  signTextureCache.set(cacheKey, texture);
  return texture;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(width, height, radius);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Shared "unit" geometries. World factories never call `new THREE.*Geometry`
 * per-instance — they reuse one of these and size the result via
 * `mesh.scale`, keeping geometry allocation count roughly constant no
 * matter how dense the district gets.
 */
export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
export const UNIT_ROUNDED_BOX = createRoundedBoxGeometry(1, 1, 1, 0.22);
/** Extra-soft, big-radius variant for hero/toy-like elements (signs, bakery body, bins). */
export const UNIT_CHUNKY_BOX = createRoundedBoxGeometry(1, 1, 1, 0.34);
export const UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 14);
export const UNIT_CYLINDER_OPEN = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true, 0, Math.PI);
/** Tapered trunk profile baked into the geometry so a single instanced batch reads as "chunky tapered". */
export const UNIT_TRUNK = new THREE.CylinderGeometry(0.6, 1, 1, 10);
/** Frustum (not a pointed cone) so a character skirt has a flat waist that can meet a bodice cleanly instead of tapering to a sharp point. */
export const UNIT_SKIRT = new THREE.CylinderGeometry(0.55, 1, 1, 14);
export const UNIT_CONE = new THREE.ConeGeometry(1, 1, 10);
export const UNIT_ICOSA = new THREE.IcosahedronGeometry(1, 0);
export const UNIT_SPHERE = new THREE.SphereGeometry(1, 16, 12);
export const UNIT_CAPSULE = new THREE.CapsuleGeometry(1, 1, 4, 8);
export const UNIT_TORUS = new THREE.TorusGeometry(1, 0.3, 8, 16);
export const UNIT_CIRCLE = new THREE.CircleGeometry(1, 28);
export const UNIT_RING = new THREE.RingGeometry(0.55, 1, 28);
export const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
export const UNIT_TRIANGLE = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, -0.7);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();

/**
 * Recurring DeliBuddies motif: a rounded "parcel swirl" — a thick comma/droplet
 * shape reused as a small sculpted emblem on signage, awnings and planters
 * instead of a flat printed logo. Original silhouette, no reference reuse.
 */
export const UNIT_EMBLEM = (() => {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.5, Math.PI * 0.15, Math.PI * 1.85, false);
  shape.quadraticCurveTo(0.15, -0.05, 0, -0.5);
  shape.quadraticCurveTo(-0.05, -0.12, -0.32, -0.28);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, curveSegments: 10 });
  geometry.translate(0, 0, -0.09);
  geometry.computeVertexNormals();
  return geometry;
})();
