import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, FUEL, REFUELING, START_DELAY, ZERO_G } from '../dist/src/engine.js';
import { LEVELS, createLevel, levelAssetNames } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { svgRendererFixture } from './svg-fixture.mjs';

const idle = { up: false, down: false, left: false, right: false };
const pump = { ...idle, refuel: true };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
function docked(level = LEVELS.find(level => level.id === 'luna')) {
  const game = new Game(() => .5, level);
  game.start('casual'); game.step(START_DELAY, idle);
  game.ship = game.spawnAtStation(); game.dwell = game.serviceDelay;
  game.fuel = 40; game.bank = 10;
  return game;
}
function run(game, seconds, controls = pump) {
  for (let i = 0; i < Math.round(seconds * 120); i++) game.step(1 / 120, controls);
}

test('every level removes its former fuel pad, graphics, and station collisions while keeping destinations', () => {
  for (const level of LEVELS) {
    assert.equal(level.padCount, [10, 13].includes(level.number) ? 5 : 6);
    assert.ok(!level.pads.some(pad => pad.id === 6 || pad.building.kind === 'gas'));
    assert.ok(!level.solids.some(solid => solid.padId === 6));
    assert.ok(!levelAssetNames(level).some(name => /^(gas|pad-6|island-6)/.test(name)));
    assert.deepEqual(level.destinations, level.pads.filter(pad => pad.id !== level.restaurant).map(pad => pad.id));
    const game = docked(level);
    run(game, .5, idle); near(game.fuel, 40); near(game.bank, 10);
    run(game, 2); near(game.fuel, 50); near(game.bank, 9);
    run(game, .5, idle); near(game.fuel, 50); near(game.bank, 9);
  }
});

test('pumping charges fractional cents at 120 Hz and only sells affordable fuel', () => {
  const game = docked();
  run(game, 2); near(game.fuel, 50); near(game.bank, 9);
  game.bank = .03; run(game, 1);
  near(game.fuel, 50.3); assert.equal(game.bank, 0);
  const fuel = game.fuel; run(game, 1); assert.equal(game.fuel, fuel);
  for (const bank of [0, -3]) {
    game.bank = bank; run(game, 1); assert.equal(game.bank, bank); assert.equal(game.fuel, fuel);
  }
  game.bank = .00001; run(game, .1); near(game.fuel, fuel + .0001); assert.equal(game.bank, 0);
});

test('a nearly full tank charges only for the missing fuel and remains full without more charges', () => {
  const game = docked(); game.fuel = 99.9;
  run(game, 1); assert.equal(game.fuel, FUEL.capacity); near(game.bank, 9.99);
  const bank = game.bank; run(game, 1); assert.equal(game.bank, bank);
});

test('fuel purchase requires a docked restaurant ship and stops during pause, takeoff, and gear retraction', () => {
  for (const action of ['other-pad', 'airborne', 'paused', 'countdown', 'crashed', 'gameover', 'idle', 'gear', 'up']) {
    const game = docked();
    if (action === 'other-pad') game.ship.landed = game.level.destinations[0];
    else if (action === 'airborne') game.ship = game.spawn();
    else if (action === 'gear') game.toggleGear();
    else if (action !== 'up') game.phase = action;
    game.step(1 / 120, { ...pump, up: action === 'up' });
    assert.equal(game.bank, 10, action);
    assert.ok(game.fuel <= 40, action);
  }
  const game = docked(); run(game, 1); game.pause(); run(game, 1);
  near(game.fuel, 45); near(game.bank, 9.5);
});

test('Zero G must finish clamping before pumping; gravity wells allow immediate pumping', () => {
  const game = docked(LEVELS.find(level => level.id === 'zero-g'));
  game.dwell = 0; run(game, ZERO_G.clingDelay, { ...pump, down: true });
  assert.equal(game.clinging, true); near(game.bank, 10);
  near(game.fuel, 40 - FUEL.downRate * ZERO_G.clingDelay);
  const fuel = game.fuel; run(game, 1); near(game.fuel, fuel + REFUELING.refillRate); near(game.bank, 9.5);
  for (const level of LEVELS.filter(level => level.gravityWell)) {
    const dockedGame = docked(level); dockedGame.dwell = 0;
    run(dockedGame, .1); near(dockedGame.fuel, 40.5); near(dockedGame.bank, 9.95);
  }
});

test('pump rate and price support per-level overrides without changing existing skill settings', () => {
  const config = LEVEL_CONFIG.find(level => level.id === 'luna');
  const level = createLevel({ ...config, refueling: { refillRate: 10, pricePerUnit: .25 } });
  const game = docked(level); run(game, 1); near(game.fuel, 50); near(game.bank, 7.5);
  for (const key of ['refillRate', 'pricePerUnit']) for (const value of [0, -1, NaN, Infinity, undefined]) {
    assert.throws(() => createLevel({ ...config, refueling: { [key]: value } }), /refueling/);
  }
  const defaults = docked(createLevel({ ...config, refueling: { pricePerUnit: .2 } }));
  run(defaults, 1); near(defaults.fuel, 45); near(defaults.bank, 9);
});

test('deliveries retain fractional pump charges and orders still load while pumping', () => {
  const game = docked(); game.orders[0].status = 'waiting';
  game.step(1 / 120, pump); assert.ok(game.order);
  const bank = game.bank;
  game.ship.landed = game.order.target; game.servicedPad = null; game.dwell = game.serviceDelay;
  const tip = Math.round(game.tip * 100) / 100;
  game.service(); near(game.bank, bank + tip);
});

test('restaurant service prompt describes holding, pumping, full tanks, and insufficient funds', () => {
  const game = docked(), renderer = svgRendererFixture();
  const label = () => renderer.service.querySelector('[data-refuel]').textContent;
  renderer.saucer(game, idle, 0); assert.match(label(), /HOLD F/);
  renderer.saucer(game, pump, 0); assert.match(label(), /FUELING 40%/);
  game.bank = 0; renderer.saucer(game, idle, 0); assert.match(label(), /NO FUNDS/);
  game.fuel = 100; renderer.saucer(game, idle, 0); assert.equal(label(), 'TANK FULL');
});
