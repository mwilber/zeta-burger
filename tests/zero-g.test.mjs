import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PHYSICS, FUEL, START_DELAY, ZERO_G, CRASH_DURATION } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { padVelocity, WORLD_WIDTH, WORLD_HEIGHT } from '../dist/src/world.js';
import { svgRendererFixture } from './svg-fixture.mjs';

const zeroG = LEVELS.find(level => level.id === 'zero-g');
const luna = LEVELS.find(level => level.id === 'luna');
const idle = { up: false, down: false, left: false, right: false };
const down = { ...idle, down: true };
const dt = 1 / 120;
function playing(level = zeroG) {
  const game = new Game(() => .5, level); game.start('casual'); game.step(START_DELAY, idle);
  return game;
}
function fly(game, seconds, controls = idle) {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls);
}
function touchdown(game, id = 0, controls = down, relativeVy = 20, relativeVx = 0) {
  const pad = game.pads.find(p => p.id === id), velocity = padVelocity(pad, game.time);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .05,
    vx: velocity.x + relativeVx, vy: velocity.y + relativeVy, gear: true, landed: null };
  game.dwell = 0; game.servicedPad = null; game.step(dt, controls);
  assert.equal(game.ship.landed, id); assert.equal(game.phase, 'playing');
}

test('Zero G retains its identity and configurable gravity is validated and applied to every level', () => {
  assert.equal(zeroG.number, 5); assert.equal(zeroG.name, 'Zero G');
  assert.equal(nextLevel(zeroG).id, 'trick-or-treat');
  assert.equal(zeroG.gravity, 0); assert.ok(zeroG.pads.every(pad => pad.motion));
  assert.ok(LEVELS.filter(level => !level.gravityWell && !level.current && level.id !== 'zero-g').every(level => level.gravity === 100));
  const config = structuredClone(LEVEL_CONFIG.find(level => level.id === 'luna'));
  for (const gravity of [-1, NaN, Infinity, undefined]) assert.throws(() => createLevel({ ...config, gravity }), /gravity/);
  for (const gravity of [0, 45, 175]) {
    const game = playing(createLevel({ ...config, gravity }));
    fly(game, .5);
    assert.ok(Math.abs(game.ship.vy - gravity * .5) < 1e-9);
  }
  for (const motion of [{ x: -1, y: 1, period: 2 }, { x: 1, y: NaN, period: 2 }, { x: 1, y: 1, period: 0 }]) {
    config.pads[0].motion = motion;
    assert.throws(() => createLevel(config), /motion/);
  }
});

test('weightless flight preserves both axes of momentum with idle, empty fuel, and extended gear', () => {
  for (const gear of [true, false]) {
    const game = playing(); game.ship = { x: 400, y: 150, vx: 30, vy: 12, gear, landed: null };
    game.fuel = 0; fly(game, 1, { ...idle, up: true });
    assert.ok(Math.abs(game.ship.x - 430) < 1e-9); assert.ok(Math.abs(game.ship.y - 162) < 1e-9);
    assert.equal(game.ship.vx, 30); assert.equal(game.ship.vy, 12);
  }
  const game = playing(); fly(game, .3, down);
  const vy = game.ship.vy, fuel = game.fuel; fly(game, .3);
  assert.equal(game.ship.vy, vy); assert.equal(game.fuel, fuel);
  fly(game, .3, { ...idle, up: true }); assert.ok(Math.abs(game.ship.vy) < 1e-9);
});

test('only Zero G reduces every thruster to 30% acceleration while keeping normal fuel consumption', () => {
  assert.equal(zeroG.thrustScale, .3);
  const config = LEVEL_CONFIG.find(level => level.id === 'zero-g');
  for (const thrustScale of [-1, NaN, Infinity]) assert.throws(() => createLevel({ ...config, thrustScale }), /thrustScale/);
  // Check raw thruster acceleration in levels without environmental drag.
  // Srormfront's full thrust against wind is covered in stormfront.test.mjs.
  for (const level of LEVELS.filter(level => !level.gravityWell && !level.current && !level.storm)) for (const sign of [-1, 1]) {
    const game = playing(level), scale = level === zeroG ? .3 : 1;
    fly(game, .1, { up: sign < 0, down: sign > 0, left: sign < 0, right: sign > 0 });
    assert.ok(Math.abs(game.ship.vx - sign * PHYSICS.sideThrust * scale * .1) < 1e-9, level.name);
    const acceleration = level.gravity + sign * (sign < 0 ? PHYSICS.upThrust : PHYSICS.downThrust) * scale;
    assert.ok(Math.abs(game.ship.vy - acceleration * .1) < 1e-9, level.name);
    assert.ok(Math.abs(game.fuel - (FUEL.capacity - (FUEL.upRate + FUEL.sideRate) * .1)) < 1e-9, level.name);
  }
});

