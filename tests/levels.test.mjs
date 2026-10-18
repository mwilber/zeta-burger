import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync } from 'node:fs';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { LEVELS, createLevel, createLevels, nextLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { Game, START_DELAY, PHYSICS } from '../dist/src/engine.js';

const luna = LEVELS.find(level => level.id === 'luna');
const copyConfig = () => structuredClone(LEVEL_CONFIG.find(level => level.id === 'luna'));

test('configuration order controls progression regardless of level numbers', () => {
  const configs = [8, 1, 4].map(number => ({ ...copyConfig(), number, id: `world-${number}` }));
  const levels = createLevels(configs);
  assert.deepEqual(levels.map(level => level.number), [8, 1, 4]);
  assert.equal(nextLevel(levels[0], levels), levels[1]);
  assert.equal(nextLevel(levels[1], levels), levels[2]);
  assert.equal(nextLevel(levels[2], levels), undefined);
  assert.equal(nextLevel({ id: 'unknown' }, levels), undefined);

  const rearranged = createLevels([configs[2], configs[0], configs[1]]);
  assert.deepEqual(rearranged.map(level => level.number), [4, 8, 1]);
  assert.equal(nextLevel(rearranged[0], rearranged), rearranged[1]);
  assert.equal(nextLevel(rearranged[1], rearranged), rearranged[2]);
  assert.equal(nextLevel(rearranged[2], rearranged), undefined);
  for (const level of levels) {
    const moved = rearranged.find(candidate => candidate.id === level.id);
    assert.equal(levelAssetPath('background', moved), levelAssetPath('background', level));
  }
});

test('Luna is level 1 and preserves all seven original stations', () => {
  const level = luna;
  assert.equal(level.number, 1);
  assert.equal(level.name, 'Luna');
  assert.equal(level.padCount, 7);
  assert.deepEqual(level.pads.map(p => [p.id, p.x, p.y]), [
    [6, 82, 640], [0, 370, 560], [1, 116, 340], [2, 563, 253],
    [3, 954, 363], [4, 724, 558], [5, 1120, 633]
  ]);
  assert.deepEqual(level.destinations, [1, 2, 3, 4, 5]);
});

test('editing a pad position moves its building, island, and all collisions together', () => {
  const config = copyConfig();
  config.pads[1].x += 25; config.pads[1].y -= 30;
  const moved = createLevel(config), original = luna;
  const pad = moved.pads[1], old = original.pads[1];
  assert.equal(pad.building.x - old.building.x, 25);
  assert.equal(pad.building.y - old.building.y, -30);
  const solids = moved.solids.filter(s => s.padId === pad.id);
  original.solids.filter(s => s.padId === pad.id).forEach((solid, i) => {
    assert.deepEqual(solids[i].points, solid.points.map(p => ({ x: p.x + 25, y: p.y - 30 })));
  });
});

test('pad list controls count, destinations, collision geometry, and required graphics', () => {
  const config = copyConfig();
  config.pads = config.pads.filter(p => [0, 5, 6].includes(p.id));
  config.pads[2].id = 42;
  const level = createLevel(config);
  assert.equal(level.padCount, 3);
  assert.equal(level.solids.length, 9);
  assert.deepEqual(level.destinations, [42]);
  const names = levelAssetNames(level);
  assert.ok(names.includes('pad-42') && names.includes('pad-42-active') && names.includes('island-42'));
  assert.ok(!names.includes('pad-1') && !names.includes('mushroom'));
});

test('asset filenames append level number after the original name and all Luna assets exist', () => {
  assert.equal(levelAssetPath('pad-3-active', { number: 2 }), './assets/pad-3-active-2.svg');
  assert.equal(levelAssetPath('manifest', { number: 1 }, 'json'), './assets/manifest-1.json');
  for (const name of levelAssetNames(luna)) accessSync(new URL('../public/' + levelAssetPath(name, luna), import.meta.url));
  accessSync(new URL('../public/assets/manifest-1.json', import.meta.url));
});

test('configuration rejects duplicate IDs, missing station roles, and undeliverable levels', () => {
  let config = copyConfig(); config.pads[1].id = config.pads[0].id;
  assert.throws(() => createLevel(config), /pad IDs/);
  config = copyConfig(); config.restaurant = 99;
  assert.throws(() => createLevel(config), /restaurant and gas station/);
  config = copyConfig(); config.pads = config.pads.slice(0, 2);
  assert.throws(() => createLevel(config), /delivery pad/);
  config = copyConfig(); config.pads[0].width = -10;
  assert.throws(() => createLevel(config), /geometry/);
});

test('starting another level replaces spawn, pad roles, destination schedule, and shift state', () => {
  const config = copyConfig();
  config.number = 2; config.id = 'test-world'; config.name = 'Test world';
  config.pads = config.pads.filter(p => [0, 5, 6].includes(p.id));
  config.restaurant = 5; config.gasStation = 0; config.start = { x: 600, y: 100 };
  const next = createLevel(config), game = new Game(() => .5);
  game.start(); game.bank = 100; game.lives = 1;
  game.start('casual', next);
  assert.equal(game.level, next);
  assert.deepEqual([game.ship.x, game.ship.y], [600, 100]);
  assert.equal(game.bank, 0); assert.equal(game.lives, 3);
  assert.ok(game.orders.every(o => o.target === 6));
  assert.equal(game.countdownTime, START_DELAY);
  const restaurant = next.pads.find(p => p.id === 5);
  game.ship = { x: restaurant.x + restaurant.width / 2, y: restaurant.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: 5 };
  game.orders[0].status = 'waiting'; game.dwell = 1; game.service();
  assert.equal(game.order.target, 6);
  assert.equal(game.spawnAtStation().landed, 0);
});

test('continuing levels carries the signed bank balance and adds new tips; fresh starts reset it', () => {
  const game = new Game(() => .5);
  const deliver = (elapsed = 0) => {
    game.step(START_DELAY, { up: false, down: false, left: false, right: false });
    const order = game.orders[0]; order.status = 'onboard'; order.elapsed = elapsed;
    const pad = game.destination;
    game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: pad.id };
    game.dwell = game.serviceDelay; game.service();
    assert.equal(game.endReason, 'delivered');
  };
  game.start('tester', LEVELS[0]); deliver();
  assert.equal(game.bank, 7.5);
  game.start('tester', LEVELS[1], { carryBank: true });
  assert.equal(game.bank, 7.5); assert.equal(game.delivered, 0);
  deliver(250); // The second delivery's tip is -$12.50.
  assert.equal(game.bank, -5);
  game.start('tester', LEVELS[0], { carryBank: true });
  assert.equal(game.bank, -5, 'negative balances also carry forward');
  game.start('tester', LEVELS[0]);
  assert.equal(game.bank, 0, 'a replay starts a new bank');
});
