import type { MapBounds, MapPoint } from './MapTypes';
export function worldToMap(x:number,z:number,b:MapBounds):MapPoint{return{x:(x-b.minX)/(b.maxX-b.minX)*100,y:(b.maxZ-z)/(b.maxZ-b.minZ)*100};}
export function clampMapPoint(p:MapPoint):MapPoint{return{x:Math.max(0,Math.min(100,p.x)),y:Math.max(0,Math.min(100,p.y))};}
