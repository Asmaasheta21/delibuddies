import type { Character } from '../player/Character';
import type { PackageEntity } from './Package';
export class CarrySystem {
  private readonly carried = new Map<string, PackageEntity>();
  attach(actor: Character, item: PackageEntity): boolean { if (this.carried.has(actor.entityId) || item.state === 'DESTROYED') return false; item.state = 'CARRIED'; item.carrierEntityId = actor.entityId; actor.animation.setCarrying(true); this.carried.set(actor.entityId, item); return true; }
  detach(actor: Character): PackageEntity | null { const item = this.carried.get(actor.entityId) ?? null; if (item) { item.state = 'WORLD'; item.carrierEntityId = null; actor.animation.setCarrying(false); this.carried.delete(actor.entityId); } return item; }
  getCarried(entityId: string): PackageEntity | null { return this.carried.get(entityId) ?? null; }
}
