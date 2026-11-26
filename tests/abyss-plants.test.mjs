import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game, PHYSICS, SEEKERS, START_DELAY } from '../dist/src/engine.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { LEVELS, createLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { intersects } from '../dist/src/world.js';

const level = LEVELS.find(level => level.id === 'abyss');
const config = LEVEL_CONFIG.find(level => level.id === 'abyss');
const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
function playing(selected = level) {
  const game = new Game(() => .5, selected);
  game.start('casual'); game.step(START_DELAY, idle); game.seekers = [];
  return game;
}

test('four kelp fronds form two staggered openings with artwork matching their collision silhouettes', () => {
  assert.deepEqual(level.structures.map(p => [p.x, p.y, p.width, p.height]), [
    [446, 0, 38, 346], [446, 494, 38, 266], [850, 0, 38, 130], [850, 258, 38, 502]
  ]);
  for (const plant of level.structures) {
    assert.ok(levelAssetNames(level).includes(plant.kind));
    const art = readFileSync(new URL('../public/' + levelAssetPath(plant.kind, level), import.meta.url), 'utf8');
    assert.ok(art.includes(`viewBox="0 0 ${plant.width} ${plant.height}"`));
    assert.equal(art.match(/data-plant-outline="" points="([^"]+)"/)[1], plant.outline.map(p => `${p.x},${p.y}`).join(' '));
    assert.deepEqual(level.solids.find(s => s.structureId === plant.id).points,
      plant.outline.map(p => ({ x: plant.x + p.x, y: plant.y + p.y })));
  }
});

test('kelp stops the ship hull, fast crossings, and extended gear', () => {
  for (const plant of level.structures) {
    for (const fast of [false, true]) {
      const game = playing();
      Object.assign(game.ship, { x: plant.x + (fast ? -70 : plant.width / 2), y: plant.y + plant.height / 2,
        vx: fast ? 24000 : 0, vy: 0, gear: false, landed: null });
      game.step(dt, idle);
      assert.equal(game.phase, 'crashed', plant.id);
      assert.match(game.events.at(-1).message, /Sea plant impact/);
    }
    if (plant.y === 0) continue;
    const game = playing();
    Object.assign(game.ship, { x: plant.x + plant.width / 2 - PHYSICS.footX,
      y: plant.y - PHYSICS.footY + 1, vx: 0, vy: 0, gear: true, landed: null });
    game.step(dt, idle);
    assert.equal(game.phase, 'crashed');
    assert.match(game.events.at(-1).message, /Landing gear impact/);
  }
});

test('the whole ship clears each opening in both directions, with gear up or down', () => {
  for (const [x, y] of [[446, 420], [850, 194]]) for (const direction of [-1, 1]) for (const gear of [false, true]) {
    const game = playing();
    Object.assign(game.ship, { x: direction > 0 ? x - 60 : x + 98, y, vx: direction * 24000, vy: 0, gear, landed: null });
    game.step(dt, idle);
    assert.equal(game.phase, 'playing', `opening ${x}, direction ${direction}, gear ${gear}`);
    assert.equal(game.lives, 3);
    assert.ok(direction > 0 ? game.ship.x > x + 38 + 24 : game.ship.x < x - 24);
  }
});

test('plants stay fixed while fish and stations pass through without any interaction', () => {
  const game = playing(), control = playing(createLevel({ ...config, structures: [] }));
  const plants = structuredClone(game.solids.filter(s => s.kind === 'structure'));
  const fish = level.structures.map((plant, id) => ({ id, x: plant.x - 20, y: plant.y + plant.height / 2,
    vx: SEEKERS.speed, vy: 0, radius: SEEKERS.radius, age: 0, phase: 0, wanderAngle: 0, wanderTime: 100 }));
  for (const selected of [game, control]) {
    selected.ship = selected.spawnAtStation();
    selected.seekers = structuredClone(fish);
  }
  let stationCrossed = false;
  for (let i = 0; i < level.current.period * 120; i++) {
    game.step(dt, idle); control.step(dt, idle);
    assert.deepEqual(game.pads, control.pads);
    assert.deepEqual(game.ship, control.ship);
    assert.deepEqual(game.seekers, control.seekers);
    assert.deepEqual(game.solids.filter(s => s.kind === 'structure'), plants);
    stationCrossed ||= game.solids.some(s => s.padId !== null && plants.some(p => intersects(s.points, p.points)));
    assert.equal(game.phase, 'playing');
  }
  assert.ok(stationCrossed, 'a drifting station actually crosses the plant silhouette');
  assert.ok(game.seekers.every((fish, i) => fish.x > level.structures[i].x + level.structures[i].width), 'fish cross all four plants');
  assert.equal(game.lives, 3);
});
