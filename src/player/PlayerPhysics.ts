import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/**
 * All player movement tuning in one place — nothing here is a magic number
 * scattered through PlayerController. Starting values per the Stage 4 brief;
 * meant to be tuned by play-testing against the actual district scale.
 */
export const PLAYER_CONFIG = {
  capsuleRadius: 0.28,
  capsuleHalfHeight: 0.42,
  walkSpeed: 3.6,
  runSpeed: 5.8,
  acceleration: 20,
  deceleration: 24,
  rotationSmoothingTime: 0.11,
  /** Horizontal control is softer while airborne — you can nudge a jump, not redirect it instantly. */
  airControlFactor: 0.55,
  jumpSpeed: 6.4,
  gravity: 20,
  maxFallSpeed: 22,
  coyoteTime: 0.13,
  jumpBufferTime: 0.12,
  autoStepMaxHeight: 0.22,
  autoStepMinWidth: 0.2,
  snapToGroundDistance: 0.25,
  maxSlopeClimbAngleRad: THREE.MathUtils.degToRad(50)
} as const;

export interface PlayerMoveResult {
  grounded: boolean;
  justLanded: boolean;
  verticalVelocity: number;
  position: THREE.Vector3;
}

/**
 * Wraps a Rapier kinematic capsule + `KinematicCharacterController`. Owns
 * gameplay position; `Player`/`Character` visuals follow this, never the
 * other way around. Nothing above this module touches Rapier types directly.
 */
export class PlayerPhysics {
  private readonly world: RAPIER.World;
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;

  private readonly horizontalVelocity = new THREE.Vector2();
  private verticalVelocity = 0;
  private grounded = false;
  private timeSinceGrounded = Infinity;
  private jumpBufferTimer = -1;
  private actualSpeed = 0;
  private readonly position = new THREE.Vector3();
  private readonly feet = new THREE.Vector3();
  private readonly movement = { x: 0, y: 0, z: 0 };
  private readonly result: PlayerMoveResult = { grounded: false, justLanded: false, verticalVelocity: 0, position: this.position };

  constructor(physics: PhysicsWorld, spawnPosition: THREE.Vector3) {
    this.world = physics.world;

    const feetClearance = PLAYER_CONFIG.capsuleHalfHeight + PLAYER_CONFIG.capsuleRadius;
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      spawnPosition.x,
      spawnPosition.y + feetClearance,
      spawnPosition.z
    );
    this.body = this.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(PLAYER_CONFIG.capsuleHalfHeight, PLAYER_CONFIG.capsuleRadius).setFriction(0);
    this.collider = this.world.createCollider(colliderDesc, this.body);

