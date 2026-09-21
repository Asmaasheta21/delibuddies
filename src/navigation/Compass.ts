export function wrapAngle(r:number):number{return Math.atan2(Math.sin(r),Math.cos(r));}
export function destinationAngle(px:number,pz:number,heading:number,tx:number,tz:number):number{return wrapAngle(Math.atan2(tx-px,tz-pz)-heading);}
export function smoothAngle(current:number,target:number,dt:number,speed=9):number{return wrapAngle(current+wrapAngle(target-current)*(1-Math.exp(-speed*dt)));}
export function distanceLabel(distance:number):'NEAR'|'CLOSE'|'FAR'{return distance<8?'NEAR':distance<24?'CLOSE':'FAR';}
