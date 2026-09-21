import { DEFAULT_CHARACTER_ID, type CharacterId } from '../config/characters';

export interface CharacterSelectScreenOptions {
  root: HTMLElement;
  onSelect: (id: CharacterId) => void;
  onPlay: () => void;
}

const STORAGE_KEY = 'delibuddies.selectedCharacter';

function readStoredCharacterId(): CharacterId {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'boy' || stored === 'girl') return stored;
  } catch {
    // localStorage unavailable (privacy mode, etc.) — default is fine.
  }
  return DEFAULT_CHARACTER_ID;
}

function storeCharacterId(id: CharacterId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Non-fatal — selection still works for the current session.
  }
}

/**
 * DOM chrome for character select: two big click zones (each half the
 * screen, so the 3D staged characters read through as the actual "cards"),
 * a title, and PLAY. Keyboard left/right + Enter are bound only while this
 * screen is visible, and unbound on hide() so repeated visits never stack
 * listeners.
 */
export class CharacterSelectScreen {
  private readonly root: HTMLElement;
  private readonly zones: HTMLButtonElement[];
  private readonly playButton: HTMLButtonElement;
  private readonly onSelectCallback: (id: CharacterId) => void;
  private readonly onPlayCallback: () => void;
  private selectedId: CharacterId;
  private keyboardBound = false;

  constructor(options: CharacterSelectScreenOptions) {
    this.root = options.root;
    this.onSelectCallback = options.onSelect;
    this.onPlayCallback = options.onPlay;

    this.zones = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.select-zone'));
    const playButton = this.root.querySelector<HTMLButtonElement>('#select-play');
    if (!playButton || this.zones.length !== 2) {
      throw new Error('[CharacterSelectScreen] expected two .select-zone buttons and a #select-play button');
    }
    this.playButton = playButton;
    this.selectedId = readStoredCharacterId();

    for (const zone of this.zones) {
      zone.addEventListener('click', this.handleZoneClick);
    }
    this.playButton.addEventListener('click', this.onPlayCallback);
  }

  getSelectedId(): CharacterId {
    return this.selectedId;
  }

  show(): void {
    this.applyHighlight();
    if (!this.keyboardBound) {
      window.addEventListener('keydown', this.handleKeydown);
      this.keyboardBound = true;
    }
    this.root.classList.remove('is-hidden');
  }

  hide(): void {
    if (this.keyboardBound) {
      window.removeEventListener('keydown', this.handleKeydown);
      this.keyboardBound = false;
    }
    this.root.classList.add('is-hidden');
  }

  dispose(): void {
    this.hide();
    for (const zone of this.zones) {
      zone.removeEventListener('click', this.handleZoneClick);
    }
    this.playButton.removeEventListener('click', this.onPlayCallback);
  }

  private readonly handleZoneClick = (event: MouseEvent): void => {
    const zone = event.currentTarget as HTMLButtonElement;
    const id = zone.dataset.characterId;
    if (id === 'boy' || id === 'girl') this.setSelected(id);
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') this.setSelected('boy');
    else if (event.key === 'ArrowRight') this.setSelected('girl');
    else if (event.key === 'Enter') this.onPlayCallback();
  };

  private setSelected(id: CharacterId): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    storeCharacterId(id);
    this.applyHighlight();
    this.onSelectCallback(id);
  }

  private applyHighlight(): void {
    for (const zone of this.zones) {
      zone.classList.toggle('is-selected', zone.dataset.characterId === this.selectedId);
    }
  }
}
