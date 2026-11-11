import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';
import { Game, PHYSICS, START_DELAY, CRASH_DURATION } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { AVALANCHE } from '../dist/src/avalanche.js';
import { BOULDERS } from '../dist/src/boulders.js';
import { rectangle, sweepContact } from '../dist/src/world.js';
import { svgRendererFixture } from './svg-fixture.mjs';

const level = LEVELS.find(level => level.id === 'avalanche');
const config = LEVEL_CONFIG.find(level => level.id === 'avalanche');
const idle = { up: false, down: false, left: false, right: false }, dt = 1 / 120;
const run = (game, seconds) => { for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, idle); };
function gameAtPlay() {
  const game = new Game(() => .5, level); game.start('casual'); game.step(START_DELAY, idle);
  game.boulderSpawnTime = 1000;
  return game;
}
function rock(details = {}) {
  return { id: 99, side: 'left', x: 640, y: 300, vx: 0, vy: 0, radius: 37, angle: 0, ...details };
}

test('Avalanche starts the stack, keeps older identities, and ships complete matching artwork', () => {
  assert.equal(new Game().level, level); assert.equal(level.number, 13); assert.equal(level.name, 'Avalanche');
  assert.deepEqual(LEVELS.map(level => level.number), [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(nextLevel(level).id, 'blizzard');
  assert.equal(level.gravity, 100); assert.equal(level.thrustScale ?? 1, 1);
  assert.equal(level.boulders.spawnIntervalMax, config.boulders.spawnIntervalMax); assert.equal(level.padCount, 5);
  assert.equal(level.fallingObstacleLimit, 0); assert.equal(level.seekerCount, 0);
  assert.ok(!level.storm && !level.current && !level.gravityWell);
  assert.equal(level.pads.filter(pad => pad.x + pad.width / 2 < 640).length, 3);
  for (const name of levelAssetNames(level)) accessSync(new URL('../public/' + levelAssetPath(name, level), import.meta.url));
  for (const mountain of level.structures) {
    const art = readFileSync(new URL('../public/' + levelAssetPath(mountain.kind, level), import.meta.url), 'utf8');
    assert.equal(art.match(/data-mountain-outline="" points="([^"]+)"/)[1], mountain.outline.map(p => `${p.x},${p.y}`).join(' '));
    assert.deepEqual(level.solids.find(s => s.structureId === mountain.id).points,
      mountain.outline.map(p => ({ x: p.x + mountain.x, y: p.y + mountain.y })));
  }
});

test('spawn interval is configurable and every initial/subsequent delay lies between 1 and its maximum', () => {
  for (const max of [1, 2, 5, 9]) for (const sample of [0, .5, 1]) {
    const custom = createLevel({ ...config, boulders: { spawnIntervalMax: max } });
    const game = new Game(() => sample, custom); game.start('casual', custom, { designMode: true });
    assert.equal(game.boulderSpawnTime, 1 + sample * (max - 1));
    game.boulderSpawnTime = 0; game.step(dt, idle);
    assert.equal(game.boulders.length, 1);
    assert.equal(game.boulderSpawnTime, 1 + sample * (max - 1));
    assert.ok(game.boulders[0].radius >= BOULDERS.radiusMin && game.boulders[0].radius <= BOULDERS.radiusMax);
    run(game, .9); assert.equal(game.boulders.length, 1, 'no second spawn before one second');
  }
  for (const value of [undefined, NaN, Infinity, -1, 0, .9]) {
    assert.throws(() => createLevel({ ...config, boulders: { spawnIntervalMax: value } }), /boulders.spawnIntervalMax/);
  }
});

test('airborne spawn sides are random; landing on every ledge forces the opposite side', () => {
  for (const sample of [.1, .9]) {
    const airborne = gameAtPlay(); airborne.random = () => sample;
    airborne.boulderSpawnTime = 0; airborne.step(dt, idle);
    assert.equal(airborne.boulders[0].side, sample < .5 ? 'left' : 'right');
    for (const pad of level.pads) {
      const game = gameAtPlay(); game.random = () => sample;
      game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: pad.id };
      game.boulderSpawnTime = 0; game.step(dt, idle);
      assert.equal(game.boulders[0].side, game.ship.x < 640 ? 'right' : 'left', pad.name);
      game.toggleGear(); game.boulderSpawnTime = 0; game.step(dt, idle);
      assert.equal(game.boulders[1].side, sample < .5 ? 'left' : 'right', 'retraction restores random sides');
    }
  }
});

test('landing immediately before a spawn shelters that side; upward liftoff restores random sides', () => {
  const game = gameAtPlay(), pad = game.pads.find(pad => pad.id === 0);
  game.random = () => .1;
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .01, vx: 0, vy: 10, gear: true, landed: null };
  game.boulderSpawnTime = 0; game.step(dt, idle);
  assert.equal(game.ship.landed, pad.id); assert.equal(game.boulders[0].side, 'right');
  game.boulderSpawnTime = 0; game.step(dt, { ...idle, up: true });
  assert.equal(game.ship.landed, null); assert.equal(game.boulders[1].side, 'left');
});

