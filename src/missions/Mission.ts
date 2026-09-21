import type { MissionResult, MissionStatus } from './MissionTypes';
export abstract class Mission { status:MissionStatus='NOT_STARTED'; timer=240; result:MissionResult|null=null; constructor(readonly missionId:string,readonly title:string){} abstract reset():void; }
