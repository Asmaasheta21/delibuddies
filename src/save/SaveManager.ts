import { DEFAULT_SAVE, type SaveData } from './SaveTypes';
const KEY='delibuddies.save.v1';
export class SaveManager { load():SaveData{try{const raw=localStorage.getItem(KEY);if(!raw)return {...DEFAULT_SAVE};const v=JSON.parse(raw) as Partial<SaveData>;return {...DEFAULT_SAVE,...v,version:1,musicEnabled:v.musicEnabled!==false,sfxEnabled:v.sfxEnabled!==false};}catch{return {...DEFAULT_SAVE};}} save(p:Partial<SaveData>){const next={...this.load(),...p,version:1};try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}return next;} }