test('boulders bounce downhill on both slopes, roll over stations, and disintegrate without accumulating', () => {
  // Different radii and starting momentum exercise rebounds at mountain faces,
  // decks, building roofs, and corners; every rock must reach the valley bottom.
  for (let seed = 1; seed <= 40; seed++) {
    let state = seed;
    const random = () => { state = state * 16807 % 2147483647; return state / 2147483647; };
    const game = new Game(random, level); game.start('casual', level, { designMode: true });
    game.boulderSpawnTime = 0; game.step(dt, idle); game.boulderSpawnTime = 1000;
    const boulder = game.boulders[0], start = { ...boulder };
    let bounced = false, frames = 0;
    while (game.boulders.length && frames++ < 30 * 120) {
      const vy = boulder.vy; game.step(dt, idle);
      if (boulder.vy < vy - 10) bounced = true;
      assert.ok(Number.isFinite(boulder.x) && Number.isFinite(boulder.y));
    }
    assert.equal(game.boulders.length, 0, `seed ${seed}: rock stuck at ${boulder.x},${boulder.y}`);
    assert.ok(bounced, `seed ${seed}: bounced on the hillside`);
    assert.ok(Math.abs(boulder.x - start.x) > 150);
    assert.notEqual(boulder.angle, start.angle);
    const impacts = game.events.filter(e => e.type === 'boulder-impact');
    assert.equal(impacts.length, 1); assert.ok(impacts[0].y + boulder.radius >= AVALANCHE.bottomY);
    assert.equal(game.lives, 3); assert.equal(game.phase, 'idle');
  }
});

test('a rock rebounds from a station deck instead of exploding on contact', () => {
  const game = gameAtPlay(), pad = game.pads.find(p => p.id === 0);
  const shelter = game.pads.find(p => p.id === 1);
  game.ship = { x: shelter.x + shelter.width / 2, y: shelter.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: shelter.id };
  const boulder = rock({ x: pad.x + pad.width / 2, y: pad.y - 38, vy: 180 });
  game.boulders = [boulder]; game.step(1 / 60, idle);
  assert.ok(game.boulders.includes(boulder)); assert.ok(boulder.vy < 0);
  assert.equal(game.events.some(e => e.type === 'boulder-impact'), false);
});

