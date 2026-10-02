export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 760;
export interface Point { x: number; y: number }
export interface Pad { id: number; name: string; x: number; y: number; width: number; color: string; island: Point[]; building: { x: number; y: number; width: number; height: number; kind: string } }
function station(id: number, name: string, x: number, y: number, width: number, color: string, ix: number, iw: number, bx: number, bw: number, bh: number, kind: string): Pad {
  return { id, name, x, y, width, color, island: [{ x: ix, y: y + 10 }, { x: ix + iw, y: y + 10 }, { x: ix + iw - 18, y: y + 43 }, { x: ix + iw * .62, y: y + 83 }, { x: ix + iw * .3, y: y + 64 }, { x: ix + 15, y: y + 39 }], building: { x: bx, y: y - bh, width: bw, height: bh + 10, kind } };
}
export const PADS: Pad[] = [
  station(6, 'Gas station', 82, 640, 110, '#98daed', 34, 218, 206, 28, 48, 'gas'),
  station(0, 'Zeta Burger', 370, 560, 116, '#bdf77d', 258, 254, 280, 76, 95, 'restaurant'),
  station(1, 'Spore Heights', 116, 340, 102, '#da9fec', 42, 204, 60, 43, 73, 'mushroom'),
  station(2, 'Orbit Observatory', 563, 253, 104, '#98daed', 527, 217, 683, 44, 65, 'observatory'),
  station(3, 'Moon Motel', 954, 363, 104, '#ffc481', 930, 272, 1081, 65, 83, 'motel'),
  station(4, 'Crystal Gardens', 724, 558, 104, '#da9fec', 674, 214, 845, 26, 64, 'crystal'),
  station(5, 'Cosmic Outpost', 1120, 633, 104, '#98daed', 1025, 233, 1047, 53, 67, 'outpost')
];
export interface Solid { points: Point[]; kind: 'pad' | 'island' | 'building'; padId: number }
export function rectangle(x: number, y: number, w: number, h: number): Point[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}
export const SOLIDS: Solid[] = PADS.flatMap(pad => [
  { points: rectangle(pad.x, pad.y, pad.width, 10), kind: 'pad' as const, padId: pad.id },
  { points: pad.island, kind: 'island' as const, padId: pad.id },
  { points: rectangle(pad.building.x, pad.building.y, pad.building.width, pad.building.height), kind: 'building' as const, padId: pad.id }
]);
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
