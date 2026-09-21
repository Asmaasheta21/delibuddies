import { DELIVERY_CONFIG } from '../config/delivery';
import type { CakePackage } from './CakePackage';
export type ImpactSeverity = 'soft' | 'normal' | 'hard' | 'major';
export function severityDamage(severity: ImpactSeverity): number { return severity === 'soft' ? 1 : severity === 'normal' ? 5 : severity === 'hard' ? 10 : 15; }
export function impactSeverity(speed: number): ImpactSeverity | null { if (speed < DELIVERY_CONFIG.softImpactSpeed) return null; if (speed < DELIVERY_CONFIG.normalImpactSpeed) return 'soft'; if (speed < DELIVERY_CONFIG.hardImpactSpeed) return 'normal'; return 'hard'; }
export class PackageDamageSystem {
  applyCollision(cake: CakePackage, resolvedSpeedLoss: number): number { const severity = impactSeverity(resolvedSpeedLoss); return severity ? cake.impact(severityDamage(severity)) : 0; }
  applyLanding(cake: CakePackage, downwardSpeed: number): number { return downwardSpeed >= DELIVERY_CONFIG.hardLandingSpeed ? cake.impact(15) : 0; }
}
