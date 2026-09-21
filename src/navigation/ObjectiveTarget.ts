export type NavigationObjective='PICKUP'|'DESTINATION';
export function objectiveTargetForPackage(state:'WORLD'|'CARRIED'|'DESTROYED'):NavigationObjective{return state==='WORLD'?'PICKUP':'DESTINATION';}
export function mapPauseTransition(action:'OPEN'|'CLOSE',state:'PLAYING'|'PAUSED'):'PLAYING'|'PAUSED'{return action==='OPEN'&&state==='PLAYING'?'PAUSED':action==='CLOSE'&&state==='PAUSED'?'PLAYING':state;}
