export enum GameState {
  BOOT = 'BOOT',
  MAIN_MENU = 'MAIN_MENU',
  CHARACTER_SELECT = 'CHARACTER_SELECT',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface StateChangePayload {
  from: GameState;
  to: GameState;
}

export type GameEvents = {
  stateChange: StateChangePayload;
};

/**
 * Explicit allow-list of transitions. Anything not listed here is rejected
 * by Game.setState so state handling can't silently drift as new screens
 * (settings, multiplayer lobby, etc.) are added later.
 */
export const VALID_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  [GameState.BOOT]: [GameState.MAIN_MENU],
  [GameState.MAIN_MENU]: [GameState.CHARACTER_SELECT],
  [GameState.CHARACTER_SELECT]: [GameState.MAIN_MENU, GameState.PLAYING],
  [GameState.PLAYING]: [GameState.PAUSED, GameState.SUCCESS, GameState.FAILED],
  [GameState.PAUSED]: [GameState.PLAYING, GameState.MAIN_MENU],
  [GameState.SUCCESS]: [GameState.MAIN_MENU, GameState.CHARACTER_SELECT],
  [GameState.FAILED]: [GameState.MAIN_MENU, GameState.CHARACTER_SELECT, GameState.PLAYING]
};
