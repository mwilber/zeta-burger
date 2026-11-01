import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync } from 'node:fs';
import { Game, PHYSICS, START_DELAY, CRASH_DURATION, FUEL } from '../dist/src/engine.js';
import { LEVELS, createLevel, nextLevel, levelAssetNames, levelAssetPath } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { LIGHTNING, createLightning, windVelocity, windOffset } from '../dist/src/storm.js';
import { WORLD_HEIGHT } from '../dist/src/world.js';

const level = LEVELS.find(l => l.id === 'srormfront');
const config = LEVEL_CONFIG.find(l => l.id === level.id);
const idle = { up: false, down: false, left: false, right: false }, dt = 1 / 120;
const fly = (game, seconds, input = idle) => { for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, input); };
function playing() {
  const game = new Game(() => .5, level); game.start('casual'); game.step(START_DELAY, idle);
  game.lightningSpawnTime = 1000;
  return game;
}
function dock(game, id = 0) {
  const pad = game.pads.find(p => p.id === id);
  game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY, vx: 0, vy: 0, gear: true, landed: id };
}
function bolt(x, age = LIGHTNING.warningDuration) {
  return { ...createLightning(99, x, () => .5), age };
}

test('Srormfront is the new starting level, preserves the old stack, and has complete artwork', () => {
  assert.equal(new Game().level, level); assert.equal(LEVELS[0], level);
  assert.equal(level.number, 11); assert.equal(level.name, 'Srormfront'); assert.equal(nextLevel(level).id, 'grotto');
  assert.equal(level.padCount, 7); assert.equal(level.gravity, 100); assert.equal(level.thrustScale ?? 1, 1);
  assert.equal(level.seekerCount, 0); assert.equal(level.fallingObstacleLimit, 0);
  assert.ok(!level.current && !level.gravityWell && level.pads.every(p => !p.motion));
  assert.ok(level.storm.windSpeed > LEVELS.find(l => l.id === 'abyss').current.speed * 3);
  for (const name of levelAssetNames(level)) accessSync(new URL('../public/' + levelAssetPath(name, level), import.meta.url));
});

test('storm configuration validates finite positive wind settings and a bounded rain count', () => {
  for (const key of ['windSpeed', 'gustDuration', 'drag', 'rainCount']) {
    for (const value of [NaN, Infinity, undefined, -1, ...(key === 'rainCount' ? [.5, 2001] : [0])]) {
      assert.throws(() => createLevel({ ...config, storm: { ...config.storm, [key]: value } }), /invalid storm/);
    }
  }
  assert.doesNotThrow(() => createLevel({ ...config, storm: { ...config.storm, rainCount: 0 } }));
});

test('gusts reverse abruptly while integrated rain displacement remains continuous', () => {
  const storm = level.storm, boundary = storm.gustDuration;
  assert.equal(windVelocity(storm, boundary - 1e-6), storm.windSpeed);
  assert.equal(windVelocity(storm, boundary), -.8 * storm.windSpeed);
  for (let i = 1; i < 20; i++) {
    const t = boundary * i;
    assert.ok(Math.abs(windOffset(storm, t + 1e-6) - windOffset(storm, t - 1e-6)) < .001);
  }
  const t = .7, h = 1e-5;
  assert.ok(Math.abs((windOffset(storm, t + h) - windOffset(storm, t)) / h - windVelocity(storm, t)) < 1e-6);
});

test('wind carries an empty-fuel ship with either gear setting and thrust can fight it', () => {
  for (const time of [0, level.storm.gustDuration]) for (const gear of [false, true]) {
    const game = playing(); game.time = time; game.fuel = 0;
    Object.assign(game.ship, { x: 450, y: 100, gear });
    fly(game, .25, { ...idle, up: true, left: true });
    const sign = time ? -1 : 1;
    assert.ok(game.ship.vx * sign > 0); assert.ok((game.ship.x - 450) * sign > 0);
    assert.equal(game.fuel, 0); assert.equal(game.phase, 'playing');
    assert.ok(Math.abs(game.ship.vy - level.gravity * .25) < 1e-8);
  }
  const game = playing(); Object.assign(game.ship, { x: 450, y: 100 });
  game.step(dt, { ...idle, left: true });
  const wind = windVelocity(level.storm, game.time) * (1 - Math.exp(-level.storm.drag * dt));
  assert.ok(Math.abs(game.ship.vx - (wind - PHYSICS.sideThrust * dt)) < 1e-9);
  fly(game, .5 - dt, { ...idle, left: true });
  assert.ok(game.ship.vx < 0); assert.ok(Math.abs(game.fuel - (100 - FUEL.sideRate * .5)) < 1e-8);
});

