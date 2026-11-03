import { WORLD_WIDTH } from './world.js';
import type { Point, Solid } from './world.js';

export const BOULDERS = { radiusMin: 32, radiusMax: 42, gravity: 240, restitution: .42, rollAcceleration: 24 };
export interface Boulder { id: number; side: 'left' | 'right'; x: number; y: number; vx: number; vy: number; radius: number; angle: number }

export function boulderBody(boulder: Boulder): Point[] {
  return Array.from({ length: 16 }, (_, i) => ({ x: boulder.x + Math.cos(i * Math.PI / 8) * boulder.radius,
    y: boulder.y + Math.sin(i * Math.PI / 8) * boulder.radius }));
}

// Resolve a circle against a convex solid. Small physics substeps keep the
// circle outside even thin station decks; slopes redirect its momentum downhill.
export function bounceBoulder(boulder: Boulder, solid: Solid, dt: number): boolean {
  const points = solid.points;
  const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
  const winding = Math.sign(area);
  let inside = true, distance = Infinity, closest = { x: 0, y: 0 }, normal = { x: 0, y: -1 };
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const ex = q.x - p.x, ey = q.y - p.y, length = Math.hypot(ex, ey);
    if (!length) continue;
    if ((ex * (boulder.y - p.y) - ey * (boulder.x - p.x)) * winding < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((boulder.x - p.x) * ex + (boulder.y - p.y) * ey) / (length * length)));
    const point = { x: p.x + ex * t, y: p.y + ey * t };
    const d = Math.hypot(boulder.x - point.x, boulder.y - point.y);
    if (d < distance) { distance = d; closest = point; normal = { x: ey / length * winding, y: -ex / length * winding }; }
  }
  if (!inside && distance >= boulder.radius) return false;
  if (!inside && distance > 1e-9) normal = { x: (boulder.x - closest.x) / distance, y: (boulder.y - closest.y) / distance };
  const depth = (inside ? boulder.radius + distance : boulder.radius - distance) + .001;
  boulder.x += normal.x * depth; boulder.y += normal.y * depth;
  const incoming = boulder.vx * normal.x + boulder.vy * normal.y;
  if (incoming < 0) {
    // Large impacts bounce; small contacts settle into a roll.
    const restitution = incoming < -35 ? BOULDERS.restitution : 0;
    boulder.vx -= (1 + restitution) * incoming * normal.x;
    boulder.vy -= (1 + restitution) * incoming * normal.y;
  }
  // Rough, irregular rocks keep tumbling off flat ledges toward the valley.
  if (normal.y < -.2) boulder.vx += (boulder.x < WORLD_WIDTH / 2 ? 1 : -1) * BOULDERS.rollAcceleration * dt;
  return true;
}
