import { CharacterAnimationState, type CharacterRig, type LocomotionInput } from './CharacterTypes';

const SELECTED_REACTION_DURATION = 0.9;
const LAND_DURATION = 0.16;
const JUMP_POSE_DURATION = 0.22;

/** Speed (0..1 normalized) below which the character is considered stationary for animation purposes. */
const IDLE_SPEED_THRESHOLD = 0.06;
/** Actual speed above which WALK becomes RUN (only relevant while grounded). */
const RUN_SPEED_THRESHOLD = 4.2;

/** Exponential smoothing factor, frame-rate independent: how much of the way from current to target to move this frame. */
function smoothing(delta: number, timeConstant: number): number {
  return 1 - Math.exp(-delta / timeConstant);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Drives the procedural rig built by CharacterFactory. IDLE and the one-shot
 * SELECTED reaction are Stage 3's; `updateLocomotion` (Stage 4) adds
 * WALK/RUN/JUMP/FALL/LAND on the same rig and phase clock, driven by facts
 * PlayerController computes (speed, grounded, vertical velocity) rather than
 * raw input — so animation state always follows actual movement, not keys.
 */
export class CharacterAnimationController {
  private state: CharacterAnimationState = CharacterAnimationState.IDLE;
  private time = 0;
  private reactionElapsed = 0;
  private landElapsed = 0;
  private jumpElapsed = 0;
  /** Continuous gait phase — advances only while grounded and moving, so switching walk<->run never jumps the cycle. */
  private gaitPhase = 0;
  private readonly phase: number;

  // Current (smoothed) joint values, blended toward each frame's target pose
  // instead of snapping — this is what actually gets written to the rig.
  private bodyBounce = 0;
  private bodyLean = 0;
  private headTiltX = 0;
  private headTiltZ = 0;
  private headTurnY = 0;
  private leftArmX = 0;
  private rightArmX = 0;
  private rightArmZ = 0;
  private leftLegX = 0;
  private rightLegX = 0;
  private backpackX = 0;
  private scaleY = 1;
  private scaleXZ = 1;

  constructor(private readonly rig: CharacterRig, phaseSeed: number) {
    // Deterministic per-character phase offset (from entityId hash) so two
    // idling characters never bob in perfect lockstep.
    this.phase = phaseSeed;
  }

  getState(): CharacterAnimationState {
    return this.state;
  }

  /** Plays a brief hop/wave reaction, then automatically returns to IDLE. Used only pre-gameplay (character select). */
  playSelectedReaction(): void {
    this.state = CharacterAnimationState.SELECTED;
    this.reactionElapsed = 0;
  }

  /** Stage 3 entry point: idle/selected only, used while a character is staged (not yet a controllable player). */
  update(delta: number): void {
    this.time += delta;
    const t = this.time + this.phase;

    if (this.state === CharacterAnimationState.SELECTED) {
      this.reactionElapsed += delta;
      this.applySelectedReaction(this.reactionElapsed);
      if (this.reactionElapsed >= SELECTED_REACTION_DURATION) {
        this.state = CharacterAnimationState.IDLE;
      }
      return;
    }

    this.applyIdleTargets(t, 1);
    this.commitToRig();
  }

  /** Stage 4 entry point: full locomotion state machine, called every frame once a character becomes the player. */
  updateLocomotion(delta: number, input: LocomotionInput): void {
    this.time += delta;
    const t = this.time + this.phase;
    const normalizedSpeed = input.topSpeed > 0 ? Math.min(1, input.planarSpeed / input.topSpeed) : 0;

    const nextState = this.resolveState(input, normalizedSpeed);
    if (nextState !== this.state) {
      if (nextState === CharacterAnimationState.LAND) this.landElapsed = 0;
      if (nextState === CharacterAnimationState.JUMP) this.jumpElapsed = 0;
      this.state = nextState;
    }

    if (input.grounded && normalizedSpeed > IDLE_SPEED_THRESHOLD) {
      // Cycle speed scales with actual speed so feet/arms roughly match
      // ground speed instead of sliding — full-speed run cycles noticeably
      // faster than a walk.
      const stride = this.state === CharacterAnimationState.RUN ? 1.65 : 1.3;
      this.gaitPhase += delta * input.planarSpeed * Math.PI * 2 / stride;
    }

    switch (this.state) {
      case CharacterAnimationState.WALK:
        this.applyWalkTargets(this.gaitPhase, false);
        break;
      case CharacterAnimationState.RUN:
        this.applyWalkTargets(this.gaitPhase, true);
        break;
      case CharacterAnimationState.JUMP:
        this.jumpElapsed += delta;
        this.applyJumpTargets(this.jumpElapsed);
        break;
      case CharacterAnimationState.FALL:
        this.applyFallTargets(t);
        break;
      case CharacterAnimationState.LAND:
        this.landElapsed += delta;
        this.applyLandTargets(this.landElapsed);
        break;
      default:
        this.applyIdleTargets(t, 1);
        break;
    }

    if (this.carrying) {
      this.targetLeftArmX = -0.72;
      this.targetRightArmX = -0.72;
      this.targetRightArmZ = 0.08;
      this.targetBodyLean *= 0.65;
      this.targetBackpackX *= 0.7;
    }
    this.commitToRig(delta);
  }

  private resolveState(input: LocomotionInput, normalizedSpeed: number): CharacterAnimationState {
    if (!input.grounded) {
      return input.verticalVelocity > 0.5 ? CharacterAnimationState.JUMP : CharacterAnimationState.FALL;
    }
    if (input.justLanded) return CharacterAnimationState.LAND;
    if (this.state === CharacterAnimationState.LAND && this.landElapsed < LAND_DURATION) return CharacterAnimationState.LAND;
    if (normalizedSpeed <= IDLE_SPEED_THRESHOLD) return CharacterAnimationState.IDLE;
    return input.planarSpeed >= RUN_SPEED_THRESHOLD ? CharacterAnimationState.RUN : CharacterAnimationState.WALK;
  }

  // --- Target pose functions: pure(ish) functions of phase/time that set --
  // --- `target*` local variables, applied via commitToRig()'s smoothing. --

  private targetBodyBounce = 0;
  private targetBodyLean = 0;
  private targetHeadTiltX = 0;
  private targetHeadTiltZ = 0;
  private targetHeadTurnY = 0;
  private targetLeftArmX = 0;
  private targetRightArmX = 0;
  private targetRightArmZ = 0;
  private targetLeftLegX = 0;
  private targetRightLegX = 0;
  private targetBackpackX = 0;
  private targetScaleY = 1;
  private targetScaleXZ = 1;
  private carrying = false;

  setCarrying(carrying: boolean): void { this.carrying = carrying; }

  private applyIdleTargets(t: number, _intensity: number): void {
    this.targetBodyBounce = Math.sin(t * 1.6) * 0.015;
    this.targetBodyLean = 0;
    this.targetHeadTurnY = Math.sin(t * 0.6) * 0.09;
    this.targetHeadTiltZ = Math.sin(t * 0.9 + 1.3) * 0.025;
    this.targetHeadTiltX = 0;

    const armSwing = Math.sin(t * 0.7) * 0.06;
    const gesture = Math.max(0, Math.sin(t * 0.35)) ** 6 * 0.5;
    this.targetLeftArmX = -armSwing;
    this.targetRightArmX = armSwing - gesture;
    this.targetRightArmZ = gesture * 0.4;
    this.targetLeftLegX = 0;
    this.targetRightLegX = 0;

    this.targetBackpackX = Math.sin(t * 1.6 - 0.4) * 0.05;
    this.targetScaleY = 1;
    this.targetScaleXZ = 1;
  }

  private applyWalkTargets(phase: number, running: boolean): void {
    const legAmp = running ? 0.85 : 0.5;
    const armAmp = running ? 0.95 : 0.42;
    const bounceAmp = running ? 0.07 : 0.03;
    const swing = Math.sin(phase);

    this.targetLeftLegX = swing * legAmp;
    this.targetRightLegX = -swing * legAmp;
    // Opposite-arm swing: right arm forward when left leg forward, and vice versa.
    this.targetLeftArmX = -swing * armAmp;
    this.targetRightArmX = swing * armAmp;
    this.targetRightArmZ = 0;

    this.targetBodyBounce = Math.abs(Math.sin(phase)) * bounceAmp;
    this.targetBodyLean = running ? 0.14 : 0.04;
    this.targetHeadTurnY = 0;
    this.targetHeadTiltZ = Math.sin(phase) * (running ? 0.015 : 0.02);
    this.targetHeadTiltX = -this.targetBodyLean * 0.4;

    this.targetBackpackX = Math.sin(phase - 0.5) * (running ? 0.22 : 0.12) + this.targetBodyLean * 0.5;
    this.targetScaleY = 1;
    this.targetScaleXZ = 1;
  }

  private applyJumpTargets(elapsed: number): void {
    const t = Math.min(1, elapsed / JUMP_POSE_DURATION);
    // Legs tuck up briefly at takeoff, then ease back toward neutral.
    const tuck = (1 - t) * 0.5;
    this.targetLeftLegX = tuck;
    this.targetRightLegX = tuck;
    this.targetLeftArmX = -0.6 * (1 - t) - 0.15;
    this.targetRightArmX = -0.6 * (1 - t) - 0.15;
    this.targetRightArmZ = 0.15;
    this.targetBodyLean = 0;
    this.targetBodyBounce = 0;
    this.targetHeadTiltX = -0.1;
    this.targetHeadTiltZ = 0;
    this.targetHeadTurnY = 0;
    this.targetScaleY = 1 + (1 - t) * 0.08;
    this.targetScaleXZ = 1 - (1 - t) * 0.04;
    this.targetBackpackX = -0.15;
  }

  private applyFallTargets(t: number): void {
    this.targetLeftLegX = 0.18 + Math.sin(t * 2) * 0.03;
    this.targetRightLegX = 0.18 - Math.sin(t * 2) * 0.03;
    this.targetLeftArmX = -0.3;
    this.targetRightArmX = -0.3;
    this.targetRightArmZ = 0.35;
    this.targetBodyLean = -0.05;
    this.targetBodyBounce = 0;
    this.targetHeadTiltX = 0.08;
    this.targetHeadTiltZ = 0;
    this.targetHeadTurnY = 0;
    this.targetScaleY = 0.98;
    this.targetScaleXZ = 1.01;
    this.targetBackpackX = 0.2;
  }

  private applyLandTargets(elapsed: number): void {
    const t = Math.min(1, elapsed / LAND_DURATION);
    const dip = (1 - t) * 0.3;
    this.targetLeftLegX = dip;
    this.targetRightLegX = dip;
    this.targetLeftArmX = dip * 0.5;
    this.targetRightArmX = dip * 0.5;
    this.targetRightArmZ = 0;
    this.targetBodyLean = 0;
    this.targetBodyBounce = -dip * 0.4;
    this.targetHeadTiltX = dip * 0.3;
    this.targetHeadTiltZ = 0;
    this.targetHeadTurnY = 0;
    this.targetScaleY = 1 - dip * 0.5;
    this.targetScaleXZ = 1 + dip * 0.25;
    this.targetBackpackX = -dip * 0.3;
  }

  private applySelectedReaction(elapsed: number): void {
    const { bodyPivot, headPivot, rightArmPivot, backpack, root } = this.rig;
    const t = elapsed / SELECTED_REACTION_DURATION;

    const hop = Math.abs(Math.sin(t * Math.PI * 2.2)) * (1 - t) * 0.22;
    bodyPivot.position.y = hop;
    const squash = 1 - Math.min(0.14, hop * 0.6);
    root.scale.set(1 + (1 - squash) * 0.5, squash + (1 - squash) * 0.2, 1 + (1 - squash) * 0.5);

    headPivot.rotation.z = Math.sin(t * Math.PI * 4) * 0.12 * (1 - t);

    rightArmPivot.rotation.x = -1.9 + Math.sin(t * Math.PI * 6) * 0.35;
    rightArmPivot.rotation.z = 0.3;

    backpack.rotation.x = Math.sin(t * Math.PI * 4 - 0.3) * 0.1;
  }

  /** Blends joint values toward the targets, then writes them to the rig. */
  private commitToRig(delta = 1 / 60): void {
    const fast = smoothing(delta, 0.06);
    const medium = smoothing(delta, 0.1);
    const slow = smoothing(delta, 0.22);

    this.bodyBounce = lerp(this.bodyBounce, this.targetBodyBounce, medium);
    this.bodyLean = lerp(this.bodyLean, this.targetBodyLean, slow);
    this.headTiltX = lerp(this.headTiltX, this.targetHeadTiltX, medium);
    this.headTiltZ = lerp(this.headTiltZ, this.targetHeadTiltZ, medium);
    this.headTurnY = lerp(this.headTurnY, this.targetHeadTurnY, slow);
    this.leftArmX = lerp(this.leftArmX, this.targetLeftArmX, fast);
    this.rightArmX = lerp(this.rightArmX, this.targetRightArmX, fast);
    this.rightArmZ = lerp(this.rightArmZ, this.targetRightArmZ, fast);
    this.leftLegX = lerp(this.leftLegX, this.targetLeftLegX, fast);
    this.rightLegX = lerp(this.rightLegX, this.targetRightLegX, fast);
    this.backpackX = lerp(this.backpackX, this.targetBackpackX, slow);
    this.scaleY = lerp(this.scaleY, this.targetScaleY, fast);
    this.scaleXZ = lerp(this.scaleXZ, this.targetScaleXZ, fast);

    const { root, bodyPivot, headPivot, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, backpack } = this.rig;
    bodyPivot.position.y = this.bodyBounce;
    bodyPivot.rotation.x = this.bodyLean;
    headPivot.rotation.x = this.headTiltX;
    headPivot.rotation.y = this.headTurnY;
    headPivot.rotation.z = this.headTiltZ;
    leftArmPivot.rotation.x = this.leftArmX;
    rightArmPivot.rotation.x = this.rightArmX;
    rightArmPivot.rotation.z = this.rightArmZ;
    leftLegPivot.rotation.x = this.leftLegX;
    rightLegPivot.rotation.x = this.rightLegX;
    backpack.rotation.x = this.backpackX;
    root.scale.set(this.scaleXZ, this.scaleY, this.scaleXZ);
  }
}
