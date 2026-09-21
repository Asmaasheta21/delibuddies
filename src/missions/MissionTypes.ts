export type MissionStatus='NOT_STARTED'|'ACTIVE'|'SUCCESS'|'FAILED';
export interface MissionResult { reason?:'TIME'|'CAKE'; score:number; stars:number; timeTaken:number; condition:number; }
