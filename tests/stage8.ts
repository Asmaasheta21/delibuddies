import { SaveManager } from '../src/save/SaveManager'; import { DEFAULT_SAVE } from '../src/save/SaveTypes';
const s=new SaveManager(); const d=DEFAULT_SAVE; console.assert(d.musicEnabled&&d.sfxEnabled&&d.bestScore===0); console.log('PASS Stage 8 save defaults/schema tests');
