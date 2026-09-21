import * as THREE from 'three';
import type { Interactable } from './InteractionTypes';
import type { InputSnapshot } from '../input/InputManager';
import { DELIVERY_CONFIG } from '../config/delivery';

export class InteractionSystem {
  private readonly candidates: Interactable[] = [];
  private target: Interactable | null = null;
  register(item: Interactable): void { if (!this.candidates.includes(item)) this.candidates.push(item); }
  unregister(item: Interactable): void { const i = this.candidates.indexOf(item); if (i >= 0) this.candidates.splice(i, 1); if (this.target === item) this.target = null; }
  update(actorPosition: THREE.Vector3, entityId: string, input: InputSnapshot): Interactable | null {
    let best: Interactable | null = null; let bestDistance: number = DELIVERY_CONFIG.pickupRange;
    for (const candidate of this.candidates) {
      if (!candidate.canInteract(actorPosition)) continue;
      const distance = actorPosition.distanceTo(candidate.interactionPosition);
      if (distance <= bestDistance) { bestDistance = distance; best = candidate; }
    }
    this.target = best;
    if (best && input.interactPressed) best.interact(entityId);
    return best;
  }
  getTarget(): Interactable | null { return this.target; }
}
