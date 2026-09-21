import * as THREE from 'three';
import type { InputSnapshot } from '../input/InputManager';
import { PLAYER_CONFIG, type PlayerPhysics } from './PlayerPhysics';
import type { Character } from './Character';
import type { ThirdPersonCamera } from '../camera/ThirdPersonCamera';

// Reusable scratch objects — allocated once, reused every frame. Nothing in
// `update()` below allocates.
const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchMoveDir = new THREE.Vector3();
const scratchVelocityXZ = new THREE.Vector2();

/**
 * Turns one frame of InputManager state + camera orientation into physics
 * intent and rig facing. Contains the only movement equations in the
 * project — Game.ts never touches velocity/acceleration/rotation math.
 */
export class PlayerController {
  private facingAngle: number;
  private readonly previousPosition = new THREE.Vector3();
  private readonly currentPosition = new THREE.Vector3();

  constructor(
    private readonly physics: PlayerPhysics,
    private readonly character: Character,
    private readonly camera: ThirdPersonCamera
  ) {
    this.facingAngle = character.root.rotation.y;
    this.reset();
  }

  reset(): void {
    this.facingAngle = this.character.root.rotation.y;
    this.currentPosition.copy(this.character.root.position);
    this.previousPosition.copy(this.currentPosition);
    this.camera.reset(this.currentPosition, this.facingAngle);
  }

  update(dt: number, snapshot: InputSnapshot): void {
    if (snapshot.jumpPressed) {
      this.physics.requestJump();
    }

    this.camera.getForward(scratchForward);
    this.camera.getRight(scratchRight);

    scratchMoveDir.set(0, 0, 0);
    scratchMoveDir.addScaledVector(scratchForward, snapshot.moveY);
    scratchMoveDir.addScaledVector(scratchRight, snapshot.moveX);
    const inputLengthSq = scratchMoveDir.lengthSq();
    if (inputLengthSq > 1) scratchMoveDir.normalize();

    const topSpeed = snapshot.running ? PLAYER_CONFIG.runSpeed : PLAYER_CONFIG.walkSpeed;
    scratchVelocityXZ.set(scratchMoveDir.x * topSpeed, scratchMoveDir.z * topSpeed);

    const result = this.physics.step(dt, scratchVelocityXZ);

    // Face movement direction via shortest-angle interpolation. While
    // stationary, keep whatever facing we already have instead of drifting
    // back toward the camera.
    if (inputLengthSq > 0.0001) {
      const targetAngle = Math.atan2(scratchMoveDir.x, scratchMoveDir.z);
      const delta = Math.atan2(Math.sin(targetAngle - this.facingAngle), Math.cos(targetAngle - this.facingAngle));
      this.facingAngle += delta * (1 - Math.exp(-dt / PLAYER_CONFIG.rotationSmoothingTime));
    }

    this.previousPosition.copy(this.currentPosition);
    this.currentPosition.copy(result.position);
    this.currentPosition.y -= PLAYER_CONFIG.capsuleHalfHeight + PLAYER_CONFIG.capsuleRadius;
    this.character.root.rotation.y = this.facingAngle;

    this.character.animation.updateLocomotion(dt, {
      planarSpeed: this.physics.getHorizontalSpeed(),
      topSpeed,
      isRunning: snapshot.running,
      grounded: result.grounded,
      verticalVelocity: result.verticalVelocity,
      justLanded: result.justLanded
    });

  }

  render(dt: number, alpha: number): void {
    this.character.root.position.lerpVectors(this.previousPosition, this.currentPosition, alpha);
    this.camera.update(dt, this.character.root.position);
  }
}
