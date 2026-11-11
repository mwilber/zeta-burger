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
    draft.setPlatformCount(2);
    assert.equal(draft.preview().destinations.length, 1);
    assert.throws(() => draft.setPlatformCount(1), /Choose/);
    draft.setPlatformCount(15);
    const level = exported(draft);
    assert.equal(level.padCount, 15); assert.equal(level.destinations.length, 14);
    assertAssetsExist(level);
    assert.equal(new Set(level.pads.map(pad => pad.id)).size, 15);
    assert.equal(draft.removePlatform(original.restaurant), false);
  }
});

test('blank drafts require a restaurant and delivery platform and support paid restaurant fuel', () => {
  const draft = new EditorDraft();
  assert.equal(draft.preview().pads.length, 0);
  assert.throws(() => draft.exportJavaScript(), /restaurant/);
  draft.addPlatform();
  assert.throws(() => draft.exportJavaScript(), /delivery pad/);
  draft.addPlatform(asset(4, 1));
  draft.config.refueling = { pricePerUnit: .2, refillRate: 4 };
  const level = exported(draft), game = new Game(() => .5, level);
  assert.equal(level.number, Math.max(...LEVEL_CONFIG.map(level => level.number)) + 1);
  assert.equal(level.padCount, 2);
  assertAssetsExist(level);
  game.start('casual'); game.step(START_DELAY, noInput);
  game.ship = game.spawnAtStation(); game.bank = 1; game.fuel = 40;
  game.step(1, noInput); assert.equal(game.fuel, 40);
  game.step(1, { ...noInput, refuel: true });
  assert.equal(game.fuel, 44); assert.ok(Math.abs(game.bank - .2) < 1e-9);
  assert.deepEqual(createLevels([draft.config, ...LEVEL_CONFIG]).map(level => level.number), [level.number, ...LEVEL_CONFIG.map(level => level.number)]);
});

test('mixed platform themes use separate building slots and export all assets without new files', () => {
  const draft = new EditorDraft();
  draft.addPlatform(asset(1, 0)); draft.addPlatform(asset(4, 0)); draft.addPlatform(asset(7, 0));
  draft.setBackground(8);
  const barrier = draft.addBarrier(BARRIER_ASSETS.find(asset => asset.level.number === 8).key);
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
  assert.equal(game.clinging, true, 'respawn docks immediately at the restaurant');
  game.fuel = 0;
  game.step(.5, noInput);
  assert.equal(game.ship.landed, level.restaurant);
  assert.equal(game.fuel, 0, 'docking provides shelter without automatically buying fuel');
});


test('Grotto drafts and reused boulders preserve their convex collision outlines through export', () => {
  const original = LEVEL_CONFIG.find(level => level.id === 'grotto');
  const draft = new EditorDraft(original);
  draft.movePlatform(1, 570, 150);
  const edited = exported(draft), baseline = createLevel(original);
  assert.equal(edited.number, 10);
  assert.equal(edited.id, 'grotto');
  assert.deepEqual(edited.structures, original.structures);
  assert.deepEqual(edited.solids.filter(solid => solid.kind === 'structure'), baseline.solids.filter(solid => solid.kind === 'structure'));
  assertAssetsExist(edited);

  const blank = new EditorDraft();
  blank.setPlatformCount(2);
  const asset = BARRIER_ASSETS.find(asset => asset.structure.kind === 'boulder-round');
  const rock = blank.addBarrier(asset.key);
  blank.moveBarrier(rock.id, 400, 300);
  const custom = exported(blank);
  assert.deepEqual(custom.structures[0].outline, asset.structure.outline);
  assert.deepEqual(custom.solids.find(solid => solid.structureId === rock.id).points,
    rock.outline.map(point => ({ x: point.x + 400, y: point.y + 300 })));
  assertAssetsExist(custom);
});
