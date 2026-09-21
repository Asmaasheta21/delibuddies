import type { PaletteKey } from '../world/Materials';

export type CharacterId = 'boy' | 'girl';

export interface CharacterPalette {
  skin: PaletteKey;
  hair: PaletteKey;
  top: PaletteKey;
  bottom: PaletteKey;
  shoe: PaletteKey;
  shoeSole: PaletteKey;
  backpack: PaletteKey;
  backpackAccent: PaletteKey;
}

export interface CharacterDefinition {
  id: CharacterId;
  /** Original character name — no reference to any existing franchise. */
  name: string;
  /** Internal/UI label kept alongside the name, per the design brief. */
  label: 'BOY' | 'GIRL';
  tagline: string;
  palette: CharacterPalette;
}

export const CHARACTER_DEFINITIONS: Record<CharacterId, CharacterDefinition> = {
  boy: {
    id: 'boy',
    name: 'Kip',
    label: 'BOY',
    tagline: 'Energetic & Friendly',
    palette: {
      skin: 'peach',
      hair: 'hairMidnight',
      top: 'powderBlue',
      bottom: 'cream',
      shoe: 'terracotta',
      shoeSole: 'cream',
      backpack: 'coral',
      backpackAccent: 'butter'
    }
  },
  girl: {
    id: 'girl',
    name: 'Poppy',
    label: 'GIRL',
    tagline: 'Cheerful & Confident',
    palette: {
      skin: 'peach',
      hair: 'hairChestnut',
      top: 'flowerPink',
      bottom: 'cream',
      shoe: 'lavender',
      shoeSole: 'cream',
      backpack: 'mint',
      backpackAccent: 'flowerPink'
    }
  }
};

export const DEFAULT_CHARACTER_ID: CharacterId = 'boy';
