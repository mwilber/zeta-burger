import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PHYSICS, FUEL, LANDING_BOUNCE } from '../dist/src/engine.js';
import { Renderer } from '../dist/src/renderer.js';
import { PADS, WORLD_WIDTH } from '../dist/src/world.js';
import { LEVELS, SKILLS } from '../dist/src/levels.js';
const dt = 1 / 120;
const idle = { left: false, right: false, up: false };
const fly = (game, seconds, controls = idle) => { for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls); };
function airborne() { const game = new Game(() => .5); game.start(); game.ship = { x: 410, y: 360, vx: 0, vy: 0, gear: false, landed: null }; return game; }
function approach(game, id, gear = true, vx = 0, vy = 20) {
  const pad = PADS.find(p => p.id === id);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .1, vx, vy, gear, landed: null };
  game.servicedPad = null; game.dwell = 0;
}

function setOrder(game, details, status = 'onboard') {
  game.orders[0] = { id: 1, availableAt: 0, status, ...details };
}

test('start airborne at the top center with retracted gear and no initial drift', () => {
  const game = new Game(); game.start();
  assert.equal(game.ship.x, WORLD_WIDTH / 2); assert.equal(game.ship.y, 80);
  assert.equal(game.ship.vx, 0); assert.equal(game.ship.vy, 0);
  assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false);
  assert.equal(game.fuel, FUEL.capacity);
  fly(game, .5, { ...idle, up: true });
  assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false); assert.ok(game.ship.vy < 0); assert.ok(game.ship.y < 80); assert.equal(game.lives, 3);
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
  for (const [vx, vy] of [[0, PHYSICS.safeVertical + 5], [PHYSICS.safeHorizontal + 5, 20], [-PHYSICS.safeHorizontal - 5, 20]]) {
    const game = airborne(); approach(game, 0, true, vx, vy); game.step(dt, idle);
    assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2);
  }
});
test('configured landing speed limits are inclusive and still reject harder impacts', () => {
  const vertical = PHYSICS.safeVertical, horizontal = PHYSICS.safeHorizontal;
  for (const [vx, impactVy, survives] of [
    [0, 90, true], [37, 20, true], [-37, 20, true],
    [horizontal, vertical, true], [-horizontal, vertical, true],
    [0, vertical + .001, false], [horizontal + .001, 20, false], [-horizontal - .001, 20, false]
  ]) {
    const game = airborne(); approach(game, 0, true, vx, impactVy - PHYSICS.gravity * dt);
    game.step(dt, idle);
    assert.equal(game.phase, survives ? 'playing' : 'crashed', `impact ${vx}, ${impactVy}`);
    assert.equal(game.ship.landed, survives ? 0 : null);
    assert.equal(game.lives, survives ? 3 : 2);
  }
});
test('only surviving touchdowns in the final 25% of either speed limit bounce', () => {
  const vertical = PHYSICS.safeVertical * .75, horizontal = PHYSICS.safeHorizontal * .75;
  for (const [vx, impactVy, bounces] of [
    [0, 20, false], [horizontal - .001, vertical - .001, false],
    [0, vertical, true], [horizontal, 20, true], [-horizontal, 20, true],
    [0, PHYSICS.safeVertical, true], [0, PHYSICS.safeVertical + .001, false]
  ]) {
    const game = airborne(); approach(game, 0, true, vx, impactVy - PHYSICS.gravity * dt);
    game.step(dt, idle);
    assert.equal(game.landingBounceTime > 0, bounces, `impact ${vx}, ${impactVy}`);
    assert.equal(game.events.some(event => event.type === 'land' && event.message.includes('Close call')), bounces);
  }
});
test('close-call landing makes the configured number of shrinking hops and settles within one second', () => {
  const game = airborne(); approach(game, 2, true, 0, 90); game.step(dt, idle);
  const docked = { ...game.ship };
  let peaks = 0, previous = 0, rising = false;
  const heights = [];
  for (let i = 0; i < 120; i++) {
    game.step(dt, idle);
    const height = -game.landingBounceOffset;
    if (height > previous + 1e-8) rising = true;
    else if (height < previous - 1e-8 && rising) { peaks++; heights.push(previous); rising = false; }
    previous = height;
    assert.deepEqual(game.ship, docked, 'visual bounce preserves docking and zero velocity');
    assert.equal(game.lives, 3);
    if ((i + 1) * dt >= LANDING_BOUNCE.duration) assert.equal(game.landingBounceOffset, 0, 'settled by the configured duration');
  }
  assert.equal(peaks, LANDING_BOUNCE.count);
  assert.ok(heights.every((height, i) => i === 0 || height < heights[i - 1]));
  assert.equal(game.landingBounceTime, 0);
  assert.equal(game.events.filter(event => event.type === 'land').length, 1);
});
test('bounce freezes on pause and clears on takeoff, gear retraction, crash, or restart', () => {
  for (const action of ['takeoff', 'gear', 'crash', 'restart']) {
    const game = airborne(); approach(game, 0, true, 0, 90); game.step(dt, idle); fly(game, .05);
    const time = game.landingBounceTime, offset = game.landingBounceOffset;
    assert.ok(offset < 0);
    game.pause(); fly(game, 1);
    assert.equal(game.landingBounceTime, time); assert.equal(game.landingBounceOffset, offset);
    game.pause();
    if (action === 'takeoff') game.step(dt, { ...idle, up: true });
    else if (action === 'gear') game.toggleGear();
    else if (action === 'crash') game.crash('test');
    else game.start();
    assert.equal(game.landingBounceTime, 0, action);
    assert.equal(game.landingBounceOffset, 0, action);
  }
});
test('canvas moves both custom hull and gear with the close-call bounce', () => {
  const game = airborne(); approach(game, 2, true, 0, 90); game.step(dt, idle); fly(game, .1);
  const calls = [], customHull = {};
  const renderer = Object.create(Renderer.prototype);
  renderer.ctx = {
    save() {}, restore() {}, rotate() {},
    translate(x, y) { calls.push(['translate', x, y]); },
    drawImage(image) { calls.push(['hull', image]); }
  };
  renderer.images = new Map([['saucer', customHull]]);
  renderer.ellipse = () => {};
  renderer.line = () => { calls.push(['gear']); };
  renderer.saucer(game, idle, game.time);
  assert.ok(game.landingBounceOffset < 0);
  assert.deepEqual(calls[0], ['translate', game.ship.x, game.ship.y + game.landingBounceOffset]);
  assert.equal(calls.filter(call => call[0] === 'gear').length, 4);
  assert.deepEqual(calls.at(-1), ['hull', customHull]);
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
  const game = airborne(); game.orders[0].availableAt = 0; approach(game, 0); game.step(dt, idle);
  fly(game, .5); assert.equal(game.order, null); fly(game, .5);
  assert.equal(game.order.target, 3); assert.equal(game.order.initialTip, 7.5);
  approach(game, 2); game.step(dt, idle); fly(game, 1); assert.equal(game.delivered, 0);
  approach(game, 3); game.step(dt, idle); fly(game, 1);
  assert.equal(game.delivered, 1); assert.equal(game.order, null); assert.ok(game.bank > 6.5 && game.bank < 7.5);
  const bank = game.bank; fly(game, 2); assert.equal(game.bank, bank); assert.equal(game.delivered, 1);
  game.orders[1].availableAt = game.time; approach(game, 0); game.step(dt, idle); fly(game, 1); assert.ok(game.order);
});
test('negative tips are credited as negative amounts', () => {
  const game = airborne(); setOrder(game, { target: 3, initialTip: 5, elapsed: 120 });
  assert.ok(game.tip < -4); approach(game, 3); game.step(dt, idle); fly(game, 1);
  assert.ok(game.bank < -4); assert.equal(game.delivered, 1);
});
test('pause freezes physics and the tip countdown', () => {
  const game = airborne(); setOrder(game, { target: 2, initialTip: 10, elapsed: 0 });
  const ship = { ...game.ship }; game.pause(); fly(game, 5, { ...idle, up: true });
  assert.deepEqual(game.ship, ship); assert.equal(game.tip, 10); game.pause(); game.step(dt, idle); assert.ok(game.tip < 10);
});
test('crashes keep the order timer running, respawn at the gas station, and end after three lives', () => {
  const game = airborne(); setOrder(game, { target: 1, initialTip: 7, elapsed: 0 });
  game.crash('test'); fly(game, 1.6); assert.equal(game.phase, 'playing'); assert.equal(game.ship.landed, PADS[0].id);
  assert.equal(game.order.target, 1); assert.ok(game.tip < 7); game.crash('test'); fly(game, 1.6);
  game.crash('test'); assert.equal(game.lives, 0); assert.equal(game.phase, 'crashed');
  fly(game, 1.5); assert.equal(game.phase, 'gameover'); assert.equal(game.endReason, 'lives');
  const tip = game.tip; fly(game, 3); assert.equal(game.tip, tip);
  game.start(); assert.equal(game.lives, 3); assert.equal(game.bank, 0); assert.equal(game.order, null);
});
test('final crash finishes its animation before game over, without respawn or further shift changes', () => {
  const game = airborne(); game.lives = 1; game.fuel = 40;
  // A tip would expire on the next step, and another order would arrive during the explosion.
  game.orders = [
    { id: 1, target: 2, initialTip: 5, elapsed: 5 / SKILLS.normal.tipRate, availableAt: 0, status: 'onboard' },
    { id: 2, target: 3, initialTip: 5, elapsed: 0, availableAt: .1, status: 'scheduled' }
  ];
  game.ship.x = 23; game.step(dt, idle);
  assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 0); assert.equal(game.endReason, null);
  const snapshot = JSON.stringify({ ship: game.ship, orders: game.orders, fuel: game.fuel, bank: game.bank, time: game.time });
  const renderer = Object.create(Renderer.prototype); renderer.particles = [];
  renderer.burst(game.events.find(event => event.type === 'crash'));
  assert.ok(renderer.particles.length > 0);
  for (let i = 0; i < 179; i++) {
    game.step(dt, { ...idle, up: true }); renderer.update(dt);
    assert.equal(game.phase, 'crashed', 'dialog stays hidden throughout the explosion');
    assert.equal(game.endReason, null);
  }
  assert.equal(game.events.some(event => event.type === 'gameover'), false);
  // The app can pause a crash animation; its delay must freeze too.
  game.phase = 'paused'; const crashTime = game.crashTime; fly(game, 2);
  assert.equal(game.crashTime, crashTime); game.phase = 'crashed';
  game.step(dt, idle); renderer.update(dt);
  assert.equal(renderer.particles.length, 0, 'explosion ends before the dialog appears');
  assert.equal(game.phase, 'gameover'); assert.equal(game.endReason, 'lives');
  assert.equal(game.events.filter(event => event.type === 'gameover').length, 1);
  assert.equal(game.events.some(event => event.type === 'respawn'), false);
  fly(game, 2);
  assert.equal(JSON.stringify({ ship: game.ship, orders: game.orders, fuel: game.fuel, bank: game.bank, time: game.time }), snapshot);
  assert.equal(game.events.filter(event => event.type === 'gameover').length, 1);
});
test('tip starts within five to ten dollars and all destinations are selectable', () => {
  for (const random of [0, .2, .4, .6, .8, .999999]) {
    const game = new Game(() => random); game.start(); game.orders[0].availableAt = 0; approach(game, 0); game.step(dt, idle); fly(game, 1);
    assert.ok(game.order.initialTip >= 5 && game.order.initialTip <= 10); assert.ok(game.order.target >= 1 && game.order.target <= 5);
  }
});

