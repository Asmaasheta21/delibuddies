import type { Game } from '../core/Game';
import { GameState } from '../core/GameState';
import { MainMenuScreen } from './MainMenuScreen';
import { CharacterSelectScreen } from './CharacterSelectScreen';

export interface UIManagerOptions {
  game: Game;
  uiRoot: HTMLElement;
}

/**
 * Bridges DOM screens to Game state. Screens never call `game.setState`
 * directly for flows that also need scene/camera work — that orchestration
 * stays inside Game (see `enterCharacterSelect` / `confirmCharacterSelectionAndPlay`),
 * so UIManager only shows/hides the right screen and forwards button intents.
 */
export class UIManager {
  private readonly game: Game;
  private readonly mainMenu: MainMenuScreen;
  private readonly characterSelect: CharacterSelectScreen;

  constructor(options: UIManagerOptions) {
    this.game = options.game;

    const mainMenuRoot = options.uiRoot.querySelector<HTMLElement>('#main-menu-screen');
    const selectRoot = options.uiRoot.querySelector<HTMLElement>('#character-select-screen');
    if (!mainMenuRoot || !selectRoot) {
      throw new Error('[UIManager] missing required screen root elements in index.html');
    }

    this.mainMenu = new MainMenuScreen({
      root: mainMenuRoot,
      onPlay: () => {
        this.game.enterCharacterSelect(this.characterSelect.getSelectedId());
      }
    });

    this.characterSelect = new CharacterSelectScreen({
      root: selectRoot,
      onSelect: (id) => this.game.selectCharacterOnStage(id),
      onPlay: () => this.game.confirmCharacterSelectionAndPlay()
    });

    this.game.events.on('stateChange', ({ to }) => this.applyScreenForState(to));
    this.applyScreenForState(this.game.getState());
  }

  private applyScreenForState(state: GameState): void {
    if (state === GameState.MAIN_MENU) {
      this.mainMenu.show();
    } else {
      this.mainMenu.hide();
    }

    if (state === GameState.CHARACTER_SELECT) {
      this.characterSelect.show();
    } else {
      this.characterSelect.hide();
    }
  }
}
