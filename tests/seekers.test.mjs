import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync } from 'node:fs';
import { Game, SEEKERS, START_DELAY, CRASH_DURATION, PHYSICS } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../dist/src/world.js';

const obsession = LEVELS.find(level => level.id === 'obsession');
const trickOrTreat = LEVELS.find(level => level.id === 'trick-or-treat');
const luna = LEVELS.find(level => level.id === 'luna');
const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
const cloud = (values = {}) => ({ id: 99, x: 250, y: 150, vx: 0, vy: 0, radius: SEEKERS.radius,
  age: 0, phase: 0, wanderAngle: 0, wanderTime: 3, ...values });
function playing(level = obsession) {
  const game = new Game(() => .5, level); game.start('tester'); game.step(START_DELAY, idle);
  return game;
}
function fly(game, seconds, holdShip = false) {
  const ship = { ...game.ship };
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    if (holdShip) game.ship = { ...ship };
    game.step(dt, idle);
  }
}

test('Trick Or Treat reskins Obsession and every level has its required assets', () => {
  assert.equal(nextLevel(LEVELS[0]), trickOrTreat);
  assert.equal(trickOrTreat.number, 4); assert.equal(trickOrTreat.name, 'Trick Or Treat');
  assert.equal(nextLevel(trickOrTreat), obsession);
  assert.deepEqual(trickOrTreat.solids, obsession.solids);
  assert.deepEqual(trickOrTreat.start, obsession.start);
  assert.deepEqual(trickOrTreat.destinations, obsession.destinations);
  for (const setting of ['restaurant', 'gasStation', 'seekerCount', 'fallingObstacleLimit']) {
    assert.equal(trickOrTreat[setting], obsession[setting]);
  }
  assert.equal(obsession.number, 3); assert.equal(obsession.seekerCount, 4);
  assert.equal(obsession.fallingObstacleLimit, 0);
  assert.equal(nextLevel(obsession).id, 'meteor-shower');
  assert.equal(nextLevel(nextLevel(obsession)), luna);
  assert.ok(levelAssetNames(obsession).includes('seeker'));
  assert.ok(!levelAssetNames(luna).includes('seeker'));
  for (const level of LEVELS) for (const name of levelAssetNames(level)) {
    accessSync(new URL('../public/' + levelAssetPath(name, level), import.meta.url));
  }
  const config = LEVEL_CONFIG.find(level => level.id === 'obsession');
  for (const seekerCount of [-1, .5, NaN, Infinity]) {
    assert.throws(() => createLevel({ ...config, seekerCount }), /seekerCount/);
  }
});

test('seekers spawn across the field with a safe initial clearance and reset on replay and level changes', () => {
  for (const random of [0, .5, .999999]) {
    const game = new Game(() => random, obsession); game.start();
    assert.equal(game.seekers.length, obsession.seekerCount);
    assert.equal(new Set(game.seekers.map(s => s.id)).size, obsession.seekerCount);
    for (const s of game.seekers) {
      assert.ok(Math.hypot(s.x - game.ship.x, s.y - game.ship.y) >= SEEKERS.spawnClearance);
      assert.ok(s.x >= s.radius && s.x <= WORLD_WIDTH - s.radius);
      assert.ok(s.y >= s.radius && s.y <= WORLD_HEIGHT - 12 - s.radius);
    }
    const initial = structuredClone(game.seekers);
    game.seekers[0].x += 100; game.start(); assert.deepEqual(game.seekers, initial);
    game.start('tester', luna); assert.deepEqual(game.seekers, []);
    game.start('tester', obsession); assert.equal(game.seekers.length, 4);
  }
});

test('airborne pursuit closes distance, turns smoothly, and pulses at about quarter ship flight speed', () => {
  const game = playing(); game.ship = { x: 640, y: 100, vx: 0, vy: 0, gear: false, landed: null };
  game.seekers = [cloud({ x: 200, y: 100, vx: -30 })];
  const s = game.seekers[0]; game.step(dt, idle);
  assert.ok(s.vx > -30 && s.vx < 0, 'turns with inertia instead of snapping toward the target');
  fly(game, 3, true);
  assert.ok(s.vx > 20, 'eventually heads toward the ship');
  const before = s.x, speeds = [];
  for (let i = 0; i < 360; i++) {
    game.ship.y = 100; game.ship.vy = 0; game.step(dt, idle);
    speeds.push(Math.hypot(s.vx, s.vy));
  }
  assert.ok(s.x > before + 60 && s.x < before + 115);
  assert.ok(Math.max(...speeds) - Math.min(...speeds) > 5, 'visible contraction/glide rhythm');
  assert.ok(speeds.every(speed => speed <= SEEKERS.speed * 1.35 + 1e-9));
  assert.equal(game.lives, 3);
});

test('landed ships are immune even inside clouds, whose random headings change every few seconds', () => {
  const game = playing(); game.ship = game.spawnAtStation();
  let seed = 13; game.random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  game.seekers = [cloud({ x: game.ship.x, y: game.ship.y, wanderTime: .01 })];
  const s = game.seekers[0]; fly(game, .025);
  const angle = s.wanderAngle;
  assert.notEqual(angle, 0); assert.ok(s.wanderTime >= 1.9 && s.wanderTime <= 4);
  fly(game, 4.1);
  assert.notEqual(s.wanderAngle, angle); assert.equal(game.lives, 3); assert.equal(game.phase, 'playing');
  assert.equal(game.ship.landed, game.level.gasStation);
  // Motion does not depend on where the landed ship is: it never chases a safe ship.
  const other = playing(); other.ship = { ...game.ship, x: 1100, landed: 0 };
  other.seekers = structuredClone(game.seekers); other.random = game.random;
  const snapshot = structuredClone(game.seekers); fly(game, .5); fly(other, .5);
  assert.notDeepEqual(game.seekers, snapshot);
  assert.deepEqual(game.seekers, other.seekers);
});