test('releasing downward thrust before 250 ms floats away and resets docking progress', () => {
  const game = playing(); touchdown(game); fly(game, .1, down);
  assert.equal(game.clinging, false);
  const pad = game.pads.find(p => p.id === 0);
  game.step(dt, idle);
  assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, true); assert.equal(game.dwell, 0);
  assert.ok(game.ship.vy < padVelocity(pad, game.time).y);
  touchdown(game); fly(game, .1, down); assert.equal(game.clinging, false);
  game.step(dt, { ...down, up: true }); assert.equal(game.ship.landed, null, 'balanced inputs exert no holding thrust');
  touchdown(game, 0, idle); game.step(dt, idle); assert.equal(game.ship.landed, null, 'an unpowered touchdown also rebounds');
});

test('holding down clamps at 250 ms, consumes fuel, and carries the ship for free until takeoff', () => {
  assert.equal(ZERO_G.clingDelay, .25);
  const game = playing(); touchdown(game);
  const fuel = game.fuel, relativeX = game.ship.x - game.pads.find(p => p.id === 0).x;
  fly(game, ZERO_G.clingDelay - dt, down); assert.equal(game.clinging, false);
  game.step(dt, down); assert.equal(game.clinging, true);
  assert.ok(Math.abs(game.fuel - (fuel - FUEL.downRate * ZERO_G.clingDelay)) < 1e-9);
  assert.equal(game.events.filter(e => e.type === 'clamp').length, 1);
  const latchedFuel = game.fuel; fly(game, 3);
  const pad = game.pads.find(p => p.id === 0);
  assert.ok(Math.abs(game.ship.x - pad.x - relativeX) < 1e-9);
  assert.equal(game.ship.y, pad.y - PHYSICS.footY); assert.equal(game.fuel, latchedFuel);
  const velocity = padVelocity(pad, game.time + dt);
  game.step(dt, { ...idle, up: true, right: true });
  assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false); assert.equal(game.clinging, false);
  assert.ok(game.ship.vx > velocity.x); assert.ok(game.ship.vy < velocity.y);
});

test('fuel exhaustion releases an unclamped ship; gear retraction releases a clamp with station momentum', () => {
  const game = playing(); touchdown(game); game.fuel = FUEL.downRate * dt / 2;
  game.step(dt, down); assert.equal(game.fuel, 0); assert.equal(game.clinging, false);
  game.step(dt, down); assert.equal(game.ship.landed, null);
  game.fuel = FUEL.capacity; touchdown(game); fly(game, 1, down);
  const velocity = { vx: game.ship.vx, vy: game.ship.vy };
  game.toggleGear(); assert.equal(game.ship.landed, null); assert.equal(game.dwell, 0);
  game.step(dt, idle); assert.equal(game.ship.vx, velocity.vx); assert.equal(game.ship.vy, velocity.vy);
});

test('station motion moves its buildings and collisions together, stays in bounds, and is isolated between games', () => {
  const game = playing(), other = playing(), original = structuredClone(zeroG);
  game.ship = game.spawnAtStation(); game.dwell = ZERO_G.clingDelay;
  for (let i = 0; i < 22 * 120; i++) {
    game.step(dt, idle);
    for (const pad of game.pads) {
      const base = zeroG.pads.find(p => p.id === pad.id), dx = pad.x - base.x, dy = pad.y - base.y;
      assert.ok(Math.abs(pad.building.x - base.building.x - dx) < 1e-9);
      assert.ok(Math.abs(pad.building.y - base.building.y - dy) < 1e-9);
      for (const solid of game.solids.filter(s => s.padId === pad.id)) {
        const old = zeroG.solids.find(s => s.padId === pad.id && s.kind === solid.kind);
        solid.points.forEach((p, j) => {
          assert.ok(Math.abs(p.x - old.points[j].x - dx) < 1e-9 && Math.abs(p.y - old.points[j].y - dy) < 1e-9);
          assert.ok(p.x > 0 && p.x < WORLD_WIDTH && p.y > 0 && p.y < WORLD_HEIGHT - 12);
        });
      }
    }
  }
  assert.notDeepEqual(game.pads, zeroG.pads); assert.deepEqual(zeroG, original); assert.deepEqual(other.pads, zeroG.pads);
  assert.equal(game.lives, 3);
});

test('clamp progress and stations freeze on pause, countdown, and final crash; replay and level changes reset them', () => {
  const game = playing(); touchdown(game); fly(game, .1, down); game.pause();
  const snapshot = JSON.stringify({ ship: game.ship, pads: game.pads, dwell: game.dwell, fuel: game.fuel });
  fly(game, 2, down); assert.equal(JSON.stringify({ ship: game.ship, pads: game.pads, dwell: game.dwell, fuel: game.fuel }), snapshot);
  game.pause(); fly(game, .15, down); assert.equal(game.clinging, true);
  game.lives = 1; game.crash('test'); const pads = structuredClone(game.pads); fly(game, CRASH_DURATION);
  assert.deepEqual(game.pads, pads); assert.equal(game.phase, 'gameover');
  game.start(); assert.equal(game.dwell, 0); assert.deepEqual(game.pads, zeroG.pads);
  fly(game, 2); assert.deepEqual(game.pads, zeroG.pads);
  game.start('casual', luna); assert.equal(game.level.gravity, 100); assert.deepEqual(game.pads, luna.pads);
});

