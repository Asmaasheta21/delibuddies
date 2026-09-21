export interface SaveData { version:1; musicEnabled:boolean; sfxEnabled:boolean; selectedCharacter?:'boy'|'girl'; bestScore:number; bestStars:number; }
export const DEFAULT_SAVE:SaveData={version:1,musicEnabled:true,sfxEnabled:true,bestScore:0,bestStars:0};