test('skill fixes the total and random arrivals stay within each interval range', () => {
  for (const skill of Object.keys(SKILLS)) {
    let seed = 23;
    const game = new Game(() => { seed = seed * 16807 % 2147483647; return seed / 2147483647; });
    game.start(skill);
    const setting = SKILLS[skill];
    assert.equal(game.totalOrders, setting.orders);
    assert.equal(game.scheduledCount, setting.orders);
    assert.equal(game.orders[0].availableAt, 5);
    assert.equal(game.orders[0].status, "scheduled");
    assert.equal(game.orders[0].elapsed, 0);
    let previous = 5;
    const intervals = [];
    for (const order of game.orders.slice(1)) {
      const gap = order.availableAt - previous;
      assert.ok(gap >= setting.arrivalMin && gap <= setting.arrivalMax);
      assert.equal(order.elapsed, 0); assert.equal(order.status, 'scheduled');
      intervals.push(gap); previous = order.availableAt;
    }
    assert.ok(new Set(intervals).size > 1);
    game.ship = game.spawnAtStation(); fly(game, 250);
    assert.equal(game.orders.length, setting.orders, 'the shift never creates additional orders');
  }
});
test('orders overlap and waiting tips fall while another order is aboard', () => {
  const game = new Game(() => .5); game.start();
  setOrder(game, { target: 3, initialTip: 5, elapsed: 80 });
  game.orders[1].availableAt = .2;
  const firstTip = game.tip;
  fly(game, .5);
  const waiting = game.orders[1];
  assert.equal(waiting.status, 'waiting');
  assert.ok(Math.abs(waiting.elapsed - .3) < .00001, 'countdown starts at arrival, including partial steps');
  assert.ok(game.tip < firstTip && game.tip < 0);
  assert.ok(game.tipFor(waiting) < waiting.initialTip);
  assert.equal(game.orders[2].elapsed, 0, 'unreleased orders do not lose tips');
});
test('restaurant loads a newly arrived order while the pilot remains docked', () => {
  const game = airborne(); Object.assign(game.orders[0], { availableAt: 2, status: 'scheduled', elapsed: 0 });
  approach(game, 0); game.step(dt, idle); fly(game, 1);
  assert.equal(game.order, null); assert.equal(game.servicedPad, null);
  fly(game, 1.1); assert.equal(game.order.id, 1);
  assert.equal(game.waitingOrders.length, 0);
});
test('delivery can lose money while a different waiting order still has a positive tip', () => {
  const game = airborne();
  setOrder(game, { target: 3, initialTip: 5, elapsed: 80 });
  game.orders[1].availableAt = 0;
  approach(game, 3); game.step(dt, idle); fly(game, 1);
  assert.ok(game.bank < 0); assert.equal(game.delivered, 1);
  assert.ok(game.tipFor(game.orders[1]) > 0); assert.equal(game.phase, 'playing');
});
test('all delivered ends the level immediately and freezes every resource', () => {
  const game = airborne();
  setOrder(game, { target: 3, initialTip: 5, elapsed: 0 }); game.orders = [game.orders[0]];
  approach(game, 3); game.step(dt, idle); fly(game, 1);
  assert.equal(game.phase, 'gameover'); assert.equal(game.endReason, 'delivered');
  assert.equal(game.delivered, 1); assert.ok(game.bank > 0);
  const snapshot = JSON.stringify({ orders: game.orders, ship: game.ship, fuel: game.fuel, time: game.time });
  fly(game, 10, { ...idle, up: true });
  assert.equal(JSON.stringify({ orders: game.orders, ship: game.ship, fuel: game.fuel, time: game.time }), snapshot);
});
test('tip failure waits for all arrivals, and requires strictly negative tips', () => {
  const game = new Game(() => .5); game.start(); game.ship = game.spawnAtStation();
  setOrder(game, { target: 1, initialTip: 5, elapsed: 100 }, 'waiting');
  game.orders = [game.orders[0], { id: 2, target: 2, initialTip: 5, elapsed: 0, availableAt: 2, status: 'scheduled' }];
  fly(game, 1); assert.equal(game.phase, 'playing');
  fly(game, 1.1); assert.equal(game.phase, 'playing', 'the new order has a positive tip');
  game.orders[1].elapsed = 5 / SKILLS.normal.tipRate;
  game.checkEnd(); assert.equal(game.phase, 'playing', 'zero is not below zero');
  game.step(dt, idle); assert.equal(game.endReason, 'tips'); assert.equal(game.phase, 'gameover');
});
test('delivered orders do not participate in tip failure or keep aging', () => {
  const game = new Game(); game.start();
  game.orders = [
    { id: 1, target: 1, initialTip: 10, elapsed: 1, availableAt: 0, status: 'delivered' },
    { id: 2, target: 2, initialTip: 5, elapsed: 100, availableAt: 0, status: 'waiting' }
  ];
  game.delivered = 1; game.step(dt, idle);
  assert.equal(game.endReason, 'tips'); assert.equal(game.orders[0].elapsed, 1);
});
test('pause freezes arrivals, tips, fuel, and level time', () => {
  const game = new Game(); game.start(); Object.assign(game.orders[0], { availableAt: .1, status: 'scheduled', elapsed: 0 });
  game.fuel = 40; game.pause(); fly(game, 10, { ...idle, up: true, right: true });
  assert.equal(game.time, 0); assert.equal(game.fuel, 40); assert.equal(game.scheduledCount, game.totalOrders);
  game.pause(); fly(game, .2); assert.equal(game.orders[0].status, 'waiting');
});
test('arrivals and independent tip clocks continue during replacement delay', () => {
  const game = new Game(); game.start(); Object.assign(game.orders[0], { availableAt: .2, status: 'scheduled', elapsed: 0 });
  game.crash('test'); fly(game, .5);
  assert.equal(game.phase, 'crashed'); assert.equal(game.orders[0].status, 'waiting');
  assert.ok(Math.abs(game.orders[0].elapsed - .3) < .00001);
  game.orders = [{ id: 1, target: 1, initialTip: 5, elapsed: 100, availableAt: 0, status: 'waiting' }];
  game.step(dt, idle); assert.equal(game.endReason, 'tips', 'tip failure can end a shift before respawn');
});
test('fuel is charged only for working thrusters, with an empty tank disabling thrust', () => {
  const game = airborne();
  fly(game, .25, { ...idle, up: true, right: true });
  assert.ok(Math.abs(game.fuel - (100 - .25 * (FUEL.upRate + FUEL.sideRate))) < .00001);
  const fuel = game.fuel; fly(game, .25); assert.equal(game.fuel, fuel);
  game.ship.gear = true; fly(game, .1, { ...idle, right: true }); assert.equal(game.fuel, fuel);
  game.ship.gear = false; game.fuel = 0;
  const vx = game.ship.vx, vy = game.ship.vy;
  fly(game, .1, { ...idle, up: true, right: true });
  assert.equal(game.ship.vx, vx); assert.ok(Math.abs(game.ship.vy - vy - PHYSICS.gravity * .1) < .00001);
  assert.equal(game.fuel, 0);
});
test('a partial tank supplies only the remaining fraction of a thrust step', () => {
  const game = airborne(); game.fuel = FUEL.upRate * dt / 2;
  game.step(dt, { ...idle, up: true });
  assert.equal(game.fuel, 0);
  assert.ok(Math.abs(game.ship.vy - (PHYSICS.gravity - PHYSICS.upThrust / 2) * dt) < .00001);
});
test('gas station refills for free up to capacity; other pads do not refill', () => {
  const game = new Game(); game.start(); game.ship = game.spawnAtStation(); game.fuel = 0;
  fly(game, 2); assert.ok(Math.abs(game.fuel - 50) < .00001); assert.equal(game.bank, 0);
  fly(game, 3); assert.equal(game.fuel, 100);
  approach(game, 1); game.step(dt, idle); game.fuel = 40; fly(game, 1);
  assert.equal(game.fuel, 40);
});
test('first upward movement retracts gear after every landing and keeps momentum', () => {
  for (const pad of PADS) {
    const game = airborne(); approach(game, pad.id); game.step(dt, idle);
    assert.equal(game.ship.gear, true); assert.equal(game.ship.landed, pad.id);
    game.step(dt, { ...idle, up: true, right: true });
    assert.equal(game.ship.gear, false); assert.equal(game.ship.landed, null);
    assert.ok(game.ship.vx > 0 && game.ship.vy < 0); assert.equal(game.lives, 3);
  }
});
test('banking responds immediately to either control and reaches the 25-degree limit while held', () => {
  const max = 25 * Math.PI / 180;
  for (const direction of [-1, 1]) {
    const game = airborne();
    const controls = { ...idle, left: direction < 0, right: direction > 0 };
    game.step(dt, controls);
    assert.ok(game.tilt * direction > 0, 'tilt begins on the first input step');
    const firstTilt = game.tilt;
    fly(game, .1 - dt, controls);
    assert.ok(game.tilt * direction > firstTilt * direction);
    assert.ok(game.tilt * direction > 17 * Math.PI / 180, 'banking responds at the faster rate');
    fly(game, .5, controls);
    assert.equal(game.tilt, direction * max);
    fly(game, .1, controls); assert.equal(game.tilt, direction * max, 'held input cannot exceed the limit');
  }
});
test('release rights the saucer immediately despite continued horizontal drift', () => {
  const game = airborne(); game.tilt = 25 * Math.PI / 180; game.ship.vx = 80;
  game.step(dt, idle);
  assert.ok(game.tilt < 25 * Math.PI / 180 && game.tilt > 0);
  fly(game, .1 - dt);
  assert.ok(game.tilt < 8 * Math.PI / 180, 'return to center uses the faster rate too');
  assert.equal(game.ship.vx, 80, 'coasting speed does not keep the ship tilted');
  fly(game, .5); assert.equal(game.tilt, 0);
});
test('opposite input changes the tilt direction before the ship reverses its drift', () => {
  const game = airborne(); game.ship.vx = 100; game.tilt = 25 * Math.PI / 180;
  fly(game, .1, { ...idle, left: true });
  assert.ok(game.tilt < 0); assert.ok(game.ship.vx > 0);
});
test('locked or balanced side controls return upright and tilt never changes physics', () => {
  for (const gear of [true, false]) {
    const game = airborne(); game.ship.gear = gear; game.tilt = 25 * Math.PI / 180;
    game.step(dt, { ...idle, left: true, right: true });
    assert.ok(game.tilt < 25 * Math.PI / 180);
  }
  const locked = airborne(); locked.ship.gear = true;
  locked.step(dt, { ...idle, right: true }); assert.equal(locked.tilt, 0);
  const other = airborne(); other.tilt = -25 * Math.PI / 180;
  const flat = airborne();
  other.step(dt, { ...idle, right: true }); flat.step(dt, { ...idle, right: true });
  assert.deepEqual(other.ship, flat.ship, 'tilt does not affect physics');
});
test('level configuration selects spawn, restaurant, destinations, and collision geometry', () => {
  const level = { ...LEVELS[0], id: 'test-level', gasStation: 1, restaurant: 4, destinations: [2], solids: [] };
  const game = new Game(() => .5, level); game.start('expert');
  assert.deepEqual({ x: game.ship.x, y: game.ship.y }, level.start); assert.equal(game.ship.landed, null);
  assert.equal(game.spawnAtStation().landed, 1); assert.equal(game.destination.id, 4);
  assert.ok(game.orders.every(order => order.target === 2));
  game.orders[0].availableAt = 0; approach(game, 4); game.step(dt, idle); fly(game, 1);
  assert.equal(game.order.target, 2); assert.equal(game.destination.id, 2);
});


