// Run `npm run build`, then `node scripts/generate-avalanche-art.mjs`.
// Mountain art uses the same exact convex outlines as the collision geometry.
import { writeFile, readFile } from 'node:fs/promises';
import { LEVELS } from '../dist/src/levels.js';

const level = LEVELS.find(level => level.id === 'avalanche');
const assets = new URL('../public/assets/', import.meta.url);
const svg = (box, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">\n<title>${title}</title>\n${body}\n</svg>\n`;
const save = (name, content) => writeFile(new URL(`${name}-13.svg`, assets), content);
const pine = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-2 -4H2V4H-2Z" fill="#354b4a"/><path d="M0 -38L-12 -18H-7L-19 0H19L7 -18H12Z" fill="#45675e"/><path d="M0 -38L-9 -22H2L-6 -7H10" fill="#b0c7bd" opacity=".45"/></g>`;

await save('background', svg('0 0 1280 760', 'Avalanche — the mountain valley', `
<defs>
 <linearGradient id="valley-sky" x2="0" y2="1"><stop stop-color="#294a60"/><stop offset=".6" stop-color="#8caaa9"/><stop offset="1" stop-color="#d6d3b9"/></linearGradient>
 <linearGradient id="valley-haze" x2="0" y2="1"><stop stop-color="#c6d9d2" stop-opacity="0"/><stop offset="1" stop-color="#d5dfca" stop-opacity=".55"/></linearGradient>
</defs>
<g data-sky=""><rect width="1280" height="760" fill="url(#valley-sky)"/></g>
<circle cx="695" cy="139" r="39" fill="#f5dfaa" opacity=".75"/>
<g fill="#e3e7d4" opacity=".12"><path d="M240 104Q350 65 440 95T660 77Q750 85 820 110L790 121H250Z"/><path d="M720 218Q820 175 960 207T1220 188L1280 224V238H730Z"/></g>
<path d="M0 420L190 219 309 386 481 167 650 384 811 221 970 389 1118 170 1280 367V748H0Z" fill="#718f92"/>
<path d="M309 386L481 167 650 384 545 307 516 324 480 245 441 298 420 279Z M970 389L1118 170 1280 367 1191 300 1160 319 1117 244 1074 301Z" fill="#dae1d7"/>
<path d="M481 167L516 324 650 384 545 307Z M1118 170L1160 319 1280 367 1191 300Z" fill="#a5beb7"/>
<path d="M0 589L171 419 331 563 508 371 689 583 862 402 1015 577 1178 391 1280 510V748H0Z" fill="#5d7c79"/>
<path d="M331 563L508 371 689 583 553 492 516 513 488 452 454 490Z M689 583L862 402 1015 577 925 510 886 531 858 474 822 503Z" fill="#a7beb0" opacity=".65"/>
<path d="M362 748Q465 617 587 651Q678 610 788 661L948 748Z" fill="#6b8b73"/>
${Array.from({ length: 23 }, (_, i) => pine(360 + i * 27, 712 + Math.sin(i * .6) * 14, .55 + i % 3 * .13)).join('\n')}
<rect y="470" width="1280" height="278" fill="url(#valley-haze)"/>
<path d="M550 748Q599 699 635 728T730 748" fill="#d8cbb0"/><path d="M641 748Q606 736 647 722T658 704" fill="none" stroke="#bddfd6" stroke-width="6"/>
<path d="M0 748H1280V760H0Z" fill="#484c40"/><path d="M0 748H1280" stroke="#a7ac88"/>
<g font-family="monospace" font-size="11" letter-spacing="2" fill="#ecedda"><text x="34" y="43">AVALANCHE / TALUS VALLEY</text><text x="1246" y="43" text-anchor="end">LAND TO HALT ROCKFALL ON YOUR SIDE</text></g>`));

for (const mountain of level.structures) {
 const points = mountain.outline.map(p => `${p.x},${p.y}`).join(' ');
 const west = mountain.id.startsWith('west');
 await save(mountain.kind, svg(`0 0 ${mountain.width} ${mountain.height}`, `Avalanche ${west ? 'west' : 'east'} mountain — solid granite`, `
<defs>
 <linearGradient id="granite" x1="${west ? 0 : 1}" x2="${west ? 1 : 0}" y2=".7"><stop stop-color="#3a4a4b"/><stop offset=".55" stop-color="#68716b"/><stop offset="1" stop-color="#aca48c"/></linearGradient>
 <pattern id="strata" width="86" height="72" patternUnits="userSpaceOnUse"><path d="M-20 25L35 3 85 22 105 10M-10 64L27 49 66 61 95 44" fill="none" stroke="#ded3b6" stroke-opacity=".14" stroke-width="2"/><path d="M35 3L26 36 39 53M66 61L58 72" fill="none" stroke="#243c3c" stroke-opacity=".4" stroke-width="2"/></pattern>
 <clipPath id="mountain-clip"><polygon points="${points}"/></clipPath>
</defs>
<polygon data-mountain-outline="" points="${points}" fill="url(#granite)"/>
<g clip-path="url(#mountain-clip)">
 <g transform="scale(${mountain.width / 550} 1)"><g ${west ? '' : 'transform="translate(550 0) scale(-1 1)"'}>
  <path d="M0 0H100L550 628 394 520 307 326 196 232 143 85 95 36 0 43Z" fill="#b9b49c" opacity=".22"/>
  <path d="M0 175L155 121 231 251 127 230 176 359 0 420Z" fill="#354b4b" opacity=".38"/>
  <path d="M100 0L160 83 142 82 119 39 102 50 84 22H0V0Z" fill="#e1e5d5"/>
  <path d="M102 74L155 156 184 168 230 269M188 283L243 356 277 363 323 452M313 475L365 520 391 569 441 598" fill="none" stroke="#e6dcc0" opacity=".4" stroke-width="3"/>
  <path d="M85 93L113 161 99 184 137 244M212 278L204 319 239 354M290 421L277 464 319 507M393 564L378 604" fill="none" stroke="#243c3c" opacity=".6" stroke-width="3"/>
  ${pine(34, 120, .8)}${pine(47, 293, .9)}${pine(183, 415, .85)}${pine(225, 584, 1.1)}${pine(57, 552, 1.4)}
 </g></g>
 <rect width="${mountain.width}" height="628" fill="url(#strata)"/>
</g>`));
}

for (const pad of level.pads) {
 const width = pad.island[1].x - pad.island[0].x;
 await save(`island-${pad.id}`, svg(`0 0 ${width} 83`, 'Mountain-side granite landing ledge', `
<path d="M0 0H${width}L${width - 18} 33 ${width * .62} 73 ${width * .3} 54 15 29Z" fill="#6b7165"/>
<path d="M0 0H${width}L${width - 4} 6H4Z" fill="#bcc0a3"/>
<path d="M15 29L${width * .3} 54 ${width * .45} 24 30 8Z" fill="#92917b"/>
<path d="M${width * .62} 73L${width - 18} 33 ${width * .7} 20Z" fill="#384d49"/>
<path d="M38 13L57 23 49 36M91 13L86 30" fill="none" stroke="#c4baa0" opacity=".5"/>`));
 for (const active of [false, true]) {
  const w = pad.width, accent = active ? '#ffe0a0' : pad.color;
  await save(`pad-${pad.id}${active ? '-active' : ''}`, svg(`-5 -90 ${w + 10} 160`, `${pad.name} landing pad`, `
<rect width="${w}" height="10" rx="1" fill="#2e4546"/><path d="M1 1H${w - 1}" stroke="${accent}" stroke-width="3"/>
<path d="M6 6H${w - 6}" stroke="#c7c9af" stroke-dasharray="5 8"/>
<path d="M0 -2V-6M${w} -2V-6" stroke="#9fafa3" stroke-width="2"/><circle cy="-7" r="2" fill="${accent}"/><circle cx="${w}" cy="-7" r="2" fill="${accent}"/>
${active ? `<path d="M0 -3L-5 -51H${w + 5}L${w} -3Z" fill="${accent}" opacity=".07"/><path data-beacon="" d="M${w / 2 - 7} -70L${w / 2} -62 ${w / 2 + 7} -70" fill="none" stroke="${accent}" stroke-width="2"/>` : ''}
<rect x="${w / 2 - 12}" y="17" width="24" height="23" rx="2" fill="#263f40" stroke="${accent}" stroke-opacity=".6"/>
<text x="${w / 2}" y="34" fill="${accent}" font-family="monospace" font-size="16" text-anchor="middle" font-weight="bold">${pad.id}</text>
<text x="${w / 2}" y="57" fill="#e4e4ca" font-family="monospace" font-size="7" text-anchor="middle">${pad.name.toUpperCase()}</text>`));
 }
 const { width: w, height: h, kind } = pad.building;
 const sign = { restaurant: 'ZETA', lodge: 'LODGE', refuge: 'REST', observatory: 'OBS', chalet: 'CHALET', gas: 'FUEL' }[kind];
 await save(kind, svg(`0 0 ${w} ${h}`, `${pad.name} alpine station`, `
<path d="M2 22H${w - 2}V${h}H2Z" fill="#795f49" stroke="#364847"/>
<path d="M2 32H${w - 2}M2 43H${w - 2}M2 54H${w - 2}" stroke="#4b4c40" stroke-width="2"/>
<path d="M0 25L${w / 2} 2 ${w} 25Z" fill="#314d4e" stroke="#a8b9a5"/>
<path d="M${w / 2} 2L${w - 2} 23H${w - 7}L${w / 2} 9 6 23H0Z" fill="#c9ceba"/>
<rect x="7" y="29" width="8" height="9" fill="#f0cd88"/><rect x="${w - 15}" y="29" width="8" height="9" fill="#f0cd88"/>
<rect x="${w / 2 - 5}" y="${h - 18}" width="10" height="18" fill="#304849"/>
<rect x="3" y="${h - 29}" width="${w - 6}" height="10" rx="1" fill="#2e4644"/>
<text x="${w / 2}" y="${h - 21}" fill="${pad.color}" font-family="monospace" font-size="${sign.length > 4 ? 5 : 7}" font-weight="bold" text-anchor="middle">${sign}</text>
<path d="M1 ${h - 1}H${w - 1}" stroke="#d4cbb0" stroke-width="2"/>`));
}

await save('boulder', svg('-40 -40 80 80', 'Giant rolling granite boulder', `
<defs><radialGradient id="boulder-rock" cx=".3" cy=".2" r=".85"><stop stop-color="#c8bda2"/><stop offset=".55" stop-color="#8f8877"/><stop offset="1" stop-color="#4a5350"/></radialGradient></defs>
<path d="M40 0L36.96 15.31 28.28 28.28 15.31 36.96 0 40 -15.31 36.96 -28.28 28.28 -36.96 15.31 -40 0 -36.96 -15.31 -28.28 -28.28 -15.31 -36.96 0 -40 15.31 -36.96 28.28 -28.28 36.96 -15.31Z" fill="url(#boulder-rock)"/>
<path d="M-28 -28L-10 -22 1 -35 16 -23 10 -8 -8 -2 -26 -10Z" fill="#d4c8ac" opacity=".4"/>
<path d="M-28 28L-17 10 1 15 12 34 0 40 -15 37Z M28 -28L24 -9 37 3 40 0 37 -15Z" fill="#48514d" opacity=".5"/>
<path d="M-31 -9L-12 -4 -5 9 9 12 17 28M-5 9L-16 23M-12 -4L-6 -17 7 -23M9 12L23 1 31 5" fill="none" stroke="#424c48" stroke-width="2.2" stroke-linejoin="bevel"/>
<path d="M-27 -24L-16 -28M7 -31L15 -27M-30 4L-25 13" stroke="#eee1bd" stroke-width="2" opacity=".7"/>
<g fill="#4b5550" opacity=".5"><circle cx="14" cy="-9" r="2.5"/><circle cx="-20" cy="9" r="2"/><circle cx="7" cy="24" r="1.5"/><circle cx="22" cy="13" r="2"/></g>`));
await save('effects', await readFile(new URL('effects-10.svg', assets), 'utf8'));
await save('saucer', await readFile(new URL('saucer-10.svg', assets), 'utf8'));
await writeFile(new URL('manifest-13.json', assets), '{\n  "background": "",\n  "saucer": "",\n  "buildings": {}\n}\n');
console.log('Generated Avalanche level-13 SVG assets.');
