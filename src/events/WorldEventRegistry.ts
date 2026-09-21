import type { WorldEventDefinition } from './WorldEventTypes';
export const WORLD_EVENT_REGISTRY:readonly WorldEventDefinition[]=[
 {id:'road-work',name:'ROAD WORK',description:'Main Street traffic is slowed.',affectedRoute:'main-street',affectedArea:'Main Street',severity:'mild',icon:'⚠',mapLabel:'ROAD WORK',routeStatus:'DELAYED',challengeLabel:'Road Work Route',bonus:75,position:[0,.2,9],kind:'barriers'},
 {id:'market-rush',name:'MARKET RUSH',description:'The shortcut is crowded today!',affectedRoute:'market-shortcut',affectedArea:'Market',severity:'moderate',icon:'👥',mapLabel:'MARKET RUSH',routeStatus:'VERY CROWDED',challengeLabel:'Market Rush Challenge',bonus:100,position:[-19,.2,0],kind:'crowd'},
 {id:'delivery-van',name:'DELIVERY VAN',description:'A delivery is narrowing the crossing.',affectedRoute:'main-street',affectedArea:'Crossing',severity:'moderate',icon:'🚚',mapLabel:'VAN BLOCKAGE',routeStatus:'BOTTLENECK',challengeLabel:'Van Squeeze',bonus:90,position:[2,.2,-1],kind:'van'},
 {id:'park-sprinklers',name:'PARK SPRINKLERS',description:'Time your run through the wet grass.',affectedRoute:'park-route',affectedArea:'Park',severity:'moderate',icon:'💦',mapLabel:'SPRINKLERS',routeStatus:'WET CYCLE',challengeLabel:'Sprinkler Sprint',bonus:100,position:[18,.2,1],kind:'sprinklers'},
 {id:'moving-day',name:'MOVING DAY',description:'Movers are crossing the alley.',affectedRoute:'alley',affectedArea:'Alley',severity:'high',icon:'📦',mapLabel:'MOVING DAY',routeStatus:'OBSTRUCTED · VARIABLE',challengeLabel:'Moving Day Run',bonus:125,position:[-30,.2,-5],kind:'furniture'}
] as const;
export function selectWorldEvent(runIndex:number):WorldEventDefinition|null{return runIndex<=0?null:WORLD_EVENT_REGISTRY[(runIndex-1)%WORLD_EVENT_REGISTRY.length]!;}
