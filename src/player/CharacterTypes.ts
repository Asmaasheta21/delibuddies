import * as THREE from 'three';
import type { CharacterId } from '../config/characters';

/**
 * Selection and physics-driven locomotion share the same procedural rig.
 */
export enum CharacterAnimationState {
  IDLE = 'IDLE',
  SELECTED = 'SELECTED',
  WALK = 'WALK',
  RUN = 'RUN',
  JUMP = 'JUMP',
  FALL = 'FALL',
  LAND = 'LAND'
}

/**
 * The procedural rig's named parts, exposed so the animation controller can
 * drive them without reaching into arbitrary scene-graph children. Every
 * group's local origin is its own pivot point (e.g. armPivot rotates the
 * whole arm from the shoulder).
 */
export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  backpack: THREE.Group;
  carryAnchor: THREE.Group;
}

/** Per-frame locomotion facts the animation controller needs to pick/blend a pose. Computed by PlayerController, not by physics or rendering code directly. */
export interface LocomotionInput {
  /** Current horizontal speed in world units/sec. */
  planarSpeed: number;
  /** The controller's current top speed (walk or run target) — used to normalize planarSpeed into a 0..1 cycle intensity. */
  topSpeed: number;
  isRunning: boolean;
  grounded: boolean;
  verticalVelocity: number;
  /** True for exactly the frame ground contact was (re)acquired after being airborne. */
  justLanded: boolean;
  carrying?: boolean;
}

/** A unique, spawnable instance — not a global singleton — so Phase 2 can hold many of these under different entity ids. */
export interface CharacterInstanceOptions {
  entityId: string;
  characterId: CharacterId;
}
