import type { StructureConfig } from './level-config.js';

function kelp(id: string, x: number, y: number, height: number, hanging = false): StructureConfig {
  const width = 38;
  // A dense kelp frond with a tapered tip. Artwork uses these exact vertices.
  const outline = [
    { x: 19, y: 0 }, { x: 31, y: 30 }, { x: 38, y: Math.round(height * .48) },
    { x: 33, y: height }, { x: 5, y: height },
    { x: 0, y: Math.round(height * .48) }, { x: 7, y: 30 }
  ];
  return { id, x, y, width, height, kind: `sea-plant-${id}`,
    outline: hanging ? outline.map(p => ({ x: p.x, y: height - p.y })).reverse() : outline };
}

// Stationary dividers, with staggered 148- and 128-unit openings.
// Only ship collision uses these structures; fish and stations pass through.
export const ABYSS_PLANTS: StructureConfig[] = [
  kelp('west-upper', 446, 0, 346, true),
  kelp('west-lower', 446, 494, 266),
  kelp('east-upper', 850, 0, 130, true),
  kelp('east-lower', 850, 258, 502)
];
