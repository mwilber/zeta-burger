import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, START_DELAY, CRASH_DURATION, FALLING_OBSTACLES } from '../dist/src/engine.js';
import { LEVELS, createLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../dist/src/world.js';
import { accessSync } from 'node:fs';
import { svgRendererFixture } from './svg-fixture.mjs';

const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
const luna = LEVELS.find(level => level.id === 'luna');
const shower = LEVELS.find(level => level.id === 'meteor-shower');
function playing(level = shower) {
  const game = new Game(() => .5, level);
  game.start(); game.step(START_DELAY, idle);
  game.fallingObstacleSpawnTime = 100;
  return game;
}
const createFallingObstacle = (values = {}) => ({ id: 99, x: 800, y: 80, vx: 40, vy: 180, radius: 10, ...values });
function fly(game, seconds) { for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, idle); }
const impacts = game => game.events.filter(event => event.type === 'falling-obstacle-impact');

test('Meteor Shower precedes Luna during development with matching geometry, cool grey assets, and four falling obstacles', () => {
  assert.equal(LEVELS[0], shower);
  assert.equal(LEVELS[1], luna);
  assert.equal(shower.number, 2); assert.equal(shower.name, 'Meteor Shower');
  assert.equal(shower.fallingObstacleLimit, 4);
  assert.equal(luna.fallingObstacleLimit, 0);
  assert.deepEqual(shower.solids, luna.solids);
  assert.ok(levelAssetNames(shower).includes('falling-obstacle'));
  assert.ok(!levelAssetNames(luna).includes('falling-obstacle'));
  for (const name of levelAssetNames(shower)) accessSync(new URL('../public/' + levelAssetPath(name, shower), import.meta.url));
  for (const value of [-1, .5, NaN, Infinity]) {
    assert.throws(() => createLevel({ ...LEVEL_CONFIG[1], fallingObstacleLimit: value }), /fallingObstacleLimit/);
  }
});

test('zero disables falling obstacles; enabled levels spawn from the top and never exceed their limit', () => {
  const disabled = playing(luna); disabled.ship = disabled.spawnAtStation();
  fly(disabled, 8); assert.deepEqual(disabled.fallingObstacles, []);
  for (const limit of [1, 4]) {
    const game = playing({ ...shower, solids: [], fallingObstacleLimit: limit });
    game.ship = game.spawnAtStation(); game.fallingObstacleSpawnTime = FALLING_OBSTACLES.spawnDelay;
    let peak = 0;
    for (let i = 0; i < 120 * 12; i++) {
      game.step(dt, idle);
      assert.ok(game.fallingObstacles.length <= limit);
      peak = Math.max(peak, game.fallingObstacles.length);
      for (const obstacle of game.fallingObstacles) {
        assert.ok(obstacle.vy > 0); assert.ok(obstacle.radius >= 10 && obstacle.radius <= 18);
        if (obstacle.y < 0) assert.ok(obstacle.y >= -obstacle.radius);
      }
    }
    assert.equal(peak, limit);
  }
});

test('falling obstacles use varied fixed angles and speeds, without gravity or steering', () => {
  const game = playing({ ...shower, solids: [] }); game.ship = game.spawnAtStation();
  let seed = 10;
  game.random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  const angles = [], speeds = [];
  for (let i = 0; i < 6; i++) {
    game.fallingObstacles = []; game.fallingObstacleSpawnTime = 0;
    game.step(dt, idle);
    const obstacle = game.fallingObstacles[0];
    assert.ok(obstacle && obstacle.y < 0);
    angles.push(obstacle.vx / obstacle.vy); speeds.push(Math.hypot(obstacle.vx, obstacle.vy));
  }
  assert.ok(angles.some(value => value < 0) && angles.some(value => value > 0));
  assert.equal(new Set(speeds).size, 6);
  const obstacle = createFallingObstacle(), before = { ...obstacle };
  game.fallingObstacles = [obstacle]; game.fallingObstacleSpawnTime = 100;
  fly(game, .5);
  assert.ok(Math.abs(obstacle.x - before.x - before.vx * .5) < 1e-6);
  assert.ok(Math.abs(obstacle.y - before.y - before.vy * .5) < 1e-6);
  assert.equal(obstacle.vx, before.vx); assert.equal(obstacle.vy, before.vy);
});

test('every pad, building, and island destroys falling obstacles without changing terrain or player resources', () => {
  for (const solid of shower.solids) {
    const game = playing();
    const x = solid.points.reduce((sum, p) => sum + p.x, 0) / solid.points.length;
    const y = solid.points.reduce((sum, p) => sum + p.y, 0) / solid.points.length;
    const terrain = JSON.stringify(game.level.solids);
    game.fallingObstacles = [createFallingObstacle({ x, y, radius: 3 })];
    game.step(dt, idle);
    assert.equal(game.fallingObstacles.length, 0, `${solid.kind} on pad ${solid.padId}`);
    assert.equal(impacts(game).length, 1);
    assert.equal(game.lives, 3); assert.equal(game.bank, 0); assert.equal(game.delivered, 0);
    assert.equal(JSON.stringify(game.level.solids), terrain);
  }
});

