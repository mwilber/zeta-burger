// Run `npm run build`, then `node scripts/generate-abyss-plants.mjs`.
// Share the collision outlines so the kelp's visible edge stays accurate.
import { writeFile } from 'node:fs/promises';
import { ABYSS_PLANTS } from '../dist/src/abyss.js';

for (const plant of ABYSS_PLANTS) {
  const { id, kind, width, height, outline } = plant;
  const points = outline.map(p => `${p.x},${p.y}`).join(' ');
  const hanging = id.endsWith('upper');
  const leaves = [];
  for (let y = 44; y < height - 8; y += 28) {
    // Overlapping blades form one dense frond; all details stay inside its hull.
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 1 : width - 1;
      leaves.push(`<path d="M19 ${y + 22}Q${19 + side * 16} ${y + 16} ${edge} ${y - 8}Q${19 + side * 4} ${y - 2} 19 ${y + 9}Z" fill="${side < 0 ? '#328d62' : '#4aab73'}"/>
      <path d="M19 ${y + 19}Q${19 + side * 10} ${y + 8} ${edge} ${y - 8}" fill="none" stroke="#a4d78b" stroke-opacity=".42" stroke-width=".8"/>`);
    }
  }
  const artwork = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <title>Abyss ${id} kelp — solid ship obstacle</title>
  <defs>
    <linearGradient id="kelp-${id}"><stop stop-color="#164f43"/><stop offset=".5" stop-color="#378861"/><stop offset="1" stop-color="#103f3b"/></linearGradient>
    <clipPath id="kelp-clip-${id}"><polygon points="${points}"/></clipPath>
  </defs>
  <polygon data-plant-outline="" points="${points}" fill="url(#kelp-${id})"/>
  <g clip-path="url(#kelp-clip-${id})">
    <g${hanging ? ` transform="translate(0 ${height}) scale(1 -1)"` : ''}>
      ${leaves.join('\n      ')}
      <path d="M19 ${height}Q15 ${height * .7} 19 ${height * .5}T19 8" fill="none" stroke="#91c880" stroke-width="3"/>
      <path d="M20 ${height}V16" stroke="#d1e5a0" stroke-width=".7" opacity=".5"/>
    </g>
    <polygon points="${points}" fill="none" stroke="#64bb8b" stroke-width="1.6" stroke-linejoin="round"/>
  </g>
</svg>
`;
  await writeFile(new URL(`../public/assets/${kind}-7.svg`, import.meta.url), artwork);
}
console.log('Generated Abyss sea-plant SVG assets.');
