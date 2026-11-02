import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PHYSICS, FUEL, START_DELAY, CRASH_DURATION, SEEKERS } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { currentOffset, currentVelocity, padVelocity, WORLD_WIDTH, WORLD_HEIGHT, intersects } from '../dist/src/world.js';

const abyss = LEVELS.find(level => level.id === 'abyss');
const config = LEVEL_CONFIG.find(level => level.id === 'abyss');
const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
function playing(level = abyss) {
  const game = new Game(() => .5, level); game.start('casual'); game.step(START_DELAY, idle); return game;
}
function fly(game, seconds, controls = idle) {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls);
}
function dock(game, id = 0) {
  const pad = game.pads.find(p => p.id === id), velocity = padVelocity(pad, game.time, game.level.current);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY, vx: velocity.x, vy: velocity.y, gear: true, landed: id };
  game.dwell = 0; game.servicedPad = null;
}
const fish = values => ({ id: 99, x: 250, y: 150, vx: 0, vy: 0, radius: SEEKERS.radius,
  age: 0, phase: 0, wanderAngle: 0, wanderTime: 3, ...values });

test('Abyss preserves its identity and progression behind Megalopolis', () => {
  assert.equal(nextLevel(LEVELS.find(l => l.id === 'megalopolis')), abyss);
  assert.deepEqual(LEVELS.map(l => [l.number, l.id]), [[12, 'blizzard'], [11, 'srormfront'], [10, 'grotto'], [9, 'freeman'], [8, 'megalopolis'], [7, 'abyss'], [6, 'event-horizon'], [5, 'zero-g'], [4, 'trick-or-treat'], [3, 'obsession'], [2, 'meteor-shower'], [1, 'luna']]);
  assert.equal(nextLevel(abyss).id, 'event-horizon');
  assert.equal(abyss.padCount, 7); assert.equal(abyss.seekerCount, 4); assert.equal(abyss.fallingObstacleLimit, 0);
  assert.equal(abyss.gravity, 35); assert.equal(abyss.thrustScale ?? 1, 1);
  assert.ok(LEVELS.filter(l => l !== abyss).every(l => l.current === undefined));
});

test('current configuration rejects invalid speeds, periods, and drag', () => {
  for (const key of ['speed', 'period', 'drag']) {
    for (const value of [NaN, Infinity, undefined, -1, ...(key === 'speed' ? [] : [0])]) {
      assert.throws(() => createLevel({ ...config, current: { ...config.current, [key]: value } }), /Level 7: invalid current/);
    }
  }
  assert.doesNotThrow(() => createLevel({ ...config, current: { ...config.current, speed: 0 } }));
});

test('the flow pushes an unpowered ship in both directions, with either gear setting', () => {
  for (const time of [0, abyss.current.period / 2]) for (const gear of [false, true]) {
    const game = playing(); dock(game); fly(game, time);
    Object.assign(game.ship, { x: 640, y: 80, vx: 0, vy: 0, gear, landed: null });
    game.seekers = []; game.fuel = 0;
    fly(game, .5, { ...idle, right: true, up: true });
    const sign = time === 0 ? 1 : -1;
    assert.ok(game.ship.vx * sign > 0); assert.ok((game.ship.x - 640) * sign > 0);
    assert.ok(Math.abs(game.ship.vy - abyss.gravity * .5) < 1e-9);
    assert.equal(game.fuel, 0); assert.equal(game.phase, 'playing');
  }
});

test('full-power sideways thrust overcomes flow and consumes the usual fuel', () => {
  for (const time of [0, abyss.current.period / 2]) for (const sign of [-1, 1]) {
    const game = playing(); dock(game); fly(game, time);
    Object.assign(game.ship, { x: 640, y: 80, vx: 0, vy: 0, gear: false, landed: null });
    game.seekers = [];
    const startTime = game.time;
    game.step(dt, { ...idle, left: sign < 0, right: sign > 0, up: true });
    const water = currentVelocity(abyss.current, startTime + dt) * (1 - Math.exp(-abyss.current.drag * dt));
    assert.ok(Math.abs(game.ship.vx - water - sign * PHYSICS.sideThrust * dt) < 1e-9);
    assert.ok(Math.abs(game.ship.vy - (abyss.gravity - PHYSICS.upThrust) * dt) < 1e-9);
    fly(game, .5 - dt, { ...idle, left: sign < 0, right: sign > 0 });
    assert.ok(sign * game.ship.vx > 0);
    assert.ok(Math.abs(game.fuel - (100 - FUEL.sideRate * .5 - FUEL.upRate * dt)) < 1e-9);
  }
});

