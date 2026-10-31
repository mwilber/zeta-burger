import type { StructureConfig } from './level-config.js';
import type { Point } from './world.js';

// Six reusable convex boulders on 100 × 100 artboards. The SVG silhouettes
// use these same vertices; scaling a rock scales its art and collisions alike.
const shapes: Record<string, [number, number][]> = {
  slab: [[0, 0], [94, 0], [100, 20], [100, 78], [84, 100], [12, 100], [0, 76]],
  wedge: [[0, 65], [35, 8], [65, 0], [94, 10], [100, 80], [82, 100], [10, 95]],
  crown: [[0, 24], [18, 0], [78, 0], [100, 25], [96, 84], [72, 100], [16, 95], [0, 70]],
  round: [[0, 28], [26, 0], [72, 0], [96, 22], [100, 68], [78, 100], [25, 98], [0, 74]],
  slope: [[0, 0], [35, 0], [100, 85], [100, 100], [0, 100]],
  shelf: [[0, 0], [100, 0], [100, 100], [58, 88], [12, 55], [0, 25]]
};

// Convert the compact coordinate pairs once, keeping definitions easy to edit.
export const BOULDER_OUTLINES: Record<string, Point[]> = Object.fromEntries(
  Object.entries(shapes).map(([kind, points]) => [kind, points.map(([x, y]) => ({ x, y }))])
);
function rock(id: string, shape: string, x: number, y: number, width: number, height: number): StructureConfig {
  return { id, x, y, width, height, kind: `boulder-${shape}`,
    outline: BOULDER_OUTLINES[shape].map(p => ({ x: p.x * width / 100, y: p.y * height / 100 })) };
}

export const GROTTO_BOULDERS: StructureConfig[] = [
  // Outdoor restaurant ledge; the mouth opens to its right.
  rock('restaurant-ledge', 'slab', -20, 210, 315, 105),
  // Mountain crown and the thick upper cavern wall / trailhead ledge.
  rock('upper-ledge', 'slab', 510, 180, 300, 100),
  rock('upper-link', 'wedge', 755, 105, 260, 175),
  rock('mountain-peak', 'wedge', 865, -85, 275, 280),
  rock('mountain-crown', 'crown', 1080, -50, 250, 260),
  rock('upper-east', 'shelf', 970, 175, 340, 85),
  // The central group is assembled from overlapping, individually solid rocks.
  rock('heart-west', 'wedge', 270, 402, 230, 135),
  rock('heart-crown', 'crown', 425, 385, 240, 155),
  rock('heart-east', 'slope', 625, 385, 215, 160),
  rock('heart-base', 'slab', 440, 485, 300, 80),
  rock('heart-round', 'round', 710, 475, 170, 105),
  // Eastern balcony and the rock below its landing surface.
  rock('echo-ledge', 'shelf', 1035, 355, 270, 170),
  rock('echo-base', 'round', 1120, 440, 230, 95),
  // Sloping floor leaves a broad lower passage around the heart.
  rock('fuel-ledge', 'slab', -20, 615, 310, 180),
  rock('west-floor', 'slope', 235, 615, 330, 180),
  rock('deep-floor', 'slab', 535, 710, 370, 85),
  rock('refuge-slope', 'wedge', 850, 665, 280, 130),
  rock('refuge-ledge', 'slab', 1040, 665, 280, 130)
];
