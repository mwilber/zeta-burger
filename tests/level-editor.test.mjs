import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync } from 'node:fs';
import vm from 'node:vm';
import { EditorDraft, PLATFORM_ASSETS, BARRIER_ASSETS } from '../dist/src/editor-config.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { createLevel, createLevels, levelAssetNames, levelAssetPath, padBuildingAssetName } from '../dist/src/levels.js';
import { Game, START_DELAY, PHYSICS } from '../dist/src/engine.js';
const noInput = { left: false, right: false, up: false, down: false };
const asset = (number, id) => PLATFORM_ASSETS.find(asset => asset.key === `${number}:${id}`);
function assertAssetsExist(level) {
  for (const name of levelAssetNames(level)) accessSync(new URL('../public/' + levelAssetPath(name, level), import.meta.url));
}
function exported(draft) {
  const [config] = vm.runInNewContext(`[${draft.exportJavaScript()}]`);
  return createLevel(structuredClone(config));
}

test('existing drafts isolate configuration and move the complete station and collisions', () => {
  const original = LEVEL_CONFIG.find(level => level.number === 5), snapshot = JSON.stringify(original);
  const draft = new EditorDraft(original), before = draft.preview();
  const pad = draft.config.pads.find(pad => pad.id === 1);
  draft.movePlatform(1, pad.x + 30, pad.y - 40);
  const after = draft.preview();
  for (const [i, solid] of before.solids.filter(solid => solid.padId === 1).entries()) {
    assert.deepEqual(after.solids.filter(solid => solid.padId === 1)[i].points, solid.points.map(point => ({ x: point.x + 30, y: point.y - 40 })));
  }
  assert.equal(JSON.stringify(original), snapshot);
  assert.deepEqual(draft.config.pads.find(pad => pad.id === 1).motion, original.pads.find(pad => pad.id === 1).motion);
  assert.equal(exported(draft).number, original.number);
  assert.equal(exported(draft).id, original.id);
});

test('platform counts preserve mandatory roles and exports reuse real assets beyond original IDs', () => {
  for (const original of LEVEL_CONFIG) {
    const draft = new EditorDraft(original);
    draft.setPlatformCount(3);
    assert.equal(draft.preview().destinations.length, 1);
    assert.throws(() => draft.setPlatformCount(2), /Choose/);
    draft.setPlatformCount(15);
    const level = exported(draft);
    assert.equal(level.padCount, 15); assert.equal(level.destinations.length, 13);
    assertAssetsExist(level);
    assert.equal(new Set(level.pads.map(pad => pad.id)).size, 15);
    assert.equal(draft.removePlatform(original.restaurant), false);
    assert.equal(draft.removePlatform(original.gasStation), false);
  }
});

test('fuel toggle removes the entire station, restores its location and assets, and keeps no-fuel gameplay usable', () => {
  const draft = new EditorDraft(LEVEL_CONFIG[0]);
  const fuel = structuredClone(draft.config.pads.find(pad => pad.id === draft.config.gasStation));
  draft.setFuel(false);
  const level = exported(draft), game = new Game(() => .5, level);
  assert.equal(level.gasStation, null); assert.equal(level.padCount, 6);
  assert.ok(!level.solids.some(solid => solid.padId === fuel.id));
  assert.ok(!levelAssetNames(level).includes(`pad-${fuel.id}`));
  game.start('tester', level, { designMode: false });
  game.step(START_DELAY, noInput);
  game.crash('test'); game.step(1.6, noInput);
  assert.equal(game.phase, 'playing'); assert.equal(game.ship.landed, level.restaurant);
  const fuelBefore = 42; game.fuel = fuelBefore; game.step(1, noInput);
  assert.equal(game.fuel, fuelBefore, 'restaurant does not become a fuel station');
  game.fuel = 24; game.ship.landed = null; game.step(.01, { ...noInput, up: true });
  assert.ok(game.events.some(event => event.message.includes('no fuel station')));
  draft.setFuel(true);
  assert.deepEqual(draft.config.pads.find(pad => pad.id === draft.config.gasStation), fuel);
  assertAssetsExist(exported(draft));
});

test('blank drafts preview empty or fuel-only worlds, but export requires a restaurant and delivery platform', () => {
  const draft = new EditorDraft();
  assert.equal(draft.preview().pads.length, 0);
  assert.throws(() => draft.exportJavaScript(), /restaurant/);
  draft.setFuel(true);
  assert.equal(draft.preview().pads.length, 1);
  assert.throws(() => draft.exportJavaScript(), /restaurant/);
  draft.setFuel(false); draft.addPlatform();
  assert.throws(() => draft.exportJavaScript(), /delivery pad/);
  draft.addPlatform(asset(4, 1));
  const level = exported(draft);
  assert.equal(level.number, Math.max(...LEVEL_CONFIG.map(level => level.number)) + 1); assert.equal(level.padCount, 2);
  assert.equal(level.gasStation, null);
  assertAssetsExist(level);
  assert.deepEqual(createLevels([draft.config, ...LEVEL_CONFIG]).map(level => level.number), [level.number, ...LEVEL_CONFIG.map(level => level.number)]);
});

