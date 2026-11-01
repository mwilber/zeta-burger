import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';
import { Game, PHYSICS, START_DELAY, CRASH_DURATION } from '../dist/src/engine.js';
import { LEVELS, createLevel, levelAssetNames, levelAssetPath, nextLevel } from '../dist/src/levels.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { BOULDER_OUTLINES } from '../dist/src/grotto.js';
import { intersects, rectangle, sweepContact } from '../dist/src/world.js';

const level = LEVELS.find(l => l.id === 'grotto');
const config = LEVEL_CONFIG.find(l => l.id === 'grotto');
const idle = { up: false, down: false, left: false, right: false };
const dt = 1 / 120;
function playing(random = () => .5) {
  const game = new Game(random, level); game.start('casual'); game.step(START_DELAY, idle); return game;
}
function fly(game, seconds, controls = idle) {
  for (let i = 0; i < Math.round(seconds / dt); i++) game.step(dt, controls);
}

test('Grotto follows Srormfront with six sketch stations and six reusable boulder shapes', () => {
  assert.equal(nextLevel(LEVELS.find(l => l.id === 'srormfront')), level);
  assert.equal(level.number, 10); assert.equal(nextLevel(level).id, 'freeman');
  assert.equal(level.padCount, 6); assert.deepEqual(level.destinations, [1, 2, 3, 4]);
  assert.equal(level.gravity, 100); assert.equal(level.thrustScale ?? 1, 1);
  assert.equal(level.seekerCount, 0); assert.equal(level.fallingObstacleLimit, 0);
  assert.ok(!level.current && !level.gravityWell && level.pads.every(p => !p.motion));
  assert.equal(new Set(level.structures.map(s => s.kind)).size, 6);
  for (const s of level.structures) {
    assert.deepEqual(level.solids.find(solid => solid.structureId === s.id).points, s.outline.map(p => ({ x: s.x + p.x, y: s.y + p.y })));
  }
  const heart = level.solids.filter(s => s.structureId?.startsWith('heart-'));
  assert.ok(heart.length >= 5);
  assert.ok(heart.every(s => heart.some(other => s !== other && intersects(s.points, other.points))), 'central rocks form one overlapping group');
});

test('all Grotto SVG assets exist and rock silhouettes match collision vertices', () => {
  for (const name of levelAssetNames(level)) accessSync(new URL('../public/' + levelAssetPath(name, level), import.meta.url));
  for (const [shape, points] of Object.entries(BOULDER_OUTLINES)) {
    const art = readFileSync(new URL(`../public/assets/boulder-${shape}-10.svg`, import.meta.url), 'utf8');
    assert.match(art, /viewBox="0 0 100 100"/);
    assert.equal(art.match(/data-rock-outline="" points="([^"]+)"/)[1], points.map(p => `${p.x},${p.y}`).join(' '));
  }
  const background = readFileSync(new URL('../public/assets/background-10.svg', import.meta.url), 'utf8');
  assert.match(background, /data-sky/); assert.match(background, /grotto-depth/); assert.match(background, /back-strata/);
});

test('convex structure outlines reject invalid, concave, repeated, and crossing vertices', () => {
  const replace = outline => ({ ...config, structures: [{ ...config.structures[0], outline }] });
  for (const outline of [[], [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    [{ x: 0, y: 0 }, { x: NaN, y: 5 }, { x: 5, y: 5 }],
    [{ x: 0, y: 0 }, { x: 999, y: 5 }, { x: 5, y: 5 }],
    [{ x: -1, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }],
    [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 2, y: 2 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }]
  ]) assert.throws(() => createLevel(replace(outline)), /outline/);
  const valid = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.doesNotThrow(() => createLevel(replace(valid)));
  assert.doesNotThrow(() => createLevel(replace([...valid].reverse())));
});

test('sloped empty corners are passable while boulder faces catch hulls, gear, and fast crossings', () => {
  const corner = playing();
  // This point is inside the bounding rectangle of heart-west, above its slope.
  Object.assign(corner.ship, { x: 300, y: 420 }); corner.step(dt, idle);
  assert.equal(corner.phase, 'playing');
  const west = level.solids.find(s => s.structureId === 'heart-west');
  assert.equal(sweepContact(rectangle(277, 400, 46, 28), west.points, { x: 0, y: 0 }), null);
  for (const [x, y, vx, gear] of [[400, 480, 0, false], [200, 480, 36000, false], [500, 369, 0, true]]) {
    const game = playing(); Object.assign(game.ship, { x, y, vx, gear }); game.step(dt, idle);
    assert.equal(game.phase, 'crashed'); assert.equal(game.lives, 2);
    assert.match(game.events.at(-1).message, gear ? /Landing gear impact/ : /Cavern wall impact/);
  }
});