test('replacement saucers arrive securely clamped at the moving gas station and refill safely', () => {
  const game = playing(); fly(game, 1); game.crash('test'); fly(game, CRASH_DURATION);
  assert.equal(game.ship.landed, zeroG.gasStation); assert.equal(game.clinging, true);
  game.fuel = 40; fly(game, 1); assert.ok(Math.abs(game.fuel - 65) < 1e-9); assert.equal(game.lives, 2);
  const pad = game.pads.find(p => p.id === zeroG.gasStation); assert.equal(game.ship.y, pad.y - PHYSICS.footY);
});

test('pickup and delivery wait for the landing clamp, and the clamp indicator and thrust are visible', () => {
  const game = playing(); game.orders[0].availableAt = 0;
  touchdown(game); fly(game, .2, down); assert.equal(game.order, null);
  const renderer = svgRendererFixture(); renderer.saucer(game, down, game.time);
  assert.equal(renderer.vertical.style.display, '');
  assert.equal(renderer.service.querySelector('[data-refuel]').textContent, 'HOLD ↓ TO CLAMP');
  fly(game, .05, down); assert.ok(game.order);
  renderer.saucer(game, down, game.time); assert.equal(renderer.vertical.style.display, 'none');
  assert.match(renderer.service.querySelector('[data-refuel]').textContent, /CLAMPED/);
  touchdown(game, game.order.target); fly(game, .2, down); assert.equal(game.delivered, 0);
  fly(game, .05, down); assert.equal(game.delivered, 1); assert.ok(game.bank > 0);
});

test('landing limits use speed relative to a moving pad, and its building remains fatal', () => {
  for (const relativeVy of [PHYSICS.safeVertical - PHYSICS.downThrust * dt, PHYSICS.safeVertical + 1]) {
    const game = playing();
    // Start at an orbital phase where the pad is moving upward.
    game.ship = game.spawnAtStation(); game.dwell = ZERO_G.clingDelay; fly(game, 2);
    const pad = game.pads.find(p => p.id === 0), velocity = padVelocity(pad, game.time);
    game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .05, vx: velocity.x, vy: velocity.y + relativeVy, gear: true, landed: null };
    game.step(dt, idle);
    assert.equal(game.phase, relativeVy > PHYSICS.safeVertical ? 'crashed' : 'playing');
  }
  const game = playing(); const building = game.pads.find(p => p.id === 0).building;
  Object.assign(game.ship, { x: building.x + 20, y: building.y + 30 }); game.step(dt, idle);
  assert.equal(game.phase, 'crashed');
});

test('a complete Zero G restaurant–delivery–restaurant flight works without teleporting or losing a life', () => {
  const game = playing();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function navigate(target, landId = null) {
    if (game.ship.gear !== (landId !== null)) game.toggleGear();
    for (let i = 0; i < 40 * 120; i++) {
      const point = target(), s = game.ship, dx = point.x - s.x, dy = point.y - s.y;
      const velocity = point.pad ? padVelocity(point.pad, game.time) : { x: 0, y: 0 };
      const desiredX = clamp(dx * 1.5, -100, 100) + velocity.x;
      const desiredY = (landId === null ? clamp(dy * 1.5, -80, 60) : clamp((dy + 10) * 1.5, 12, 45)) + velocity.y;
      const controls = s.landed !== null ? down : {
        left: !s.gear && s.vx > desiredX + .6, right: !s.gear && s.vx < desiredX - .6,
        up: s.vy > desiredY + .6, down: s.vy < desiredY - .6
      };
      game.step(dt, controls);
      assert.equal(game.phase, 'playing', game.events.at(-1)?.message);
      if (landId !== null && game.clinging) return;
      if (landId === null && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5
        && Math.abs(s.vx - velocity.x) < 3 && Math.abs(s.vy - velocity.y) < 3) return;
    }
    assert.fail(`Navigation timed out: ${JSON.stringify(game.ship)}`);
  }
  function approach(id, height) {
    return () => { const pad = game.pads.find(p => p.id === id); return { x: pad.x + pad.width / 2, y: pad.y - height, pad }; };
  }
  navigate(() => ({ x: 640, y: 125 }));
  navigate(() => ({ x: 428, y: 125 }));
  navigate(approach(0, 80)); navigate(approach(0, PHYSICS.footY), 0);
  while (!game.order) game.step(dt, idle);
  const target = game.order.target;
  fly(game, .25, { ...idle, up: true });
  const x = game.ship.x; navigate(() => ({ x, y: 125 }));
  navigate(() => ({ x: game.pads.find(p => p.id === target).x + 52, y: 125 }));
  navigate(approach(target, 80)); navigate(approach(target, PHYSICS.footY), target);
  assert.equal(game.delivered, 1); assert.ok(game.bank > 0);
  fly(game, .25, { ...idle, up: true });
  const returnX = game.ship.x; navigate(() => ({ x: returnX, y: 125 }));
  navigate(() => ({ x: 428, y: 125 }));
  navigate(approach(0, 80)); navigate(approach(0, PHYSICS.footY), 0);
  assert.equal(game.lives, 3); assert.ok(game.order); assert.ok(game.fuel > 0);
});
