import type { StructureConfig } from './level-config.js';

// Shared by collision geometry, boulder spawn points, and the SVG generator.
export const AVALANCHE = { summitX: 100, summitY: 100, toeX: 450, bottomY: 728 };
export const AVALANCHE_MOUNTAINS: StructureConfig[] = [
  { id: 'west-mountain', x: 0, y: 100, width: 450, height: 628, kind: 'mountain-west',
    outline: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 450, y: 628 }, { x: 0, y: 628 }] },
  { id: 'east-mountain', x: 830, y: 100, width: 450, height: 628, kind: 'mountain-east',
    outline: [{ x: 350, y: 0 }, { x: 450, y: 0 }, { x: 450, y: 628 }, { x: 0, y: 628 }] }
];
