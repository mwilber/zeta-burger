// Run `npm run build`, then `node scripts/generate-blizzard-art.mjs`.
// Station artboards use the configured collision dimensions; peaks and trees
// in the background are distant scenery, leaving the flight lanes open.
import { writeFile, readFile } from 'node:fs/promises';
import { LEVELS } from '../dist/src/levels.js';

const level = LEVELS.find(level => level.id === 'blizzard');
const assets = new URL('../public/assets/', import.meta.url);
const svg = (box, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">\n<title>${title}</title>\n${body}\n</svg>\n`;
const save = (name, content) => writeFile(new URL(`${name}-12.svg`, assets), content);
const pine = (x, y, scale, color) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-2 -6H2V3H-2Z" fill="#445d6b"/><path d="M0 -45L-10 -25H-6L-16 -10H-11L-22 0H22L11 -10H16L6 -25H10Z" fill="${color}"/><path d="M0 -45L-9 -27H1L-5 -14H10L0 -20H7Z" fill="#d7e9ee" opacity=".65"/></g>`;

await save('background', svg('0 0 1280 760', 'Blizzard — alpine whiteout', `
<defs>
  <linearGradient id="winter-sky" x2="0" y2="1"><stop stop-color="#243e59"/><stop offset=".65" stop-color="#7896aa"/><stop offset="1" stop-color="#c1d6df"/></linearGradient>
  <linearGradient id="winter-mist" x2="0" y2="1"><stop stop-color="#d4e9ef" stop-opacity="0"/><stop offset="1" stop-color="#d4e9ef" stop-opacity=".3"/></linearGradient>
  <linearGradient id="mountain-face" x2=".8" y2="1"><stop stop-color="#c6dce5"/><stop offset="1" stop-color="#647f99"/></linearGradient>
</defs>
<g data-sky=""><rect width="1280" height="760" fill="url(#winter-sky)"/></g>
<g fill="#d5e6ed" opacity=".13">
  <path d="M0 78Q120 34 243 85T512 78T810 65T1104 76L1280 62V133Q1130 162 994 127T730 139T420 122T163 142L0 119Z"/>
  <path d="M0 167Q184 123 330 161T644 148T943 175T1280 146V198Q1090 220 910 208T562 211T233 204L0 219Z"/>
</g>
<!-- Distant serrated alpine ridges, snow caps, and shaded glacier faces. -->
<path d="M0 431L94 326 174 377 324 196 466 368 563 282 703 406 891 215 1034 382 1151 271 1280 402V760H0Z" fill="#8fa9ba"/>
<path d="M174 377L324 196 466 368 351 300 319 322 281 282Z M703 406L891 215 1034 382 947 319 912 345 882 292 843 315Z M1034 382L1151 271 1280 402 1198 346 1167 361 1145 324Z" fill="#e1edf2"/>
<path d="M324 196L351 300 466 368 384 283Z M891 215L912 345 1034 382 947 319Z M1151 271L1167 361 1280 402Z" fill="#b5cbd8"/>
<path d="M0 566L128 437 233 514 430 323 608 524 749 421 899 550 1069 361 1280 568V760H0Z" fill="url(#mountain-face)"/>
<path d="M233 514L430 323 608 524 497 449 465 466 427 391 379 433 355 416Z M899 550L1069 361 1280 568 1156 480 1105 495 1066 427 1016 469Z" fill="#f0f6f8"/>
<path d="M430 323L465 466 608 524 497 449Z M1069 361L1105 495 1280 568 1156 480Z" fill="#a1bacb"/>
<path d="M0 663Q179 561 350 644T682 622T1009 651T1280 611V760H0Z" fill="#7898ad"/>
${Array.from({ length: 38 }, (_, i) => pine(i * 36 - 20, 700 + Math.sin(i * .8) * 24, .65 + i % 4 * .13, '#587b8c')).join('\n')}
<rect y="250" width="1280" height="498" fill="url(#winter-mist)"/>
<path d="M0 748H1280V760H0Z" fill="#e0edf2"/><path d="M0 748H1280" stroke="#f6fcff" stroke-width="2"/>
<g font-family="monospace" font-size="11" letter-spacing="2" fill="#e3f2f7">
  <text x="34" y="43">BLIZZARD / ALPINE SECTOR</text>
  <text data-wind-label="" x="1246" y="43" text-anchor="end">WIND → EAST</text>
</g>`));

for (const pad of level.pads) {
  const width = pad.island[1].x - pad.island[0].x;
  await save(`island-${pad.id}`, svg(`0 0 ${width} 83`, 'Snow-covered granite ledge', `
<defs><linearGradient id="frozen-rock" x2=".6" y2="1"><stop stop-color="#7292a3"/><stop offset="1" stop-color="#344d66"/></linearGradient></defs>
<path d="M0 0H${width}L${width - 18} 33 ${width * .62} 73 ${width * .3} 54 15 29Z" fill="url(#frozen-rock)" stroke="#90b6c8" stroke-width="1"/>
<path d="M15 29L${width * .3} 54 ${width * .43} 26 50 8Z" fill="#4a687e"/>
<path d="M${width * .62} 73L${width - 18} 33 ${width * .72} 23Z" fill="#283f59" opacity=".65"/>
<path d="M0 0H${width}L${width - 5} 8Q${width * .8} 13 ${width * .68} 7Q${width * .48} 15 ${width * .29} 8Q24 14 4 7Z" fill="#f2fafc"/>
<path d="M20 10L23 23 27 10M${width - 40} 10L${width - 36} 30 ${width - 32} 10M${width - 24} 9L${width - 21} 20 ${width - 18} 9" fill="#bbebfa"/>
<path d="M${width * .35} 28L${width * .47} 36 ${width * .43} 48M${width * .72} 16L${width * .66} 32" fill="none" stroke="#b2cbd5" opacity=".35"/>`));

  for (const active of [false, true]) {
    const w = pad.width, accent = active ? '#ffe0a0' : pad.color;
    await save(`pad-${pad.id}${active ? '-active' : ''}`, svg(`-5 -90 ${w + 10} 160`, `${pad.name} landing pad${active ? ' — delivery beacon' : ''}`, `
<rect y="0" width="${w}" height="10" rx="2" fill="#304d63"/>
<rect y="0" width="${w}" height="3" rx="1" fill="${accent}"/>
<path d="M5 6H${w - 5}" stroke="#95b1c0"/>
<path d="M8 9H${w - 8}" stroke="#e6f4f9" stroke-width="2" stroke-dasharray="4 16"/>
<path d="M-2 0V-6M${w + 2} 0V-6" stroke="#526e81" stroke-width="3"/>
<g fill="${accent}"><circle cx="-2" cy="-7" r="2"/><circle cx="${w + 2}" cy="-7" r="2"/></g>
${active ? `<path d="M0 -2L-11 -55H${w + 11}L${w} -2Z" fill="#ffe0a0" opacity=".08"/><path data-beacon="" d="M${w / 2 - 6} -78L${w / 2} -70 ${w / 2 + 6} -78" fill="none" stroke="#ffe0a0" stroke-width="2"/>` : ''}
<rect x="${w / 2 - 12}" y="18" width="24" height="23" rx="3" fill="#203c52" stroke="${accent}" stroke-opacity=".75"/>
<text x="${w / 2}" y="35" text-anchor="middle" font-family="monospace" font-size="15" font-weight="bold" fill="${accent}">${pad.id}</text>
<text x="${w / 2}" y="62" text-anchor="middle" font-family="monospace" font-size="8" fill="#e2f0f6">${pad.name.toUpperCase()}</text>`));
  }

  const { width: w, height: h, kind } = pad.building;
  const roof = h * .32, eave = h * .43;
  const windows = [w * .23, w * .65].map(x => `<rect x="${x}" y="${h * .51}" width="${w * .15}" height="${h * .16}" rx="1" fill="#ffd995"/><path d="M${x + w * .075} ${h * .51}V${h * .67}" stroke="#785c49" stroke-width="1"/>`).join('');
  const sign = kind === 'restaurant' ? 'ZETA BURGER' : kind === 'gas' ? 'FUEL' : kind === 'lodge' ? 'LODGE' : '';
  await save(kind, svg(`0 0 ${w} ${h}`, `Blizzard ${pad.name} — alpine chalet`, `
<rect x="${w * .73}" y="${h * .12}" width="${w * .12}" height="${h * .25}" fill="#657983"/>
<rect x="${w * .70}" y="${h * .11}" width="${w * .18}" height="3" rx="1" fill="#f4fbfd"/>
<path d="M2 ${roof}H${w - 2}V${h}H2Z" fill="#7a5949"/>
<path d="M2 ${h * .56}H${w - 2}M2 ${h * .72}H${w - 2}M2 ${h * .88}H${w - 2}" stroke="#4a4141" stroke-width="2"/>
<path d="M1 ${eave}L${w / 2} 4 ${w - 1} ${eave}Z" fill="#425c70" stroke="#263e52" stroke-width="2" stroke-linejoin="round"/>
<path d="M1 ${eave - 2}L${w / 2} 2 ${w - 1} ${eave - 2} ${w - 5} ${eave + 2} ${w / 2} 10 5 ${eave + 2}Z" fill="#eff9fc"/>
<path d="M${w * .42} ${h * .21}H${w * .58}V${h * .32}H${w * .42}Z" fill="#ffdc9a"/>
${windows}
<rect x="${w * .43}" y="${h * .75}" width="${w * .19}" height="${h * .25}" fill="#304555"/>
<circle cx="${w * .58}" cy="${h * .89}" r="1" fill="#ffdc9a"/>
<path d="M1 ${h - 2}H${w - 1}" stroke="#e7f5f8" stroke-width="4"/>
${sign ? `<rect x="2" y="${h * .70}" width="${w - 4}" height="${h * .13}" rx="1" fill="#294653"/><text x="${w / 2}" y="${h * .795}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${kind === 'restaurant' ? 6.5 : 6}" fill="#ffe1a0">${sign}</text>` : ''}
${kind === 'observatory' ? `<path d="M${w * .22} ${roof}A${w * .28} ${w * .28} 0 0 1 ${w * .78} ${roof}Z" fill="#d9edf3" stroke="#a3cbdc"/><path d="M${w / 2} ${roof}V${roof - w * .28}" stroke="#7d9daf" stroke-width="2"/>` : ''}`));
}

// Keep the shared meteor artboard/body origin, replacing the trail with six
// symmetric branched ice arms. Radius 16 scales to a 48-unit-wide snowflake.
await save('falling-obstacle', svg('-24 -76 48 100', 'Six-branched snowflake', `
<g data-snowflake="" fill="none" stroke-linecap="round" stroke-linejoin="round">
${Array.from({ length: 6 }, (_, i) => `<g data-snowflake-arm="" transform="rotate(${i * 60})"><path d="M0 0H15M7 0L11 -4M7 0L11 4M11 0L14 -3M11 0L14 3" stroke="#629cbd" stroke-width="2.8"/><path d="M0 0H15M7 0L11 -4M7 0L11 4M11 0L14 -3M11 0L14 3" stroke="#f5fdff" stroke-width="1.6"/></g>`).join('\n')}
<path d="M4 0L2 3.46H-2L-4 0 -2 -3.46H2Z" stroke="#d5f3ff" stroke-width="1"/>
</g>`));

let effects = await readFile(new URL('effects-11.svg', assets), 'utf8');
effects = effects.replace(/\n  <g id="lightning-bolt"[\s\S]*?(?=<\/svg>)/, '\n');
effects = effects.replace('stroke="#70baff" stroke-width="1.4"', 'stroke="#ffffff" stroke-width="1.8"');
effects = effects.replace('data-crash-colors="#ffd297,#ff918f,#dabaff"', 'data-crash-colors="#ffffff,#bce9ff,#78b6d5"');
await save('effects', effects);
await save('saucer', await readFile(new URL('saucer-11.svg', assets), 'utf8'));
await writeFile(new URL('manifest-12.json', assets), '{\n  "background": "",\n  "saucer": "",\n  "buildings": {}\n}\n');
console.log('Generated Blizzard SVG artwork.');
