import type { RouteId } from '../routes/RouteTypes';
export type WorldEventId='road-work'|'market-rush'|'delivery-van'|'park-sprinklers'|'moving-day';
export interface WorldEventDefinition {id:WorldEventId;name:string;description:string;affectedRoute:RouteId;affectedArea:string;severity:'mild'|'moderate'|'high';icon:string;mapLabel:string;routeStatus:string;challengeLabel:string;bonus:number;position:[number,number,number];kind:'barriers'|'crowd'|'van'|'sprinklers'|'furniture';}
export interface WorldEventMapMetadata {id:WorldEventId;name:string;description:string;icon:string;affectedRoute:RouteId;mapLabel:string;routeStatus:string;challengeLabel:string;bonus:number;}
export interface EventBonusLine {label:string;amount:number;}
