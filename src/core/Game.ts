import * as THREE from 'three';
import { EventBus } from './EventBus';
import { GameState, VALID_TRANSITIONS, type GameEvents } from './GameState';
import { City } from '../world/City';
import { FOG_FAR, FOG_NEAR, SKY_COLOR } from '../world/Environment';
import { CharacterSelectionManager } from '../player/CharacterSelectionManager';
import { Player } from '../player/Player';
import type { CharacterId } from '../config/characters';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { buildStaticColliders } from '../physics/ColliderBuilder';
import { InputManager } from '../input/InputManager';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { CakePackage } from '../delivery/CakePackage';
import { PackageDamageSystem } from '../delivery/PackageDamageSystem';
import { ObstacleSystem } from '../obstacles/ObstacleSystem';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { NPCSystem } from '../npc/NPCSystem';
import { DeliveryZone } from '../delivery/DeliveryZone';
import { CakeDeliveryMission } from '../missions/CakeDeliveryMission';

const BASE_FOV_DEGREES = 50;

/**
 * Central orchestrator: owns the renderer/scene/camera/loop, the physics
 * world lifecycle, and gate-keeps `GameState` transitions. All movement
 * equations live in `PlayerController`; all camera follow/orbit/collision
 * math lives in `ThirdPersonCamera` — Game only calls `.step()`/`.update()`
 * on them in the right order each frame.
 */
export class Game {
  readonly events = new EventBus<GameEvents>();

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();

  private readonly physicsWorld: PhysicsWorld;
  private readonly inputManager: InputManager;
  private readonly thirdPersonCamera: ThirdPersonCamera;

  private state: GameState = GameState.BOOT;
  private animationHandle = 0;
  private disposed = false;
  private readonly city: City;
  private readonly characterSelection: CharacterSelectionManager;
  private player: Player | null = null;
  private readonly interaction = new InteractionSystem();
  private readonly damageSystem = new PackageDamageSystem();
  private readonly cake: CakePackage;
  private readonly obstacles = new ObstacleSystem();
  private readonly traffic = new TrafficSystem();
  private readonly npcs = new NPCSystem();
  private readonly deliveryZone: DeliveryZone;
  readonly mission = new CakeDeliveryMission();

