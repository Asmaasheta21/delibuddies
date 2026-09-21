import './style.css';
import { Game } from './core/Game';
import { GameState } from './core/GameState';
import { UIManager } from './ui/UIManager';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { MobileControls } from './input/MobileControls';
import { SaveManager } from './save/SaveManager';
import { AudioManager } from './audio/AudioManager';
import { NavigationSystem } from './navigation/NavigationSystem';
import type { RouteId } from './routes/RouteTypes';

const MIN_BOOT_DELAY_MS = 500;

async function bootstrap(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
  const loadingScreen = document.querySelector<HTMLDivElement>('#loading-screen');
  const uiRoot = document.querySelector<HTMLElement>('#ui-root');

  if (!canvas) {
    throw new Error('Missing #scene-canvas element in index.html');
  }
  if (!uiRoot) {
    throw new Error('Missing #ui-root element in index.html');
  }

  // The Rapier WASM module is genuinely async to initialize — await it here
  // (behind the loading screen) rather than lazily inside Game, so Game's
  // own constructor stays synchronous. A minimum delay keeps the loading
  // screen from flashing on a fast machine where init resolves instantly.
  const [physicsWorld] = await Promise.all([
    PhysicsWorld.create(),
    new Promise((resolve) => window.setTimeout(resolve, MIN_BOOT_DELAY_MS))
  ]);

  const game = new Game(canvas, physicsWorld);
  const save = new SaveManager(); const prefs=save.load(); const audio=new AudioManager(); audio.musicEnabled=prefs.musicEnabled; audio.sfxEnabled=prefs.sfxEnabled;
  const qaRun=location.pathname==='/__qa'?Number(new URLSearchParams(location.search).get('eventRun')):NaN;game.configureRunIndex(Number.isFinite(qaRun)&&qaRun>=0?qaRun:prefs.missionAttempts);
  const discovered=new Set<RouteId>(['main-street','park-route',...prefs.discoveredRoutes.filter((r):r is RouteId=>r==='market-shortcut'||r==='alley')]);
  const navigation=new NavigationSystem(uiRoot,game.getMapData(),discovered,routes=>save.save({discoveredRoutes:routes.filter(r=>r==='market-shortcut'||r==='alley')}),()=>game.openMap(),()=>game.closeMap());
  game.setNavigationUpdater((dt,player,target,route,objective)=>{navigation.update(dt,player,target,objective);navigation.discover(route);});
  document.addEventListener('pointerdown',()=>audio.unlock(),{once:true}); document.addEventListener('keydown',()=>audio.unlock(),{once:true});
  new UIManager({ game, uiRoot });
  const mobileControls = new MobileControls(game.getInputManager(), uiRoot);

  const gameplayHud = uiRoot.querySelector<HTMLElement>('#gameplay-hud');
  const pauseScreen = uiRoot.querySelector<HTMLElement>('#pause-screen');
  const resultScreen = uiRoot.querySelector<HTMLElement>('#result-screen');
  uiRoot.querySelector('#pause-button')?.addEventListener('click', () => game.setState(GameState.PAUSED));
  uiRoot.querySelector('#resume-button')?.addEventListener('click', () => game.setState(GameState.PLAYING));
  uiRoot.querySelector('#restart-button')?.addEventListener('click', () => game.retryMission());
  uiRoot.querySelector('#pause-menu-button')?.addEventListener('click', () => game.setState(GameState.MAIN_MENU));
  const settings=uiRoot.querySelector<HTMLElement>('#settings-screen'); const music=uiRoot.querySelector<HTMLInputElement>('#music-toggle')!, sfx=uiRoot.querySelector<HTMLInputElement>('#sfx-toggle')!; music.checked=prefs.musicEnabled;sfx.checked=prefs.sfxEnabled;
  uiRoot.querySelector('#main-menu-settings')?.addEventListener('click',()=>settings?.classList.remove('is-hidden')); uiRoot.querySelector('#settings-back')?.addEventListener('click',()=>settings?.classList.add('is-hidden')); music.addEventListener('change',()=>{audio.setMusicEnabled(music.checked);save.save({musicEnabled:music.checked});}); sfx.addEventListener('change',()=>{audio.setSfxEnabled(sfx.checked);save.save({sfxEnabled:sfx.checked});});
  uiRoot.querySelector('#try-again-button')?.addEventListener('click', () => { resultScreen?.classList.add('is-hidden'); game.retryMission(); });
  uiRoot.querySelector('#result-menu-button')?.addEventListener('click', () => { resultScreen?.classList.add('is-hidden'); game.setState(GameState.MAIN_MENU); });
  game.events.on('stateChange', ({ to }) => {
    mobileControls.reset();
      document.body.dataset.gameState = to;
    gameplayHud?.classList.toggle('is-hidden', to !== GameState.PLAYING);
    resultScreen?.classList.toggle('is-hidden', to !== GameState.SUCCESS && to !== GameState.FAILED);
    if (to === GameState.SUCCESS || to === GameState.FAILED) { const result=game.mission.result; uiRoot.querySelector('#result-title')!.textContent=to===GameState.SUCCESS?'DELIVERY COMPLETE!':'DELIVERY FAILED'; uiRoot.querySelector('#result-reason')!.textContent=to===GameState.FAILED?(result?.reason==='TIME'?'YOU RAN OUT OF TIME':'THE CAKE WAS DESTROYED'):`TIME TAKEN ${Math.floor((result?.timeTaken??0)/60).toString().padStart(2,'0')}:${Math.floor((result?.timeTaken??0)%60).toString().padStart(2,'0')} · SCORE ${result?.score??0} · ${result?.stars??0} STARS`;const tips=uiRoot.querySelector<HTMLElement>('#result-tip-summary')!;tips.innerHTML=result?.tipBreakdown?.length?`${result.tipBreakdown.map(line=>`<div><span>${line.label}</span><span>+${line.amount}</span></div>`).join('')}<div><b>TOTAL TIP</b><b>+${result.tipBreakdown.reduce((sum,line)=>sum+line.amount,0)}</b></div>`:'';tips.classList.toggle('is-hidden',!result?.tipBreakdown?.length); }
    uiRoot.querySelector('#interaction-prompt')?.classList.add('is-hidden');
    pauseScreen?.classList.toggle('is-hidden', to !== GameState.PAUSED || game.isMapOpen);
  });
  let updateTimer=0;game.events.on('worldEventChange',event=>{navigation.setWorldEvent(event);save.save({missionAttempts:prefs.missionAttempts+1});const card=uiRoot.querySelector<HTMLElement>('#city-update')!;window.clearTimeout(updateTimer);if(!event){card.classList.add('is-hidden');return;}uiRoot.querySelector('#city-update-title')!.textContent=`${event.icon} ${event.name}`;uiRoot.querySelector('#city-update-copy')!.textContent=event.description;card.classList.remove('is-hidden');updateTimer=window.setTimeout(()=>card.classList.add('is-hidden'),2800);});
  document.body.dataset.gameState = game.getState();

  game.start();

  loadingScreen?.classList.add('is-hidden');
  game.setState(GameState.MAIN_MENU);
}

bootstrap().catch((error: unknown) => {
  console.error('[bootstrap] failed to start DeliBuddies', error);
});