test('stations, collision shapes, and docked ships ride a full current cycle safely', () => {
  const game = playing(), other = playing(), original = structuredClone(abyss);
  dock(game, abyss.gasStation); const offset = game.ship.x - game.pads[0].x;
  let left = false, right = false;
  for (let i = 0; i < abyss.current.period * 120; i++) {
    game.step(dt, idle);
    const dx = currentOffset(abyss.current, game.time);
    left ||= dx < -20; right ||= dx > 20;
    for (const pad of game.pads) {
      const base = abyss.pads.find(p => p.id === pad.id);
      assert.ok(Math.abs(pad.x - base.x - dx) < 1e-9); assert.equal(pad.y, base.y);
      assert.ok(Math.abs(pad.building.x - base.building.x - dx) < 1e-9);
      for (const solid of game.solids.filter(s => s.padId === pad.id)) {
        const old = abyss.solids.find(s => s.padId === pad.id && s.kind === solid.kind);
        solid.points.forEach((p, j) => {
          assert.ok(Math.abs(p.x - old.points[j].x - dx) < 1e-9); assert.equal(p.y, old.points[j].y);
          assert.ok(p.x > 0 && p.x < WORLD_WIDTH && p.y > 0 && p.y < WORLD_HEIGHT - 12);
        });
      }
    }
    assert.ok(Math.abs(game.ship.x - game.pads[0].x - offset) < 1e-9);
    assert.equal(game.ship.y, game.pads[0].y - PHYSICS.footY);
  }
  assert.ok(left && right); assert.equal(game.lives, 3); assert.equal(game.fuel, 100);
  assert.deepEqual(abyss, original); assert.deepEqual(other.pads, abyss.pads);
  for (const a of game.solids) for (const b of game.solids) {
    if (a.padId !== b.padId) assert.ok(!intersects(a.points, b.points));
  }
});

test('moving pads accept gentle landings, serve orders, release on lift-off, and refill replacements', () => {
  const game = playing(); game.seekers = [];
  game.orders[0].availableAt = 0;
  const touchdown = id => {
    const pad = game.pads.find(p => p.id === id), velocity = padVelocity(pad, game.time, abyss.current);
    game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .05,
      vx: velocity.x, vy: 20, gear: true, landed: null };
    game.dwell = 0; game.servicedPad = null; game.step(dt, idle);
    assert.equal(game.ship.landed, id); assert.equal(game.clinging, true);
  };
  touchdown(abyss.restaurant); fly(game, .79); assert.equal(game.order, null);
  fly(game, .02); assert.ok(game.order);
  const fuel = game.fuel; fly(game, .5); assert.equal(game.fuel, fuel);
  game.step(dt, { ...idle, up: true }); assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false);
  touchdown(game.order.target); fly(game, .81); assert.equal(game.delivered, 1); assert.ok(game.bank > 0);
  game.toggleGear(); assert.equal(game.ship.landed, null);
  game.crash('test'); fly(game, CRASH_DURATION);
  assert.equal(game.ship.landed, abyss.gasStation); assert.equal(game.clinging, true);
  game.fuel = 40; fly(game, 1); assert.ok(Math.abs(game.fuel - 65) < 1e-9); assert.equal(game.lives, 2);
});

test('fish pursue in open water, swim through scenery, wander around docked ships, and only hit in flight', () => {
  const game = playing();
  game.seekers = [fish({ x: 200, y: 80 })];
  fly(game, 1); assert.ok(game.seekers[0].x > 220); assert.ok(game.seekers[0].vx > 0);
  dock(game, abyss.gasStation);
  for (const solid of game.solids) {
    const x = solid.points.reduce((sum, p) => sum + p.x, 0) / solid.points.length;
    const y = solid.points.reduce((sum, p) => sum + p.y, 0) / solid.points.length;
    game.seekers = [fish({ x, y }), fish({ x, y, id: 100 })];
    game.step(dt, idle); assert.equal(game.seekers.length, 2); assert.equal(game.phase, 'playing');
  }
  game.seekers = [fish({ x: game.ship.x, y: game.ship.y, wanderTime: 0 })];
  game.step(dt, idle); assert.equal(game.lives, 3); assert.ok(game.seekers[0].wanderTime > 0);
  game.toggleGear(); game.step(dt, idle);
  assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2);
  fly(game, .1); assert.equal(game.lives, 2);
});

