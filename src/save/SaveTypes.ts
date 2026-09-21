export interface SaveData { version:2; musicEnabled:boolean; sfxEnabled:boolean; selectedCharacter?:'boy'|'girl'; bestScore:number; bestStars:number; discoveredRoutes:string[]; }
export const DEFAULT_SAVE:SaveData={version:2,musicEnabled:true,sfxEnabled:true,bestScore:0,bestStars:0,discoveredRoutes:[]};