test('clouds pass through every terrain type and each other without disappearing or changing solids', () => {
  const game = playing(); game.ship = game.spawnAtStation();
  const terrain = JSON.stringify(game.level.solids);
  for (const solid of game.level.solids) {
    const x = solid.points.reduce((sum, p) => sum + p.x, 0) / solid.points.length;
    const y = solid.points.reduce((sum, p) => sum + p.y, 0) / solid.points.length;
    game.seekers = [cloud({ x, y, vx: 30 }), cloud({ id: 100, x, y, vx: 30 })];
    fly(game, .25);
    assert.equal(game.seekers.length, 2);
    assert.ok(game.seekers.every(s => s.x > x), solid.kind);
    assert.deepEqual(game.seekers[0], { ...game.seekers[1], id: 99 });
  }
  assert.equal(JSON.stringify(game.level.solids), terrain); assert.equal(game.lives, 3);
  assert.equal(game.events.some(event => event.type === 'falling-obstacle-impact'), false);
});

test('flight hull and extended gear collide with seekers; the cloud survives and one hit costs one life', () => {
  for (const gear of [false, true]) {
    const game = playing(); game.ship = { x: 640, y: 100, vx: 0, vy: 0, gear, landed: null };
    game.seekers = [cloud({ x: 640 + (gear ? 16 : 0), y: 100 + (gear ? 20 : 0), radius: gear ? 2 : 28 })];
    game.step(dt, idle);
    assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2); assert.equal(game.seekers.length, 1);
    assert.match(game.events.at(-1).message, /Seeker/);
    fly(game, .1); assert.equal(game.lives, 2, 'absent ship cannot be hit again');
  }
  const game = playing(); game.seekers = [cloud({ x: 640, y: 80 }), cloud({ id: 100, x: 640, y: 80 })];
  game.step(dt, idle); assert.equal(game.lives, 2);
  assert.equal(game.events.filter(event => event.type === 'crash').length, 1);
});

test('taking off or retracting gear removes landed protection; a completed landing gains it immediately', () => {
  for (const liftOff of [false, true]) {
    const game = playing(); game.ship = game.spawnAtStation();
    game.seekers = [cloud({ x: game.ship.x, y: game.ship.y })];
    game.step(dt, idle); assert.equal(game.lives, 3);
    if (!liftOff) game.toggleGear();
    game.step(dt, { ...idle, up: liftOff }); assert.equal(game.lives, 2);
  }
  const game = playing(), pad = game.level.pads.find(p => p.id === game.level.gasStation);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .1, vx: 0, vy: 20, gear: true, landed: null };
  game.seekers = [cloud({ x: game.ship.x, y: game.ship.y })];
  game.step(dt, idle); assert.equal(game.ship.landed, pad.id); assert.equal(game.lives, 3);
});

test('continuous collision catches a fast ship crossing a cloud between frames', () => {
  const game = playing(); game.ship = { x: 500, y: 100, vx: 20000, vy: 0, gear: false, landed: null };
  game.seekers = [cloud({ x: 600, y: 100 })]; game.step(.01, idle);
  assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2);
});

test('seekers freeze during countdown, pause, final explosion, and game over; other respawn delays allow wandering', () => {
  const game = new Game(() => .5, obsession); game.start();
  const initial = structuredClone(game.seekers); fly(game, START_DELAY);
  assert.deepEqual(game.seekers, initial);
  game.ship = game.spawnAtStation(); fly(game, .1); assert.notDeepEqual(game.seekers, initial);
  game.pause(); const paused = structuredClone(game.seekers); fly(game, 3);
  assert.deepEqual(game.seekers, paused); game.pause();
  game.crash('test'); fly(game, .1); assert.notDeepEqual(game.seekers, paused);
  fly(game, CRASH_DURATION); assert.equal(game.ship.landed, game.level.gasStation); assert.equal(game.lives, 2);
  game.lives = 1; game.crash('test'); const final = structuredClone(game.seekers);
  fly(game, CRASH_DURATION + 1); assert.equal(game.phase, 'gameover'); assert.deepEqual(game.seekers, final);
});

test('clouds remain in the field and turn back at its edges instead of being removed', () => {
  const game = playing(); game.ship = game.spawnAtStation();
  game.seekers = [cloud({ x: 28, y: 28, vx: -30, vy: -30, wanderAngle: -Math.PI * .75 }),
    cloud({ id: 100, x: WORLD_WIDTH - 28, y: WORLD_HEIGHT - 40, vx: 30, vy: 30, wanderAngle: Math.PI / 4 })];
  fly(game, 10);
  for (const s of game.seekers) {
    assert.ok(s.x >= s.radius && s.x <= WORLD_WIDTH - s.radius);
    assert.ok(s.y >= s.radius && s.y <= WORLD_HEIGHT - 12 - s.radius);
  }
  assert.equal(game.seekers.length, 2);
});