test('all six ledges allow docking, normal service, free refueling, and safe lift-off', () => {
  for (const pad of level.pads) {
    const game = playing(); game.orders[0].availableAt = 0;
    if (level.destinations.includes(pad.id)) { game.orders[0].target = pad.id; game.orders[0].status = 'onboard'; }
    game.ship = { x: pad.x + pad.width / 2, y: pad.y - PHYSICS.footY - .05, vx: 0, vy: 20, gear: true, landed: null };
    game.fuel = 40; game.step(dt, idle);
    assert.equal(game.phase, 'playing'); assert.equal(game.ship.landed, pad.id);
    fly(game, .79); assert.equal(game.delivered, 0);
    fly(game, .02);
    if (pad.id === level.restaurant) assert.ok(game.order);
    if (level.destinations.includes(pad.id)) assert.equal(game.delivered, 1);
    assert.ok(game.fuel >= (pad.id === level.gasStation ? 60 : 40));
    game.step(dt, { ...idle, up: true });
    assert.equal(game.ship.landed, null); assert.equal(game.ship.gear, false); assert.equal(game.phase, 'playing');
  }
  const replacement = playing(); replacement.crash('test'); fly(replacement, CRASH_DURATION);
  assert.equal(replacement.ship.landed, level.gasStation); fly(replacement, 1);
  assert.equal(replacement.phase, 'playing');
  replacement.start('casual', LEVELS.find(l => l.id === 'freeman'));
  assert.equal(replacement.solids.some(s => s.kind === 'structure'), false);
});

function seek(game, x, y, landId = null) {
  if (game.ship.gear !== (landId !== null)) game.toggleGear();
  for (let i = 0; i < 40 * 120; i++) {
    const s = game.ship, dx = x - s.x, dy = y - s.y;
    const desiredX = Math.max(-90, Math.min(90, dx * 1.5));
    const desiredY = Math.max(-80, Math.min(45, (s.gear ? dy + 12 : dy) * 1.4));
    game.step(dt, { left: !s.gear && s.vx > desiredX + .6, right: !s.gear && s.vx < desiredX - .6, up: s.landed !== null || s.vy > desiredY, down: false });
    assert.equal(game.phase, 'playing', `${game.events.at(-1)?.message} heading to ${x},${y}; ship ${JSON.stringify(s)}`);
    if (landId !== null && s.landed === landId) return;
    if (landId === null && Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5 && Math.abs(s.vx) < 3 && Math.abs(s.vy) < 3) return;
  }
  assert.fail(`Navigation timeout: ${JSON.stringify(game.ship)}`);
}
// Waypoints follow the upper entrance, both sides of the central group, and
// the lower passage. Every segment is flown using ordinary game controls.
const routes = {
  1: [[380, 100], [650, 100]],
  2: [[380, 120], [380, 335], [950, 320], [1155, 310]],
  3: [[380, 120], [380, 335], [950, 320], [950, 620], [755, 620]],
  4: [[380, 120], [380, 335], [950, 320], [950, 610], [1165, 610]],
  6: [[380, 120], [380, 335], [150, 355], [135, 525]]
};
for (const id of [1, 2, 3, 4, 6]) test(`fly from the outdoor restaurant to pad ${id} and back through the passages`, () => {
  const game = playing(() => (Math.max(1, id) - .5) / 4);
  game.orders.forEach(order => { order.initialTip = 100; });
  game.orders[0].availableAt = 0; game.orders[0].target = id === 6 ? 1 : id;
  seek(game, 158, 188, 0); fly(game, 1); assert.ok(game.order);
  for (const [x, y] of routes[id]) seek(game, x, y);
  const pad = level.pads.find(p => p.id === id), x = pad.x + pad.width / 2;
  seek(game, x, pad.y - PHYSICS.footY, id); fly(game, 1);
  if (id !== 6) assert.equal(game.delivered, 1);
  for (const [x, y] of [...routes[id]].reverse()) seek(game, x, y);
  seek(game, 158, 100); seek(game, 158, 188, 0); fly(game, 1);
  assert.equal(game.lives, 3); assert.ok(game.fuel > 0); assert.ok(game.order);
});