test('first order arrives five seconds after start, with its tip clock beginning on arrival', () => {
  for (const skill of Object.keys(SKILLS)) {
    for (const random of [0, .5, .999999]) {
      const game = new Game(() => random); game.start(skill);
      assert.equal(game.time, 0); assert.equal(game.order, null);
      assert.equal(game.waitingOrders.length, 0);
      const order = game.orders[0];
      assert.equal(order.id, 1); assert.equal(order.availableAt, 5); assert.equal(order.elapsed, 0);
      assert.equal(order.status, 'scheduled'); assert.equal(game.tipFor(order), order.initialTip);
      game.ship = game.spawnAtStation(); fly(game, 4.9);
      assert.equal(order.status, 'scheduled'); assert.equal(order.elapsed, 0);
      game.pause(); const time = game.time; fly(game, 1); assert.equal(game.time, time);
      game.pause(); fly(game, .2);
      assert.equal(order.status, 'waiting'); assert.equal(game.waitingOrders.length, 1);
      assert.ok(Math.abs(order.elapsed - .1) < .000001, 'countdown starts at five seconds');
      assert.ok(Math.abs(game.tipFor(order) - (order.initialTip - .1 * SKILLS[skill].tipRate)) < .000001);
      game.start(skill); assert.equal(game.orders[0].elapsed, 0);
      assert.equal(game.orders[0].availableAt, 5); assert.equal(game.waitingOrders.length, 0);
      assert.equal(game.ship.x, WORLD_WIDTH / 2); assert.equal(game.ship.y, 80);
    }
  }
});
