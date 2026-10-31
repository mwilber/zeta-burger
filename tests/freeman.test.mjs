import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';
import { Game, PHYSICS, START_DELAY, CRASH_DURATION } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';

const level = LEVELS.find(l => l.id === 'freeman');
const horizon = LEVELS.find(l => l.id === 'event-horizon');
const config = LEVEL_CONFIG.find(l => l.id === 'freeman');
const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
function playing(selected = level) {
  const game = new Game(() => .5, selected); game.start('casual'); game.step(START_DELAY, idle); return game;
}
function fly(game, seconds) {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, idle);
}

test('Freeman starts the stack and preserves Event Horizon’s peripheral layout with a gentler stellar well', () => {
  assert.equal(new Game().level, level); assert.equal(LEVELS[0], level);
  assert.equal(level.number, 9); assert.equal(level.name, 'Freeman');
  assert.equal(nextLevel(level).id, 'megalopolis');
  assert.equal(level.gravity, 0); assert.equal(level.thrustScale ?? 1, 1);
  assert.equal(level.padCount, 7); assert.equal(level.seekerCount, 0); assert.equal(level.fallingObstacleLimit, 0);
  assert.equal(level.blackHole, undefined); assert.equal(level.gravityWell, level.star);
  assert.deepEqual(level.start, horizon.start);
  assert.deepEqual(level.solids, horizon.solids);
  assert.ok(level.pads.every(pad => !pad.motion));
  assert.deepEqual(level.star, { ...horizon.blackHole, strength: horizon.blackHole.strength / 2, maxAcceleration: horizon.blackHole.maxAcceleration / 2 });
});

test('stellar gravity pulls in all directions at half Event Horizon’s acceleration, including near the cap', () => {
  for (const [x, y] of [[400, 380], [880, 380], [640, 270], [640, 550], [400, 270], [720, 380]]) {
    for (const gear of [false, true]) {
      const star = playing(), hole = playing(horizon);
      for (const game of [star, hole]) {
        Object.assign(game.ship, { x, y, gear }); game.fuel = 0;
        game.step(dt, { ...idle, up: true, right: true });
        assert.equal(game.phase, 'playing'); assert.equal(game.fuel, 0);
      }
      assert.ok(Math.abs(star.ship.vx * 2 - hole.ship.vx) < 1e-9);
      assert.ok(Math.abs(star.ship.vy * 2 - hole.ship.vy) < 1e-9);
      assert.ok(star.ship.vx * (640 - x) + star.ship.vy * (380 - y) > 0);
      assert.ok(Math.hypot(star.ship.vx, star.ship.vy) <= level.star.maxAcceleration * dt + 1e-9);
    }
  }
});

test('every station immediately shelters the ship, services in 250 ms, and releases on thrust or gear retraction', () => {
  for (const pad of level.pads) for (const release of ['gear', 'up']) {
    const game = playing(); game.orders[0].availableAt = 0;
    if (level.destinations.includes(pad.id)) {
      game.orders[0].target = pad.id; game.orders[0].status = 'onboard';
    }
    game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .05, vx: 0, vy: 20, gear: true, landed: null };
    game.fuel = 0; game.step(dt, idle);
    assert.equal(game.ship.landed, pad.id); assert.equal(game.clinging, true);
    assert.equal(game.needsLandingThrust, false); assert.equal(game.serviceDelay, .25);
    const docked = { ...game.ship }; fly(game, .24);
    if (pad.id === level.restaurant) assert.equal(game.order, null);
    assert.equal(game.delivered, 0);
    fly(game, .02);
    if (pad.id === level.restaurant) assert.ok(game.order);
    if (level.destinations.includes(pad.id)) assert.equal(game.delivered, 1);
    fly(game, 1); assert.deepEqual(game.ship, docked);
    if (pad.id === level.gasStation) assert.ok(game.fuel > 25);
    else assert.equal(game.fuel, 0);
    game.fuel = 40;
    if (release === 'gear') game.toggleGear();
    game.step(dt, release === 'up' ? { ...idle, up: true } : idle);
    assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false);
    const previous = { ...game.ship }; game.step(dt, idle);
    const dx = 640 - previous.x, dy = 380 - previous.y, distance = Math.hypot(dx, dy);
    const pull = Math.min(level.star.maxAcceleration, level.star.strength / distance ** 2);
    assert.ok(Math.abs(game.ship.vx - previous.vx - dx / distance * pull * dt) < 1e-9);
    assert.ok(Math.abs(game.ship.vy - previous.vy - dy / distance * pull * dt) < 1e-9);
  }
});

test('the stellar surface catches hull, gear, center spawns, and fast crossings; replacements dock safely', () => {
  for (const [x, y, vx, vy, gear] of [
    [640, 380, 0, 0, false], [640, 318, 0, 0, true],
    [568, 380, 0, 0, false], [400, 380, 60000, 0, false], [640, 550, 0, -40000, false]
  ]) {
    const game = playing(); Object.assign(game.ship, { x, y, vx, vy, gear }); game.step(dt, idle);
    assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2);
    assert.match(game.events.at(-1).message, /Stellar surface/);
    assert.ok([game.ship.x, game.ship.y, game.ship.vx, game.ship.vy].every(Number.isFinite));
    game.step(dt, idle); assert.equal(game.lives, 2);
    fly(game, CRASH_DURATION); assert.equal(game.ship.landed, level.gasStation);
    const docked = { ...game.ship }; fly(game, 1); assert.deepEqual(game.ship, docked);
  }
});

test('Freeman requires complete level-9 assets and a visible surface matching its collision radius', () => {
  const names = levelAssetNames(level);
  assert.ok(names.includes('star')); assert.ok(!names.includes('black-hole'));
  for (const name of names) accessSync(new URL('../public/' + levelAssetPath(name, level), import.meta.url));
  accessSync(new URL('../public/assets/manifest-9.json', import.meta.url));
  const art = readFileSync(new URL('../public/assets/star-9.svg', import.meta.url), 'utf8');
  assert.match(art, /viewBox="-208 -156 416 312"/);
  assert.match(art, /<circle r="52" fill="url\(#photosphere\)"/);
});

test('stellar configuration validates all gravity parameters and rejects simultaneous wells', () => {
  for (const key of ['x', 'y', 'radius', 'strength', 'maxAcceleration']) {
    for (const value of [NaN, Infinity, undefined, ...(key === 'x' || key === 'y' ? [] : [0, -1])]) {
      assert.throws(() => createLevel({ ...config, star: { ...config.star, [key]: value } }), /Level 9: invalid star/);
    }
  }
  assert.throws(() => createLevel({ ...config, blackHole: horizon.blackHole }), /only one gravity well/);
});
