import * as THREE from 'three';
import { Character } from './Character';
import { CHARACTER_DEFINITIONS, DEFAULT_CHARACTER_ID, type CharacterId } from '../config/characters';
import { getMaterial, PALETTE, UNIT_CYLINDER, UNIT_RING, type PaletteKey } from '../world/Materials';
import type { WorldLandmarks } from '../world/WorldTypes';

interface StagedEntry {
  character: Character;
  podium: THREE.Group;
  ringMaterial: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  accent: PaletteKey;
}

// z = 33 keeps the staging clear of Stage 2's bakery-plaza props (bench at
// (3, 31), trees at (±8.5, 30/32), lamp at (0, 32)).
const STAGE_POSITIONS: Record<CharacterId, THREE.Vector3> = {
  boy: new THREE.Vector3(-3.2, 0, 33),
  girl: new THREE.Vector3(3.2, 0, 33)
};

/** Characters on stage face +Z; the selection camera sits further south and looks back at them. */
const STAGE_FACING_Y = 0;

/**
 * Owns the temporary 3D presentation used by the character-select screen:
 * two podiums, two idling Character instances, and the selection highlight.
 * `enterStage()`/`confirmSelection()` are idempotent-safe so repeated visits
 * never accumulate duplicate characters or podiums.
 */
export class CharacterSelectionManager {
  private readonly scene: THREE.Scene;
  private readonly staged = new Map<CharacterId, StagedEntry>();
  private isStaged = false;
  private selectedId: CharacterId = DEFAULT_CHARACTER_ID;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  getSelectedId(): CharacterId {
    return this.selectedId;
  }

  /** `initialId` lets the caller sync this manager to an already-restored/persisted selection instead of always defaulting. */
  enterStage(initialId: CharacterId = DEFAULT_CHARACTER_ID): void {
    if (this.isStaged) {
      this.applyHighlight();
      return;
    }
    this.selectedId = initialId;

    for (const id of Object.keys(CHARACTER_DEFINITIONS) as CharacterId[]) {
      const position = STAGE_POSITIONS[id];
      const accent: PaletteKey = id === 'boy' ? 'powderBlue' : 'flowerPink';
      const { group: podium, ring, ringMaterial } = this.buildPodium(accent);
      podium.position.set(position.x, 0, position.z);
      this.scene.add(podium);

      const character = new Character({ entityId: `select-${id}`, characterId: id });
      character.setTransform(position, STAGE_FACING_Y);
      this.scene.add(character.root);

      this.staged.set(id, { character, podium, ringMaterial, ring, accent });
    }

    this.isStaged = true;
    this.applyHighlight();
    this.staged.get(this.selectedId)?.character.animation.playSelectedReaction();
  }

  select(id: CharacterId): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.applyHighlight();
    this.staged.get(id)?.character.animation.playSelectedReaction();
  }

  /** Advances only the staged (selection-screen) characters and their podium rings. */
  updateStage(delta: number): void {
    if (!this.isStaged) return;
    for (const entry of this.staged.values()) {
      entry.character.update(delta);
      entry.ring.rotation.z += delta * 0.25;
    }
  }

  /** Tears down staging, keeping the chosen character and moving it to the given spawn anchor. Returns that character. */
  confirmSelection(landmarks: WorldLandmarks): Character {
    const chosenId = this.selectedId;
    const chosenEntry = this.staged.get(chosenId);
    if (!chosenEntry) {
      throw new Error('[CharacterSelectionManager] confirmSelection called before enterStage');
    }

    for (const [id, entry] of this.staged) {
      this.scene.remove(entry.podium);
      if (id !== chosenId) {
        this.scene.remove(entry.character.root);
      }
    }
    this.staged.clear();
    this.isStaged = false;

    chosenEntry.character.setTransform(
      landmarks.playerSpawnAnchor.position.clone(),
      landmarks.playerSpawnAnchor.rotation.y
    );
    return chosenEntry.character;
  }

  private applyHighlight(): void {
    for (const [id, entry] of this.staged) {
      const active = id === this.selectedId;
      entry.ringMaterial.emissiveIntensity = active ? 0.85 : 0.2;
      entry.ringMaterial.opacity = active ? 0.95 : 0.55;
      entry.podium.scale.setScalar(active ? 1.06 : 1);
    }
  }

  private buildPodium(accent: PaletteKey): { group: THREE.Group; ring: THREE.Mesh; ringMaterial: THREE.MeshStandardMaterial } {
    const group = new THREE.Group();

    const base = new THREE.Mesh(UNIT_CYLINDER, getMaterial('plaza', { roughness: 0.8 }));
    base.scale.set(1.1, 0.22, 1.1);
    base.position.y = 0.11;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // A dedicated (non-cached) material: unlike every other material in the
    // world layer, this one is intentionally mutated per-instance at runtime
    // (highlight toggling), so it must not be the shared getMaterial() cache.
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[accent]),
      roughness: 0.4,
      emissive: new THREE.Color(PALETTE[accent]),
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.55
    });
    const ring = new THREE.Mesh(UNIT_RING, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(0.92);
    ring.position.y = 0.23;
    group.add(ring);

    return { group, ring, ringMaterial };
  }
}
