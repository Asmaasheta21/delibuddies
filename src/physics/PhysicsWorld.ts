import RAPIER from '@dimforge/rapier3d-compat';

const GRAVITY_Y = -20;
/** Clamp the per-frame delta fed to physics so a backgrounded tab (huge delta on return) can't spiral the simulation. */
const FIXED_STEP = 1 / 60;
const MAX_STEP_DELTA = FIXED_STEP * 5;

/**
 * Thin wrapper around a Rapier `World`. Nothing outside `physics/` and the
 * player/camera modules need Rapier types. At most five 60 Hz steps run per
 * render frame. Intent is resolved before each world step; the returned
 * remainder interpolates rendering without advancing gameplay a second time.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private accumulator = 0;

  private constructor(world: RAPIER.World) {
    this.world = world;
  }

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: GRAVITY_Y, z: 0 });
    return new PhysicsWorld(world);
  }

  advance(delta: number, beforeStep: (dt: number) => void): number {
    this.accumulator = Math.min(this.accumulator + Math.max(0, delta), MAX_STEP_DELTA);
    this.world.timestep = FIXED_STEP;
    while (this.accumulator >= FIXED_STEP) {
      beforeStep(FIXED_STEP);
      this.world.step();
      this.accumulator -= FIXED_STEP;
    }
    return this.accumulator / FIXED_STEP;
  }

  resetTime(): void {
    this.accumulator = 0;
  }

  dispose(): void {
    this.world.free();
  }
}

export { RAPIER };
