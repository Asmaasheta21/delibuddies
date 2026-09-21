export interface MainMenuScreenOptions {
  root: HTMLElement;
  onPlay: () => void;
}

/** Minimal Stage 1 main menu, extended just enough to route PLAY into character select. Full menu polish is Stage 8's job. */
export class MainMenuScreen {
  private readonly root: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly handlePlay: () => void;

  constructor(options: MainMenuScreenOptions) {
    this.root = options.root;
    const playButton = this.root.querySelector<HTMLButtonElement>('#main-menu-play');
    if (!playButton) {
      throw new Error('[MainMenuScreen] missing #main-menu-play button');
    }
    this.playButton = playButton;
    this.handlePlay = options.onPlay;
    this.playButton.addEventListener('click', this.handlePlay);
  }

  show(): void {
    this.root.classList.remove('is-hidden');
  }

  hide(): void {
    this.root.classList.add('is-hidden');
  }

  dispose(): void {
    this.playButton.removeEventListener('click', this.handlePlay);
  }
}
