import { createPad, createSolids } from './world.js';
import { LEVEL_CONFIG } from './level-config.js';
import type { LevelConfig } from './level-config.js';
import type { Pad, Solid, Point } from './world.js';

export const SKILLS = {
  casual: { name: 'Casual', orders: 4, arrivalMin: 12, arrivalMax: 22, tipRate: .06 },
  normal: { name: 'Normal', orders: 6, arrivalMin: 8, arrivalMax: 16, tipRate: .08 },
  expert: { name: 'Expert', orders: 8, arrivalMin: 5, arrivalMax: 10, tipRate: .12 },
  tester: { name: 'Tester', orders: 1, arrivalMin: 8, arrivalMax: 16, tipRate: .08 }
} as const;
export type Skill = keyof typeof SKILLS;
export interface Level {
  number: number;
  id: string;
  name: string;
  theme: string;
  padCount: number;
  pads: Pad[];
  solids: Solid[];
  start: Point;
  restaurant: number;
  gasStation: number;
  fallingObstacleLimit: number;
  destinations: number[];
}
export function createLevel(config: LevelConfig): Level {
  const fail = (message: string): never => { throw new Error(`Level ${config.number}: ${message}`); };
  if (!Number.isInteger(config.number) || config.number < 1) fail('number must be a positive integer');
  if (!Number.isInteger(config.fallingObstacleLimit) || config.fallingObstacleLimit < 0) fail('fallingObstacleLimit must be a nonnegative integer');
  const ids = new Set<number>();
  for (const pad of config.pads) {
    if (!Number.isInteger(pad.id) || pad.id < 0 || ids.has(pad.id)) fail('pad IDs must be unique nonnegative integers');
    ids.add(pad.id);
    if (![pad.x, pad.y, pad.width, pad.island.x, pad.island.width, pad.building.x, pad.building.width, pad.building.height].every(Number.isFinite)
      || pad.width < 38 || pad.island.width <= 18 || pad.building.width <= 0 || pad.building.height <= 0) fail(`invalid geometry for pad ${pad.id}`);
    if (!/^[a-z][a-z0-9-]*$/.test(pad.building.kind)) fail(`invalid building asset name for pad ${pad.id}`);
  }
  if (!ids.has(config.restaurant) || !ids.has(config.gasStation) || config.restaurant === config.gasStation) fail('restaurant and gas station must reference distinct existing pads');
  const destinations = config.pads.filter(pad => pad.id !== config.restaurant && pad.id !== config.gasStation).map(pad => pad.id);
  if (!destinations.length) fail('at least one delivery pad is required');
  if (![config.start.x, config.start.y].every(Number.isFinite)) fail('invalid starting position');
  const pads = config.pads.map(createPad);
  return { ...config, pads, padCount: pads.length, solids: createSolids(pads), destinations };
}
/** Configuration array order controls selection and progression; numbers stay stable for assets. */
export function createLevels(configs: LevelConfig[]): Level[] {
  const levels = configs.map(createLevel);
  if (!levels.length) throw new Error('At least one level must be configured');
  if (new Set(levels.map(level => level.number)).size !== levels.length || new Set(levels.map(level => level.id)).size !== levels.length) {
    throw new Error('Level numbers and IDs must be unique');
  }
  return levels;
}
export const LEVELS: Level[] = createLevels(LEVEL_CONFIG);
export function nextLevel(current: Pick<Level, 'id'>, levels: Level[] = LEVELS): Level | undefined {
  const index = levels.findIndex(level => level.id === current.id);
  return index < 0 ? undefined : levels[index + 1];
}
/** Append the level number after the full original asset name, before its extension. */
export function levelAssetPath(name: string, level: Pick<Level, 'number'>, extension = 'svg'): string {
  return `./assets/${name}-${level.number}.${extension}`;
}
export function levelAssetNames(level: Pick<Level, 'pads' | 'fallingObstacleLimit'>): string[] {
  return [...new Set(['background', 'saucer', 'effects', ...(level.fallingObstacleLimit > 0 ? ['falling-obstacle'] : []), ...level.pads.flatMap(pad => [
    pad.building.kind, `island-${pad.id}`, `pad-${pad.id}`, `pad-${pad.id}-active`
  ])])];
}
