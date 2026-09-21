export interface InputSnapshot {
  /** -1..1, A/D or joystick X. */
  moveX: number;
  /** -1..1, W/S or joystick Y (positive = forward). */
  moveY: number;
  running: boolean;
  /** True only on the frame the jump input transitioned from up to down. */
  jumpPressed: boolean;
  /** True only on the frame Escape transitioned from up to down. */
  pausePressed: boolean;
  interactPressed?: boolean;
  /** Accumulated pointer drag since the last `consume()`, in pixels. */
  cameraDeltaX: number;
  cameraDeltaY: number;
}

/**
 * Centralizes every raw input source (keyboard, pointer drag, and whatever
 * `MobileControls` pushes in) behind one per-frame snapshot. No other module
 * adds its own `keydown`/`pointermove` listener — PlayerController and the
 * camera only ever read `consume()`.
 */
export class InputManager {
  private readonly keys = new Set<string>();
  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualRunning = false;
  private virtualJumpQueued = false;

  private dragPointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private cameraDeltaX = 0;
  private cameraDeltaY = 0;

  private pauseQueued = false;
  private interactQueued = false;

  constructor(private readonly dragSurface: HTMLElement) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.dragSurface.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    this.dragSurface.addEventListener('lostpointercapture', this.handlePointerUp);
    window.addEventListener('blur', this.reset);
  }

  readonly reset = (): void => {
    this.keys.clear();
    this.virtualMoveX = this.virtualMoveY = 0;
    this.virtualRunning = this.virtualJumpQueued = false;
    this.cameraDeltaX = this.cameraDeltaY = 0;
    this.pauseQueued = false;
    this.interactQueued = false;
    if (this.dragPointerId !== null && this.dragSurface.hasPointerCapture(this.dragPointerId)) this.dragSurface.releasePointerCapture(this.dragPointerId);
    this.dragPointerId = null;
  };

  /** Pushed by MobileControls; merged with keyboard state (keyboard wins if both are active). */
  setVirtualMove(x: number, y: number): void {
    this.virtualMoveX = x;
    this.virtualMoveY = y;
  }

  setVirtualRunning(running: boolean): void {
    this.virtualRunning = running;
  }

  queueVirtualJump(): void {
    this.virtualJumpQueued = true;
  }
  queueVirtualInteract(): void { this.interactQueued = true; }

  addCameraDelta(dx: number, dy: number): void {
    this.cameraDeltaX += dx;
    this.cameraDeltaY += dy;
  }

  /** Call exactly once per frame. Resets edge-triggered/accumulated fields. */
  consume(): InputSnapshot {
    const keyboardX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const keyboardY = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const moveX = keyboardX !== 0 ? keyboardX : this.virtualMoveX;
    const moveY = keyboardY !== 0 ? keyboardY : this.virtualMoveY;

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.virtualRunning;

    const jumpPressed = this.virtualJumpQueued;
    this.virtualJumpQueued = false;

    const pausePressed = this.pauseQueued;
    this.pauseQueued = false;
    const interactPressed = this.interactQueued;
    this.interactQueued = false;

    const snapshot: InputSnapshot = {
      moveX,
      moveY,
      running,
      jumpPressed,
      pausePressed,
      interactPressed,
      cameraDeltaX: this.cameraDeltaX,
      cameraDeltaY: this.cameraDeltaY
    };
    this.cameraDeltaX = 0;
    this.cameraDeltaY = 0;
    return snapshot;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space') event.preventDefault();
    if (event.repeat || this.keys.has(event.code)) return;
    if (event.code === 'Space') this.virtualJumpQueued = true;
    if (event.code === 'Escape') this.pauseQueued = true;
    if (event.code === 'KeyE') this.interactQueued = true;
    this.keys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.dragPointerId !== null || event.button !== 0) return;
    event.preventDefault();
    this.dragPointerId = event.pointerId;
    this.dragSurface.setPointerCapture(event.pointerId);
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return;
    this.cameraDeltaX += event.clientX - this.lastPointerX;
    this.cameraDeltaY += event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return;
    if (this.dragSurface.hasPointerCapture(event.pointerId)) this.dragSurface.releasePointerCapture(event.pointerId);
    this.dragPointerId = null;
  };

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.dragSurface.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.dragSurface.removeEventListener('lostpointercapture', this.handlePointerUp);
    window.removeEventListener('blur', this.reset);
  }
}
