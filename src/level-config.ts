import type { Point } from './world.js';

export interface PadConfig {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  color: string;
  // Optional orbital drift amplitudes (world units) and period (seconds).
  motion?: { x: number; y: number; period: number };
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
  // Uniform downward acceleration in world units/second², separate from a black hole.
  gravity: number;
  // Inward inverse-square gravity; strength is world units³/second².
  blackHole?: { x: number; y: number; radius: number; strength: number; maxAcceleration: number };
  // Thruster acceleration multiplier; omitted levels use full power.
  thrustScale?: number;
  start: Point;
  restaurant: number;
  gasStation: number;
  // Maximum active falling obstacles. Set to 0 to disable them.
  fallingObstacleLimit: number;
  // Persistent, intangible cloud hazards. Set to 0 to disable them.
  seekerCount: number;
  pads: PadConfig[];
}

// Add/remove entries in `pads` to change the total pad count. All pads other
// than the restaurant and gas station are delivery destinations automatically.
// During development, levels are a LIFO stack: prepend each new level here.
// Add matching assets named <original-name>-<number>.svg.
// Array order is play order. Rearrange level entries without changing their
// numbers, IDs, or asset filenames. The first entry is the starting level.
export const LEVEL_CONFIG: LevelConfig[] = [{
  number: 6,
  id: 'event-horizon',
  name: 'Event Horizon',
  theme: 'Stay on the outer rim. The black hole pulls harder as you approach. Hold Down to clamp.',
  gravity: 0,
  blackHole: { x: 640, y: 380, radius: 52, strength: 7200000, maxAcceleration: 240 },
  start: { x: 640, y: 65 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 0,
  seekerCount: 0,
  pads: [
    { id: 6, name: 'Gas station', x: 82, y: 420, width: 110, color: '#80e9ff', island: { x: -48, width: 218 }, building: { x: 124, width: 28, height: 48, kind: 'gas' } },
    { id: 0, name: 'Zeta Burger', x: 260, y: 155, width: 116, color: '#ffd789', island: { x: -112, width: 254 }, building: { x: -90, width: 76, height: 95, kind: 'restaurant' } },
    { id: 1, name: 'Spore Heights', x: 1100, y: 420, width: 102, color: '#b1b5ff', island: { x: -74, width: 204 }, building: { x: -56, width: 43, height: 73, kind: 'mushroom' } },
    { id: 2, name: 'Orbit Observatory', x: 588, y: 155, width: 104, color: '#80e9ff', island: { x: -36, width: 217 }, building: { x: 120, width: 44, height: 65, kind: 'observatory' } },
    { id: 3, name: 'Moon Motel', x: 950, y: 155, width: 104, color: '#ffd789', island: { x: -24, width: 272 }, building: { x: 127, width: 65, height: 83, kind: 'motel' } },
    { id: 4, name: 'Crystal Gardens', x: 865, y: 655, width: 104, color: '#b1b5ff', island: { x: -50, width: 214 }, building: { x: 121, width: 26, height: 64, kind: 'crystal' } },
    { id: 5, name: 'Cosmic Outpost', x: 380, y: 655, width: 104, color: '#80e9ff', island: { x: -95, width: 233 }, building: { x: -73, width: 53, height: 67, kind: 'outpost' } }
  ]
}, {
  number: 5,
  id: 'zero-g',
  name: 'Zero G',
  theme: 'No gravity. Hold Down on a pad for 250 ms to engage the landing clamp.',
  gravity: 0,
  thrustScale: .3,
  start: { x: 640, y: 80 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 0,
  seekerCount: 0,
  pads: [
    { id: 6, name: 'Gas station', x: 82, y: 640, width: 110, color: '#80e9ff', motion: { x: 16, y: 10, period: 18 }, island: { x: -48, width: 218 }, building: { x: 124, width: 28, height: 48, kind: 'gas' } },
    { id: 0, name: 'Zeta Burger', x: 370, y: 560, width: 116, color: '#ffd789', motion: { x: 18, y: 12, period: 20 }, island: { x: -112, width: 254 }, building: { x: -90, width: 76, height: 95, kind: 'restaurant' } },
    { id: 1, name: 'Spore Heights', x: 116, y: 340, width: 102, color: '#b1b5ff', motion: { x: 16, y: 12, period: 16 }, island: { x: -74, width: 204 }, building: { x: -56, width: 43, height: 73, kind: 'mushroom' } },
    { id: 2, name: 'Orbit Observatory', x: 563, y: 253, width: 104, color: '#80e9ff', motion: { x: 18, y: 10, period: 22 }, island: { x: -36, width: 217 }, building: { x: 120, width: 44, height: 65, kind: 'observatory' } },
    { id: 3, name: 'Moon Motel', x: 954, y: 363, width: 104, color: '#ffd789', motion: { x: 14, y: 12, period: 19 }, island: { x: -24, width: 272 }, building: { x: 127, width: 65, height: 83, kind: 'motel' } },
    { id: 4, name: 'Crystal Gardens', x: 724, y: 558, width: 104, color: '#b1b5ff', motion: { x: 16, y: 10, period: 17 }, island: { x: -50, width: 214 }, building: { x: 121, width: 26, height: 64, kind: 'crystal' } },
    { id: 5, name: 'Cosmic Outpost', x: 1120, y: 633, width: 104, color: '#80e9ff', motion: { x: 14, y: 10, period: 21 }, island: { x: -95, width: 233 }, building: { x: -73, width: 53, height: 67, kind: 'outpost' } }
  ]
}, {
  number: 4,
  id: 'trick-or-treat',
  name: 'Trick Or Treat',
  theme: 'Burgers, boos, and midnight deliveries. Land to escape the ghosts.',
  gravity: 100,
  start: { x: 640, y: 80 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 0,
  seekerCount: 4,
  pads: [
    { id: 6, name: 'Gas station', x: 82, y: 640, width: 110, color: '#b4ed72', island: { x: -48, width: 218 }, building: { x: 124, width: 28, height: 48, kind: 'gas' } },
    { id: 0, name: 'Zeta Burger', x: 370, y: 560, width: 116, color: '#ff9b47', island: { x: -112, width: 254 }, building: { x: -90, width: 76, height: 95, kind: 'restaurant' } },
    { id: 1, name: 'Spore Heights', x: 116, y: 340, width: 102, color: '#ff9b47', island: { x: -74, width: 204 }, building: { x: -56, width: 43, height: 73, kind: 'mushroom' } },
    { id: 2, name: 'Orbit Observatory', x: 563, y: 253, width: 104, color: '#b4ed72', island: { x: -36, width: 217 }, building: { x: 120, width: 44, height: 65, kind: 'observatory' } },
    { id: 3, name: 'Moon Motel', x: 954, y: 363, width: 104, color: '#d7a0ff', island: { x: -24, width: 272 }, building: { x: 127, width: 65, height: 83, kind: 'motel' } },
    { id: 4, name: 'Crystal Gardens', x: 724, y: 558, width: 104, color: '#ff9b47', island: { x: -50, width: 214 }, building: { x: 121, width: 26, height: 64, kind: 'crystal' } },
    { id: 5, name: 'Cosmic Outpost', x: 1120, y: 633, width: 104, color: '#b4ed72', island: { x: -95, width: 233 }, building: { x: -73, width: 53, height: 67, kind: 'outpost' } }
  ]
}, {
  number: 3,
  id: 'obsession',
  name: 'Obsession',
  theme: 'Neon skies. Something is following you. Land for safety.',
  gravity: 100,
  start: { x: 640, y: 80 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 0,
  seekerCount: 4,
  pads: [
    { id: 6, name: 'Gas station', x: 82, y: 640, width: 110, color: '#53f4ff', island: { x: -48, width: 218 }, building: { x: 124, width: 28, height: 48, kind: 'gas' } },
    { id: 0, name: 'Zeta Burger', x: 370, y: 560, width: 116, color: '#ff65d8', island: { x: -112, width: 254 }, building: { x: -90, width: 76, height: 95, kind: 'restaurant' } },
    { id: 1, name: 'Spore Heights', x: 116, y: 340, width: 102, color: '#ff65d8', island: { x: -74, width: 204 }, building: { x: -56, width: 43, height: 73, kind: 'mushroom' } },
    { id: 2, name: 'Orbit Observatory', x: 563, y: 253, width: 104, color: '#53f4ff', island: { x: -36, width: 217 }, building: { x: 120, width: 44, height: 65, kind: 'observatory' } },
    { id: 3, name: 'Moon Motel', x: 954, y: 363, width: 104, color: '#ffb86b', island: { x: -24, width: 272 }, building: { x: 127, width: 65, height: 83, kind: 'motel' } },
    { id: 4, name: 'Crystal Gardens', x: 724, y: 558, width: 104, color: '#ff65d8', island: { x: -50, width: 214 }, building: { x: 121, width: 26, height: 64, kind: 'crystal' } },
    { id: 5, name: 'Cosmic Outpost', x: 1120, y: 633, width: 104, color: '#53f4ff', island: { x: -95, width: 233 }, building: { x: -73, width: 53, height: 67, kind: 'outpost' } }
  ]
}, {
  number: 2,
  id: 'meteor-shower',
  name: 'Meteor Shower',
  theme: 'Cool skies. Watch for falling rocks.',
  gravity: 100,
  start: { x: 640, y: 80 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 4,
  seekerCount: 0,
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
  gravity: 100,
  start: { x: 640, y: 80 },
  restaurant: 0,
  gasStation: 6,
  fallingObstacleLimit: 0,
  seekerCount: 0,
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
