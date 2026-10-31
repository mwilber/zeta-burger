import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync } from 'node:fs';
import { BACKGROUND_ARTWORK, PLATFORM_ARTWORK, BARRIER_ARTWORK } from '../dist/src/artwork-options.js';
import { PLATFORM_ASSETS, BARRIER_ASSETS } from '../dist/src/editor-config.js';
import { LEVEL_CONFIG } from '../dist/src/level-config.js';
import { createPad } from '../dist/src/world.js';

test('artwork palettes cover every configured asset and reference existing SVGs', () => {
  assert.deepEqual(BACKGROUND_ARTWORK.map(option => option.value), LEVEL_CONFIG.map(level => String(level.number)));
  assert.deepEqual(PLATFORM_ARTWORK.map(option => option.value), PLATFORM_ASSETS.map(asset => asset.key));
  assert.deepEqual(BARRIER_ARTWORK.map(option => option.value), BARRIER_ASSETS.map(asset => asset.key));
  for (const options of [BACKGROUND_ARTWORK, PLATFORM_ARTWORK, BARRIER_ARTWORK]) {
    assert.equal(new Set(options.map(option => option.value)).size, options.length);
    for (const option of options) {
      assert.ok(option.label.trim());
      assert.ok(option.thumbnail.layers.length > 0);
      for (const layer of option.thumbnail.layers) {
        accessSync(new URL('../public/' + layer.src, import.meta.url));
        assert.ok([layer.x, layer.y, layer.width, layer.height].every(Number.isFinite));
        assert.ok(layer.width > 0 && layer.height > 0);
      }
    }
  }
});

test('platform thumbnails contain the complete station geometry, including offset buildings and islands', () => {
  for (const [index, option] of PLATFORM_ARTWORK.entries()) {
    const pad = createPad({ ...PLATFORM_ASSETS[index].pad, x: 0, y: 0 });
    const [x, y, width, height] = option.thumbnail.viewBox.split(' ').map(Number);
    const points = [...pad.island, { x: pad.x, y: pad.y }, { x: pad.x + pad.width, y: pad.y + 70 },
      { x: pad.building.x, y: pad.building.y }, { x: pad.building.x + pad.building.width, y: pad.building.y + pad.building.height }];
    assert.ok(points.every(point => point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height), option.label);
  }
});
