import { Mission } from './Mission';
const SCORE={base:5000,timeSecond:10,conditionPoint:25,marketShortcut:150,alleyCut:200,noCollisions:300,condition90:400} as const;
export class CakeDeliveryMission extends Mission { static readonly duration=240; private visited=new Set<string>();private tookDamage=false;tipBonus=0;
 constructor(){super('delivery-01','DELIVERY 01');this.reset();}
 reset(){this.status='ACTIVE';this.timer=CakeDeliveryMission.duration;this.result=null;this.visited.clear();this.tookDamage=false;this.tipBonus=0;}
 tick(dt:number){if(this.status!=='ACTIVE')return;this.timer=Math.max(0,this.timer-Math.min(dt,1/12));if(this.timer===0)this.fail('TIME');}
 visitRoute(route:string){this.visited.add(route);} recordDamage(){this.tookDamage=true;}
 fail(reason:'TIME'|'CAKE'){if(this.status!=='ACTIVE')return;this.status='FAILED';this.result={reason,score:0,stars:0,timeTaken:CakeDeliveryMission.duration-this.timer,condition:0};}
 complete(condition:number){if(this.status!=='ACTIVE'||condition<=0||this.timer<=0)return false;const whole=Math.floor(this.timer),stars=condition>=80&&whole>=75?3:condition>=50&&whole>=30?2:1;this.tipBonus=(this.visited.has('alley')?SCORE.alleyCut:this.visited.has('market-shortcut')?SCORE.marketShortcut:0)+(this.tookDamage?0:SCORE.noCollisions)+(condition>=90?SCORE.condition90:0);const score=SCORE.base+whole*SCORE.timeSecond+Math.round(condition)*SCORE.conditionPoint+this.tipBonus;this.status='SUCCESS';this.result={score,stars,timeTaken:CakeDeliveryMission.duration-this.timer,condition};return true;}
 get objective(){return this.status==='ACTIVE'?'PICK UP THE CAKE':'DELIVER THE CAKE';}
}
