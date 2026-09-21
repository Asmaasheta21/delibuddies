import * as THREE from 'three';
export interface Interactable {
  readonly interactionId: string;
  readonly displayLabel: string;
  readonly interactionPosition: THREE.Vector3;
  canInteract(actorPosition: THREE.Vector3): boolean;
  interact(entityId: string): boolean;
}
