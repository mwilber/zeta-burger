import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, FUEL, START_DELAY, SEEKERS } from '../dist/src/engine.js';
import { LEVELS } from '../dist/src/levels.js';
import { svgRendererFixture } from './svg-fixture.mjs';

const noInput = { up: false, down: false, left: false, right: false };
const thrust = { ...noInput, up: true, right: true };
const dt = 1 / 120;
function run(game, seconds, controls = noInput) {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls);
}
function design(level = LEVELS[0], skill = 'normal') {
  const game = new Game(() => .5, level);
  game.start(skill, level, { designMode: true });
  return game;
}

test('every level stays idle indefinitely while orders arrive with frozen tips', () => {
  for (const level of LEVELS) {
    const game = design(level);
    assert.equal(game.phase, 'idle');
    assert.equal(game.countdownTime, 0);
    const ship = { ...game.ship };
    run(game, 4.9, thrust);
    assert.equal(game.waitingOrders.length, 0);
    run(game, .2, thrust);
    assert.equal(game.waitingOrders.length, 1);
    run(game, 130, thrust);
    assert.equal(game.waitingOrders.length, game.totalOrders, level.id);
    assert.ok(game.orders.every(order => order.elapsed === 0 && game.tipFor(order) === order.initialTip));
    game.toggleGear(); game.crash('ignored');
    assert.deepEqual(game.ship, ship, level.id);
    assert.equal(game.fuel, FUEL.capacity);
    assert.equal(game.lives, 3);
    assert.equal(game.delivered, 0);
    assert.equal(game.phase, 'idle');
    assert.equal(game.endReason, null);
    assert.equal(game.events.some(event => event.type === 'crash' || event.type === 'gameover'), false);
  }
});

test('design mode blocks every level-ending condition', () => {
  const game = design(LEVELS[0], 'tester');
  game.orders[0].status = 'waiting'; game.orders[0].initialTip = -100;
  game.checkEnd(); assert.equal(game.phase, 'idle');
  game.delivered = game.orders.length; game.checkEnd();
  for (const reason of ['delivered', 'tips', 'lives']) game.finish(reason);
  assert.equal(game.phase, 'idle'); assert.equal(game.endReason, null);
  assert.equal(game.events.length, 0);
});

test('moving stations and their collision geometry continue while the ship stays fixed', () => {
  for (const id of ['zero-g', 'abyss']) {
    const game = design(LEVELS.find(level => level.id === id));
    const pads = structuredClone(game.pads), solids = structuredClone(game.solids), ship = { ...game.ship };
    run(game, 2);
    assert.notDeepEqual(game.pads, pads, id);
    assert.notDeepEqual(game.solids, solids, id);
    assert.deepEqual(game.ship, ship, id);
  }
});

test('seekers still pursue the idle airborne ship and cannot kill it on contact', () => {
  const game = design(LEVELS.find(level => level.id === 'obsession'));
  game.seekers = [{ id: 99, x: game.ship.x - 100, y: game.ship.y, vx: 0, vy: 0, radius: SEEKERS.radius,
    age: 0, phase: 0, wanderAngle: Math.PI, wanderTime: 3 }];
  run(game, 2);
  assert.ok(game.seekers[0].vx > 0, 'pursues the ship instead of wandering left');
  game.seekers[0].x = game.ship.x; game.seekers[0].y = game.ship.y;
  run(game, 1);
  assert.equal(game.phase, 'idle'); assert.equal(game.lives, 3);
  assert.ok(game.seekers[0].age > 2.9);
});

test('falling obstacles spawn and move through the idle ship, then explode on scenery', () => {
  const game = design(LEVELS.find(level => level.id === 'meteor-shower'));
  run(game, 1.1);
  assert.ok(game.fallingObstacles.length > 0);
  const rock = { id: 99, x: game.ship.x, y: game.ship.y, vx: 0, vy: 180, radius: 10 };
  game.fallingObstacles = [rock];
  game.step(dt, noInput);
  assert.ok(game.fallingObstacles.includes(rock)); assert.ok(rock.y > game.ship.y);
  const solid = game.solids[0];
  rock.x = solid.points.reduce((sum, p) => sum + p.x, 0) / solid.points.length;
  rock.y = solid.points.reduce((sum, p) => sum + p.y, 0) / solid.points.length;
  game.step(dt, noInput);
  assert.ok(!game.fallingObstacles.includes(rock));
  assert.ok(game.events.some(event => event.type === 'falling-obstacle-impact'));
  assert.equal(game.phase, 'idle'); assert.equal(game.lives, 3);
});

test('pause freezes design mode and resumes idle; level switches preserve it until explicitly disabled', () => {
  const game = design(LEVELS.find(level => level.id === 'abyss'));
  run(game, 6);
  game.pause();
  const snapshot = JSON.stringify({ time: game.time, orders: game.orders, pads: game.pads, seekers: game.seekers });
  run(game, 5);
  assert.equal(game.phase, 'paused');
  assert.equal(JSON.stringify({ time: game.time, orders: game.orders, pads: game.pads, seekers: game.seekers }), snapshot);
  game.pause(); run(game, 1);
  assert.equal(game.phase, 'idle'); assert.ok(game.time > 6.9);
  game.start('tester', LEVELS[0]);
  assert.equal(game.phase, 'idle'); assert.equal(game.designMode, true);
  assert.equal(game.time, 0); assert.equal(game.totalOrders, 1);
  game.start('tester', LEVELS[0], { designMode: false });
  assert.equal(game.phase, 'countdown'); assert.equal(game.designMode, false);
  game.step(START_DELAY, noInput); game.step(dt, thrust);
  assert.equal(game.phase, 'playing'); assert.notEqual(game.ship.vy, 0);
  assert.ok(game.fuel < FUEL.capacity);
});

test('idle saucer stays visible without thrust effects even with held controls', () => {
  const game = design(), renderer = svgRendererFixture();
  renderer.saucer(game, thrust, 1);
  assert.equal(renderer.ship.style.display, '');
  assert.equal(renderer.vertical.style.display, 'none');
  assert.equal(renderer.horizontal.style.display, 'none');
});
