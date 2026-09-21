import * as THREE from 'three';
export type RouteId='main-street'|'market-shortcut'|'park-route'|'alley';
export interface DeliveryRoute { id:RouteId; label:string; waypoints:THREE.Vector3[]; risk:'low'|'medium'|'high'; estimatedSeconds:number; identity:string; reward:number; }
export const DELIVERY_ROUTES:readonly DeliveryRoute[]=[
 {id:'main-street',label:'Main Street',risk:'low',estimatedSeconds:82,identity:'Wide, predictable traffic, safest for fragile cakes',reward:0,waypoints:[new THREE.Vector3(0,0,24),new THREE.Vector3(0,0,0),new THREE.Vector3(-2,0,-18),new THREE.Vector3(-8,0,-30)]},
 {id:'market-shortcut',label:'Market Shortcut',risk:'high',estimatedSeconds:58,identity:'Crowds, crates and tight turns',reward:150,waypoints:[new THREE.Vector3(-2,0,24),new THREE.Vector3(-18,0,6),new THREE.Vector3(-22,0,-8),new THREE.Vector3(-8,0,-30)]},
 {id:'park-route',label:'Park Route',risk:'medium',estimatedSeconds:70,identity:'Curves, fountain and ramps',reward:75,waypoints:[new THREE.Vector3(2,0,20),new THREE.Vector3(18,0,4),new THREE.Vector3(10,0,-12),new THREE.Vector3(-8,0,-30)]},
 {id:'alley',label:'Alley Cut',risk:'high',estimatedSeconds:54,identity:'Fastest route with narrow geometry',reward:200,waypoints:[new THREE.Vector3(-2,0,24),new THREE.Vector3(-30,0,24),new THREE.Vector3(-30,0,-20),new THREE.Vector3(-8,0,-30)]}
];
export function routeAt(position:THREE.Vector3):RouteId|'unknown'{if(position.x<-26)return'alley';if(position.x<-9&&position.z>-10&&position.z<10)return'market-shortcut';if(position.x>9&&Math.abs(position.z)<10)return'park-route';if(Math.abs(position.x)<9)return'main-street';return'unknown';}