test('world sides and floor destroy falling obstacles; entry through the top does not', () => {
  for (const obstacle of [
    createFallingObstacle({ x: 10.5, y: 30, vx: -120 }),
    createFallingObstacle({ x: WORLD_WIDTH - 10.5, y: 30, vx: 120 }),
    createFallingObstacle({ x: 640, y: WORLD_HEIGHT - 12 - 10.5 })
  ]) {
    const game = playing(); game.fallingObstacles = [obstacle]; game.step(dt, idle);
    assert.equal(game.fallingObstacles.length, 0); assert.equal(impacts(game).length, 1); assert.equal(game.lives, 3);
  }
  const game = playing(); game.fallingObstacles = [createFallingObstacle({ y: -10 })]; game.step(dt, idle);
  assert.equal(game.fallingObstacles.length, 1); assert.equal(impacts(game).length, 0);
});

test('fast falling obstacles hit a thin pad at first contact without tunneling', () => {
  const game = playing();
  game.fallingObstacles = [createFallingObstacle({ x: 428, y: 400, vx: 0, vy: 20000, radius: 8 })];
  game.step(.01, idle);
  assert.equal(game.fallingObstacles.length, 0);
  assert.equal(impacts(game).length, 1);
  assert.ok(Math.abs(impacts(game)[0].y - 552) < 1e-6);
  assert.equal(game.lives, 3);
});

test('falling obstacles that meet each other both explode once', () => {
  const game = playing();
  game.fallingObstacles = [createFallingObstacle({ id: 1, x: 400, y: 100, vx: 100, vy: 100, radius: 8 }), createFallingObstacle({ id: 2, x: 430, y: 100, vx: -100, vy: 100, radius: 8 })];
  game.step(.1, idle);
  assert.equal(game.fallingObstacles.length, 0); assert.equal(impacts(game).length, 2); assert.equal(game.lives, 3);
});

test('hull, extended gear, and docked ships are vulnerable; both ship and obstacle explode', () => {
  for (const placement of ['hull', 'gear', 'docked']) {
    const game = playing();
    if (placement === 'docked') game.ship = game.spawnAtStation();
    if (placement === 'gear') game.ship.gear = true;
    game.fallingObstacles = [createFallingObstacle({ x: game.ship.x + (placement === 'gear' ? 16 : 0), y: game.ship.y + (placement === 'gear' ? 18 : 0), radius: placement === 'gear' ? 2 : 10 })];
    game.step(dt, idle);
    assert.equal(game.phase, 'crashed', placement); assert.equal(game.lives, 2);
    assert.equal(game.fallingObstacles.length, 0); assert.equal(impacts(game).length, 1);
    assert.equal(game.events.filter(event => event.type === 'crash').length, 1);
  }
});

test('a moving ship cannot pass through a falling obstacle between frames', () => {
  const game = playing(); game.ship.vx = 600;
  game.fallingObstacles = [createFallingObstacle({ x: 690, y: 80, vx: 0, vy: 20, radius: 6 })];
  game.step(.1, idle);
  assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2); assert.equal(game.fallingObstacles.length, 0);
});

test('simultaneous falling obstacle hits cost a single life and cannot hit the absent ship again', () => {
  const game = playing();
  game.fallingObstacles = [createFallingObstacle({ id: 1, x: game.ship.x, y: game.ship.y, vx: 0, radius: 4 }), createFallingObstacle({ id: 2, x: game.ship.x + 18, y: game.ship.y, vx: 0, radius: 4 })];
  game.step(dt, idle);
  assert.equal(game.lives, 2); assert.equal(game.events.filter(event => event.type === 'crash').length, 1);
  assert.equal(game.fallingObstacles.length, 1);
  const y = game.fallingObstacles[0].y; game.step(dt, idle);
  assert.ok(game.fallingObstacles[0].y > y); assert.equal(game.lives, 2);
});

test('countdown, pause, final explosion, and game over freeze obstacles; replay and level change clear them', () => {
  const game = new Game(() => .5, shower); game.start(); fly(game, 2);
  assert.deepEqual(game.fallingObstacles, []);
  game.step(1, idle); assert.equal(game.phase, 'playing'); assert.deepEqual(game.fallingObstacles, []);
  game.fallingObstacles = [createFallingObstacle()]; game.fallingObstacleSpawnTime = .5;
  game.pause(); const snapshot = JSON.stringify(game.fallingObstacles); fly(game, 1);
  assert.equal(JSON.stringify(game.fallingObstacles), snapshot); assert.equal(game.fallingObstacleSpawnTime, .5);
  game.pause(); game.step(dt, idle); assert.notEqual(JSON.stringify(game.fallingObstacles), snapshot);
  game.lives = 1; game.crash('test'); const final = JSON.stringify(game.fallingObstacles); fly(game, CRASH_DURATION + 1);
  assert.equal(game.phase, 'gameover'); assert.equal(JSON.stringify(game.fallingObstacles), final);
  game.start(); assert.deepEqual(game.fallingObstacles, []);
  game.fallingObstacles = [createFallingObstacle()]; game.start('normal', luna); assert.deepEqual(game.fallingObstacles, []);
});

test('falling obstacle explosions reuse the ship particle count, palette, and lifetime', () => {
  for (const type of ['crash', 'falling-obstacle-impact']) {
    const renderer = svgRendererFixture(); renderer.burst({ type, x: 100, y: 200, message: '' });
    assert.equal(renderer.particles.length, 65);
    assert.ok(renderer.particles.every(p => p.x === 100 && p.y === 200 && p.life <= CRASH_DURATION));
    assert.ok(renderer.particles.every(p => ['#ffd297', '#ff918f', '#dabaff'].includes(p.color)));
    renderer.update(CRASH_DURATION); assert.equal(renderer.particles.length, 0);
  }
});
