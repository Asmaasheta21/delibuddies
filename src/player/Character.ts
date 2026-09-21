import * as THREE from 'three';
import { buildCharacterRig } from './CharacterFactory';
import { CharacterAnimationController } from './CharacterAnimation';
import type { CharacterId } from '../config/characters';
import { CHARACTER_DEFINITIONS } from '../config/characters';
import type { CharacterInstanceOptions } from './CharacterTypes';

function hashPhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  return (hash / 1000) * Math.PI * 2;
}

/**
 * One spawnable character instance — not a global singleton. Multiple of
 * these can exist at once (e.g. the two staged during selection), each with
 * its own entityId, root transform and animation state, so Stage 4's
 * PlayerController (and eventually Phase 2's networked peers) has a clean
 * per-instance seam to attach to instead of one hardcoded "the player".
 */
export class Character {
  readonly entityId: string;
  readonly characterId: CharacterId;
  readonly root: THREE.Group;
  readonly animation: CharacterAnimationController;
  readonly carryAnchor: THREE.Group;

  constructor(options: CharacterInstanceOptions) {
    this.entityId = options.entityId;
    this.characterId = options.characterId;

    const definition = CHARACTER_DEFINITIONS[options.characterId];
    const rig = buildCharacterRig(definition);
    this.root = rig.root;
    this.root.userData.entityId = options.entityId;
    this.root.userData.characterId = options.characterId;

    this.animation = new CharacterAnimationController(rig, hashPhase(options.entityId));
    this.carryAnchor = rig.carryAnchor;
  }

  setTransform(position: THREE.Vector3, rotationY: number): void {
    this.root.position.copy(position);
    this.root.rotation.y = rotationY;
  }

  update(delta: number): void {
    this.animation.update(delta);
  }
}