    this.controller = this.world.createCharacterController(0.02);
    this.controller.enableAutostep(PLAYER_CONFIG.autoStepMaxHeight, PLAYER_CONFIG.autoStepMinWidth, true);
    this.controller.enableSnapToGround(PLAYER_CONFIG.snapToGroundDistance);
    this.controller.setMaxSlopeClimbAngle(PLAYER_CONFIG.maxSlopeClimbAngleRad);
    this.controller.setSlideEnabled(true);
    this.controller.setMinSlopeSlideAngle(PLAYER_CONFIG.maxSlopeClimbAngleRad);
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }

  isGrounded(): boolean {
    return this.grounded;
  }

  /** Current (smoothed) horizontal speed, world units/sec — used to drive animation intensity so it tracks actual motion, not raw input. */
  getHorizontalSpeed(): number {
    return this.actualSpeed;
  }
  getVerticalVelocity(): number { return this.verticalVelocity; }

  canJump(): boolean {
    return this.grounded || this.timeSinceGrounded < PLAYER_CONFIG.coyoteTime;
  }

  /** Buffers a jump request for a short window so a press just before landing still triggers. */
  requestJump(): void {
    this.jumpBufferTimer = PLAYER_CONFIG.jumpBufferTime;
  }

  getPosition(): THREE.Vector3 {
    const t = this.body.translation();
    return this.position.set(t.x, t.y, t.z);
  }

  /** Foot-level position (capsule bottom) — what the visual character root should track. */
  getFootPosition(): THREE.Vector3 {
    const t = this.body.translation();
    const clearance = PLAYER_CONFIG.capsuleHalfHeight + PLAYER_CONFIG.capsuleRadius;
    return this.feet.set(t.x, t.y - clearance, t.z);
  }

  /**
   * Advances one physics step. `desiredVelocityXZ` is a world-space
   * horizontal velocity (already camera-relative and walk/run-scaled) —
   * this method only integrates acceleration/gravity/jump and asks Rapier's
   * character controller to resolve collisions against it.
   */
  step(dt: number, desiredVelocityXZ: THREE.Vector2): PlayerMoveResult {
    const wantsToMove = desiredVelocityXZ.lengthSq() > 0;
    const rate = wantsToMove ? PLAYER_CONFIG.acceleration : PLAYER_CONFIG.deceleration;
    const controlFactor = this.grounded ? 1 : PLAYER_CONFIG.airControlFactor;
    const lerpT = 1 - Math.exp(-rate * controlFactor * dt);
    this.horizontalVelocity.x += (desiredVelocityXZ.x - this.horizontalVelocity.x) * lerpT;
    this.horizontalVelocity.y += (desiredVelocityXZ.y - this.horizontalVelocity.y) * lerpT;

    if (this.jumpBufferTimer >= 0) {
      this.jumpBufferTimer -= dt;
      if (this.canJump()) {
        this.verticalVelocity = PLAYER_CONFIG.jumpSpeed;
        this.jumpBufferTimer = -1;
        this.timeSinceGrounded = PLAYER_CONFIG.coyoteTime;
      } else if (this.jumpBufferTimer < 0) {
        this.jumpBufferTimer = -1;
      }
    }

    this.verticalVelocity = Math.max(this.verticalVelocity - PLAYER_CONFIG.gravity * dt, -PLAYER_CONFIG.maxFallSpeed);

    this.movement.x = this.horizontalVelocity.x * dt;
    this.movement.y = this.verticalVelocity * dt;
    this.movement.z = this.horizontalVelocity.y * dt;
    this.controller.computeColliderMovement(this.collider, this.movement, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const computed = this.controller.computedMovement();
    this.actualSpeed = Math.hypot(computed.x, computed.z) / dt;
    if (this.verticalVelocity > 0 && computed.y < this.movement.y - 0.001) this.verticalVelocity = 0;

    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();
    if (this.grounded) {
      this.timeSinceGrounded = 0;
      if (this.verticalVelocity < 0) this.verticalVelocity = -0.5;
    } else {
      this.timeSinceGrounded += dt;
    }

    const current = this.body.translation();
    this.position.set(current.x + computed.x, current.y + computed.y, current.z + computed.z);
    this.body.setNextKinematicTranslation(this.position);
    this.result.grounded = this.grounded;
    this.result.justLanded = this.grounded && !wasGrounded;
    this.result.verticalVelocity = this.verticalVelocity;
    return this.result;
  }

  /** Immediate reposition — spawn and recovery use this, never `step()`. */
  teleport(groundPosition: THREE.Vector3): void {
    const clearance = PLAYER_CONFIG.capsuleHalfHeight + PLAYER_CONFIG.capsuleRadius;
    this.body.setTranslation({ x: groundPosition.x, y: groundPosition.y + clearance, z: groundPosition.z }, true);
    this.body.setNextKinematicTranslation(this.body.translation());
    this.world.updateSceneQueries();
    this.verticalVelocity = 0;
    this.horizontalVelocity.set(0, 0);
    this.grounded = false;
    this.timeSinceGrounded = Infinity;
    this.actualSpeed = 0;
    this.jumpBufferTimer = -1;
  }

  dispose(): void {
    this.world.removeCharacterController(this.controller);
    this.world.removeRigidBody(this.body);
  }
}
