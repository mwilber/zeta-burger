import { LEVEL_CONFIG } from './level-config.js';
import type { PadConfig } from './level-config.js';
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 760;
export interface Point { x: number; y: number }
export interface Pad { id: number; name: string; x: number; y: number; width: number; color: string; island: Point[]; building: { x: number; y: number; width: number; height: number; kind: string } }
export function createPad(config: PadConfig): Pad {
  const { id, name, x, y, width, color, island, building } = config;
  const ix = x + island.x, iw = island.width;
  return { id, name, x, y, width, color, island: [{ x: ix, y: y + 10 }, { x: ix + iw, y: y + 10 }, { x: ix + iw - 18, y: y + 43 }, { x: ix + iw * .62, y: y + 83 }, { x: ix + iw * .3, y: y + 64 }, { x: ix + 15, y: y + 39 }], building: { x: x + building.x, y: y - building.height, width: building.width, height: building.height + 10, kind: building.kind } };
}
// Default-level exports retained for physics and route consumers.
export const PADS: Pad[] = LEVEL_CONFIG[0].pads.map(createPad);
export interface Solid { points: Point[]; kind: 'pad' | 'island' | 'building'; padId: number }
export function rectangle(x: number, y: number, w: number, h: number): Point[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}
export function createSolids(pads: Pad[]): Solid[] { return pads.flatMap(pad => [
  { points: rectangle(pad.x, pad.y, pad.width, 10), kind: 'pad' as const, padId: pad.id },
  { points: pad.island, kind: 'island' as const, padId: pad.id },
  { points: rectangle(pad.building.x, pad.building.y, pad.building.width, pad.building.height), kind: 'building' as const, padId: pad.id }
]); }
export const SOLIDS = createSolids(PADS);
// Convex polygon SAT. The visible terrain silhouette is also its collision shape.
export function intersects(a: Point[], b: Point[]): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const ax = -(q.y - p.y), ay = q.x - p.x;
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const v of a) { const d = v.x * ax + v.y * ay; amin = Math.min(amin, d); amax = Math.max(amax, d); }
      for (const v of b) { const d = v.x * ax + v.y * ay; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
      if (amax <= bmin || bmax <= amin) return false;
    }
  }
  return true;
}