test('station geometry stays fixed and docking blocks wind while normal service and refueling work', () => {
  const game = playing(); dock(game); const ship = { ...game.ship }, pads = structuredClone(game.pads), solids = structuredClone(game.solids);
  game.orders[0].status = 'waiting';
  fly(game, .79); assert.equal(game.order, null);
  fly(game, .02); assert.ok(game.order);
  fly(game, 4); assert.deepEqual(game.ship, ship); assert.deepEqual(game.pads, pads); assert.deepEqual(game.solids, solids);
  assert.equal(game.fuel, 100);
  dock(game, level.gasStation); game.fuel = 40; fly(game, 1); assert.ok(Math.abs(game.fuel - 65) < 1e-8);
  game.step(dt, { ...idle, up: true }); assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false); assert.ok(game.ship.vx !== 0);
});

test('ground warnings fix their endpoint and path, are harmless, then flash once with thunder', () => {
  const game = playing(); dock(game);
  game.lightningSpawnTime = 0; game.random = () => .1;
  game.step(dt, idle);
  const strike = game.lightning[0];
  assert.equal(strike.x, game.ship.x); assert.equal(strike.y, WORLD_HEIGHT - 12);
  assert.equal(strike.points[0].y, 0); assert.deepEqual(strike.points.at(-1), { x: strike.x, y: strike.y });
  const points = structuredClone(strike.points), x = strike.x;
  fly(game, .9); assert.equal(game.lives, 3); assert.equal(game.events.some(e => e.type === 'lightning'), false);
  assert.deepEqual(strike.points, points); assert.equal(strike.x, x);
  fly(game, .3);
  assert.equal(game.lives, 2); assert.match(game.events.find(e => e.type === 'crash').message, /Lightning/);
  assert.equal(game.events.filter(e => e.type === 'lightning').length, 1);
  assert.equal(game.lightning.length, 0);
});

test('active lightning hits hulls, fast crossings, angled segments, and extended gear', () => {
  const hull = playing(); hull.ship.x = 450; hull.lightning = [bolt(450)]; hull.step(dt, idle);
  assert.equal(hull.lives, 2);
  const fast = playing(); Object.assign(fast.ship, { x: 500, y: 100, vx: 20000 }); fast.lightning = [bolt(600)]; fast.step(.01, idle);
  assert.equal(fast.lives, 2);
  for (const gear of [false, true]) {
    const game = playing(); Object.assign(game.ship, { x: 500, y: 100, gear });
    game.lightning = [{ ...bolt(550), points: [{ x: 550, y: 0 }, { x: 550, y: 110 }, { x: 516, y: 118 }, { x: 550, y: 130 }, { x: 550, y: 748 }] }];
    game.step(dt, idle); assert.equal(game.lives, gear ? 2 : 3);
  }
});

test('escaping a warning, a near miss, and crossing before activation or after expiry are safe', () => {
  const escaped = playing(); dock(escaped); const warning = bolt(escaped.ship.x, .8);
  escaped.lightning = [warning]; escaped.ship.x += 65; fly(escaped, .5); assert.equal(escaped.lives, 3);
  const near = playing(); near.lightning = [bolt(near.ship.x + 30)]; near.step(dt, idle); assert.equal(near.lives, 3);
  const before = playing(); Object.assign(before.ship, { x: 450, y: 100, vx: 2500 }); before.lightning = [bolt(500, .95)]; before.step(.1, idle);
  assert.equal(before.lives, 3, 'crossed before the warning completed');
  const after = playing(); Object.assign(after.ship, { x: 450, y: 100, vx: 2500 });
  after.lightning = [bolt(600, LIGHTNING.warningDuration + LIGHTNING.strikeDuration - .001)]; after.step(.1, idle);
  assert.equal(after.lives, 3, 'crossed after the flash ended');
});

