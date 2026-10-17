import type { Point } from './world.js';

export interface PadConfig {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  color: string;
  // Island and building positions are offsets from the pad's (x, y).
  island: { x: number; width: number };
  building: { x: number; width: number; height: number; kind: string };
}
export interface LevelConfig {
  // Stable asset suffix and display number; independent of play order.
  number: number;
  id: string;
  name: string;
  theme: string;
  start: Point;
  restaurant: number;
  gasStation: number;
  // Maximum active falling obstacles. Set to 0 to disable them.
  fallingObstacleLimit: number;
  pads: PadConfig[];
}

// Add/remove entries in `pads` to change the total pad count. All pads other
// than the restaurant and gas station are delivery destinations automatically.
// During development, levels are a LIFO stack: prepend each new level here.
// Add matching assets named <original-name>-<number>.svg.
// Array order is play order. Rearrange level entries without changing their
// numbers, IDs, or asset filenames. The first entry is the starting level.
export const LEVEL_CONFIG: LevelConfig[] = [{
  number: 2,
  id: 'meteor-shower',
  name: 'Meteor Shower',
  theme: 'Cool skies. Watch for falling rocks.',
  start: { x: 640, y: 80 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 4,
  pads: [
    { id: 6, name: 'Gas station', x: 82, y: 640, width: 110, color: '#b6c8d8', island: { x: -48, width: 218 }, building: { x: 124, width: 28, height: 48, kind: 'gas' } },
    { id: 0, name: 'Zeta Burger', x: 370, y: 560, width: 116, color: '#b6c8d8', island: { x: -112, width: 254 }, building: { x: -90, width: 76, height: 95, kind: 'restaurant' } },
    { id: 1, name: 'Spore Heights', x: 116, y: 340, width: 102, color: '#b6c8d8', island: { x: -74, width: 204 }, building: { x: -56, width: 43, height: 73, kind: 'mushroom' } },
    { id: 2, name: 'Orbit Observatory', x: 563, y: 253, width: 104, color: '#b6c8d8', island: { x: -36, width: 217 }, building: { x: 120, width: 44, height: 65, kind: 'observatory' } },
    { id: 3, name: 'Moon Motel', x: 954, y: 363, width: 104, color: '#b6c8d8', island: { x: -24, width: 272 }, building: { x: 127, width: 65, height: 83, kind: 'motel' } },
    { id: 4, name: 'Crystal Gardens', x: 724, y: 558, width: 104, color: '#b6c8d8', island: { x: -50, width: 214 }, building: { x: 121, width: 26, height: 64, kind: 'crystal' } },
    { id: 5, name: 'Cosmic Outpost', x: 1120, y: 633, width: 104, color: '#b6c8d8', island: { x: -95, width: 233 }, building: { x: -73, width: 53, height: 67, kind: 'outpost' } }
  ]
}, {
  number: 1,
  id: 'luna',
  name: 'Luna',
  theme: 'Low gravity. High stakes.',
  start: { x: 640, y: 80 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 0,
  pads: [
    { id: 6, name: 'Gas station', x: 82, y: 640, width: 110, color: '#98daed', island: { x: -48, width: 218 }, building: { x: 124, width: 28, height: 48, kind: 'gas' } },
    { id: 0, name: 'Zeta Burger', x: 370, y: 560, width: 116, color: '#bdf77d', island: { x: -112, width: 254 }, building: { x: -90, width: 76, height: 95, kind: 'restaurant' } },
    { id: 1, name: 'Spore Heights', x: 116, y: 340, width: 102, color: '#da9fec', island: { x: -74, width: 204 }, building: { x: -56, width: 43, height: 73, kind: 'mushroom' } },
    { id: 2, name: 'Orbit Observatory', x: 563, y: 253, width: 104, color: '#98daed', island: { x: -36, width: 217 }, building: { x: 120, width: 44, height: 65, kind: 'observatory' } },
    { id: 3, name: 'Moon Motel', x: 954, y: 363, width: 104, color: '#ffc481', island: { x: -24, width: 272 }, building: { x: 127, width: 65, height: 83, kind: 'motel' } },
    { id: 4, name: 'Crystal Gardens', x: 724, y: 558, width: 104, color: '#da9fec', island: { x: -50, width: 214 }, building: { x: 121, width: 26, height: 64, kind: 'crystal' } },
    { id: 5, name: 'Cosmic Outpost', x: 1120, y: 633, width: 104, color: '#98daed', island: { x: -95, width: 233 }, building: { x: -73, width: 53, height: 67, kind: 'outpost' } }
  ]
}];
