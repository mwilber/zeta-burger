import { LEVEL_CONFIG } from './level-config.js';
import { PLATFORM_ASSETS, BARRIER_ASSETS } from './editor-config.js';
import { levelAssetPath } from './levels.js';
import type { ArtworkOption, ArtworkLayer } from './artwork-picker.js';

export const BACKGROUND_ARTWORK: ArtworkOption[] = LEVEL_CONFIG.map(level => ({
  value: String(level.number), label: level.name,
  thumbnail: { viewBox: '0 0 1280 760', layers: [{ src: levelAssetPath('background', level), x: 0, y: 0, width: 1280, height: 760 }] }
}));
export const PLATFORM_ARTWORK: ArtworkOption[] = PLATFORM_ASSETS.map(({ key, label, level, pad }) => {
  const layers: ArtworkLayer[] = [];
  if (pad.island) layers.push({ src: levelAssetPath(`island-${pad.id}`, level), x: pad.island.x, y: 10, width: pad.island.width, height: 83 });
  layers.push({ src: levelAssetPath(level.assets?.[`building-${pad.id}`] ? `building-${pad.id}` : pad.building.kind, level),
    x: pad.building.x, y: -pad.building.height, width: pad.building.width, height: pad.building.height + 10 });
  layers.push({ src: levelAssetPath(`pad-${pad.id}`, level), x: -5, y: -90, width: pad.width + 10, height: 160 });
  const left = Math.min(...layers.map(layer => layer.x)) - 8, top = Math.min(...layers.map(layer => layer.y)) - 8;
  const right = Math.max(...layers.map(layer => layer.x + layer.width)) + 8, bottom = Math.max(...layers.map(layer => layer.y + layer.height)) + 8;
  return { value: key, label, thumbnail: { viewBox: `${left} ${top} ${right - left} ${bottom - top}`, layers } };
});
export const BARRIER_ARTWORK: ArtworkOption[] = BARRIER_ASSETS.map(({ key, label, level, structure }) => ({
  value: key, label,
  thumbnail: { viewBox: `0 0 ${structure.width} ${structure.height}`,
    layers: [{ src: levelAssetPath(structure.kind, level), x: 0, y: 0, width: structure.width, height: structure.height }] }
}));
