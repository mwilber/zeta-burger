import type { LevelConfig } from './level-config.js';
import type { Pad, Point } from './world.js';
import { WORLD_WIDTH } from './world.js';

export const LIGHTNING = { spawnDelay: 3, warningDuration: 3.5, strikeDuration: .18, intervalMin: 3.6, intervalMax: 6.4, width: 5, arcDuration: .12 };
export interface LightningStrike { id: number; padId: number; x: number; y: number; age: number; points: Point[] }
// One set per second initially, then 2, 4, and 8 sets per second as impact nears.
// The same schedule drives visual pulses and zap events, using gameplay time.
export const LIGHTNING_ARC_TIMES = Array.from({ length: Math.ceil(LIGHTNING.warningDuration) }, (_, second) =>
  Array.from({ length: 2 ** second }, (_, i) => second + i / 2 ** second))
  .flat().filter(time => time < LIGHTNING.warningDuration);
export function lightningArcPulse(age: number): { index: number; progress: number } | null {
  if (age < 0 || age >= LIGHTNING.warningDuration) return null;
  let index = 0;
  while (index + 1 < LIGHTNING_ARC_TIMES.length && LIGHTNING_ARC_TIMES[index + 1] <= age) index++;
  const progress = (age - LIGHTNING_ARC_TIMES[index]) / LIGHTNING.arcDuration;
  return progress < 1 ? { index, progress } : null;
}
const GUSTS = [1, -.8, .65, -1, .85, -.6];
export function windVelocity(storm: LevelConfig['storm'], time: number): number {
  if (!storm) return 0;
  return storm.windSpeed * GUSTS[((Math.floor(time / storm.gustDuration) % GUSTS.length) + GUSTS.length) % GUSTS.length];
}
/** Continuous displacement keeps rain from jumping when a gust changes. */
export function windOffset(storm: NonNullable<LevelConfig['storm']>, time: number): number {
  const elapsed = Math.max(0, time) / storm.gustDuration;
  const whole = Math.floor(elapsed), cycles = Math.floor(whole / GUSTS.length), remainder = whole % GUSTS.length;
  return (cycles * GUSTS.reduce((sum, gust) => sum + gust, 0)
    + GUSTS.slice(0, remainder).reduce((sum, gust) => sum + gust, 0)
    + (elapsed - whole) * GUSTS[remainder]) * storm.windSpeed * storm.gustDuration;
}
/** The endpoint and the entire jagged path are fixed when the warning appears. */
export function createLightning(id: number, pad: Pick<Pad, 'id' | 'x' | 'y' | 'width'>, random: () => number): LightningStrike {
  const x = pad.x + pad.width / 2, y = pad.y;
  const points = Array.from({ length: 13 }, (_, i) => ({
    x: Math.max(8, Math.min(WORLD_WIDTH - 8, x + (i === 12 ? 0 : (random() * 2 - 1) * 22))),
    y: y * i / 12
  }));
  return { id, padId: pad.id, x, y, age: 0, points };
}
/** Convex strips follow every visible segment, including angled sections. */
export function lightningBodies(strike: LightningStrike): Point[][] {
  return strike.points.slice(1).map((b, i) => {
    const a = strike.points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / length * LIGHTNING.width / 2, ny = (b.x - a.x) / length * LIGHTNING.width / 2;
    return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }];
  });
}
