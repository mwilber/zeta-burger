import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PHYSICS } from '../dist/src/engine.js';
import { PADS } from '../dist/src/world.js';
const dt = 1 / 120;
const idle = { left: false, right: false, up: false };
const fly = (game, seconds, controls = idle) => { for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls); };
function airborne() { const game = new Game(() => .5); game.start(); game.ship = { x: 410, y: 360, vx: 0, vy: 0, gear: false, landed: null }; return game; }
function approach(game, id, gear = true, vx = 0, vy = 20) {
  const pad = PADS.find(p => p.id === id);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .1, vx, vy, gear, landed: null };
  game.servicedPad = null; game.dwell = 0;
}

test('launch from home and gravity-driven flight have no pitch control', () => {
  const game = new Game(); game.start();
  fly(game, .5, { ...idle, up: true });
  assert.equal(game.ship.landed, null); assert.ok(game.ship.vy < 0); assert.ok(game.ship.y < 618); assert.equal(game.lives, 3);
});
test('gear down blocks both sideways thrusters but preserves drift', () => {
  const game = airborne(); game.ship.vx = 48; game.ship.vy = -15;
  game.toggleGear();
  assert.equal(game.ship.vx, 48); assert.equal(game.ship.vy, -15);
  fly(game, .25, { ...idle, left: true });
  assert.equal(game.ship.vx, 48); assert.ok(Math.abs(game.ship.x - 422) < .001);
  assert.ok(Math.abs(game.ship.vy - (-15 + PHYSICS.gravity * .25)) < .001);
});
test('retracted gear allows independent up and side thrust and no horizontal drag', () => {
  const game = airborne(); fly(game, .25, { ...idle, right: true, up: true });
  assert.ok(Math.abs(game.ship.vx - PHYSICS.sideThrust * .25) < .001); assert.ok(game.ship.vy < 0);
  const vx = game.ship.vx; fly(game, .25); assert.equal(game.ship.vx, vx);
});
test('each pad accepts a safe gear-only touchdown', () => {
  for (const pad of PADS) {
    const game = airborne(); approach(game, pad.id); game.step(dt, idle);
    assert.equal(game.ship.landed, pad.id, `pad ${pad.id}`); assert.equal(game.lives, 3);
    assert.equal(game.ship.y + PHYSICS.footY, pad.y); assert.equal(game.ship.vy, 0);
    fly(game, 1); assert.equal(game.lives, 3, `remain on pad ${pad.id}`);
  }
});
test('hull contact on a pad with retracted gear destroys the saucer', () => {
  const game = airborne(), pad = PADS.find(p => p.id === 0);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - 8.1, vx: 0, vy: 20, gear: false, landed: null };
  game.step(dt, idle); assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2);
});
test('excessive descent speed and sideways drift cause hard landings', () => {
  for (const [vx, vy] of [[0, 90], [40, 20], [-40, 20]]) {
    const game = airborne(); approach(game, 0, true, vx, vy); game.step(dt, idle);
    assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2);
  }
});
test('one foot outside a pad cannot become a landing', () => {
  const game = airborne(), pad = PADS.find(p => p.id === 0); approach(game, 0);
  game.ship.x = pad.x + 10; game.step(dt, idle);
  assert.equal(game.phase, 'crashed'); assert.equal(game.ship.landed, null);
});
test('buildings, terrain, pad undersides, and world edges are fatal', () => {
  const pad = PADS.find(p => p.id === 0);
  const placements = [[pad.building.x + 25, pad.building.y + 30], [300, 590], [428, 573], [23, 100], [400, 16], [800, 744]];
  for (const [x, y] of placements) {
    const game = airborne(); game.ship.x = x; game.ship.y = y; game.step(dt, idle);
    assert.equal(game.phase, 'crashed', `impact at ${x},${y}`);
  }
});
test('pickup requires restaurant dwell; wrong destination never pays; delivery pays once', () => {
  const game = airborne(); approach(game, 0); game.step(dt, idle);
  fly(game, .5); assert.equal(game.order, null); fly(game, .5);
  assert.equal(game.order.target, 3); assert.equal(game.order.initialTip, 7.5);
  approach(game, 2); game.step(dt, idle); fly(game, 1); assert.equal(game.delivered, 0);
  approach(game, 3); game.step(dt, idle); fly(game, 1);
  assert.equal(game.delivered, 1); assert.equal(game.order, null); assert.ok(game.bank > 7 && game.bank < 7.5);
  const bank = game.bank; fly(game, 2); assert.equal(game.bank, bank); assert.equal(game.delivered, 1);
  approach(game, 0); game.step(dt, idle); fly(game, 1); assert.ok(game.order);
});
test('negative tips are credited as negative amounts', () => {
  const game = airborne(); game.order = { target: 3, initialTip: 5, elapsed: 60 };
  assert.equal(game.tip, -4); approach(game, 3); game.step(dt, idle); fly(game, 1);
  assert.ok(game.bank < -4); assert.equal(game.delivered, 1);
});
test('pause freezes physics and the tip countdown', () => {
  const game = airborne(); game.order = { target: 2, initialTip: 10, elapsed: 0 };
  const ship = { ...game.ship }; game.pause(); fly(game, 5, { ...idle, up: true });
  assert.deepEqual(game.ship, ship); assert.equal(game.tip, 10); game.pause(); game.step(dt, idle); assert.ok(game.tip < 10);
});
test('crashes keep the order timer running, respawn at home, and end after three lives', () => {
  const game = airborne(); game.order = { target: 1, initialTip: 7, elapsed: 0 };
  game.crash('test'); fly(game, 1.6); assert.equal(game.phase, 'playing'); assert.equal(game.ship.landed, PADS[0].id);
  assert.equal(game.order.target, 1); assert.ok(game.tip < 7); game.crash('test'); fly(game, 1.6);
  game.crash('test'); assert.equal(game.lives, 0); assert.equal(game.phase, 'gameover');
  const tip = game.tip; fly(game, 3); assert.equal(game.tip, tip);
  game.start(); assert.equal(game.lives, 3); assert.equal(game.bank, 0); assert.equal(game.order, null);
});
test('tip starts within five to ten dollars and all destinations are selectable', () => {
  for (const random of [0, .2, .4, .6, .8, .999999]) {
    const game = new Game(() => random); game.start(); approach(game, 0); game.step(dt, idle); fly(game, 1);
    assert.ok(game.order.initialTip >= 5 && game.order.initialTip <= 10); assert.ok(game.order.target >= 1 && game.order.target <= 5);
  }
});
