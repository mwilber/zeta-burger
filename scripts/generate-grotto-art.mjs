// Run `npm run build` first, then `node scripts/generate-grotto-art.mjs`.
// Rock silhouettes come from the gameplay definitions, keeping their collision
// vertices and the exported SVG artboards in agreement.
import { writeFile, readFile } from 'node:fs/promises';
import { BOULDER_OUTLINES } from '../dist/src/grotto.js';
import { LEVELS } from '../dist/src/levels.js';

const level = LEVELS.find(level => level.id === 'grotto');
const assets = new URL('../public/assets/', import.meta.url);
const svg = (box, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">\n  <title>${title}</title>\n${body}\n</svg>\n`;
const save = (name, content) => writeFile(new URL(`${name}-10.svg`, assets), content);
const polygon = points => points.map(p => `${p.x},${p.y}`).join(' ');
const palettes = [
  ['#827b70', '#5d5954', '#353b3d'], ['#8d806f', '#655c52', '#3c3d3a'],
  ['#877e72', '#625b54', '#393d3e'], ['#8a8178', '#605c58', '#393d40'],
  ['#8a7c6a', '#63594e', '#383c3b'], ['#8c8171', '#665e55', '#393c3d']
];
let variant = 0;
for (const [shape, points] of Object.entries(BOULDER_OUTLINES)) {
  const [light, middle, dark] = palettes[variant++], outline = polygon(points);
  const facets = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return `<path d="M${p.x} ${p.y}L${q.x} ${q.y} 48 43Z" fill="${i < 2 ? light : i < 5 ? dark : middle}" opacity="${i % 2 ? '.24' : '.42'}"/>`;
  }).join('\n');
  await save(`boulder-${shape}`, svg('0 0 100 100', `Grotto ${shape} boulder — solid silhouette`, `
  <defs>
    <linearGradient id="rock-${shape}" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="${light}"/><stop offset=".4" stop-color="${middle}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <clipPath id="clip-${shape}"><polygon points="${outline}"/></clipPath>
  </defs>
  <polygon data-rock-outline="" points="${outline}" fill="url(#rock-${shape})"/>
  <g clip-path="url(#clip-${shape})">
    ${facets}
    <g fill="none" stroke="#282e30" stroke-width=".55" opacity=".66">
      <path d="M15 0L23 17 19 32 32 44 27 62M100 36L80 41 72 59 58 64 54 100M0 73L19 69 27 62 44 68"/>
      <path d="M23 17L42 20 52 15M72 59L79 77 94 84M32 44L48 43 58 49"/>
    </g>
    <g fill="none" stroke="#e4ceb0" stroke-width=".35" opacity=".23">
      <path d="M16 0L24 17 20 31M81 42L73 59 59 65M2 74L18 71M36 23L43 25M47 79L58 82M69 28L82 31M10 50L16 53"/>
    </g>
    <g fill="#e1c5a0" opacity=".15"><circle cx="32" cy="28" r=".65"/><circle cx="65" cy="37" r=".5"/><circle cx="49" cy="71" r=".7"/><circle cx="17" cy="58" r=".4"/><circle cx="83" cy="63" r=".6"/></g>
    <polygon points="${outline}" fill="none" stroke="#222d30" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M${points.slice(0, 3).map(p => `${p.x} ${p.y}`).join('L')}" fill="none" stroke="#d8c6a5" stroke-width=".9" opacity=".6"/>
  </g>`));
}