  constructor(canvas: HTMLCanvasElement, physicsWorld: PhysicsWorld) {
    this.canvas = canvas;
    this.physicsWorld = physicsWorld;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Warm, slightly filmic response instead of the flat default linear
    // output — this alone does a lot of the "sunny and delicious" lift.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR);

    // Default/MAIN_MENU camera: an elevated district overview. CHARACTER_SELECT
    // has its own fixed framing below; PLAYING hands the same THREE.Camera
    // object to `thirdPersonCamera`, which drives it every frame instead.
    this.camera = new THREE.PerspectiveCamera(BASE_FOV_DEGREES, 1, 0.1, 300);
    this.camera.position.set(-16, 15, 30);
    this.camera.lookAt(0, 1.5, 6);

    this.inputManager = new InputManager(this.canvas);
    this.thirdPersonCamera = new ThirdPersonCamera(this.camera, physicsWorld);

    this.city = new City();
    this.scene.add(this.city.root);
    const cakePosition = this.city.landmarks.bakeryPickupAnchor.position.clone(); cakePosition.x += 1.1; cakePosition.y = 0.16;
    this.cake = new CakePackage('cake-001', cakePosition); this.scene.add(this.cake.root); this.interaction.register(this.cake);
    this.scene.add(this.obstacles.root, this.traffic.root, this.npcs.root);
    buildStaticColliders(physicsWorld, this.obstacles.getCollidables());
    physicsWorld.world.updateSceneQueries();
    this.deliveryZone = new DeliveryZone(this.city.landmarks.deliveryDestinationAnchor.position); this.interaction.register(this.deliveryZone);
    buildStaticColliders(physicsWorld, this.city.getCollidablePlacements());
    buildStaticColliders(physicsWorld, this.city.getGroundPlacements());
    physicsWorld.world.updateSceneQueries();

    this.characterSelection = new CharacterSelectionManager(this.scene);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  getCity(): City {
    return this.city;
  }

  getInputManager(): InputManager {
    return this.inputManager;
  }

  getPlayer(): Player | null {
    return this.player;
  }

  /** Live-updates the 3D highlight/reaction on stage — does not change game state. */
  selectCharacterOnStage(id: CharacterId): void {
    this.characterSelection.select(id);
  }

  /** MAIN_MENU -> CHARACTER_SELECT: frames the staging area and stages both characters. */
  enterCharacterSelect(initialId: CharacterId): void {
    if (!this.setState(GameState.CHARACTER_SELECT)) return;
    this.characterSelection.enterStage(initialId);
    this.setCameraToCharacterSelect();
  }

  /**
   * CHARACTER_SELECT -> PLAYING: tears down staging, spawns the chosen
   * character at the world's playerSpawnAnchor as a real controllable
   * `Player` (physics + controller + third-person camera), and enters
   * PLAYING. This is the only place a `Player` is constructed.
   */
  confirmCharacterSelectionAndPlay(): void {
    const chosen = this.characterSelection.confirmSelection(this.city.landmarks);
    const spawnAnchor = this.city.landmarks.playerSpawnAnchor;
    this.player = new Player(
      this.physicsWorld,
      chosen,
      spawnAnchor.position.clone(),
      spawnAnchor.rotation.y,
      this.thirdPersonCamera
      ,this.damageSystem
    );
    this.setState(GameState.PLAYING);
  }
  retryMission(): void { if (this.player) this.player.respawnAt(this.city.landmarks.playerSpawnAnchor.position.clone(), this.city.landmarks.playerSpawnAnchor.rotation.y); this.cake.reset(this.city.landmarks.bakeryPickupAnchor.position.clone().setX(this.city.landmarks.bakeryPickupAnchor.position.x+1.1)); this.deliveryZone.reset(); this.traffic.reset(); this.npcs.reset(); this.mission.reset(); this.setState(GameState.PLAYING); }

  private setCameraToCharacterSelect(): void {
    this.camera.position.set(0, 3.6, 41);
    this.camera.lookAt(0, 1.4, 33);
  }

  private readonly handleResize = (): void => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.aspect = aspect;
    // `fov` is vertical field of view, so a fixed-framing shot (character
    // select) loses horizontal coverage on tall/narrow (portrait mobile)
    // viewports. Widen vertical FOV as aspect narrows so horizontal coverage
    // stays roughly constant; desktop aspects (>=1) are unaffected. The
    // gameplay third-person camera additionally compensates via its own
    // distance/framing (see ThirdPersonCamera), so portrait play never
    // degenerates into severe fisheye.
    const gameplay = this.state === GameState.PLAYING || this.state === GameState.PAUSED;
    this.camera.fov = gameplay ? (aspect < 1 ? 58 : 50) : (aspect < 1 ? Math.min(78, BASE_FOV_DEGREES / aspect) : BASE_FOV_DEGREES);
    this.camera.updateProjectionMatrix();
  };

  getState(): GameState {
    return this.state;
  }