test('weather freezes for countdown, pause, final crash, and game over; resets on level changes', () => {
  const game = new Game(() => .5, level); game.start();
  const snapshot = () => JSON.stringify({ time: game.time, ship: game.ship, lightning: game.lightning, timer: game.lightningSpawnTime });
  const initial = snapshot(); fly(game, 2); assert.equal(snapshot(), initial); fly(game, 1);
  dock(game); fly(game, 1.8); assert.equal(game.lightning.length, 1);
  game.pause(); const paused = snapshot(); fly(game, 2); assert.equal(snapshot(), paused);
  game.pause(); game.lives = 1; game.crash('test'); const final = snapshot();
  fly(game, CRASH_DURATION); assert.equal(game.phase, 'gameover'); assert.equal(snapshot(), final);
  fly(game, 1); assert.equal(snapshot(), final);
  game.start(); assert.equal(snapshot(), initial);
  game.start('casual', LEVELS.find(l => l.id === 'luna')); assert.deepEqual(game.lightning, []); assert.equal(game.level.storm, undefined);
});

test('weather continues during design mode and replacement delay without killing the idle or new ship', () => {
  const design = new Game(() => .1, level); design.start('casual', level, { designMode: true });
  fly(design, 4); assert.equal(design.lives, 3); assert.ok(design.events.some(e => e.type === 'lightning'));
  const game = playing(); dock(game, level.gasStation); game.lightning = [bolt(game.ship.x, .9)]; game.crash('test');
  fly(game, CRASH_DURATION); assert.equal(game.phase, 'playing'); assert.equal(game.lives, 2); assert.equal(game.ship.landed, level.gasStation);
});

test('a continuous restaurant–delivery–restaurant flight remains navigable through gust reversals', () => {
  const game = new Game(() => .1, level); game.start('casual'); game.step(START_DELAY, idle);
  // Isolate wind and landing navigation; live lightning contacts are covered above.
  game.lightningSpawnTime = 1e6; game.orders.forEach(order => { order.initialTip = 100; });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function seek(x, y, landId = null) {
    if (game.ship.gear) game.toggleGear();
    for (let i = 0; i < 60 * 120; i++) {
      const s = game.ship, dx = x - s.x, dy = y - s.y;
      if (landId !== null && !s.gear && Math.abs(dx) < .8 && Math.abs(s.vx) < 1 && Math.abs(dy) < 12) game.toggleGear();
      const desiredX = clamp(dx * 1.8, -85, 85);
      const desiredY = s.gear ? clamp((dy + 8) * 1.5, 12, 25) : clamp(dy * 1.8, -65, 65);
      game.step(dt, { left: !s.gear && s.vx > desiredX + .4, right: !s.gear && s.vx < desiredX - .4,
        up: s.landed !== null || s.vy > desiredY + .3, down: false });
      assert.equal(game.phase, 'playing', `${game.events.at(-1)?.message}; ${JSON.stringify(s)}`);
      if (landId !== null && s.landed === landId) return;
      if (landId === null && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5 && Math.abs(s.vx) < 3 && Math.abs(s.vy) < 3) return;
    }
    assert.fail(`Navigation timeout: ${JSON.stringify(game.ship)}`);
  }
  seek(640, 110); seek(428, 110); seek(428, 460); seek(428, 538, 0); fly(game, 1);
  assert.equal(game.order.target, 1);
  seek(428, 110); seek(167, 110); seek(167, 240); seek(167, 318, 1); fly(game, 1);
  assert.equal(game.delivered, 1);
  seek(167, 110); seek(428, 110); seek(428, 460); seek(428, 538, 0);
  assert.equal(game.lives, 3); assert.ok(game.fuel > 0);
});
