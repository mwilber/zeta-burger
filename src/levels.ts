import { PADS, SOLIDS } from './world.js';
import type { Pad, Solid, Point } from './world.js';

export const SKILLS = {
  casual: { name: 'Casual', orders: 4, arrivalMin: 12, arrivalMax: 22, tipRate: .06 },
  normal: { name: 'Normal', orders: 6, arrivalMin: 8, arrivalMax: 16, tipRate: .08 },
  expert: { name: 'Expert', orders: 8, arrivalMin: 5, arrivalMax: 10, tipRate: .12 }
} as const;
export type Skill = keyof typeof SKILLS;
export interface Level {
  id: string;
  name: string;
  pads: Pad[];
  solids: Solid[];
  start: Point;
  restaurant: number;
  gasStation: number;
  destinations: number[];
}
// Add future levels here; the engine and renderer use the selected level's geometry.
export const LEVELS: Level[] = [{
  id: 'zeta-prime', name: 'Zeta Prime', pads: PADS, solids: SOLIDS, start: { x: 640, y: 80 },
  restaurant: 0, gasStation: 6, destinations: [1, 2, 3, 4, 5]
}];
