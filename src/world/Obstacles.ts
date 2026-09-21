import * as THREE from 'three';
import type { PropBatches } from './Props';
import { WorldObjectCategory, type CollidablePlacement } from './WorldTypes';

/**
 * Decorative-but-future-collidable crate clusters. Kept separate from Props.ts
 * because these specifically exist to visually imply obstacles/navigation
 * difficulty (market clutter, alley clutter) rather than pure environmental
 * dressing — Stage 6 will read their placements back out to add real colliders.
 */

export interface CrateClusterSpec {
  positions: Array<{ x: number; z: number; rotationY?: number; scale?: number }>;
}

function crateHalfExtents(scale: number): THREE.Vector3 {
  return new THREE.Vector3(0.35 * scale, 0.35 * scale, 0.35 * scale);
}

export function scatterCrates(
  batches: PropBatches,
  spec: CrateClusterSpec,
  baseY: number
): CollidablePlacement[] {
  const placements: CollidablePlacement[] = [];
  for (const { x, z, rotationY = 0, scale = 1 } of spec.positions) {
    batches.addCrate(x, z, rotationY, scale);
    placements.push({
      position: new THREE.Vector3(x, baseY + 0.35 * scale, z),
      rotationY,
      halfExtents: crateHalfExtents(scale),
      category: WorldObjectCategory.SOLID_PROP
    });
  }
  return placements;
}

/** Market crate clusters flanking the stall corridor — deterministic, no Math.random. */
export function buildMarketCrateSpec(): CrateClusterSpec {
  const positions: CrateClusterSpec['positions'] = [];
  for (let i = 0; i < 6; i += 1) {
    const x = -24 + i * 2.3;
    positions.push({ x, z: i % 2 === 0 ? -8 : 8, rotationY: i * 0.35, scale: 0.9 });
  }
  return { positions };
}

/** Alley crate clutter — staggered left/right to read as a tighter, riskier-feeling shortcut. */
export function buildAlleyCrateSpec(): CrateClusterSpec {
  const positions: CrateClusterSpec['positions'] = [];
  for (let i = 0; i < 8; i += 1) {
    const z = 22 - i * 6;
    const x = -29.5 + (i % 2 === 0 ? -0.6 : 0.6);
    positions.push({ x, z, rotationY: i * 0.5, scale: 0.85 });
  }
  return { positions };
}