test('currents and fish freeze on countdown, pause, and final crash, then reset on restart and level change', () => {
  const game = new Game(() => .5, abyss); game.start();
  const snapshot = () => JSON.stringify({ ship: game.ship, pads: game.pads, fish: game.seekers, time: game.time });
  const start = snapshot(); fly(game, 2); assert.equal(snapshot(), start); fly(game, 1);
  dock(game); fly(game, .5); game.pause();
  const paused = snapshot(); fly(game, 2); assert.equal(snapshot(), paused);
  game.pause(); game.lives = 1; game.crash('test'); const final = snapshot();
  fly(game, CRASH_DURATION); assert.equal(game.phase, 'gameover'); assert.equal(snapshot(), final);
  fly(game, 1); assert.equal(snapshot(), final);
  game.start(); assert.equal(snapshot(), start);
  game.start('casual', LEVELS.find(level => level.id === 'event-horizon')); assert.deepEqual(game.seekers, []); assert.equal(game.level.current, undefined);
});

test('current-driven scenery cannot sweep through the ship between frames', () => {
  const game = playing(createLevel({ ...config, current: { ...config.current, speed: 30000, drag: 1e-9 } }));
  const building = game.pads.find(p => p.id === 0).building;
  Object.assign(game.ship, { x: building.x + building.width + 30, y: building.y + 30 });
  game.seekers = []; game.step(dt, idle);
  assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2); assert.match(game.events.at(-1).message, /Hull impact/);
});

test('a continuous restaurant–delivery–restaurant flight works across current reversals', () => {
  const game = new Game(() => 0, abyss); game.start('casual'); game.step(START_DELAY, idle);
  // Isolate navigation and moving-pad landings; fish contacts are covered above.
  game.seekers = [];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function navigate(target, landId = null) {
    if (game.ship.gear) game.toggleGear();
    for (let i = 0; i < 40 * 120; i++) {
      const point = target(), s = game.ship, dx = point.x - s.x, dy = point.y - s.y;
      const velocity = point.pad ? padVelocity(point.pad, game.time, abyss.current) : { x: 0, y: 0 };
      if (landId !== null && !s.gear && Math.abs(dx) < .8 && Math.abs(s.vx - velocity.x) < 1 && Math.abs(dy) < 12) game.toggleGear();
      const desiredX = clamp(dx * 1.8, -85, 85) + velocity.x;
      const desiredY = s.gear ? clamp((dy + 8) * 1.5, 12, 25) : clamp(dy * 1.8, -65, 65);
      game.step(dt, {
        left: !s.gear && s.vx > desiredX + .4, right: !s.gear && s.vx < desiredX - .4,
        up: s.landed !== null || s.vy > desiredY + .3, down: false
      });
      assert.equal(game.phase, 'playing', `${game.events.at(-1)?.message}; ship ${JSON.stringify(s)}`);
      if (landId !== null && s.landed === landId) return;
      if (landId === null && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5 && Math.abs(s.vx - velocity.x) < 3 && Math.abs(s.vy) < 3) return;
    }
    assert.fail(`Navigation timeout: ${JSON.stringify(game.ship)}`);
  }
  function approach(id, height = PHYSICS.footY) {
    return () => { const pad = game.pads.find(p => p.id === id); return { x: pad.x + pad.width / 2, y: pad.y - height, pad }; };
  }
  navigate(() => ({ x: 640, y: 110 })); navigate(() => ({ x: 428, y: 110 }));
  navigate(approach(0, 100)); navigate(approach(0), 0);
  while (!game.order) game.step(dt, idle);
  fly(game, .25, { ...idle, up: true });
  const departureX = game.ship.x; navigate(() => ({ x: departureX, y: 110 }));
  navigate(approach(1, 240)); navigate(approach(1, 100)); navigate(approach(1), 1); fly(game, 1);
  assert.equal(game.delivered, 1); assert.ok(game.bank > 0);
  fly(game, .25, { ...idle, up: true });
  const returnX = game.ship.x; navigate(() => ({ x: returnX, y: 110 }));
  navigate(() => ({ x: 428, y: 110 })); navigate(approach(0, 100)); navigate(approach(0), 0); fly(game, 1);
  assert.equal(game.lives, 3); assert.ok(game.order); assert.ok(game.fuel > 0);
});
