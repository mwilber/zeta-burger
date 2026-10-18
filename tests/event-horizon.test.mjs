import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PHYSICS, START_DELAY, ZERO_G, CRASH_DURATION } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { WORLD_WIDTH, WORLD_HEIGHT, intersects } from '../dist/src/world.js';

const level = LEVELS.find(level => level.id === 'event-horizon');
const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
function playing() {
  const game = new Game(() => .5, level); game.start('casual'); game.step(START_DELAY, idle); return game;
}
function fly(game, seconds, controls = idle) {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls);
}

test('Event Horizon starts the stack with a central well and seven accessible peripheral stations', () => {
  assert.equal(LEVELS[0], level); assert.equal(level.number, 6);
  assert.equal(nextLevel(level).id, 'zero-g');
  assert.deepEqual(LEVELS.map(level => level.number), [6, 5, 4, 3, 2, 1]);
  assert.equal(level.blackHole.x, WORLD_WIDTH / 2); assert.equal(level.blackHole.y, WORLD_HEIGHT / 2);
  assert.equal(level.gravity, 0); assert.equal(level.thrustScale ?? 1, 1);
  assert.equal(level.padCount, 7); assert.equal(level.seekerCount, 0); assert.equal(level.fallingObstacleLimit, 0);
  for (const pad of level.pads) {
    assert.ok(pad.y <= 170 || pad.y >= 640 || pad.x + pad.width / 2 < 200 || pad.x > 1080);
    assert.equal(pad.motion, undefined);
  }
  for (const solid of level.solids) for (const p of solid.points) {
    assert.ok(p.x > 0 && p.x < WORLD_WIDTH && p.y > 0 && p.y < WORLD_HEIGHT - 12);
    assert.ok(Math.hypot(p.x - 640, p.y - 380) > level.blackHole.radius + 80);
  }
  for (let i = 0; i < level.solids.length; i++) for (let j = i + 1; j < level.solids.length; j++) {
    if (level.solids[i].padId !== level.solids[j].padId) assert.ok(!intersects(level.solids[i].points, level.solids[j].points));
  }
});

test('the well pulls in every direction, strengthens nearby, and works without fuel or with gear down', () => {
  for (const [x, y] of [[400, 380], [880, 380], [640, 270], [640, 550], [400, 270]]) {
    for (const gear of [false, true]) {
      const game = playing(); Object.assign(game.ship, { x, y, gear }); game.fuel = 0;
      game.step(dt, { ...idle, up: true, right: true });
      const dx = 640 - x, dy = 380 - y, distance = Math.hypot(dx, dy);
      const pull = Math.min(level.blackHole.maxAcceleration, level.blackHole.strength / distance ** 2);
      assert.ok(Math.abs(game.ship.vx - dx / distance * pull * dt) < 1e-9);
      assert.ok(Math.abs(game.ship.vy - dy / distance * pull * dt) < 1e-9);
      assert.equal(game.phase, 'playing'); assert.equal(game.fuel, 0);
    }
  }
  const near = playing(), far = playing(); near.ship.x = 800; near.ship.y = 380; far.ship.x = 960; far.ship.y = 380;
  near.step(dt, idle); far.step(dt, idle);
  assert.ok(Math.abs(near.ship.vx) > Math.abs(far.ship.vx));
  assert.ok(Math.abs(near.ship.vx) <= level.blackHole.maxAcceleration * dt);
});

test('hull and gear contact, exact-center spawns, and fast crossings lose one life without invalid numbers', () => {
  for (const [x, y, vx, vy, gear] of [
    [640, 380, 0, 0, false], [640, 380 - 52 - 10, 0, 0, true],
    [640 - 52 - 20, 380, 0, 0, false], [400, 380, 60000, 0, false],
    [640, 550, 0, -40000, false]
  ]) {
    const game = playing(); Object.assign(game.ship, { x, y, vx, vy, gear }); game.step(dt, idle);
    assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2); assert.match(game.events.at(-1).message, /Event horizon/);
    assert.ok([game.ship.x, game.ship.y, game.ship.vx, game.ship.vy].every(Number.isFinite));
    game.step(dt, idle); assert.equal(game.lives, 2);
  }
});

test('every station accepts touchdown and a secure clamp, pickup and delivery, with normal refueling and release', () => {
  for (const pad of level.pads) {
    const game = playing();
    game.orders[0].availableAt = 0;
    if (pad.id !== level.restaurant && pad.id !== level.gasStation) {
      game.orders[0].status = 'onboard'; game.orders[0].target = pad.id;
    }
    game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .05, vx: 0, vy: 20, gear: true, landed: null };
    game.step(dt, { ...idle, down: true }); assert.equal(game.ship.landed, pad.id);
    fly(game, ZERO_G.clingDelay, { ...idle, down: true }); assert.equal(game.clinging, true);
    if (pad.id === level.restaurant) assert.ok(game.order);
    else if (pad.id !== level.gasStation) assert.equal(game.delivered, 1);
    game.fuel = 40; const ship = { ...game.ship }; fly(game, 1);
    assert.deepEqual(game.ship, ship); assert.equal(game.lives, 3);
    assert.ok(Math.abs(game.fuel - (pad.id === level.gasStation ? 65 : 40)) < 1e-9);
    game.step(dt, { ...idle, up: true }); assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false);
  }
});

