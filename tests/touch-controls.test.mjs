import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeThrust, TouchControls } from '../dist/src/touch-controls.js';
import { Game, PHYSICS, FUEL, ZERO_G } from '../dist/src/engine.js';
import { LEVELS } from '../dist/src/levels.js';

const neutral = { left: 0, right: 0, up: 0, down: 0 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('swipes provide full cardinal thrust and a neutral zone at the touch origin', () => {
  for (const [dx, dy] of [[0, 0], [8, 0], [0, -8], [4, 4]]) assert.deepEqual(swipeThrust(dx, dy), neutral);
  for (const [direction, dx, dy] of [['left', -20, 0], ['right', 20, 0], ['up', 0, -20], ['down', 0, 20]]) {
    assert.deepEqual(swipeThrust(dx, dy), { ...neutral, [direction]: 1 });
  }
});

test('angle shares thrust between adjacent directions independently of swipe distance', () => {
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const expected = { ...neutral, [x < 0 ? 'left' : 'right']: .5, [y < 0 ? 'up' : 'down']: .5 };
    assert.deepEqual(swipeThrust(20 * x, 20 * y), expected);
    assert.deepEqual(swipeThrust(200 * x, 200 * y), expected);
  }
  const angle = Math.PI / 8;
  const swipe = swipeThrust(100 * Math.cos(angle), -100 * Math.sin(angle));
  near(swipe.right, .75); near(swipe.up, .25);
});

class Surface extends EventTarget {
  hidden = true;
  style = {};
  captures = new Set();
  getBoundingClientRect() { return { width: 800 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  pointer(type, id, x = 0, y = 0, pointerType = 'touch') {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: id, pointerType, clientX: x, clientY: y });
    this.dispatchEvent(event);
    return event;
  }
}
function fixture() {
  const surface = new Surface(), joystick = new Surface(), knob = new Surface();
  let gearPresses = 0;
  const touch = new TouchControls(surface, joystick, knob, () => gearPresses++);
  touch.setActive(true, true);
  return { surface, joystick, knob, touch, gearPresses: () => gearPresses };
}

test('left touch anchors a joystick; movement across the midpoint retains steering', () => {
  const { surface, joystick, touch, gearPresses } = fixture();
  assert.equal(surface.pointer('pointerdown', 1, 300, 200).defaultPrevented, true);
  assert.equal(joystick.style.left, '300px'); assert.equal(joystick.style.top, '200px');
  assert.equal(joystick.hidden, false); assert.deepEqual(touch.controls(), neutral);
  surface.pointer('pointermove', 1, 500, 0);
  assert.deepEqual(touch.controls(), { ...neutral, right: .5, up: .5 });
  assert.equal(gearPresses(), 0);
  surface.pointer('pointermove', 1, 300, 200);
  assert.deepEqual(touch.controls(), neutral);
  surface.pointer('pointerup', 1);
  assert.equal(joystick.hidden, true); assert.equal(surface.captures.size, 0);
});

test('gear presses work simultaneously with steering and toggle once per press', () => {
  const { surface, touch, gearPresses } = fixture();
  surface.pointer('pointerdown', 1, 100, 200);
  surface.pointer('pointermove', 1, 100, 100);
  surface.pointer('pointerdown', 2, 400, 200);
  surface.pointer('pointermove', 2, 200, 100);
  surface.pointer('pointerup', 2);
  surface.pointer('click', 2);
  assert.equal(gearPresses(), 1);
  assert.deepEqual(touch.controls(), { ...neutral, up: 1 });
  surface.pointer('pointerdown', 3, 700, 200);
  assert.equal(gearPresses(), 2);
});

test('extra left fingers do not steal or release the active joystick', () => {
  const { surface, joystick, touch } = fixture();
  surface.pointer('pointerdown', 1, 100, 200);
  surface.pointer('pointermove', 1, 50, 150);
  surface.pointer('pointerdown', 2, 300, 200);
  surface.pointer('pointermove', 2, 300, 300);
  surface.pointer('pointerup', 2);
  assert.equal(joystick.style.left, '100px');
  assert.deepEqual(touch.controls(), { ...neutral, left: .5, up: .5 });
});