// A pale exterior above the descending mountain profile; everything below it
// is distant cave wall, visually recessed behind the solid foreground rocks.
await save('background', svg('0 0 1280 760', 'Grotto — daylight at the mountain’s edge', `
  <defs>
    <linearGradient id="grotto-sky" x2="0" y2="1"><stop stop-color="#3e7391"/><stop offset="1" stop-color="#b6cfca"/></linearGradient>
    <linearGradient id="grotto-depth" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#3e4b4b"/><stop offset=".4" stop-color="#273438"/><stop offset="1" stop-color="#101f27"/></linearGradient>
    <radialGradient id="mouth-light" cx=".05" cy=".1" r=".8"><stop stop-color="#dcc8a0" stop-opacity=".2"/><stop offset="1" stop-color="#cbb99a" stop-opacity="0"/></radialGradient>
    <pattern id="back-strata" width="250" height="170" patternUnits="userSpaceOnUse">
      <path d="M0 18L60 12 109 26 174 9 250 20M0 83L47 91 115 72 182 84 250 75M0 151L83 143 140 162 214 143 250 150" fill="none" stroke="#81908c" stroke-width="1" opacity=".085"/>
      <path d="M60 12L75 52 47 91M174 9L161 41 182 84 170 120 214 143M83 143L92 118 115 72" fill="none" stroke="#020f18" stroke-width="2" opacity=".18"/>
      <path d="M22 42L42 38 52 49M120 132L139 127M200 49L215 54" fill="none" stroke="#bbac8d" opacity=".06"/>
    </pattern>
    <clipPath id="cavern-back"><path d="M0 306L240 305 310 266 365 218 510 180 760 180 868 58 895 0H1280V760H0Z"/></clipPath>
    <linearGradient id="grotto-shaft" x2=".5" y2="1"><stop stop-color="#e9dfb7" stop-opacity=".1"/><stop offset="1" stop-color="#e9dfb7" stop-opacity="0"/></linearGradient>
  </defs>
  <g data-sky=""><path d="M0 0H1280V760H0Z" fill="url(#grotto-sky)"/></g>
  <!-- An opaque daylight layer also covers the shared decorative star field. -->
  <path d="M0 0H1280V760H0Z" fill="url(#grotto-sky)"/>
  <circle cx="380" cy="59" r="27" fill="#f8e5b8" opacity=".8"/>
  <g fill="#ebefdd" opacity=".28"><path d="M28 66Q60 42 96 61Q125 37 163 66Z"/><path d="M465 45Q503 22 538 44Q568 24 612 46Z"/></g>
  <path d="M0 182L80 121 134 164 217 102 298 177 375 130 448 187 547 125 647 190V340H0Z" fill="#617e7e" opacity=".5"/>
  <path d="M0 206L60 179 128 200 195 155 270 202 347 164 443 215 545 177 635 229V340H0Z" fill="#476967" opacity=".55"/>
  <g clip-path="url(#cavern-back)">
    <path d="M0 0H1280V760H0Z" fill="url(#grotto-depth)"/>
    <path d="M0 0H1280V760H0Z" fill="url(#back-strata)"/>
    <path d="M0 0H1280V760H0Z" fill="url(#mouth-light)"/>
    <g fill="none" stroke-linejoin="bevel">
      <path d="M91 589L86 409 352 313 861 297 974 345 969 565 866 637 450 593 278 551Z" stroke="#718079" stroke-width="32" opacity=".035"/>
      <path d="M121 578L124 433 370 340 849 321 946 364 941 550 848 605 450 566 284 529Z" stroke="#071a24" stroke-width="24" opacity=".1"/>
    </g>
    <path d="M317 218L384 218 628 659 476 660Z" fill="url(#grotto-shaft)"/>
    <g fill="#46524f" opacity=".34"><path d="M870 276L885 310 896 280 910 298 921 272Z"/><path d="M1260 536L1254 569 1244 540 1230 549 1226 530Z"/></g>
    <g fill="#79b5a7" opacity=".45"><circle cx="106" cy="442" r="1.4"/><circle cx="225" cy="493" r="1"/><circle cx="424" cy="596" r="1.5"/><circle cx="985" cy="458" r="1.1"/><circle cx="912" cy="607" r="1.5"/><circle cx="1094" cy="584" r="1"/></g>
    <g fill="none" stroke="#5c8f85" stroke-width="2" opacity=".4"><path d="M105 443L102 453M225 494L228 504M986 458L984 468M1094 584L1098 592"/></g>
    <text x="340" y="322" fill="#b4b4a1" opacity=".45" font-family="monospace" font-size="9" letter-spacing="3">GROTTO</text>
    <path d="M400 319H435L428 315M435 319L428 323" fill="none" stroke="#b4b4a1" stroke-width="1" opacity=".45"/>
  </g>
  <g fill="#557967"><path d="M18 209L24 202 30 209M40 210L43 202 48 210M236 209L240 201 245 210M558 180L563 172 568 180M774 180L779 173 784 180"/></g>
  <path d="M0 748H1280V760H0Z" fill="#12232a"/>
  <path d="M0 748H1280" stroke="#56625b" stroke-width="1"/>
`));

