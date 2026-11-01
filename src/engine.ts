import { WORLD_WIDTH, WORLD_HEIGHT, intersects, rectangle, sweepContact, padAtTime, padVelocity, createSolids, currentVelocity, currentOffset } from './world.js';
import type { Point, Pad, Solid } from './world.js';
import { LEVELS, SKILLS } from './levels.js';
import type { Level, Skill } from './levels.js';
import { LIGHTNING, createLightning, lightningBodies, windVelocity } from './storm.js';
import type { LightningStrike } from './storm.js';
export const PHYSICS = { upThrust: 285, downThrust: 285, sideThrust: 180, footY: 22, footX: 16, safeVertical: 120, safeHorizontal: 100, dwell: .8 };
export const LANDING_BOUNCE = { duration: .25, count: 3, height: 10, nearCrashRatio: .75 };
export const ZERO_G = { clingDelay: .25, rebound: 8 };
export const CRASH_DURATION = 1.5;
export const START_DELAY = 3;
export const FUEL = { capacity: 100, upRate: 1.8, downRate: 1.8, sideRate: .9, refillRate: 25, low: 25 };
export const FALLING_OBSTACLES = { spawnDelay: 1, intervalMin: .8, intervalMax: 1.6, speedMin: 140, speedMax: 220, angleMax: 35 * Math.PI / 180, radiusMin: 10, radiusMax: 18 };
export interface FallingObstacle { id: number; x: number; y: number; vx: number; vy: number; radius: number }
// The ship has no speed cap. Use a typical 120-unit/sec flight speed as the
// reference: seekers average one quarter of that, even when the ship is still.
export const SEEKERS = { speed: 30, radius: 28, turnRate: 1.4, pulsePeriod: 2.8, wanderMin: 2, wanderMax: 4, spawnClearance: 200 };
export interface Seeker { id: number; x: number; y: number; vx: number; vy: number; radius: number; age: number; phase: number; wanderAngle: number; wanderTime: number }
export function seekerBody(seeker: Seeker): Point[] {
  return Array.from({ length: 12 }, (_, i) => ({ x: seeker.x + Math.cos(i * Math.PI / 6) * seeker.radius, y: seeker.y + Math.sin(i * Math.PI / 6) * seeker.radius }));
}
export function fallingObstacleBody(obstacle: FallingObstacle): Point[] {
  return Array.from({ length: 8 }, (_, i) => ({ x: obstacle.x + Math.cos(i * Math.PI / 4) * obstacle.radius, y: obstacle.y + Math.sin(i * Math.PI / 4) * obstacle.radius }));
}
export interface Controls { left: boolean; right: boolean; up: boolean; down: boolean }
export function verticalThrustDirection(controls: Controls): number { return (controls.up ? 1 : 0) - (controls.down ? 1 : 0); }
export interface Ship { x: number; y: number; vx: number; vy: number; gear: boolean; landed: number | null }
export interface Order { id: number; target: number; initialTip: number; elapsed: number; availableAt: number; status: 'scheduled' | 'waiting' | 'onboard' | 'delivered' }
export type EndReason = 'delivered' | 'tips' | 'lives';
export type GameEvent = { type: 'crash' | 'lightning' | 'falling-obstacle-impact' | 'land' | 'clamp' | 'pickup' | 'delivery' | 'respawn' | 'gear' | 'arrival' | 'fuel' | 'gameover'; message: string; x: number; y: number; endReason?: EndReason; hardLanding?: boolean };
export type Phase = 'ready' | 'countdown' | 'playing' | 'idle' | 'paused' | 'crashed' | 'gameover';
export function shipBody(ship: Ship): Point[] {
  return [{ x: ship.x - 24, y: ship.y }, { x: ship.x - 13, y: ship.y - 7 }, { x: ship.x - 9, y: ship.y - 17 }, { x: ship.x + 9, y: ship.y - 17 }, { x: ship.x + 13, y: ship.y - 7 }, { x: ship.x + 24, y: ship.y }, { x: ship.x + 19, y: ship.y + 8 }, { x: ship.x - 19, y: ship.y + 8 }];
}
export function gearShapes(ship: Ship): Point[][] {
  return [-PHYSICS.footX, PHYSICS.footX].map(offset => rectangle(ship.x + offset - 3, ship.y + 8, 6, PHYSICS.footY - 8));
}
export class Game {
  phase: Phase = 'ready';
  designMode = false;
  editing = false;
  ship: Ship;
  lives = 3;
  bank = 0;
  delivered = 0;
  orders: Order[] = [];
  skill: Skill = 'normal';
  level: Level;
  // Live geometry belongs to this shift; level definitions stay at their origin.
  pads: Pad[];
  solids: Solid[];
  endReason: EndReason | null = null;
  fuel = FUEL.capacity;
  tilt = 0;
  landingBounceTime = 0;
  lowFuelWarned = false;
  events: GameEvent[] = [];
  fallingObstacles: FallingObstacle[] = [];
  seekers: Seeker[] = [];
  lightning: LightningStrike[] = [];
  private lightningSpawnTime = LIGHTNING.spawnDelay;
  private nextLightningId = 0;
  private fallingObstacleSpawnTime = FALLING_OBSTACLES.spawnDelay;
  private nextFallingObstacleId = 0;
  dwell = 0;
  crashTime = 0;
  countdownTime = 0;
  private pausedPhase: Phase = 'playing';
  time = 0;
  servicedPad: number | null = null;
  random: () => number;
  constructor(random: () => number = Math.random, level: Level = LEVELS[0]) { this.random = random; this.level = level; this.pads = level.pads; this.solids = level.solids; this.ship = this.spawn(); }
  spawn(): Ship {
    return { ...this.level.start, vx: 0, vy: 0, gear: false, landed: null };
  }
  spawnAtStation(): Ship {
    const station = this.pads.find(p => p.id === (this.level.gasStation ?? this.level.restaurant))!;
    return { x: station.x + station.width / 2, y: station.y - PHYSICS.footY, ...this.stationVelocity(station), gear: true, landed: station.id };
  }
  private stationVelocity(pad: Pad): { vx: number; vy: number } {
    const velocity = padVelocity(pad, this.time, this.level.current);
    return { vx: velocity.x, vy: velocity.y };
  }
  private updateStations() {
    if (!this.level.current && !this.level.pads.some(pad => pad.motion)) return;
    this.pads = this.level.pads.map(pad => padAtTime(pad, this.time, this.level.current));
    this.solids = createSolids(this.pads, this.level.structures);
  }
  get clinging(): boolean { return this.ship.landed !== null && (this.level.gravityWell !== undefined || this.level.gravity > 0 || this.dwell + 1e-9 >= ZERO_G.clingDelay); }
  get needsLandingThrust(): boolean { return this.ship.landed !== null && !this.clinging; }
  get serviceDelay(): number { return this.level.gravity === 0 ? ZERO_G.clingDelay : PHYSICS.dwell; }
  start(skill: Skill = this.skill, level: Level = this.level, options: { carryBank?: boolean; designMode?: boolean; editing?: boolean } = {}) {
    this.skill = skill; this.level = level;
    this.editing = options.editing ?? false;
    this.designMode = this.editing || (options.designMode ?? this.designMode);
    this.ship = this.spawn(); this.lives = 3; this.bank = options.carryBank ? this.bank : 0; this.delivered = 0;
    this.orders = []; this.events = []; this.dwell = 0; this.crashTime = 0; this.time = 0;
    this.pads = level.pads; this.solids = level.solids;
    this.fallingObstacles = []; this.fallingObstacleSpawnTime = FALLING_OBSTACLES.spawnDelay; this.nextFallingObstacleId = 0;
    this.lightning = []; this.lightningSpawnTime = LIGHTNING.spawnDelay; this.nextLightningId = 0;
    this.fuel = FUEL.capacity; this.tilt = 0; this.landingBounceTime = 0; this.lowFuelWarned = false; this.endReason = null;
    const setting = SKILLS[skill];
    // The first order always arrives five seconds into the shift.
    let availableAt = 5;
    for (let id = 1; id <= (level.destinations.length ? setting.orders : 0); id++) {
      if (id > 1) availableAt += setting.arrivalMin + this.random() * (setting.arrivalMax - setting.arrivalMin);
      const target = level.destinations[Math.min(level.destinations.length - 1, Math.floor(this.random() * level.destinations.length))];
      const initialTip = Math.round((5 + this.random() * 5) * 100) / 100;
      this.orders.push({ id, target, initialTip, elapsed: 0, availableAt, status: 'scheduled' });
    }
    this.spawnSeekers();
    this.servicedPad = null; this.countdownTime = this.designMode ? 0 : START_DELAY;
    this.pausedPhase = 'playing'; this.phase = this.designMode ? 'idle' : 'countdown';
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
  get destination(): Pad { return this.pads.find(p => p.id === (this.order?.target ?? this.level.restaurant))!; }
  finish(reason: NonNullable<Game['endReason']>) {
    if (this.designMode) return;
    this.endReason = reason; this.phase = 'gameover';
    this.emit('gameover', reason === 'delivered' ? 'All orders delivered!' : reason === 'tips' ? 'You’re fired! No remaining tip can keep your bank at or above $0.' : 'No saucers remaining.', { endReason: reason });
  }
  checkEnd() {
    if (this.orders.length && this.delivered === this.orders.length) this.finish('delivered');
    // Savings cover a negative tip; lose only when no remaining delivery can
    // leave a nonnegative bank balance, and no more orders are incoming.
    else if (this.orders.length && this.scheduledCount === 0 && this.orders.filter(order => order.status !== 'delivered').every(order => this.tipFor(order) < -this.bank)) this.finish('tips');
  }
  emit(type: GameEvent['type'], message: string, details: Pick<GameEvent, 'endReason' | 'hardLanding'> = {}) { this.events.push({ type, message, x: this.ship.x, y: this.ship.y, ...details }); }
  toggleGear() {
    if (this.phase !== 'playing') return;
    this.ship.gear = !this.ship.gear;
    if (!this.ship.gear) { this.ship.landed = null; this.servicedPad = null; this.dwell = 0; this.landingBounceTime = 0; }
    this.emit('gear', this.ship.gear ? 'Gear extended. Side thrusters locked. Keep an eye on your drift.' : 'Gear retracted. Side thrusters ready.');
  }
  pause() {
    if (this.editing) return;
    if (this.phase === 'playing' || this.phase === 'idle' || this.phase === 'countdown' || this.phase === 'crashed') {
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
    if (this.editing) return;
    const previousPhase = this.phase, previousShip = { ...this.ship };
    this.stepShip(dt, controls);
    // Flight hazards share gameplay pause/countdown/end rules. During replacement
    // delay they keep moving, but cannot hit the absent ship or its new spawn.
    if ((previousPhase === 'playing' || previousPhase === 'idle' || previousPhase === 'crashed') && this.endReason === null && this.lives > 0) {
      this.stepFallingObstacles(dt, previousShip, previousPhase === 'playing' && this.phase === 'playing');
      this.stepSeekers(dt, previousShip, previousPhase === 'playing' && this.phase === 'playing');
      this.stepLightning(dt, previousShip, previousPhase === 'playing' && this.phase === 'playing');
    }
  }
  private stepLightning(dt: number, previousShip: Ship, canHitShip: boolean) {
    if (!this.level.storm || dt <= 0) return;
    const shipDelta = { x: this.ship.x - previousShip.x, y: this.ship.y - previousShip.y };
    const shapes = [shipBody(previousShip), ...(this.ship.gear ? gearShapes(previousShip) : [])];
    for (const strike of this.lightning) {
      const previousAge = strike.age;
      strike.age += dt;
      if (previousAge < LIGHTNING.warningDuration && strike.age >= LIGHTNING.warningDuration) {
        this.events.push({ type: 'lightning', message: '', x: strike.x, y: strike.y });
      }
      // Clip the ship sweep to the live portion of the flash. Warnings and
      // expired bolts cannot kill a ship that crossed their location earlier.
      const from = Math.max(0, (LIGHTNING.warningDuration - previousAge) / dt);
      const to = Math.min(1, (LIGHTNING.warningDuration + LIGHTNING.strikeDuration - previousAge) / dt);
      if (canHitShip && this.phase === 'playing' && from <= to && to >= 0 && from <= 1) {
        const delta = { x: shipDelta.x * (to - from), y: shipDelta.y * (to - from) };
        if (lightningBodies(strike).some(body => shapes.some(shape => sweepContact(
          shape.map(p => ({ x: p.x + shipDelta.x * from, y: p.y + shipDelta.y * from })), body, delta) !== null))) {
          this.crash('Lightning strike! Clear the glowing ground charge before the bolt flashes.');
        }
      }
    }
    this.lightning = this.lightning.filter(strike => strike.age < LIGHTNING.warningDuration + LIGHTNING.strikeDuration);
    this.lightningSpawnTime -= dt;
    if (this.lightningSpawnTime <= 0) {
      // Sometimes threaten the ship's current column; never track it after warning.
      const x = this.random() < .35 ? Math.max(35, Math.min(WORLD_WIDTH - 35, this.ship.x)) : 35 + this.random() * (WORLD_WIDTH - 70);
      this.lightning.push(createLightning(this.nextLightningId++, x, this.random));
      this.lightningSpawnTime = LIGHTNING.intervalMin + this.random() * (LIGHTNING.intervalMax - LIGHTNING.intervalMin);
    }
  }
  private spawnSeekers() {
    this.seekers = Array.from({ length: this.level.seekerCount }, (_, id) => {
      // Spread clouds across the field, with a clear corridor at the ship spawn.
      const radius = SEEKERS.radius;
      const x = radius + (id + .25 + this.random() * .5) / this.level.seekerCount * (WORLD_WIDTH - radius * 2);
      let y = 150 + this.random() * (WORLD_HEIGHT - 230);
      if (Math.hypot(x - this.ship.x, y - this.ship.y) < SEEKERS.spawnClearance) y = this.ship.y + SEEKERS.spawnClearance;
      const wanderAngle = this.random() * Math.PI * 2;
      return { id, x, y, vx: Math.cos(wanderAngle) * SEEKERS.speed, vy: Math.sin(wanderAngle) * SEEKERS.speed,
        radius, age: 0, phase: this.random() * Math.PI * 2, wanderAngle,
        wanderTime: SEEKERS.wanderMin + this.random() * (SEEKERS.wanderMax - SEEKERS.wanderMin) };
    });
  }
  private stepSeekers(dt: number, previousShip: Ship, canHitShip: boolean) {
    const hunting = canHitShip && this.ship.landed === null;
    const shipDelta = { x: this.ship.x - previousShip.x, y: this.ship.y - previousShip.y };
    const shipShapes = [shipBody(previousShip), ...(this.ship.gear ? gearShapes(previousShip) : [])];
    const drift = currentOffset(this.level.current, this.time) - currentOffset(this.level.current, this.time - dt);
    for (const seeker of this.seekers) {
      seeker.age += dt;
      if (!hunting) {
        seeker.wanderTime -= dt;
        if (seeker.wanderTime <= 0) {
          seeker.wanderAngle = this.random() * Math.PI * 2;
          seeker.wanderTime = SEEKERS.wanderMin + this.random() * (SEEKERS.wanderMax - SEEKERS.wanderMin);
        }
      }
      const beat = seeker.age * Math.PI * 2 / SEEKERS.pulsePeriod + seeker.phase;
      const angle = hunting ? Math.atan2(this.ship.y - seeker.y, this.ship.x - seeker.x) : seeker.wanderAngle;
      // A soft contraction accelerates the cloud, followed by a drifting glide.
      // Small lateral undulations and eased steering keep pursuit organic.
      const speed = SEEKERS.speed * (1 + .35 * Math.sin(beat));
      const sway = Math.sin(beat * .5) * .18;
      const blend = 1 - Math.exp(-SEEKERS.turnRate * dt);
      seeker.vx += (Math.cos(angle + sway) * speed - seeker.vx) * blend;
      seeker.vy += (Math.sin(angle + sway) * speed - seeker.vy) * blend;
      // Clouds ignore every solid and each other. Only the field bounds contain them.
      const delta = { x: Math.max(seeker.radius, Math.min(WORLD_WIDTH - seeker.radius, seeker.x + seeker.vx * dt + drift)) - seeker.x,
        y: Math.max(seeker.radius, Math.min(WORLD_HEIGHT - 12 - seeker.radius, seeker.y + seeker.vy * dt)) - seeker.y };
      if (hunting && this.phase === 'playing') {
        const body = seekerBody(seeker);
        if (shipShapes.some(shape => sweepContact(body, shape, delta, shipDelta) !== null)) {
          this.crash('Seeker contact! Land on a pad to shelter from roaming hazards.');
        }
      }
      seeker.x += delta.x; seeker.y += delta.y;
      if (seeker.x <= seeker.radius || seeker.x >= WORLD_WIDTH - seeker.radius) {
        seeker.vx = seeker.x <= seeker.radius ? Math.abs(seeker.vx) : -Math.abs(seeker.vx);
        seeker.wanderAngle = Math.PI - seeker.wanderAngle;
      }
      if (seeker.y <= seeker.radius || seeker.y >= WORLD_HEIGHT - 12 - seeker.radius) {
        seeker.vy = seeker.y <= seeker.radius ? Math.abs(seeker.vy) : -Math.abs(seeker.vy);
        seeker.wanderAngle = -seeker.wanderAngle;
      }
    }
  }
  private stepFallingObstacles(dt: number, previousShip: Ship, canHitShip: boolean) {
    if (this.level.fallingObstacleLimit === 0) return;
    this.fallingObstacleSpawnTime -= dt;
    if (this.fallingObstacleSpawnTime <= 0) {
      if (this.fallingObstacles.length < this.level.fallingObstacleLimit) {
        const radius = FALLING_OBSTACLES.radiusMin + this.random() * (FALLING_OBSTACLES.radiusMax - FALLING_OBSTACLES.radiusMin);
        const angle = (this.random() * 2 - 1) * FALLING_OBSTACLES.angleMax;
        const speed = FALLING_OBSTACLES.speedMin + this.random() * (FALLING_OBSTACLES.speedMax - FALLING_OBSTACLES.speedMin);
        this.fallingObstacles.push({ id: this.nextFallingObstacleId++, x: radius + this.random() * (WORLD_WIDTH - radius * 2), y: -radius, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, radius });
      }
      this.fallingObstacleSpawnTime = FALLING_OBSTACLES.intervalMin + this.random() * (FALLING_OBSTACLES.intervalMax - FALLING_OBSTACLES.intervalMin);
    }
    const shipDelta = { x: this.ship.x - previousShip.x, y: this.ship.y - previousShip.y };
    const shipShapes = [shipBody(previousShip), ...(this.ship.gear ? gearShapes(previousShip) : [])];
    type Contact = { obstacle: FallingObstacle; time: number; other?: FallingObstacle; ship?: boolean };
    const contacts: Contact[] = [];
    const bodies = this.fallingObstacles.map(fallingObstacleBody);
    const deltas = this.fallingObstacles.map(obstacle => ({ x: obstacle.vx * dt, y: obstacle.vy * dt }));
    this.fallingObstacles.forEach((obstacle, i) => {
      const delta = deltas[i], body = bodies[i];
      for (const solid of this.level.solids) {
        if (solid.padId === null) {
          const time = sweepContact(body, solid.points, delta);
          if (time !== null) contacts.push({ obstacle, time });
          continue;
        }
        const pad = this.level.pads.find(pad => pad.id === solid.padId)!;
        const before = padAtTime(pad, this.time - dt, this.level.current), after = padAtTime(pad, this.time, this.level.current);
        const stationDelta = { x: after.x - before.x, y: after.y - before.y };
        const points = solid.points.map(p => ({ x: p.x + before.x - pad.x, y: p.y + before.y - pad.y }));
        const time = sweepContact(body, points, delta, stationDelta);
        if (time !== null) contacts.push({ obstacle, time });
      }
      if (canHitShip) for (const shape of shipShapes) {
        const time = sweepContact(body, shape, delta, shipDelta);
        if (time !== null) contacts.push({ obstacle, time, ship: true });
      }
      // The top is an entry point; sides and the world floor are impact surfaces.
      const edges = [
        delta.x < 0 && obstacle.x + delta.x <= obstacle.radius ? (obstacle.radius - obstacle.x) / delta.x : null,
        delta.x > 0 && obstacle.x + delta.x >= WORLD_WIDTH - obstacle.radius ? (WORLD_WIDTH - obstacle.radius - obstacle.x) / delta.x : null,
        obstacle.y + delta.y >= WORLD_HEIGHT - 12 - obstacle.radius ? (WORLD_HEIGHT - 12 - obstacle.radius - obstacle.y) / delta.y : null
      ];
      for (const time of edges) if (time !== null) contacts.push({ obstacle, time: Math.max(0, time) });
      for (let j = i + 1; j < this.fallingObstacles.length; j++) {
        const time = sweepContact(body, bodies[j], delta, deltas[j]);
        if (time !== null) contacts.push({ obstacle, time, other: this.fallingObstacles[j] });
      }
    });
    const destroyed = new Set<FallingObstacle>();
    const explode = (obstacle: FallingObstacle, time: number) => {
      destroyed.add(obstacle);
      this.events.push({ type: 'falling-obstacle-impact', message: '', x: obstacle.x + obstacle.vx * dt * time, y: obstacle.y + obstacle.vy * dt * time });
    };
    // Resolve the first surface reached, so a rock cannot hit a ship through terrain.
    contacts.sort((a, b) => a.time - b.time);
    for (const contact of contacts) {
      if (destroyed.has(contact.obstacle) || (contact.other && destroyed.has(contact.other)) || (contact.ship && this.phase !== 'playing')) continue;
      explode(contact.obstacle, contact.time);
      if (contact.other) explode(contact.other, contact.time);
      if (contact.ship) this.crash('Falling obstacle impact. Watch the sky!');
    }
    this.fallingObstacles = this.fallingObstacles.filter(obstacle => !destroyed.has(obstacle));
    for (const obstacle of this.fallingObstacles) { obstacle.x += obstacle.vx * dt; obstacle.y += obstacle.vy * dt; }
  }
  private stepShip(dt: number, controls: Controls) {
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
    const previousPads = this.pads;
    this.updateStations();
    for (const order of this.orders) {
      if (order.status === 'delivered') continue;
      if (order.status === 'scheduled' && this.time >= order.availableAt) {
        order.status = 'waiting';
        this.emit('arrival', `Order #${order.id} ready at ${this.level.pads.find(pad => pad.id === this.level.restaurant)!.name} · Pad ${order.target}`);
      }
      if (!this.designMode && order.status !== 'scheduled') order.elapsed += this.time - Math.max(previousTime, order.availableAt);
    }
    // Keep the world and dispatch running without physics, docking, or deaths.
    if (this.phase === 'idle') return;
    this.checkEnd();
    if (this.endReason !== null) return;
    if (this.phase === 'crashed') {
      this.crashTime += dt;
      if (this.crashTime + 1e-9 >= CRASH_DURATION) { this.ship = this.spawnAtStation(); this.dwell = this.serviceDelay; this.fuel = FUEL.capacity; this.tilt = 0; this.lowFuelWarned = false; this.phase = 'playing'; this.emit('respawn', 'Fresh saucer with a full tank. Your orders keep ticking.'); }
      return;
    }
    const s = this.ship;
    const vertical = this.fuel > 0 ? verticalThrustDirection(controls) : 0;
    const up = vertical > 0, down = vertical < 0;
    if (s.landed !== null) {
      const pad = this.pads.find(pad => pad.id === s.landed)!;
      const oldPad = previousPads.find(pad => pad.id === s.landed)!;
      s.x += pad.x - oldPad.x; s.y = pad.y - PHYSICS.footY;
      const velocity = this.stationVelocity(pad);
      const wasClinging = this.clinging;
      if (!up && (wasClinging || down)) {
        const heldTime = this.needsLandingThrust ? Math.min(dt, this.fuel / FUEL.downRate) : dt;
        if (this.needsLandingThrust) this.burnFuel(FUEL.downRate * heldTime);
        s.vx = velocity.vx; s.vy = velocity.vy;
        this.landingBounceTime = Math.max(0, this.landingBounceTime - dt);
        if (this.landingBounceTime < 1e-9) this.landingBounceTime = 0;
        this.updateTilt(dt, 0);
        this.dwell += heldTime;
        if (!wasClinging && this.clinging) this.emit('clamp', 'Landing clamp engaged. Release Down; thrust Up to take off.');
        if (s.landed === this.level.gasStation) {
          this.fuel = Math.min(FUEL.capacity, this.fuel + FUEL.refillRate * dt);
          if (this.fuel > FUEL.low) this.lowFuelWarned = false;
        }
        this.service(); return;
      }
      s.landed = null; this.servicedPad = null; this.dwell = 0; this.landingBounceTime = 0;
      // Without weight or a clamp, contact gives a small separating rebound.
      s.vx = velocity.vx; s.vy = velocity.vy - (up ? 0 : ZERO_G.rebound);
      if (up) {
        s.gear = false;
        this.emit('gear', 'Lift-off! Landing gear automatically retracted.');
      }
    }
    const previous = { ...s };
    const direction = !s.gear && this.fuel > 0 ? Number(controls.right) - Number(controls.left) : 0;
    const cost = ((up ? FUEL.upRate : down ? FUEL.downRate : 0) + Math.abs(direction) * FUEL.sideRate) * dt;
    const power = cost > 0 ? Math.min(1, this.fuel / cost) : 0;
    const thrust = power * (this.level.thrustScale ?? 1);
    this.burnFuel(cost);
    const current = this.level.current;
    // Water carries even an unpowered ship; sideways thrust can fight the flow.
    if (current) s.vx += (currentVelocity(current, this.time) - s.vx) * (1 - Math.exp(-current.drag * dt));
    const storm = this.level.storm;
    if (storm) s.vx += (windVelocity(storm, this.time) - s.vx) * (1 - Math.exp(-storm.drag * dt));
    s.vy += (this.level.gravity - (up ? PHYSICS.upThrust * thrust : 0) + (down ? PHYSICS.downThrust * thrust : 0)) * dt;
    s.vx += direction * PHYSICS.sideThrust * thrust * dt;
    const hole = this.level.gravityWell;
    if (hole) {
      const dx = hole.x - s.x, dy = hole.y - s.y, distance = Math.hypot(dx, dy);
      // Cap the acceleration near the horizon, including the exact center.
      const pull = Math.min(hole.maxAcceleration, hole.strength / Math.max(distance * distance, 1));
      if (distance > 0) { s.vx += dx / distance * pull * dt; s.vy += dy / distance * pull * dt; }
    }
    // Collision geometry stays upright, regardless of the visible tilt.
    this.updateTilt(dt, s.gear ? 0 : Number(controls.right) - Number(controls.left));
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (hole) {
      const horizon = Array.from({ length: 48 }, (_, i) => ({
        x: hole.x + Math.cos(i * Math.PI / 24) * hole.radius,
        y: hole.y + Math.sin(i * Math.PI / 24) * hole.radius
      }));
      const delta = { x: s.x - previous.x, y: s.y - previous.y };
      // Sweep the hull and feet so a fast crossing cannot skip the horizon.
      if ([shipBody(previous), ...(s.gear ? gearShapes(previous) : [])].some(shape => sweepContact(shape, horizon, delta) !== null)) {
        this.crash(this.level.star ? 'Stellar surface impact! Keep clear of the star and brake against the pull.' : 'Event horizon crossed! Keep to the outer rim and brake against the pull.'); return;
      }
    }
    if (s.x - 24 <= 0 || s.x + 24 >= WORLD_WIDTH || s.y - 17 <= 0 || s.y + (s.gear ? PHYSICS.footY : 8) >= WORLD_HEIGHT - 12) {
      this.crash('World edge impact. Stay inside the flight zone.'); return;
    }
    const body = shipBody(s);
    for (const solid of this.solids) {
      if (solid.padId === null) {
        if (sweepContact(shipBody(previous), solid.points, { x: s.x - previous.x, y: s.y - previous.y }) !== null) {
          this.crash(this.level.structures.find(structure => structure.id === solid.structureId)?.outline
            ? 'Cavern wall impact. Follow the open passages and land on numbered pads.'
            : 'Tower impact. Clear the rooftops before crossing the city.'); return;
        }
        continue;
      }
      const pad = this.pads.find(pad => pad.id === solid.padId)!;
      const oldPad = previousPads.find(pad => pad.id === solid.padId)!;
      const delta = { x: pad.x - oldPad.x, y: pad.y - oldPad.y };
      const swept = (pad.motion || current) && sweepContact(shipBody(previous), solid.points.map(p => ({ x: p.x - delta.x, y: p.y - delta.y })),
        { x: s.x - previous.x, y: s.y - previous.y }, delta) !== null;
      if (swept || intersects(body, solid.points)) { this.crash('Hull impact. Only your landing gear can touch a pad.'); return; }
    }
    if (!s.gear) return;
    // Only a downward crossing with both feet inside the pad can become a landing.
    for (const pad of this.pads) {
      const oldPad = previousPads.find(p => p.id === pad.id)!;
      const velocity = this.stationVelocity(pad);
      const vy = s.vy - velocity.vy, vx = s.vx - velocity.vx;
      const crossed = previous.y + PHYSICS.footY <= oldPad.y + .001 && s.y + PHYSICS.footY >= pad.y && vy >= 0;
      const distance = (s.y - previous.y) - (pad.y - oldPad.y);
      const contact = distance > 0 ? Math.max(0, Math.min(1, (oldPad.y - previous.y - PHYSICS.footY) / distance)) : 0;
      const contactX = previous.x + (s.x - previous.x) * contact - oldPad.x - (pad.x - oldPad.x) * contact;
      const feetInside = contactX - PHYSICS.footX - 3 >= 0 && contactX + PHYSICS.footX + 3 <= pad.width
        && s.x - PHYSICS.footX - 3 >= pad.x && s.x + PHYSICS.footX + 3 <= pad.x + pad.width;
      if (crossed && feetInside) {
        if (vy > PHYSICS.safeVertical || Math.abs(vx) > PHYSICS.safeHorizontal) {
          this.crash(`Hard landing. Descend at or below ${PHYSICS.safeVertical}; sideways drift at or below ${PHYSICS.safeHorizontal}.`); return;
        }
        const nearCrash = vy >= PHYSICS.safeVertical * LANDING_BOUNCE.nearCrashRatio || Math.abs(vx) >= PHYSICS.safeHorizontal * LANDING_BOUNCE.nearCrashRatio;
        this.landingBounceTime = nearCrash && this.level.gravity > 0 ? LANDING_BOUNCE.duration : 0;
        s.y = pad.y - PHYSICS.footY; s.vx = velocity.vx; s.vy = velocity.vy; s.landed = pad.id; this.dwell = 0;
        this.emit('land', `${pad.name} · ${this.needsLandingThrust ? 'Hold Down for 250 ms to clamp' : nearCrash ? 'Close call! Almost a fatal landing' : 'Docked'} at pad ${pad.id}`, { hardLanding: nearCrash });
        return;
      }
    }
    const previousGear = gearShapes(previous);
    for (const [index, gear] of gearShapes(s).entries()) {
      for (const solid of this.solids) {
        if (solid.kind === 'structure' && sweepContact(previousGear[index], solid.points, { x: s.x - previous.x, y: s.y - previous.y }) !== null) {
          this.crash('Landing gear impact. Approach the top of a numbered pad.'); return;
        }
        if (intersects(gear, solid.points)) { this.crash('Landing gear impact. Approach the top of a pad with both feet.'); return; }
      }
    }
  }
  private burnFuel(cost: number) {
    this.fuel = Math.max(0, this.fuel - cost);
    if (this.fuel <= FUEL.low && !this.lowFuelWarned) {
      this.lowFuelWarned = true; this.emit('fuel', this.level.gasStation === null ? 'Low fuel! This level has no fuel station.' : `Low fuel! Land at the gas station on pad ${this.level.gasStation} to refill.`);
    }
  }
  service() {
    if (this.dwell + 1e-9 < this.serviceDelay || this.ship.landed === this.servicedPad) return;
    const id = this.ship.landed;
    if (id === this.level.restaurant && !this.order && this.waitingOrders.length) {
      const order = this.waitingOrders[0]; order.status = 'onboard'; this.servicedPad = id;
      this.emit('pickup', `Order #${order.id} loaded! Pad ${order.target} · Tip $${this.tip.toFixed(2)}`);
    } else if (this.order && id === this.order.target) {
      this.servicedPad = id;
      const earned = Math.round(this.tip * 100) / 100;
      this.bank = Math.round((this.bank + earned) * 100) / 100;
      this.delivered++; this.order.status = 'delivered';
      this.emit('delivery', `Delivered! ${earned < 0 ? '−' : '+'}$${Math.abs(earned).toFixed(2)} · Head back to ${this.level.pads.find(pad => pad.id === this.level.restaurant)!.name}`);
      this.checkEnd();
    }
  }
}
