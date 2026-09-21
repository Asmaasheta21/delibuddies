export interface SaveData { version:3; musicEnabled:boolean; sfxEnabled:boolean; selectedCharacter?:'boy'|'girl'; bestScore:number; bestStars:number; discoveredRoutes:string[]; missionAttempts:number; }
export const DEFAULT_SAVE:SaveData={version:3,musicEnabled:true,sfxEnabled:true,bestScore:0,bestStars:0,discoveredRoutes:[],missionAttempts:0};