  setState(next: GameState): boolean {
    if (next === this.state) return false;
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      console.warn(`[Game] blocked invalid state transition ${this.state} -> ${next}`);
      return false;
    }
    const from = this.state;
    this.state = next;
    this.physicsWorld.resetTime();
    this.clock.getDelta();
    this.inputManager.reset();
    this.player?.clearInput();
    this.handleResize();
    this.events.emit('stateChange', { from, to: next });
    return true;
  }

  start(): void {
    if (this.animationHandle !== 0) return;
    this.clock.start();
    this.animate();
  }

  private readonly animate = (): void => {
    if (this.disposed) return;
    this.animationHandle = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 1 / 12);
    // Input is consumed exactly once per frame, here, regardless of state —
    // this is what lets Escape toggle PLAYING<->PAUSED even though the
    // player's own update (which would otherwise consume input) is skipped
    // while paused.
    const snapshot = this.inputManager.consume();
    if (snapshot.pausePressed) {
      if (this.state === GameState.PLAYING) this.setState(GameState.PAUSED);
      else if (this.state === GameState.PAUSED) this.setState(GameState.PLAYING);
    }

    this.city.update(delta);
    this.characterSelection.updateStage(delta);

    if (this.state === GameState.PLAYING && this.player) {
      this.mission.tick(delta);
      this.deliveryZone.update(this.player.character.root.position, this.cake);
      const target = this.interaction.update(this.player.character.root.position, this.player.entityId, snapshot);
      if (target === this.cake && snapshot.interactPressed) this.player.tryAttach(this.cake);
      if (target === this.deliveryZone && snapshot.interactPressed) this.deliveryZone.interact();
      if (this.cake.destroyed) this.mission.fail('CAKE');
      if (this.deliveryZone.deliveryPrepared && this.cake.state === 'CARRIED') { this.mission.complete(this.cake.condition); }
      if (this.mission.status === 'SUCCESS' && this.state === GameState.PLAYING) this.setState(GameState.SUCCESS);
      else if (this.mission.status === 'FAILED' && this.state === GameState.PLAYING) this.setState(GameState.FAILED);
      const prompt = document.querySelector<HTMLElement>('#interaction-prompt');
      const canShow = (target === this.cake && this.cake.state === 'WORLD') || (target === this.deliveryZone && this.deliveryZone.deliveryReady);
      prompt?.classList.toggle('is-hidden', !canShow);
      if (canShow && target) prompt!.textContent = target.displayLabel === 'DELIVER' ? '[E] DELIVER' : '[E] PICK UP';
      const mobileInteract = document.querySelector<HTMLElement>('#mobile-interact-button');
      if (mobileInteract) mobileInteract.textContent = target === this.deliveryZone ? 'DELIVER' : 'PICK UP';
      document.querySelector<HTMLElement>('#mobile-interact-button')?.classList.toggle('is-hidden', !canShow);
      const condition = document.querySelector<HTMLElement>('#cake-condition');
      const carried = this.player.getCarriedPackage();
      condition?.classList.toggle('is-hidden', !carried);
      if (carried) condition!.textContent = this.cake.destroyed ? 'CAKE DESTROYED' : `CAKE ${Math.round(this.cake.condition)}%`;
      document.querySelector<HTMLElement>('#mission-objective')!.textContent = `${this.mission.title}\n${this.cake.state === 'WORLD' ? 'PICK UP THE CAKE' : 'DELIVER THE CAKE'}`;
      document.querySelector<HTMLElement>('#mission-timer')!.textContent = `TIME ${Math.floor(this.mission.timer/60).toString().padStart(2,'0')}:${Math.floor(this.mission.timer%60).toString().padStart(2,'0')}`;
      this.player.captureInput(snapshot);
      const alpha = this.physicsWorld.advance(delta, this.player.fixedUpdate);
      this.player.render(delta, alpha);
      this.traffic.update(delta, this.player.character.root.position, this.player.getCarriedPackage() as CakePackage|null, this.player.entityId, amount => this.player?.trafficPush(amount));
      this.npcs.update(delta, this.player.character.root.position, this.player.getCarriedPackage());
    }

    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleBlur = (): void => {
    if (this.state === GameState.PLAYING) this.setState(GameState.PAUSED);
  };

  private readonly handleVisibility = (): void => {
    this.clock.getDelta();
    this.physicsWorld.resetTime();
    if (document.hidden) this.handleBlur();
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationHandle);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.inputManager.dispose();
    this.player?.dispose();
    this.physicsWorld.dispose();
    this.events.clear();
    this.renderer.dispose();
  }
}