test('moving rocks sweep hulls and gear, including ships landed on their original side', () => {
  for (const gear of [false, true]) {
    const game = gameAtPlay(); Object.assign(game.ship, { x: 640, y: 300, gear });
    game.boulders = [rock({ x: 500, y: gear ? 348 : 300, vx: 2400 })];
    game.step(.1, idle);
    assert.equal(game.lives, 2, gear ? 'extended gear hit during fast sweep' : 'hull hit during fast sweep');
    assert.equal(game.boulders.length, 0);
  }
  const miss = gameAtPlay(); Object.assign(miss.ship, { x: 640, y: 300 });
  miss.boulders = [rock({ x: 500, y: 348, vx: 2400 })]; miss.step(.1, idle);
  assert.equal(miss.lives, 3, 'retracted gear clears the lower pass');
  const docked = gameAtPlay(), pad = docked.pads.find(p => p.id === 0);
  docked.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: pad.id };
  docked.boulders = [rock({ x: docked.ship.x, y: docked.ship.y - 75, vy: 400 })];
  run(docked, .2);
  assert.equal(docked.lives, 2, 'landing does not delete or immunize against existing rocks');
  assert.equal(docked.events.filter(e => e.type === 'boulder-impact').length, 1);
});

test('all pads have clear valley approaches, safe landings, and departure lanes', () => {
  for (const pad of level.pads) {
    const x = pad.x + pad.width / 2, y = pad.y - 100;
    const waypoints = [{ x: 640, y: 80 }, { x: 640, y }, { x, y }, { x, y: pad.y - PHYSICS.footY - .1 }];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p = waypoints[i], q = waypoints[i + 1];
      const body = rectangle(p.x - 25, p.y - 18, 50, i === 2 ? 40 : 27);
      assert.ok(level.solids.every(s => sweepContact(body, s.points, { x: q.x - p.x, y: q.y - p.y }) === null), pad.name);
    }
    const game = gameAtPlay();
    game.ship = { ...waypoints[3], vx: 0, vy: 20, gear: true, landed: null };
    game.step(dt, idle); assert.equal(game.ship.landed, pad.id, pad.name);
    game.step(dt, { ...idle, up: true }); assert.equal(game.ship.landed, null);
    assert.equal(game.lives, 3);
  }
});

test('countdown, pause, editing, final crash, restart, and level changes respect boulder lifecycle', () => {
  const game = new Game(() => .5, level); game.start('casual');
  run(game, 2.9); assert.equal(game.boulders.length, 0); assert.equal(game.boulderSpawnTime, 1 + (level.boulders.spawnIntervalMax - 1) / 2);
  run(game, .1); assert.equal(game.phase, 'playing');
  game.ship = game.spawnAtStation(); run(game, level.boulders.spawnIntervalMax / 2 + .6); assert.ok(game.boulders.length);
  game.pause(); const before = JSON.stringify({ rocks: game.boulders, delay: game.boulderSpawnTime, time: game.time });
  run(game, 3); assert.equal(JSON.stringify({ rocks: game.boulders, delay: game.boulderSpawnTime, time: game.time }), before);
  game.pause(); game.lives = 1; game.crash('test');
  const frozen = JSON.stringify(game.boulders); run(game, CRASH_DURATION + 1);
  assert.equal(game.phase, 'gameover'); assert.equal(JSON.stringify(game.boulders), frozen);
  game.start('casual', level, { editing: true }); run(game, 5); assert.deepEqual(game.boulders, []);
  game.start('casual', level, { designMode: false });
  assert.deepEqual(game.boulders, []); assert.equal(game.boulderSpawnTime, 1 + (level.boulders.spawnIntervalMax - 1) / 2);
  game.start('casual', nextLevel(level)); run(game, 4); assert.deepEqual(game.boulders, []);
});

test('boulder disintegration produces visible granite fragments', () => {
  const renderer = svgRendererFixture();
  renderer.burst({ type: 'boulder-impact', message: '', x: 640, y: 690 });
  assert.equal(renderer.particles.length, 65);
  assert.ok(renderer.particles.every(p => ['#c6baa2', '#877c6c', '#554e48'].includes(p.color)));
  assert.ok(renderer.particles.every(p => p.x === 640 && p.y === 690 && p.life > 0));
});