test('the pull freezes during countdown, pause, and game over; replacement ships stay safely clamped', () => {
  const game = new Game(() => .5, level); game.start(); const spawn = { ...game.ship };
  fly(game, 2); assert.deepEqual(game.ship, spawn); fly(game, 1);
  game.pause(); fly(game, 2); assert.deepEqual(game.ship, spawn); game.pause();
  game.ship.x = 640; game.ship.y = 380; game.step(dt, idle); fly(game, CRASH_DURATION);
  assert.equal(game.ship.landed, level.gasStation); assert.equal(game.clinging, true);
  const replacement = { ...game.ship }; fly(game, 1); assert.deepEqual(game.ship, replacement);
  game.finish('lives'); fly(game, 1); assert.deepEqual(game.ship, replacement);
  game.start('casual', LEVELS.find(level => level.id === 'luna')); game.step(START_DELAY, idle);
  game.step(dt, idle); assert.equal(game.ship.vx, 0); assert.equal(game.ship.vy, 100 * dt);
});

test('malformed black-hole configurations fail with a level-specific error', () => {
  const config = LEVEL_CONFIG.find(config => config.id === level.id);
  for (const key of ['x', 'y', 'radius', 'strength', 'maxAcceleration']) {
    for (const value of [NaN, Infinity, undefined, ...(key === 'x' || key === 'y' ? [] : [0, -1])]) {
      assert.throws(() => createLevel({ ...config, blackHole: { ...config.blackHole, [key]: value } }), /Level 6: invalid blackHole/);
    }
  }
});

test('a full restaurant–delivery–refuel–restaurant route works around the well without losing a life', () => {
  const game = new Game(() => .999, level); game.start('casual'); game.step(START_DELAY, idle);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function navigate(x, y, landId = null) {
    if (game.ship.gear) game.toggleGear();
    for (let i = 0; i < 40 * 120; i++) {
      const s = game.ship, dx = x - s.x, dy = y - s.y;
      // Brake sideways before lowering gear; gravity continues to cause drift.
      if (landId !== null && !s.gear && Math.abs(dx) < .5 && Math.abs(s.vx) < .6 && Math.abs(dy) < 12) game.toggleGear();
      const desiredX = clamp(dx * 1.8, -85, 85);
      const desiredY = s.gear ? clamp((dy + 8) * 1.5, 12, 25) : clamp(dy * 1.8, -65, 65);
      const controls = s.landed !== null ? { ...idle, down: true } : {
        left: !s.gear && s.vx > desiredX + .3, right: !s.gear && s.vx < desiredX - .3,
        up: s.vy > desiredY + .3, down: s.vy < desiredY - .3
      };
      game.step(dt, controls);
      assert.equal(game.phase, 'playing', `${game.events.at(-1)?.message} heading to ${x},${y}; fuel ${game.fuel}; ship ${JSON.stringify(s)}`);
      if (landId !== null && game.clinging) return;
      if (landId === null && Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s.vx) < 3 && Math.abs(s.vy) < 3) return;
    }
    assert.fail(`Navigation timed out at ${JSON.stringify(game.ship)}`);
  }
  navigate(640, 65); navigate(318, 65); navigate(318, 133, 0);
  while (!game.order) game.step(dt, idle);
  assert.equal(game.order.target, 5);
  game.step(dt, { ...idle, up: true });
  for (const [x, y] of [[318, 65], [460, 65], [460, 260], [300, 260], [137, 260]]) navigate(x, y);
  navigate(137, 398, 6); fly(game, 4); assert.equal(game.fuel, 100);
  game.step(dt, { ...idle, up: true });
  for (const [x, y] of [[137, 280], [300, 280], [300, 550], [432, 550]]) navigate(x, y);
  navigate(432, 633, 5); assert.equal(game.delivered, 1);
  game.step(dt, { ...idle, up: true });
  for (const [x, y] of [[432, 550], [300, 550], [300, 320], [137, 320]]) navigate(x, y);
  navigate(137, 398, 6); fly(game, 4); assert.equal(game.fuel, 100);
  game.step(dt, { ...idle, up: true });
  for (const [x, y] of [[137, 280], [460, 280], [460, 65], [318, 65]]) navigate(x, y);
  navigate(318, 133, 0);
  assert.equal(game.lives, 3); assert.ok(game.bank > 0); assert.ok(game.order);
});
