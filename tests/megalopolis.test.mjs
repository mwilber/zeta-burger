import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PHYSICS, START_DELAY, CRASH_DURATION } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel, levelAssetNames } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { WORLD_HEIGHT, rectangle, intersects } from '../dist/src/world.js';

const level = LEVELS.find(l => l.id === 'megalopolis');
const config = LEVEL_CONFIG.find(l => l.id === 'megalopolis');
const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
function playing(random = () => .5) {
  const game = new Game(random, level); game.start('casual'); game.step(START_DELAY, idle); return game;
}
function fly(game, seconds, controls = idle) {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls);
}
function touchdown(game, id) {
  const pad = game.pads.find(p => p.id === id);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .05, vx: 0, vy: 20, gear: true, landed: null };
  game.dwell = 0; game.servicedPad = null; game.step(dt, idle);
  assert.equal(game.phase, 'playing', game.events.at(-1)?.message);
  assert.equal(game.ship.landed, id);
}

test('Megalopolis starts the stack with four street-level barriers, four roofs, and three balconies', () => {
  assert.equal(new Game().level, level); assert.equal(LEVELS[0], level);
  assert.equal(level.number, 8); assert.equal(nextLevel(level).id, 'abyss');
  assert.equal(level.gravity, 100); assert.equal(level.thrustScale ?? 1, 1);
  assert.equal(level.seekerCount, 0); assert.equal(level.fallingObstacleLimit, 0);
  assert.equal(level.padCount, 7); assert.equal(level.structures.length, 4);
  const rooftops = level.pads.filter(p => p.island.length === 0);
  const balconies = level.pads.filter(p => p.island.length > 0);
  assert.deepEqual(rooftops.map(p => p.id), [6, 0, 2, 4]);
  assert.deepEqual(balconies.map(p => p.id), [1, 3, 5]);
  for (const tower of level.structures) {
    assert.equal(tower.y + tower.height, WORLD_HEIGHT);
    const solid = level.solids.find(s => s.structureId === tower.id);
    assert.deepEqual(solid.points, rectangle(tower.x, tower.y, tower.width, tower.height));
    assert.ok(levelAssetNames(level).includes(tower.kind));
  }
  for (const pad of rooftops) {
    assert.ok(level.structures.some(tower => tower.y === pad.y && tower.x <= pad.x && tower.x + tower.width >= pad.x + pad.width));
    assert.ok(!levelAssetNames(level).includes(`island-${pad.id}`));
  }
  for (const pad of balconies) {
    assert.ok(level.structures.some(tower => pad.y > tower.y && (pad.x === tower.x + tower.width || pad.x + pad.width === tower.x)));
  }
  assert.ok(level.solids.every(s => !intersects(rectangle(24, 75, 1232, 50), s.points)), 'open upper flight lane');
});

test('structure geometry, IDs, and asset names are validated', () => {
  const replace = update => ({ ...config, structures: [{ ...config.structures[0], ...update }] });
  for (const key of ['x', 'y', 'width', 'height']) {
    for (const value of [NaN, Infinity, undefined, ...(key === 'width' || key === 'height' ? [0, -1] : [])]) {
      assert.throws(() => createLevel(replace({ [key]: value })), /structure/);
    }
  }
  assert.throws(() => createLevel(replace({ id: '' })), /structure IDs/);
  assert.throws(() => createLevel({ ...config, structures: [config.structures[0], config.structures[0]] }), /structure IDs/);
  assert.throws(() => createLevel(replace({ kind: '../tower' })), /asset name/);
});

test('each rooftop and balcony allows safe docking, normal service, and upward lift-off', () => {
  for (const pad of level.pads) {
    const game = playing(); game.orders[0].availableAt = 0;
    if (level.destinations.includes(pad.id)) {
      game.orders[0].target = pad.id; game.orders[0].status = 'onboard';
    }
    touchdown(game, pad.id); fly(game, .79);
    assert.equal(game.delivered, 0); assert.equal(game.clinging, true);
    fly(game, .02);
    if (pad.id === level.restaurant) assert.ok(game.order);
    if (level.destinations.includes(pad.id)) assert.equal(game.delivered, 1);
    game.step(dt, { ...idle, up: true });
    assert.equal(game.ship.gear, false); assert.equal(game.ship.landed, null);
    assert.equal(game.phase, 'playing'); assert.equal(game.lives, 3);
  }
});

