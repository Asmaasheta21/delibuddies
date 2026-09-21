import * as THREE from 'three';
export interface DeliveryRoute { id: 'safe'|'shortcut'; label: string; waypoints: THREE.Vector3[]; risk: 'low'|'high'; }
export const DELIVERY_ROUTES: readonly DeliveryRoute[] = [
  { id:'safe', label:'Main Street → Park edge → Destination', risk:'low', waypoints:[new THREE.Vector3(0,0,24),new THREE.Vector3(0,0,0),new THREE.Vector3(16,0,0),new THREE.Vector3(-8,0,-30)] },
  { id:'shortcut', label:'Alley → Market → Destination', risk:'high', waypoints:[new THREE.Vector3(-2,0,24),new THREE.Vector3(-30,0,24),new THREE.Vector3(-22,0,0),new THREE.Vector3(-8,0,-30)] }
];
