import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/** All third-person camera tuning in one place. */
export const CAMERA_CONFIG = {
  distance: 6.2,
  minDistance: 0.08,
  focusHeight: 1.3,
  minPitch: THREE.MathUtils.degToRad(10),
  maxPitch: THREE.MathUtils.degToRad(48),
  defaultPitch: THREE.MathUtils.degToRad(20),
  yawSensitivity: 0.0062,
  pitchSensitivity: 0.0042,
  followSmoothTime: 0.1,
  orbitSmoothTime: 0.045,
  /** Faster to pull IN (obstruction appears) than to relax back OUT, so it never snaps through geometry. */
  collisionTightenTime: 0.05,
  collisionRelaxTime: 0.28,
  collisionMargin: 0.3
} as const;

/**
 * Orbit-follow third-person camera. Movement-relative `forward`/`right`
 * vectors are derived from the same `yaw` that positions the camera, so
 * PlayerController and the camera can never disagree about which way is
 * "forward". A sphere cast checks static world colliders and explicitly tagged
 * overhang volumes, excluding the kinematic player. No per-frame mesh traversal.
 */
export class ThirdPersonCamera {
  private yaw = 0;
  private targetYaw = 0;
  private pitch: number = CAMERA_CONFIG.defaultPitch;
  private targetPitch: number = CAMERA_CONFIG.defaultPitch;
  private distanceTarget: number = CAMERA_CONFIG.distance;
  private currentDistance: number = CAMERA_CONFIG.distance;
  private hasFocus = false;

  private readonly smoothedFocus = new THREE.Vector3();
  private readonly scratchTargetFocus = new THREE.Vector3();
  private readonly scratchBehindDir = new THREE.Vector3();
  private readonly ray: RAPIER.Ray;
  private readonly probe = new RAPIER.Ball(0.22);
  private readonly probeRotation = { x: 0, y: 0, z: 0, w: 1 };

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly physics: PhysicsWorld) {
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  }

  /** Forward/right are flattened (ground-plane) and normalized — used by PlayerController for camera-relative movement. */
  getForward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  getRight(out: THREE.Vector3): THREE.Vector3 {
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  applyOrbitDelta(deltaX: number, deltaY: number): void {
    this.targetYaw -= deltaX * CAMERA_CONFIG.yawSensitivity;
    this.targetPitch = THREE.MathUtils.clamp(
      this.targetPitch - deltaY * CAMERA_CONFIG.pitchSensitivity,
      CAMERA_CONFIG.minPitch,
      CAMERA_CONFIG.maxPitch
    );
  }

  /** Call once when the camera starts following a (possibly new) target, so the first frame snaps instead of sweeping in from wherever the camera was. */
  reset(focusRootPosition: THREE.Vector3, yaw: number): void {
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.pitch = CAMERA_CONFIG.defaultPitch;
    this.targetPitch = CAMERA_CONFIG.defaultPitch;
    this.currentDistance = CAMERA_CONFIG.distance;
    this.distanceTarget = CAMERA_CONFIG.distance;
    this.hasFocus = false;
    this.update(0, focusRootPosition);
  }

  update(dt: number, targetRootPosition: THREE.Vector3): void {
    const orbitBlend = dt > 0 ? 1 - Math.exp(-dt / CAMERA_CONFIG.orbitSmoothTime) : 1;
    const yawDifference = Math.atan2(Math.sin(this.targetYaw - this.yaw), Math.cos(this.targetYaw - this.yaw));
    this.yaw += yawDifference * orbitBlend;
    this.pitch += (this.targetPitch - this.pitch) * orbitBlend;
    this.scratchTargetFocus.copy(targetRootPosition);
    this.scratchTargetFocus.y += CAMERA_CONFIG.focusHeight;

    if (!this.hasFocus) {
      this.smoothedFocus.copy(this.scratchTargetFocus);
      this.hasFocus = true;
    } else if (dt > 0) {
      this.smoothedFocus.lerp(this.scratchTargetFocus, 1 - Math.exp(-dt / CAMERA_CONFIG.followSmoothTime));
    } else {
      this.smoothedFocus.copy(this.scratchTargetFocus);
    }

    // Direction from the focus point toward where the camera wants to sit
    // (behind + above the player) — the negative of "forward".
    const cosPitch = Math.cos(this.pitch);
    this.scratchBehindDir.set(-Math.sin(this.yaw) * cosPitch, Math.sin(this.pitch), -Math.cos(this.yaw) * cosPitch);

    this.ray.origin.x = this.smoothedFocus.x;
    this.ray.origin.y = this.smoothedFocus.y;
    this.ray.origin.z = this.smoothedFocus.z;
    this.ray.dir.x = this.scratchBehindDir.x;
    this.ray.dir.y = this.scratchBehindDir.y;
    this.ray.dir.z = this.scratchBehindDir.z;

    const portrait = THREE.MathUtils.clamp(1 - this.camera.aspect, 0, 0.6);
    const desiredDistance = CAMERA_CONFIG.distance + portrait * 1.8;
    let allowedDistance = desiredDistance;
    const hit = this.physics.world.castShape(this.ray.origin, this.probeRotation, this.ray.dir, this.probe, 0, desiredDistance, true, RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
    if (hit) {
      allowedDistance = Math.max(CAMERA_CONFIG.minDistance, hit.time_of_impact - CAMERA_CONFIG.collisionMargin);
    }
    this.distanceTarget = allowedDistance;

    if (dt > 0) {
      const tightening = this.distanceTarget < this.currentDistance;
      const tau = tightening ? CAMERA_CONFIG.collisionTightenTime : CAMERA_CONFIG.collisionRelaxTime;
      this.currentDistance += (this.distanceTarget - this.currentDistance) * (1 - Math.exp(-dt / tau));
    } else {
      this.currentDistance = this.distanceTarget;
    }

    // Damping must never leave the camera beyond the obstruction this frame.
    this.currentDistance = Math.min(this.currentDistance, allowedDistance);

    this.camera.position.copy(this.smoothedFocus).addScaledVector(this.scratchBehindDir, this.currentDistance);
    // Never let the camera dip underground regardless of collision/pitch math.
    if (this.camera.position.y < 0.3) this.camera.position.y = 0.3;
    this.camera.lookAt(this.smoothedFocus);
  }
}
