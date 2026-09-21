import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { PlayerPhysics } from './PlayerPhysics';
import { PlayerController } from './PlayerController';
import type { Character } from './Character';
import type { InputSnapshot } from '../input/InputManager';
import type { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import type { CharacterId } from '../config/characters';
import type { PackageEntity } from '../delivery/Package';
import { CarrySystem } from '../delivery/CarrySystem';
import type { PackageDamageSystem } from '../delivery/PackageDamageSystem';

/** Falling this far below the district floor means "off the map" — recover, don't fail the game. */
const KILL_PLANE_Y = -12;
/** How long the player must be grounded before we bank a new "last safe" recovery point. */
const SAFE_POSITION_INTERVAL = 0.3;

/**
 * The controllable player entity: the Stage 3 `Character` (visuals +
 * animation) plus a physics body and controller. `entityId`/`characterId`
 * live on `.character`; this class is the seam Phase 2 would need to spawn
 * more than one of (each with its own PlayerPhysics/PlayerController), not
 * a hardcoded singleton.
 */
export class Player {
  readonly character: Character;
  private readonly physics: PlayerPhysics;
  private readonly controller: PlayerController;
  private readonly lastSafePosition: THREE.Vector3;
  private safeTimer = 0;
  private readonly snapshot: InputSnapshot = { moveX: 0, moveY: 0, running: false, jumpPressed: false, pausePressed: false, cameraDeltaX: 0, cameraDeltaY: 0 };
  private readonly carrySystem = new CarrySystem();
  private carried: PackageEntity | null = null;
  private previousSpeed = 0;
  private readonly damageSystem: PackageDamageSystem;

  constructor(
    physicsWorld: PhysicsWorld,
    character: Character,
    spawnPosition: THREE.Vector3,
    spawnRotationY: number,
    private readonly camera: ThirdPersonCamera,
    damageSystem: PackageDamageSystem
  ) {
    this.damageSystem = damageSystem;
    this.character = character;
    this.character.root.position.copy(spawnPosition);
    this.character.root.rotation.y = spawnRotationY;

    this.physics = new PlayerPhysics(physicsWorld, spawnPosition);
    this.controller = new PlayerController(this.physics, character, camera);
    this.lastSafePosition = spawnPosition.clone();

    camera.reset(this.character.root.position, spawnRotationY);
  }

  get entityId(): string {
    return this.character.entityId;
  }

  get characterId(): CharacterId {
    return this.character.characterId;
  }

  captureInput(snapshot: InputSnapshot): void {
    this.snapshot.moveX = snapshot.moveX;
    this.snapshot.moveY = snapshot.moveY;
    this.snapshot.running = snapshot.running;
    this.snapshot.jumpPressed ||= snapshot.jumpPressed;
    this.camera.applyOrbitDelta(snapshot.cameraDeltaX, snapshot.cameraDeltaY);
  }
  tryAttach(item: PackageEntity): boolean { const ok = this.carrySystem.attach(this.character, item); if (ok) this.carried = item; return ok; }
  getCarriedPackage(): PackageEntity | null { return this.carried; }
  trafficPush(amount: number): void { const p = this.physics.getFootPosition(); p.x += amount; this.physics.teleport(p); this.character.root.position.copy(p); }
  updatePackage(dt: number, damage: PackageDamageSystem): void {
    if (!this.carried) return;
    const speed = this.physics.getHorizontalSpeed();
    damage.applyCollision(this.carried as any, Math.max(0, this.previousSpeed - speed));
    (this.carried as any).update(dt, true, this.character.carryAnchor, Math.abs(speed - this.previousSpeed));
    this.previousSpeed = speed;
  }

  clearInput(): void {
    this.snapshot.jumpPressed = false;
  }

  readonly fixedUpdate = (dt: number): void => {
    const foot = this.physics.getFootPosition();
    const invalid = !Number.isFinite(foot.x) || !Number.isFinite(foot.y) || !Number.isFinite(foot.z);
    if (invalid || foot.y < KILL_PLANE_Y) this.recover();

    this.safeTimer = this.physics.isGrounded() ? this.safeTimer + dt : 0;
    if (this.safeTimer >= SAFE_POSITION_INTERVAL && !invalid) {
      this.lastSafePosition.copy(this.physics.getFootPosition());
      this.safeTimer = 0;
    }
    const fallingSpeed = -this.physics.getVerticalVelocity();
    const wasGrounded = this.physics.isGrounded();
    this.controller.update(dt, this.snapshot);
    if (this.carried && !wasGrounded && this.physics.isGrounded() && fallingSpeed > 0) this.damageSystem.applyLanding(this.carried as any, fallingSpeed);
    this.updatePackage(dt, this.damageSystem);
    this.snapshot.jumpPressed = false;
  };

  render(dt: number, alpha: number): void {
    this.controller.render(dt, alpha);
  }

  /** Restores the player to the last known safe grounded position — used for kill-plane/NaN/stuck recovery, not a game-over. */
  recover(): void {
    this.physics.teleport(this.lastSafePosition);
    this.character.root.position.copy(this.lastSafePosition);
    this.controller.reset();
    this.safeTimer = 0;
    this.clearInput();
  }

  respawnAt(position: THREE.Vector3, rotationY: number): void {
    this.physics.teleport(position);
    this.character.root.position.copy(position);
    this.character.root.rotation.y = rotationY;
    this.lastSafePosition.copy(position);
    this.controller.reset();
    this.safeTimer = 0;
    this.clearInput();
  }

  dispose(): void {
    this.physics.dispose();
  }
}
