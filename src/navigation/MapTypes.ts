import type * as THREE from 'three';
import type { DeliveryRoute, RouteId } from '../routes/RouteTypes';
export interface MapBounds { minX:number;maxX:number;minZ:number;maxZ:number; }
export interface MapLandmark { id:string;label:string;kind:'bakery'|'market'|'park'|'street'|'alley'|'destination'|'cafe'|'shop';position:THREE.Vector3; }
export interface DistrictMapData { id:string;name:string;bounds:MapBounds;landmarks:readonly MapLandmark[];routes:readonly DeliveryRoute[]; }
export interface MapPoint { x:number;y:number; }
export interface RouteDiscovery { discovered:ReadonlySet<RouteId>; }
export function discoverRoute(routes:readonly string[],route:RouteId):string[]{return routes.includes(route)?[...routes]:[...routes,route];}
