import * as THREE from 'three';
export type ObstacleKind = 'crate' | 'ramp' | 'barrier';
export interface RouteObstacle { id: string; kind: ObstacleKind; position: THREE.Vector3; size: THREE.Vector3; }
