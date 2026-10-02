import { PADS, SOLIDS, WORLD_WIDTH, WORLD_HEIGHT, intersects, rectangle } from './world.js';
import type { Point, Pad } from './world.js';
export const PHYSICS = { gravity: 115, upThrust: 285, sideThrust: 180, footY: 22, footX: 16, safeVertical: 85, safeHorizontal: 35, dwell: .8, tipRate: .15 };
export interface Controls { left: boolean; right: boolean; up: boolean }
export interface Ship { x: number; y: number; vx: number; vy: number; gear: boolean; landed: number | null }
export interface Order { target: number; initialTip: number; elapsed: number }
export type GameEvent = { type: 'crash' | 'land' | 'pickup' | 'delivery' | 'respawn' | 'gear' | 'gameover'; message: string; x: number; y: number };
export type Phase = 'ready' | 'playing' | 'paused' | 'crashed' | 'gameover';
export function shipBody(ship: Ship): Point[] {
  return [{ x: ship.x - 24, y: ship.y }, { x: ship.x - 13, y: ship.y - 7 }, { x: ship.x - 9, y: ship.y - 17 }, { x: ship.x + 9, y: ship.y - 17 }, { x: ship.x + 13, y: ship.y - 7 }, { x: ship.x + 24, y: ship.y }, { x: ship.x + 19, y: ship.y + 8 }, { x: ship.x - 19, y: ship.y + 8 }];
}
export function gearShapes(ship: Ship): Point[][] {
  return [-PHYSICS.footX, PHYSICS.footX].map(offset => rectangle(ship.x + offset - 3, ship.y + 8, 6, PHYSICS.footY - 8));
}
export class Game {
  phase: Phase = 'ready';
  ship: Ship = this.spawn();
  lives = 3;
  bank = 0;
  delivered = 0;
  order: Order | null = null;
  events: GameEvent[] = [];
  dwell = 0;
  crashTime = 0;
  time = 0;
  servicedPad: number | null = null;
  random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }
  spawn(): Ship {
    const home = PADS[0];
    return { x: home.x + home.width / 2, y: home.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: -1 };
  }
  start() {
    this.ship = this.spawn(); this.lives = 3; this.bank = 0; this.delivered = 0;
    this.order = null; this.events = []; this.dwell = 0; this.crashTime = 0; this.time = 0;
    this.servicedPad = null; this.phase = 'playing';
  }
  get tip(): number { return this.order ? this.order.initialTip - this.order.elapsed * PHYSICS.tipRate : 0; }
  get destination(): Pad { return PADS.find(p => p.id === (this.order?.target ?? 0))!; }
  emit(type: GameEvent['type'], message: string) { this.events.push({ type, message, x: this.ship.x, y: this.ship.y }); }
  toggleGear() {
    if (this.phase !== 'playing') return;
    this.ship.gear = !this.ship.gear;
    if (!this.ship.gear) { this.ship.landed = null; this.servicedPad = null; this.dwell = 0; }
    this.emit('gear', this.ship.gear ? 'Gear extended. Side thrusters locked. Keep an eye on your drift.' : 'Gear retracted. Side thrusters ready.');
  }
  pause() { if (this.phase === 'playing') this.phase = 'paused'; else if (this.phase === 'paused') this.phase = 'playing'; }
  crash(message: string) {
    if (this.phase !== 'playing') return;
    this.lives--; this.ship.landed = null; this.crashTime = 0; this.dwell = 0; this.servicedPad = null;
    this.emit('crash', message);
    this.phase = this.lives > 0 ? 'crashed' : 'gameover';
    if (this.phase === 'gameover') this.emit('gameover', 'Shift over.');
  }
  step(dt: number, controls: Controls) {
    if (this.phase === 'ready' || this.phase === 'paused' || this.phase === 'gameover') return;
    // Callers use a fixed 120 Hz timestep. Long gaps are discarded by the render loop.
    this.time += dt;
    if (this.order) this.order.elapsed += dt;
    if (this.phase === 'crashed') {
      this.crashTime += dt;
      if (this.crashTime >= 1.5) { this.ship = this.spawn(); this.phase = 'playing'; this.emit('respawn', 'Fresh saucer. Your shift continues.'); }
      return;
    }
    const s = this.ship;
    if (s.landed !== null) {
      if (!controls.up) { this.dwell += dt; this.service(); return; }
      s.landed = null; this.servicedPad = null; this.dwell = 0;
    }
    const previous = { ...s };
    s.vy += (PHYSICS.gravity - (controls.up ? PHYSICS.upThrust : 0)) * dt;
    if (!s.gear) s.vx += ((controls.right ? 1 : 0) - (controls.left ? 1 : 0)) * PHYSICS.sideThrust * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x - 24 <= 0 || s.x + 24 >= WORLD_WIDTH || s.y - 17 <= 0 || s.y + (s.gear ? PHYSICS.footY : 8) >= WORLD_HEIGHT - 12) {
      this.crash('World edge impact. Stay inside the flight zone.'); return;
    }
    const body = shipBody(s);
    for (const solid of SOLIDS) {
      if (intersects(body, solid.points)) { this.crash('Hull impact. Only your landing gear can touch a pad.'); return; }
    }
    if (!s.gear) return;
    // Only a downward crossing with both feet inside the pad can become a landing.
    for (const pad of PADS) {
      const crossed = previous.y + PHYSICS.footY <= pad.y + .001 && s.y + PHYSICS.footY >= pad.y && s.vy >= 0;
      const feetInside = s.x - PHYSICS.footX - 3 >= pad.x && s.x + PHYSICS.footX + 3 <= pad.x + pad.width;
      if (crossed && feetInside) {
        if (s.vy > PHYSICS.safeVertical || Math.abs(s.vx) > PHYSICS.safeHorizontal) {
          this.crash('Hard landing. Descend below 85; sideways drift below 35.'); return;
        }
        s.y = pad.y - PHYSICS.footY; s.vx = 0; s.vy = 0; s.landed = pad.id; this.dwell = 0;
        this.emit('land', `${pad.name} · Docked at ${pad.id < 0 ? 'home' : `pad ${pad.id}`}`);
        return;
      }
    }
    for (const gear of gearShapes(s)) {
      for (const solid of SOLIDS) {
        if (intersects(gear, solid.points)) { this.crash('Landing gear impact. Approach the top of a pad with both feet.'); return; }
      }
    }
  }
  service() {
    if (this.dwell < PHYSICS.dwell || this.ship.landed === this.servicedPad) return;
    const id = this.ship.landed;
    this.servicedPad = id;
    if (id === 0 && !this.order) {
      const target = Math.min(5, 1 + Math.floor(this.random() * 5));
      const initialTip = Math.round((5 + this.random() * 5) * 100) / 100;
      this.order = { target, initialTip, elapsed: 0 };
      this.emit('pickup', `Order loaded! Deliver to pad ${target} · Starting tip $${initialTip.toFixed(2)}`);
    } else if (this.order && id === this.order.target) {
      const earned = Math.round(this.tip * 100) / 100;
      this.bank = Math.round((this.bank + earned) * 100) / 100;
      this.delivered++; this.order = null;
      this.emit('delivery', `Delivered! ${earned < 0 ? '−' : '+'}$${Math.abs(earned).toFixed(2)} · Head back to Zeta Burger`);
    }
  }
}