test('release, cancellation, lost capture, and lifecycle resets stop thrust', () => {
  for (const end of ['pointerup', 'pointercancel', 'lostpointercapture', 'reset', 'crashed', 'inactive']) {
    const { surface, joystick, touch } = fixture();
    surface.pointer('pointerdown', 1, 100, 200);
    surface.pointer('pointermove', 1, 100, 100);
    if (end === 'reset') touch.reset();
    else if (end === 'crashed') touch.setActive(true, false);
    else if (end === 'inactive') touch.setActive(false, false);
    else surface.pointer(end, 1);
    assert.deepEqual(touch.controls(), neutral, end);
    assert.equal(joystick.hidden, true, end);
    surface.pointer('pointermove', 1, 150, 250);
    assert.deepEqual(touch.controls(), neutral, end);
    assert.equal(surface.hidden, end === 'inactive', end);
  }
});

test('countdown and crash screens swallow touches without flight actions; desktop stays inactive', () => {
  const { surface, joystick, touch, gearPresses } = fixture();
  touch.setActive(true, false);
  assert.equal(surface.pointer('pointerdown', 1, 100, 200).defaultPrevented, true);
  surface.pointer('pointerdown', 2, 700, 200);
  assert.equal(joystick.hidden, true); assert.equal(gearPresses(), 0);
  touch.setActive(false, false);
  assert.equal(surface.hidden, true);
  assert.equal(surface.pointer('pointerdown', 1, 100, 200).defaultPrevented, false);
  touch.setActive(true, true);
  surface.pointer('pointerdown', 1, 100, 200, 'mouse');
  surface.pointer('pointerdown', 2, 700, 200, 'mouse');
  assert.equal(joystick.hidden, true); assert.equal(gearPresses(), 0);
});

function airborne(id = 'luna') {
  const level = LEVELS.find(level => level.id === id), game = new Game(() => .5, level);
  game.start(); game.step(3, neutral);
  game.ship = { x: 410, y: 360, vx: 0, vy: 0, gear: false, landed: null };
  return game;
}

test('diagonal touch thrust scales acceleration and fuel, while keyboard diagonals retain full thrust', () => {
  for (const [up, side] of [[.5, .5], [.25, .75], [1, 1]]) {
    const game = airborne(), dt = .1;
    game.step(dt, { ...neutral, up, left: side });
    near(game.ship.vx, -PHYSICS.sideThrust * side * dt);
    near(game.ship.vy, (game.level.gravity - PHYSICS.upThrust * up) * dt);
    near(game.fuel, FUEL.capacity - (FUEL.upRate * up + FUEL.sideRate * side) * dt);
  }
  const game = airborne(); game.step(.1, { left: true, up: true, down: false, right: false });
  near(game.ship.vx, -PHYSICS.sideThrust * .1);
  near(game.ship.vy, (game.level.gravity - PHYSICS.upThrust) * .1);
});

test('fractional down thrust respects gear lock, empty fuel, and partial tanks', () => {
  const game = airborne(); game.ship.gear = true;
  game.step(.1, { ...neutral, down: .5, right: .5 });
  near(game.ship.vx, 0);
  near(game.ship.vy, (game.level.gravity + PHYSICS.downThrust * .5) * .1);
  near(game.fuel, FUEL.capacity - FUEL.downRate * .5 * .1);
  const partial = airborne(); partial.fuel = (FUEL.upRate + FUEL.sideRate) * .5 * .1 / 2;
  partial.step(.1, { ...neutral, up: .5, right: .5 });
  near(partial.ship.vx, PHYSICS.sideThrust * .25 * .1);
  near(partial.ship.vy, (partial.level.gravity - PHYSICS.upThrust * .25) * .1);
  near(partial.fuel, 0);
  const empty = airborne(); empty.fuel = 0; empty.step(.1, { ...neutral, up: .5, right: .5 });
  near(empty.ship.vx, 0); near(empty.ship.vy, empty.level.gravity * .1);
});

test('Zero G clamps after 250 ms of fractional down thrust and charges proportional fuel', () => {
  const game = airborne('zero-g'), pad = game.pads.find(pad => pad.id === game.level.restaurant);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: pad.id };
  const initialFuel = game.fuel;
  game.step(ZERO_G.clingDelay, { ...neutral, down: .5, left: .5 });
  assert.equal(game.clinging, true);
  near(game.fuel, initialFuel - FUEL.downRate * .5 * ZERO_G.clingDelay);
  game.step(.1, neutral); assert.equal(game.clinging, true);
  game.step(.01, { ...neutral, up: .5, left: .5 });
  assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false);
});
