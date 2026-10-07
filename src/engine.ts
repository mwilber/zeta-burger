import { WORLD_WIDTH, WORLD_HEIGHT, intersects, rectangle } from './world.js';
import type { Point, Pad } from './world.js';
import { LEVELS, SKILLS } from './levels.js';
import type { Level, Skill } from './levels.js';
export const PHYSICS = { gravity: 100, upThrust: 285, sideThrust: 180, footY: 22, footX: 16, safeVertical: 120, safeHorizontal: 100, dwell: .8 };
export const LANDING_BOUNCE = { duration: .25, count: 3, height: 10, nearCrashRatio: .75 };
export const CRASH_DURATION = 1.5;
export const START_DELAY = 3;
export const FUEL = { capacity: 100, upRate: 1.8, sideRate: .9, refillRate: 25, low: 25 };
export interface Controls { left: boolean; right: boolean; up: boolean }
export interface Ship { x: number; y: number; vx: number; vy: number; gear: boolean; landed: number | null }
export interface Order { id: number; target: number; initialTip: number; elapsed: number; availableAt: number; status: 'scheduled' | 'waiting' | 'onboard' | 'delivered' }
export type EndReason = 'delivered' | 'tips' | 'lives';
export type GameEvent = { type: 'crash' | 'land' | 'pickup' | 'delivery' | 'respawn' | 'gear' | 'arrival' | 'fuel' | 'gameover'; message: string; x: number; y: number; endReason?: EndReason; hardLanding?: boolean };
export type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'crashed' | 'gameover';
export function shipBody(ship: Ship): Point[] {
  return [{ x: ship.x - 24, y: ship.y }, { x: ship.x - 13, y: ship.y - 7 }, { x: ship.x - 9, y: ship.y - 17 }, { x: ship.x + 9, y: ship.y - 17 }, { x: ship.x + 13, y: ship.y - 7 }, { x: ship.x + 24, y: ship.y }, { x: ship.x + 19, y: ship.y + 8 }, { x: ship.x - 19, y: ship.y + 8 }];
}
export function gearShapes(ship: Ship): Point[][] {
  return [-PHYSICS.footX, PHYSICS.footX].map(offset => rectangle(ship.x + offset - 3, ship.y + 8, 6, PHYSICS.footY - 8));
}
export class Game {
  phase: Phase = 'ready';
  ship: Ship;
  lives = 3;
  bank = 0;
  delivered = 0;
  orders: Order[] = [];
  skill: Skill = 'normal';
  level: Level;
  endReason: EndReason | null = null;
  fuel = FUEL.capacity;
  tilt = 0;
  landingBounceTime = 0;
  lowFuelWarned = false;
  events: GameEvent[] = [];
  dwell = 0;
  crashTime = 0;
  countdownTime = 0;
  private pausedPhase: Phase = 'playing';
  time = 0;
  servicedPad: number | null = null;
  random: () => number;
  constructor(random: () => number = Math.random, level: Level = LEVELS[0]) { this.random = random; this.level = level; this.ship = this.spawn(); }
  spawn(): Ship {
    return { ...this.level.start, vx: 0, vy: 0, gear: false, landed: null };
  }
  spawnAtStation(): Ship {
    const station = this.level.pads.find(p => p.id === this.level.gasStation)!;
    return { x: station.x + station.width / 2, y: station.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: station.id };
  }
  start(skill: Skill = this.skill, level: Level = this.level) {
    this.skill = skill; this.level = level;
    this.ship = this.spawn(); this.lives = 3; this.bank = 0; this.delivered = 0;
    this.orders = []; this.events = []; this.dwell = 0; this.crashTime = 0; this.time = 0;
    this.fuel = FUEL.capacity; this.tilt = 0; this.landingBounceTime = 0; this.lowFuelWarned = false; this.endReason = null;
    const setting = SKILLS[skill];
    // The first order always arrives five seconds into the shift.
    let availableAt = 5;
    for (let id = 1; id <= setting.orders; id++) {
      if (id > 1) availableAt += setting.arrivalMin + this.random() * (setting.arrivalMax - setting.arrivalMin);
      const target = level.destinations[Math.min(level.destinations.length - 1, Math.floor(this.random() * level.destinations.length))];
      const initialTip = Math.round((5 + this.random() * 5) * 100) / 100;
      this.orders.push({ id, target, initialTip, elapsed: 0, availableAt, status: 'scheduled' });
    }
    this.servicedPad = null; this.countdownTime = START_DELAY; this.pausedPhase = 'playing'; this.phase = 'countdown';
  }
  get order(): Order | null { return this.orders.find(order => order.status === 'onboard') ?? null; }
  get waitingOrders(): Order[] { return this.orders.filter(order => order.status === 'waiting'); }
  get scheduledCount(): number { return this.orders.filter(order => order.status === 'scheduled').length; }
  get totalOrders(): number { return this.orders.length || SKILLS[this.skill].orders; }
  get landingBounceOffset(): number {
    if (this.ship.landed === null || this.landingBounceTime <= 0) return 0;
    // Four shrinking hops are visual only; docking and collision geometry stay on the pad.
    const progress = (1 - this.landingBounceTime / LANDING_BOUNCE.duration) * LANDING_BOUNCE.count;
    const hop = Math.floor(progress);
    return -Math.sin((progress - hop) * Math.PI) * LANDING_BOUNCE.height * (1 - hop / LANDING_BOUNCE.count);
  }
  tipFor(order: Order): number { return order.initialTip - order.elapsed * SKILLS[this.skill].tipRate; }
  get tip(): number { return this.order ? this.tipFor(this.order) : 0; }
  get destination(): Pad { return this.level.pads.find(p => p.id === (this.order?.target ?? this.level.restaurant))!; }
  finish(reason: NonNullable<Game['endReason']>) {
    this.endReason = reason; this.phase = 'gameover';
    this.emit('gameover', reason === 'delivered' ? 'All orders delivered!' : reason === 'tips' ? 'Every remaining tip is below zero.' : 'No saucers remaining.', { endReason: reason });
  }
  checkEnd() {
    if (this.orders.length && this.delivered === this.orders.length) this.finish('delivered');
    else if (this.orders.length && this.scheduledCount === 0 && this.orders.filter(order => order.status !== 'delivered').every(order => this.tipFor(order) < 0)) this.finish('tips');
  }
  emit(type: GameEvent['type'], message: string, details: Pick<GameEvent, 'endReason' | 'hardLanding'> = {}) { this.events.push({ type, message, x: this.ship.x, y: this.ship.y, ...details }); }
  toggleGear() {
    if (this.phase !== 'playing') return;
    this.ship.gear = !this.ship.gear;
    if (!this.ship.gear) { this.ship.landed = null; this.servicedPad = null; this.dwell = 0; this.landingBounceTime = 0; }
    this.emit('gear', this.ship.gear ? 'Gear extended. Side thrusters locked. Keep an eye on your drift.' : 'Gear retracted. Side thrusters ready.');
  }
  pause() {
    if (this.phase === 'playing' || this.phase === 'countdown' || this.phase === 'crashed') {
      this.pausedPhase = this.phase; this.phase = 'paused';
    } else if (this.phase === 'paused') this.phase = this.pausedPhase;
  }
  crash(message: string) {
    if (this.phase !== 'playing') return;
    this.lives--; this.ship.landed = null; this.crashTime = 0; this.dwell = 0; this.servicedPad = null; this.landingBounceTime = 0;
    this.emit('crash', message);
    this.phase = 'crashed';
  }
  updateTilt(dt: number, direction: number) {
    // Cosmetic input-driven banking, with three times the previous response speed.
    const target = direction * 25 * Math.PI / 180;
    this.tilt += (target - this.tilt) * (1 - Math.exp(-12 * dt));
    if (Math.abs(target - this.tilt) < .001) this.tilt = target;
  }
  step(dt: number, controls: Controls) {
    if (this.phase === 'ready' || this.phase === 'paused' || this.phase === 'gameover') return;
    if (this.phase === 'countdown') {
      this.countdownTime = Math.max(0, this.countdownTime - dt);
      if (this.countdownTime < 1e-9) { this.countdownTime = 0; this.phase = 'playing'; }
      return;
    }
    // The final explosion plays before game over; the completed shift stays frozen.
    if (this.phase === 'crashed' && this.lives === 0) {
      this.crashTime += dt;
      if (this.crashTime + 1e-9 >= CRASH_DURATION) this.finish('lives');
      return;
    }
    // Callers use a fixed 120 Hz timestep. Long gaps are discarded by the render loop.
    const previousTime = this.time;
    this.time += dt;
    for (const order of this.orders) {
      if (order.status === 'delivered') continue;
      if (order.status === 'scheduled' && this.time >= order.availableAt) {
        order.status = 'waiting';
        this.emit('arrival', `Order #${order.id} ready at Zeta Burger · Pad ${order.target}`);
      }
      if (order.status !== 'scheduled') order.elapsed += this.time - Math.max(previousTime, order.availableAt);
    }
    this.checkEnd();
    if (this.endReason !== null) return;
    if (this.phase === 'crashed') {
      this.crashTime += dt;
      if (this.crashTime + 1e-9 >= CRASH_DURATION) { this.ship = this.spawnAtStation(); this.fuel = FUEL.capacity; this.tilt = 0; this.lowFuelWarned = false; this.phase = 'playing'; this.emit('respawn', 'Fresh saucer with a full tank. Your orders keep ticking.'); }
      return;
    }
    const s = this.ship;
    const up = controls.up && this.fuel > 0;
    if (s.landed !== null) {
      if (!up) {
        this.landingBounceTime = Math.max(0, this.landingBounceTime - dt);
        if (this.landingBounceTime < 1e-9) this.landingBounceTime = 0;
        this.updateTilt(dt, 0);
        this.dwell += dt;
        if (s.landed === this.level.gasStation) {
          this.fuel = Math.min(FUEL.capacity, this.fuel + FUEL.refillRate * dt);
          if (this.fuel > FUEL.low) this.lowFuelWarned = false;
        }
        this.service(); return;
      }
      s.landed = null; this.servicedPad = null; this.dwell = 0; this.landingBounceTime = 0;
      s.gear = false;
      this.emit('gear', 'Lift-off! Landing gear automatically retracted.');
    }
    const previous = { ...s };
    const direction = !s.gear && this.fuel > 0 ? Number(controls.right) - Number(controls.left) : 0;
    const cost = ((up ? FUEL.upRate : 0) + Math.abs(direction) * FUEL.sideRate) * dt;
    const power = cost > 0 ? Math.min(1, this.fuel / cost) : 0;
    this.fuel = Math.max(0, this.fuel - cost);
    if (this.fuel <= FUEL.low && !this.lowFuelWarned) {
      this.lowFuelWarned = true; this.emit('fuel', `Low fuel! Land at the gas station on pad ${this.level.gasStation} to refill.`);
    }
    s.vy += (PHYSICS.gravity - (up ? PHYSICS.upThrust * power : 0)) * dt;
    s.vx += direction * PHYSICS.sideThrust * power * dt;
    // Collision geometry stays upright, regardless of the visible tilt.
    this.updateTilt(dt, s.gear ? 0 : Number(controls.right) - Number(controls.left));
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x - 24 <= 0 || s.x + 24 >= WORLD_WIDTH || s.y - 17 <= 0 || s.y + (s.gear ? PHYSICS.footY : 8) >= WORLD_HEIGHT - 12) {
      this.crash('World edge impact. Stay inside the flight zone.'); return;
    }
    const body = shipBody(s);
    for (const solid of this.level.solids) {
      if (intersects(body, solid.points)) { this.crash('Hull impact. Only your landing gear can touch a pad.'); return; }
    }
    if (!s.gear) return;
    // Only a downward crossing with both feet inside the pad can become a landing.
    for (const pad of this.level.pads) {
      const crossed = previous.y + PHYSICS.footY <= pad.y + .001 && s.y + PHYSICS.footY >= pad.y && s.vy >= 0;
      const feetInside = s.x - PHYSICS.footX - 3 >= pad.x && s.x + PHYSICS.footX + 3 <= pad.x + pad.width;
      if (crossed && feetInside) {
        if (s.vy > PHYSICS.safeVertical || Math.abs(s.vx) > PHYSICS.safeHorizontal) {
          this.crash(`Hard landing. Descend at or below ${PHYSICS.safeVertical}; sideways drift at or below ${PHYSICS.safeHorizontal}.`); return;
        }
        const nearCrash = s.vy >= PHYSICS.safeVertical * LANDING_BOUNCE.nearCrashRatio || Math.abs(s.vx) >= PHYSICS.safeHorizontal * LANDING_BOUNCE.nearCrashRatio;
        this.landingBounceTime = nearCrash ? LANDING_BOUNCE.duration : 0;
        s.y = pad.y - PHYSICS.footY; s.vx = 0; s.vy = 0; s.landed = pad.id; this.dwell = 0;
        this.emit('land', `${pad.name} · ${nearCrash ? 'Close call! Almost a fatal landing' : 'Docked'} at pad ${pad.id}`, { hardLanding: nearCrash });
        return;
      }
    }
    for (const gear of gearShapes(s)) {
      for (const solid of this.level.solids) {
        if (intersects(gear, solid.points)) { this.crash('Landing gear impact. Approach the top of a pad with both feet.'); return; }
      }
    }
  }
  service() {
    if (this.dwell < PHYSICS.dwell || this.ship.landed === this.servicedPad) return;
    const id = this.ship.landed;
    if (id === this.level.restaurant && !this.order && this.waitingOrders.length) {
      const order = this.waitingOrders[0]; order.status = 'onboard'; this.servicedPad = id;
      this.emit('pickup', `Order #${order.id} loaded! Pad ${order.target} · Tip $${this.tip.toFixed(2)}`);
    } else if (this.order && id === this.order.target) {
      this.servicedPad = id;
      const earned = Math.round(this.tip * 100) / 100;
      this.bank = Math.round((this.bank + earned) * 100) / 100;
      this.delivered++; this.order.status = 'delivered';
      this.emit('delivery', `Delivered! ${earned < 0 ? '−' : '+'}$${Math.abs(earned).toFixed(2)} · Head back to Zeta Burger`);
      this.checkEnd();
    }
  }
}
