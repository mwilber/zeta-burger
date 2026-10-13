import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { viewBoxMatrix } from '../dist/src/svg-art.js';

const saucerBox = [-24, -17, 48, 25];
const point = (matrix, x, y) => [matrix.a * x + matrix.e, matrix.d * y + matrix.f];

test('Illustrator saucer exports land in the hull box and stay aligned with the gear', () => {
  const edited = readFileSync(new URL('../public/assets/saucer-1.svg', import.meta.url), 'utf8');
  const viewBox = edited.match(/viewBox="([^"]+)"/)[1];
  const matrix = viewBoxMatrix(viewBox, saucerBox);
  const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
  assert.deepEqual(point(matrix, x, y), [-24, -17]);
  assert.deepEqual(point(matrix, x + width, y + height), [24, 8]);
  // Ship origin is 24 units from the left edge and 17 from the top, rather than the artboard center.
  assert.deepEqual(point(matrix, x + width / 2, y + height * 17 / 25), [0, 0]);
});
test('original negative-origin artwork keeps its placement', () => {
  assert.deepEqual(viewBoxMatrix('-24 -17 48 25', saucerBox), { a: 1, d: 1, e: 0, f: 0 });
  assert.deepEqual(viewBoxMatrix('-5 -90 126 160', [-5, -90, 126, 160]), { a: 1, d: 1, e: 0, f: 0 });
});
test('rebased or resized artboards normalize for scenery, pads, and effect sheets', () => {
  for (const box of [[0, 0, 1280, 760], [0, 0, 76, 105], [0, 0, 254, 83], [-5, -90, 126, 160], [-80, -90, 160, 180]]) {
    const [x, y, width, height] = box;
    const matrix = viewBoxMatrix(`0,0,${width * 2},${height * 2}`, box);
    assert.deepEqual(point(matrix, 0, 0), [x, y]);
    assert.deepEqual(point(matrix, width * 2, height * 2), [x + width, y + height]);
  }
});
test('missing viewBoxes preserve legacy coordinates and invalid artboards fail clearly', () => {
  assert.deepEqual(viewBoxMatrix(null, saucerBox), { a: 1, d: 1, e: 0, f: 0 });
  for (const value of ['', '0 0 0 25', '0 0 48 -25', '0 0 NaN 25', '0 0 48 25 1']) {
    assert.throws(() => viewBoxMatrix(value, saucerBox), /Invalid SVG viewBox/);
  }
});
