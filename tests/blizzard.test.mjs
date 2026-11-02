import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';
import { Game, FALLING_OBSTACLES, START_DELAY, CRASH_DURATION, PHYSICS } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';

const level = LEVELS.find(l => l.id === 'blizzard');
const config = LEVEL_CONFIG.find(l => l.id === level.id);
const stormfront = LEVELS.find(l => l.id === 'srormfront');
const idle = { up: false, down: false, left: false, right: false }, dt = 1 / 120;
const fly = (game, seconds) => { for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, idle); };
function playing() {
  const game = new Game(() => .5, level); game.start('casual'); game.step(START_DELAY, idle);
  return game;
}

test('Blizzard starts the stack with complete alpine artwork and preserves all older level identities', () => {
  assert.equal(new Game().level, level); assert.equal(LEVELS[0], level);
  assert.equal(level.number, 12); assert.equal(level.name, 'Blizzard');
  assert.equal(nextLevel(level), stormfront);
  assert.deepEqual(LEVELS.map(l => l.number), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(level.gravity, 100); assert.equal(level.thrustScale ?? 1, 1);
  assert.equal(level.padCount, 7); assert.equal(level.seekerCount, 0);
  assert.ok(!level.current && !level.gravityWell && level.pads.every(p => !p.motion));
  for (const name of levelAssetNames(level)) accessSync(new URL('../public/' + levelAssetPath(name, level), import.meta.url));
  const snowflake = readFileSync(new URL('../public/assets/falling-obstacle-12.svg', import.meta.url), 'utf8');
  assert.equal((snowflake.match(/data-snowflake-arm=/g) ?? []).length, 6);
  const effects = readFileSync(new URL('../public/assets/effects-12.svg', import.meta.url), 'utf8');
  assert.match(effects, /id="storm-rain"><path[^>]*stroke="#ffffff"/);
  assert.doesNotMatch(effects, /id="lightning-/);
});

test('Blizzard reuses gusts, carries empty-fuel ships, and shelters docked ships from wind', () => {
  for (const key of ['windSpeed', 'gustDuration', 'drag', 'rainCount']) assert.equal(level.storm[key], stormfront.storm[key]);
  for (const gear of [false, true]) {
    const game = playing(); game.fuel = 0;
    Object.assign(game.ship, { x: 450, y: 100, gear });
    fly(game, .25);
    assert.ok(game.ship.x > 450); assert.ok(game.ship.vx > 0);
    assert.equal(game.fuel, 0); assert.equal(game.lives, 3);
  }
  const docked = playing(); docked.ship = docked.spawnAtStation();
  docked.fallingObstacleSpawnTime = 1000;
  const ship = { ...docked.ship }, pads = structuredClone(docked.pads);
  fly(docked, 5);
  assert.deepEqual(docked.ship, ship); assert.deepEqual(docked.pads, pads);
});

test('Blizzard never schedules lightning, arcs, or thunder events through repeated weather cycles', () => {
  const game = new Game(() => .5, level); game.start('casual', level, { designMode: true });
  fly(game, 60);
  assert.deepEqual(game.lightning, []);
  assert.equal(game.events.some(e => e.type === 'lightning' || e.type === 'lightning-arc'), false);
  assert.equal(game.lives, 3);
});

test('snowflakes use ship-sized radii and slower fixed paths while meteors retain their original tuning', () => {
  for (const sample of [0, .5, .999999]) {
    for (const selected of [level, LEVELS.find(l => l.id === 'meteor-shower')]) {
      const game = new Game(() => .5, selected); game.start('casual', selected, { designMode: true });
      // Exercise tuning extremes away from the world sides, which are fatal.
      let roll = 0; game.random = () => ++roll === 4 ? .5 : sample;
      game.fallingObstacleSpawnTime = 0; game.step(dt, idle);
      const obstacle = game.fallingObstacles[0];
      assert.ok(obstacle);
      const settings = selected.fallingObstacleConfig ?? FALLING_OBSTACLES;
      const speed = Math.hypot(obstacle.vx, obstacle.vy);
      assert.ok(speed >= settings.speedMin - 1e-9 && speed <= settings.speedMax);
      assert.ok(obstacle.radius >= settings.radiusMin && obstacle.radius <= settings.radiusMax);
      if (selected === level) { assert.equal(obstacle.radius * 2, 48); assert.ok(speed < FALLING_OBSTACLES.speedMin); }
      const before = { ...obstacle };
      game.step(dt, idle);
      assert.equal(obstacle.vx, before.vx); assert.equal(obstacle.vy, before.vy);
      assert.ok(Math.abs(obstacle.y - before.y - before.vy * dt) < 1e-8);
    }
  }
});

test('slow snowflakes still hit hulls and gear, including docked saucers, and break on scenery', () => {
  for (const placement of ['hull', 'gear', 'docked', 'scenery']) {
    const game = playing(); game.fallingObstacleSpawnTime = 1000;
    game.ship = { x: 450, y: 100, vx: 0, vy: 0, gear: placement !== 'hull', landed: null };
    if (placement === 'docked') game.ship = game.spawnAtStation();
    const pad = game.pads.find(p => p.id === 0);
    const x = placement === 'scenery' ? pad.x + pad.width / 2 : game.ship.x;
    const y = placement === 'scenery' ? pad.y - 20 : game.ship.y + (placement === 'gear' ? PHYSICS.footY + 13 : placement === 'docked' ? -12 : 0);
    game.fallingObstacles = [{ id: 0, x, y, vx: 0, vy: 55, radius: 24 }];
    const solids = structuredClone(game.solids);
    game.step(dt, idle);
    assert.equal(game.fallingObstacles.length, 0, placement);
    assert.equal(game.lives, placement === 'scenery' ? 3 : 2, placement);
    assert.deepEqual(game.solids, solids);
    assert.equal(game.events.filter(e => e.type === 'falling-obstacle-impact').length, 1);
  }
});

test('snowfall respects population limits, countdown, pause, final crash, and restart', () => {
  // Isolate the cap from station impacts in the deterministic spawn corridor.
  const game = new Game(() => .5, { ...level, solids: [] });
  game.start('casual', game.level, { designMode: true });
  let peak = 0;
  for (let i = 0; i < 30 * 120; i++) {
    game.step(dt, idle); peak = Math.max(peak, game.fallingObstacles.length);
    assert.ok(game.fallingObstacles.length <= level.fallingObstacleLimit);
  }
  assert.equal(peak, level.fallingObstacleLimit);
  game.pause(); const paused = JSON.stringify({ time: game.time, obstacles: game.fallingObstacles });
  fly(game, 2); assert.equal(JSON.stringify({ time: game.time, obstacles: game.fallingObstacles }), paused);
  game.start('casual', level, { designMode: false });
  fly(game, 2); assert.equal(game.time, 0); assert.deepEqual(game.fallingObstacles, []);
  fly(game, 2.1); assert.ok(game.fallingObstacles.length);
  game.lives = 1; game.crash('test');
  const final = JSON.stringify(game.fallingObstacles); fly(game, CRASH_DURATION + 1);
  assert.equal(game.phase, 'gameover'); assert.equal(JSON.stringify(game.fallingObstacles), final);
  game.start(); assert.equal(game.time, 0); assert.deepEqual(game.fallingObstacles, []);
});

test('falling hazard tuning and optional weather settings reject invalid configuration', () => {
  for (const key of ['speedMin', 'speedMax', 'radiusMin', 'radiusMax']) {
    for (const value of [NaN, Infinity, undefined, 0, -1]) {
      assert.throws(() => createLevel({ ...config, fallingObstacleConfig: { ...config.fallingObstacleConfig, [key]: value } }), /fallingObstacleConfig/);
    }
  }
  for (const settings of [{ speedMin: 80 }, { radiusMin: 30 }]) {
    assert.throws(() => createLevel({ ...config, fallingObstacleConfig: { ...config.fallingObstacleConfig, ...settings } }), /fallingObstacleConfig/);
  }
  for (const storm of [{ lightning: 'false' }, { precipitation: 'snow' }]) {
    assert.throws(() => createLevel({ ...config, storm: { ...config.storm, ...storm } }), /invalid storm/);
  }
});