for (const pad of level.pads) {
  const { id, width: w, name, color } = pad;
  for (const active of [false, true]) {
    await save(`pad-${id}${active ? '-active' : ''}`, svg(`-5 -90 ${w + 10} 160`, `${name} landing pad${active ? ' — active' : ''}`, `
  ${active ? `<path d="M0 -3L-3 -68H${w + 3}L${w} -3Z" fill="${color}" opacity=".05"/>
  <path d="M2 -10V-48M${w - 2} -10V-48" stroke="${color}" stroke-dasharray="3 8" opacity=".38"/>
  <text data-beacon="" x="${w / 2}" y="-70" fill="${color}" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">${id === 0 ? 'PICKUP' : id === 6 ? 'FUEL' : `PAD ${id}`}</text>` : ''}
  <rect y="0" width="${w}" height="10" rx="1" fill="#1a292c"/>
  <path d="M1 1H${w - 1}" stroke="${color}" stroke-width="3"/>
  <path d="M6 6H${w - 6}" stroke="${color}" opacity=".55" stroke-width="2" stroke-dasharray="4 7"/>
  <path d="M0 0V-5M${w} 0V-5" stroke="#bcc6b6" stroke-width="2"/>
  <circle cy="-6" r="2" fill="${color}"/><circle cx="${w}" cy="-6" r="2" fill="${color}"/>
  <rect x="${w / 2 - 12}" y="16" width="24" height="23" rx="2" fill="#17282d" stroke="${color}" stroke-opacity=".5"/>
  <text x="${w / 2}" y="33" fill="${color}" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">${id}</text>
  <text x="${w / 2}" y="48" fill="#e1dac5" font-family="monospace" font-size="7" text-anchor="middle">${name.toUpperCase()}</text>`));
  }
  const b = pad.building, h = b.height + 10, bw = b.width;
  const sign = { restaurant: 'ZETA', lodge: 'LODGE', echo: 'ECHO', gas: 'FUEL', lab: 'LAB', refuge: 'REST' }[b.kind];
  await save(b.kind, svg(`0 0 ${bw} ${h}`, `${name} mountain station`, `
  <path d="M0 ${h}V8L${bw * .2} 0H${bw * .8}L${bw} 8V${h}Z" fill="#223438"/>
  <path d="M1 ${h}V9L${bw * .2} 1H${bw * .8}L${bw - 1} 9V${h}" fill="none" stroke="#81948a" stroke-width="1"/>
  <path d="M3 11H${bw - 3}" stroke="${color}" stroke-width="2"/>
  <rect x="4" y="16" width="${bw - 8}" height="15" rx="1" fill="#15282d" stroke="${color}" stroke-width=".6"/>
  <text x="${bw / 2}" y="26.5" font-family="monospace" font-weight="bold" text-anchor="middle" font-size="${b.kind === 'restaurant' ? 11 : 6.5}" fill="${color}">${sign}</text>
  <path d="M5 ${h - 7}V37H${bw - 5}V${h - 7}" fill="#344347" stroke="#63776f" stroke-width=".7"/>
  <path d="M${bw / 2} 38V${h - 7}" stroke="#162a2e"/>
  <path d="M8 41H${bw - 8}" stroke="${color}" stroke-opacity=".6" stroke-width="2"/>
  <circle cx="${bw / 2 + 4}" cy="${h - 19}" r="1.2" fill="${color}"/>
  ${b.kind === 'restaurant' ? `<path d="M9 55Q31 38 53 55Z" fill="#e2ac68"/><path d="M9 59H53" stroke="#b5d68a" stroke-width="3"/><path d="M9 63H53" stroke="#d39960" stroke-width="4"/>` : ''}
  ${b.kind === 'gas' ? `<path d="M${bw - 4} 34Q${bw - 1} 46 ${bw - 4} 51" fill="none" stroke="${color}" stroke-width="2"/>` : ''}
`));
}

const effects = await readFile(new URL('effects-9.svg', assets), 'utf8');
await save('effects', effects.replaceAll('#8de4cf', '#83d9c7').replaceAll('#28332e', '#1b3035').replaceAll('#4c5140', '#475751'));
await save('saucer', svg('-24 -17 48 25', 'Grotto survey saucer', `
  <path d="M-14 -2L-10 -13Q0 -21 10 -13L14 -2Z" fill="#83b6b4" stroke="#20383d" stroke-width="1"/>
  <path d="M-9 -11Q0 -17 9 -11L10 -4H-10Z" fill="#21444c"/>
  <path d="M-7 -10L-3 -12M1 -13L5 -11" stroke="#c1e5da" stroke-linecap="round" opacity=".8"/>
  <path d="M-24 0Q-18 -7 0 -6Q18 -7 24 0L19 8H-19Z" fill="#e2d7b6" stroke="#263c3f" stroke-width=".8"/>
  <path d="M-22 1H22L18 6H-18Z" fill="#627d79"/>
  <path d="M-17 2H-11M-3 2H3M11 2H17" stroke="#ffc479" stroke-width="2"/>
  <path d="M-12 7H12" stroke="#b4c7b3" stroke-width="1.5"/>
`));
await writeFile(new URL('manifest-10.json', assets), '{\n  "background": "",\n  "saucer": "",\n  "buildings": {}\n}\n');
console.log('Generated Grotto level-10 SVG assets.');