test('mixed platform themes use separate building slots and export all assets without new files', () => {
  const draft = new EditorDraft();
  draft.addPlatform(asset(1, 0)); draft.addPlatform(asset(4, 0)); draft.addPlatform(asset(7, 0));
  draft.setBackground(8);
  const barrier = draft.addBarrier(BARRIER_ASSETS[0].key);
  draft.moveBarrier(barrier.id, 400, 400);
  draft.config.fallingObstacleLimit = 4; draft.config.assets['falling-obstacle'] = 'falling-obstacle-2';
  draft.config.seekerCount = 4; draft.config.assets.seeker = 'seeker-4';
  draft.config.blackHole = structuredClone(LEVEL_CONFIG.find(level => level.blackHole).blackHole);
  draft.config.assets['black-hole'] = 'black-hole-6';
  draft.config.gravity = 35; draft.config.thrustScale = .3;
  const level = exported(draft);
  assertAssetsExist(level);
  assert.deepEqual(level.pads.map(pad => level.assets[padBuildingAssetName(pad, level)]), ['restaurant-1', 'restaurant-4', 'restaurant-7']);
  assert.equal(levelAssetPath('background', level), './assets/background-8.svg');
  assert.equal(level.gravity, 35); assert.equal(level.thrustScale, .3);
  assert.deepEqual(level.structures.map(structure => [structure.x, structure.y]), [[400, 400]]);
  draft.config.fallingObstacleLimit = 0; delete draft.config.blackHole; draft.config.seekerCount = 0;
  assert.equal(exported(draft).assets['falling-obstacle'], undefined);
  assert.equal(exported(draft).assets['black-hole'], undefined);
  assert.equal(exported(draft).assets.seeker, undefined);
});

test('editor freeze blocks world, ship, hazards, arrivals, pause, and tips until editing ends', () => {
  for (const config of LEVEL_CONFIG) {
    const level = createLevel(config), game = new Game(() => .5, level);
    game.start('tester', level, { editing: true });
    game.fallingObstacles = [{ id: 0, x: 100, y: 100, vx: 0, vy: 160, radius: 16 }];
    const snapshot = JSON.stringify(game);
    for (let i = 0; i < 120; i++) game.step(1, { left: true, right: false, up: true, down: false });
    game.pause(); game.toggleGear();
    assert.equal(JSON.stringify(game), snapshot);
    assert.equal(game.designMode, true); assert.equal(game.phase, 'idle');
    game.start('tester', level, { designMode: false });
    assert.equal(game.editing, false); assert.equal(game.phase, 'countdown');
    game.step(START_DELAY, noInput); game.step(.1, { ...noInput, up: true });
    assert.notEqual(game.ship.vy, 0);
    assert.ok(game.fuel < 100);
  }
});

test('asset overrides reject path injection and drag bounds keep complete stations in the world', () => {
  const draft = new EditorDraft();
  const pad = draft.addPlatform();
  draft.movePlatform(pad.id, -10000, -10000);
  let preview = draft.preview().pads[0];
  assert.ok(preview.island.every(point => point.x >= 0 && point.y >= 0));
  assert.ok(preview.building.x >= 0 && preview.building.y >= 0);
  draft.movePlatform(pad.id, 10000, 10000);
  preview = draft.preview().pads[0];
  assert.ok(preview.island.every(point => point.x <= 1280 && point.y <= 760));
  assert.ok(preview.x + preview.width <= 1280 && preview.y + PHYSICS.footY <= 760);
  draft.config.assets.background = '../secret';
  assert.throws(() => draft.preview(), /asset basename/);
});


test('Freeman drafts retain stellar gravity, assets, and docking after editing and export', () => {
  const original = LEVEL_CONFIG.find(level => level.id === 'freeman');
  const draft = new EditorDraft(original);
  draft.movePlatform(1, 1060, 450);
  draft.setFuel(false);
  draft.setPlatformCount(10);
  const level = exported(draft);
  assert.equal(level.number, 9);
  assert.equal(level.id, 'freeman');
  assert.deepEqual(level.star, original.star);
  assert.deepEqual(level.gravityWell, original.star);
  assert.equal(level.blackHole, undefined);
  assertAssetsExist(level);
  const game = new Game(() => .5, level);
  game.start('tester', level, { designMode: false });
  game.step(START_DELAY, noInput);
  game.step(.1, noInput);
  assert.ok(game.ship.vy > 0, 'the star still pulls an airborne ship');
  game.ship = game.spawnAtStation();
  assert.equal(game.ship.landed, level.restaurant);
  assert.equal(game.clinging, true, 'no-fuel respawn docks immediately at the restaurant');
  game.fuel = 0;
  game.step(.5, noInput);
  assert.equal(game.ship.landed, level.restaurant);
  assert.equal(game.fuel, 0, 'docking provides shelter without creating a fuel station');
});