test('tower faces, unmarked roofs, and fast horizontal crossings are fatal', () => {
  for (const tower of level.structures) {
    const game = playing();
    Object.assign(game.ship, { x: tower.x + tower.width / 2, y: tower.y + 80 });
    game.step(dt, idle); assert.equal(game.phase, 'crashed'); assert.match(game.events.at(-1).message, /Tower impact/);
  }
  const roof = playing();
  roof.ship = { x: 205, y: 460 - PHYSICS.footY - .05, vx: 0, vy: 20, gear: true, landed: null };
  roof.step(dt, idle); assert.equal(roof.phase, 'crashed'); assert.equal(roof.ship.landed, null);
  const fast = playing();
  Object.assign(fast.ship, { x: 650, y: 300, vx: 36000 }); fast.step(dt, idle);
  assert.equal(fast.phase, 'crashed'); assert.equal(fast.lives, 2); assert.match(fast.events.at(-1).message, /Tower impact/);
  const gearOnly = playing();
  // The hull clears the roof while the feet cross it between frames.
  Object.assign(gearOnly.ship, { x: 650, y: 195, vx: 36000, gear: true }); gearOnly.step(dt, idle);
  assert.equal(gearOnly.phase, 'crashed'); assert.match(gearOnly.events.at(-1).message, /Landing gear impact/);
});

test('replacement ships dock on the fuel roof, refill, and clear city geometry on level changes', () => {
  const game = playing(); game.crash('test'); fly(game, CRASH_DURATION);
  assert.equal(game.ship.landed, level.gasStation); assert.equal(game.clinging, true);
  game.fuel = 40; fly(game, 1); assert.ok(Math.abs(game.fuel - 65) < 1e-9); assert.equal(game.lives, 2);
  game.start('casual', LEVELS.find(l => l.id === 'zero-g')); game.step(START_DELAY, idle);
  game.ship = game.spawnAtStation(); game.dwell = .25; game.step(dt, idle);
  assert.ok(game.solids.every(s => s.kind !== 'structure'));
  game.start('casual', level); assert.equal(game.solids.filter(s => s.kind === 'structure').length, 4);
});

function seek(game, x, y, landId = null) {
  if (game.ship.gear !== (landId !== null)) game.toggleGear();
  for (let i = 0; i < 40 * 120; i++) {
    const s = game.ship, dx = x - s.x, dy = y - s.y;
    const desiredX = Math.max(-100, Math.min(100, dx * 1.5));
    const desiredY = Math.max(-90, Math.min(50, (s.gear ? dy + 12 : dy) * 1.4));
    game.step(dt, { left: !s.gear && s.vx > desiredX + .6, right: !s.gear && s.vx < desiredX - .6, up: s.landed !== null || s.vy > desiredY, down: false });
    assert.equal(game.phase, 'playing', `${game.events.at(-1)?.message} heading to ${x},${y}; ship ${JSON.stringify(s)}`);
    if (landId !== null && s.landed === landId) return;
    if (landId === null && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5 && Math.abs(s.vx) < 3 && Math.abs(s.vy) < 3) return;
  }
  assert.fail(`Navigation timeout: ${JSON.stringify(game.ship)}`);
}
for (const target of level.destinations) test(`fly across the skyline to pad ${target} and return to the restaurant without losing a life`, () => {
  const game = playing(() => (target - .5) / 5);
  const restaurant = level.pads.find(p => p.id === level.restaurant), rx = restaurant.x + restaurant.width / 2;
  seek(game, 640, 110); seek(game, rx, 110); seek(game, rx, restaurant.y - 80); seek(game, rx, restaurant.y - PHYSICS.footY, restaurant.id);
  for (let i = 0; i < 10 * 120 && !game.order; i++) game.step(dt, idle);
  assert.equal(game.order?.target, target);
  seek(game, rx, 110);
  const destination = game.destination, x = destination.x + destination.width / 2;
  seek(game, x, 110); seek(game, x, destination.y - 80); seek(game, x, destination.y - PHYSICS.footY, target);
  fly(game, 1); assert.equal(game.delivered, 1); assert.ok(game.bank > 0);
  seek(game, x, 110); seek(game, rx, 110); seek(game, rx, restaurant.y - 80); seek(game, rx, restaurant.y - PHYSICS.footY, restaurant.id);
  fly(game, 1); assert.equal(game.lives, 3); assert.ok(game.order); assert.ok(game.fuel > 0);
});
