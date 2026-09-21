import type { InputManager } from './InputManager';

const MAX_RADIUS = 46;
const DEAD_ZONE = 0.16;

/**
 * Touch-only controls: a draggable analog joystick (left) and jump/run
 * buttons (right). All of it just calls into the same `InputManager` desktop
 * input already feeds — PlayerController never knows which input source is
 * active. Camera drag on mobile falls out for free: the joystick/buttons are
 * DOM elements that intercept touches in their own corners, so any other
 * touch on the canvas already reaches InputManager's own pointer listener.
 */
export class MobileControls {
  private readonly joystickBase: HTMLElement;
  private readonly joystickThumb: HTMLElement;
  private readonly jumpButton: HTMLElement;
  private readonly runButton: HTMLElement;
  private readonly interactButton: HTMLElement;

  private activePointerId: number | null = null;
  private baseCenterX = 0;
  private baseCenterY = 0;
  private running = false;

  constructor(private readonly input: InputManager, root: HTMLElement) {
    const joystickBase = root.querySelector<HTMLElement>('#mobile-joystick-base');
    const joystickThumb = root.querySelector<HTMLElement>('#mobile-joystick-thumb');
    const jumpButton = root.querySelector<HTMLElement>('#mobile-jump-button');
    const runButton = root.querySelector<HTMLElement>('#mobile-run-button');
    const interactButton = root.querySelector<HTMLElement>('#mobile-interact-button');
    if (!joystickBase || !joystickThumb || !jumpButton || !runButton || !interactButton) {
      throw new Error('[MobileControls] missing required elements in index.html');
    }
    this.joystickBase = joystickBase;
    this.joystickThumb = joystickThumb;
    this.jumpButton = jumpButton;
    this.runButton = runButton;
    this.interactButton = interactButton;

    this.joystickBase.addEventListener('pointerdown', this.handleJoystickDown);
    window.addEventListener('pointermove', this.handleJoystickMove);
    window.addEventListener('pointerup', this.handleJoystickUp);
    window.addEventListener('pointercancel', this.handleJoystickUp);

    this.jumpButton.addEventListener('pointerdown', this.handleJumpDown);
    this.runButton.addEventListener('pointerdown', this.handleRunDown);
    this.interactButton.addEventListener('pointerdown', this.handleInteractDown);
    this.joystickBase.addEventListener('lostpointercapture', this.handleJoystickUp);
    window.addEventListener('blur', this.reset);
    window.addEventListener('resize', this.reset);
  }

  readonly reset = (): void => {
    if (this.activePointerId !== null && this.joystickBase.hasPointerCapture(this.activePointerId)) this.joystickBase.releasePointerCapture(this.activePointerId);
    this.activePointerId = null;
    this.joystickThumb.style.transform = 'translate(-50%, -50%)';
    this.input.setVirtualMove(0, 0);
    this.running = false;
    this.input.setVirtualRunning(false);
    this.runButton.classList.remove('is-active');
    this.runButton.setAttribute('aria-pressed', 'false');
  };

  dispose(): void {
    this.joystickBase.removeEventListener('pointerdown', this.handleJoystickDown);
    window.removeEventListener('pointermove', this.handleJoystickMove);
    window.removeEventListener('pointerup', this.handleJoystickUp);
    window.removeEventListener('pointercancel', this.handleJoystickUp);
    this.jumpButton.removeEventListener('pointerdown', this.handleJumpDown);
    this.runButton.removeEventListener('pointerdown', this.handleRunDown);
    this.interactButton.removeEventListener('pointerdown', this.handleInteractDown);
    this.joystickBase.removeEventListener('lostpointercapture', this.handleJoystickUp);
    window.removeEventListener('blur', this.reset);
    window.removeEventListener('resize', this.reset);
  }

  private readonly handleJoystickDown = (event: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    event.preventDefault();
    event.stopPropagation();
    this.activePointerId = event.pointerId;
    this.joystickBase.setPointerCapture(event.pointerId);
    const rect = this.joystickBase.getBoundingClientRect();
    this.baseCenterX = rect.left + rect.width / 2;
    this.baseCenterY = rect.top + rect.height / 2;
    this.updateFromPointer(event.clientX, event.clientY);
  };

  private readonly handleJoystickMove = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) return;
    event.preventDefault();
    this.updateFromPointer(event.clientX, event.clientY);
  };

  private readonly handleJoystickUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) return;
    if (this.joystickBase.hasPointerCapture(event.pointerId)) this.joystickBase.releasePointerCapture(event.pointerId);
    this.activePointerId = null;
    this.joystickThumb.style.transform = 'translate(-50%, -50%)';
    this.input.setVirtualMove(0, 0);
  };

  private updateFromPointer(clientX: number, clientY: number): void {
    const dx = clientX - this.baseCenterX;
    const dy = clientY - this.baseCenterY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;
    this.joystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;

    let normX = (clampedDist / MAX_RADIUS) * Math.cos(angle);
    let normY = (clampedDist / MAX_RADIUS) * Math.sin(angle);
    if (Math.hypot(normX, normY) < DEAD_ZONE) {
      normX = 0;
      normY = 0;
    }
    // Screen Y grows downward; pushing the thumb UP means "forward".
    this.input.setVirtualMove(normX, -normY);
  }

  private readonly handleJumpDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.input.queueVirtualJump();
  };

  private readonly handleRunDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.running = !this.running;
    this.input.setVirtualRunning(this.running);
    this.runButton.classList.toggle('is-active', this.running);
    this.runButton.setAttribute('aria-pressed', String(this.running));
  };

  private readonly handleInteractDown = (event: PointerEvent): void => { event.preventDefault(); this.input.queueVirtualInteract(); };
}
