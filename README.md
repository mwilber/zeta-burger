# Zeta Burger

Hot burgers. Cold space. A side-view arcade game about flying a saucer on an alien world's night shift. Inspired by the flight and landing mechanics of Space Taxi, with original art and a burger delivery loop.

![Zeta Burger at the start of a shift, with the saucer suspended above Luna.](docs/screenshots/game-start.png)

## Run locally

Requires Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. The server watches TypeScript and public assets; refresh the browser after changes. Set `PORT=8080 npm run dev` to use another port. The development server listens on all interfaces so a phone on the same network can open `http://YOUR_COMPUTER_LAN_IP:5173` (subject to your firewall).

```sh
npm run typecheck   # Strict TypeScript checks
npm test            # Build and run physics, scoring, and complete flight-route tests
npm run build       # Compile a static site into dist/
```

Serve `dist/` with any static HTTP host, at the domain root or in a subdirectory such as `/games/zeta-burger/`. The game uses relative asset URLs. No server APIs, remote fonts, or runtime dependencies are needed. TypeScript is the only development dependency, approved for compilation and type checking.

## Play

- **Arrow keys or W/A/S/D:** thrust up, down, left, and right. **Down Arrow or S** accelerates descent; Up and Down held together cancel vertical thrust and consume no vertical fuel. Downward thrust works in the air with either gear setting; while docked, it leaves the saucer on the pad. There is no rotation or pitch control.
- **G or Space:** extend/retract landing gear. The first upward thrust after landing automatically retracts it. Extended gear disables sideways thrust. All existing momentum continues; use opposite thrust to brake before extending gear.
- **P or Escape:** pause/resume. Switching tabs or losing focus automatically pauses the game.
- **Enter:** start a shift or replay after game over.
- **Touch:** hold the on-screen arrows; tap GEAR. Multiple simultaneous touches are supported. Landscape offers a larger flight field with controls beside it.
- **♫:** enable or mute synthesized arcade sound. Sound begins enabled and is unlocked by Start or the sound button.
- **?:** open the flight manual; the active shift pauses while it is open.

The soundscape includes a happy victory jingle for delivering all orders and a sad jingle for running out of saucers or tips. Vertical (up or down) and sideways thrust each play an independent warbling saucer sound, so both can overlap; gear lock, empty fuel, and releasing controls silence the corresponding thruster. Close-call landings stutter in time with the visual hops. Crashes use a noisy impact and falling rumble, and a rising chime announces each order ready for pickup. Pause and mute stop active sounds; the final loss jingle follows the crash animation.

Start floating at the **top center of the play field**, with no initial drift and gear retracted. Choose a skill setting before starting. Starting or replaying a shift closes the dialog and plays a **short musical jingle during a three-second pause** before flight, fuel use, arrivals, and tip clocks begin. Pause, Help, and switching away freeze the start delay and stop the jingle; resuming continues the remaining melody. The sound button mutes the jingle along with the other effects. Then fly to **pad 0** at the restaurant. Touch down gently with gear extended and remain docked for 0.8 seconds to load the oldest waiting order. You carry one order at a time. The HUD and a beacon identify its numbered destination. Land there to unload, collect the current signed tip, and return to the restaurant for another order.

Each level begins with a fixed schedule of orders. The first order always arrives **five seconds after the level starts**, with its tip countdown beginning on arrival. Later orders arrive at random intervals measured from the previous arrival, even while another order is aboard. Every order starts its own **$5–$10** tip countdown on arrival; waiting and onboard orders lose tip value independently. Current tips hover above the package icons in flight and at the restaurant; the dispatch strip shows every active order. Negative tips subtract from your bank on delivery.

| Skill | Total orders | Arrival interval | Tip decrease |
| --- | --- | --- | --- |
| Casual | 4 | 12–22 seconds | $0.06/second |
| Normal | 6 | 8–16 seconds | $0.08/second |
| Expert | 8 | 5–10 seconds | $0.12/second |
| Tester | 1 | First order at 5 seconds; no later arrivals | $0.08/second |

The level ends when all orders are delivered, or when all scheduled orders have arrived and **every undelivered tip is below zero**. A single negative tip does not end the shift while other tips remain viable or orders are still incoming. The result screen identifies the end reason and shows delivered/total progress. **Level 3 · Obsession**, **level 2 · Meteor Shower**, and **level 1 · Luna** are available in that development play order. Choose a level before starting, and completing all deliveries automatically starts the next configured level without a result dialog. The result screen appears after the final configured level or a failed shift.

Fuel starts at **100%**. Upward or downward thrust consumes **1.8%/second** and sideways thrust **0.9%/second**; using both consumes both rates. Coasting and locked sideways controls use no fuel. At zero fuel, gravity and momentum continue but thrust stops. Land on **pad 6** to refill for free at **25%/second**. Below 25%, the HUD warns you and the gas station lights up. Refueling takes time while all order tips continue falling.

Three saucers are available per shift. A crash costs one life and respawns you at the gas station with a full tank after 1.5 seconds; your onboard order survives, and all tip clocks and arrivals continue during respawn. Losing all three saucers ends the shift after the final crash animation plays for 1.5 seconds; shift resources freeze at the final impact, and the end-game dialog appears when the explosion finishes. Pause freezes arrivals, tips, fuel, and flight. Best bank is saved locally when browser storage is available.

Landings require both feet to be completely inside the pad, a downward speed at or below **93.5 world units/second**, and sideways speed at or below **38.5**. The speed readout turns pink when unsafe. A surviving touchdown within 25% of either crash speed makes the saucer bounce four times in **0.8 seconds**, with a close-call message. These visual hops leave the ship docked; thrust or gear retraction cancels them. Hull contact, gear contact against pad sides/undersides, buildings, islands, and the world boundary are fatal. The stars, distant planets, and atmospheric mountains are background scenery.

## Project layout

| File | Purpose |
| --- | --- |
| `src/engine.ts` | Browser-independent physics, landing, lives, orders, signed tips, and game state |
| `src/level-config.ts` | Editable level numbers, names, themes, pad locations/counts, and station roles |
| `src/levels.ts` | Config validation, generated levels, asset filenames, and skill settings |
| `src/world.ts` | Geometry generated from pad configuration and convex polygon collision |
| `src/renderer.ts` | SVG scene assembly, animation, and optional asset overrides |
| `src/main.ts` | Fixed-step render loop, keyboard/multitouch input, HUD, pause, help, and local best bank |
| `src/audio.ts` | Optional sound made with the browser's Web Audio API |
| `public/index.html`, `public/style.css` | Responsive game shell and accessible controls |
| `public/assets/*.svg` | Default scenery, saucer, buildings, islands, pads, and effect templates |
| `public/assets/manifest-1.json` | Optional custom image overrides |
| `tests/engine.test.mjs` | Flight, collision, landing, delivery, scoring, pause, and life-cycle checks |
| `tests/falling-obstacles.test.mjs` | Falling obstacle spawning, caps, continuous collisions, explosions, and lifecycle checks |
| `tests/seekers.test.mjs` | Seeker pursuit, random drift, landed immunity, collisions, and lifecycle checks |
| `tests/routes.test.mjs` | Actual control-driven flights from the top center to every destination and back, without teleporting |
| `scripts/dev.mjs` | Development server and TypeScript watch process using Node built-ins |

The simulation runs at **120 Hz** independent of rendering rate. Long frame gaps are discarded to avoid catching up across obstacles. The physics has gravity and independent thrusters, with no artificial horizontal drag. Gear changes never reset velocity. Holding left or right with gear retracted tips the saucer toward 25 degrees in that direction; releasing the control immediately starts its return upright, even while coasting. Banking responds three times faster than the original velocity-based tilt; the hull and gear collision shapes remain upright. Expanding energy rings replace rocket exhaust. Touch inputs use pointer capture and clear on release/cancellation; keyboard and touch inputs can coexist.

## Add designer assets

The default artwork lives in editable SVG files in `public/assets/`. The playfield uses SVG rendering; there are no built-in Canvas drawing calls. Edit the SVG files directly to change the defaults, or use the optional manifest to replace the background, saucer hull, and buildings with PNG, WebP, or SVG images.

| Asset | Purpose |
| --- | --- |
| `background-1.svg` | Sky gradients, planets, mountains, and world boundary scenery |
| `saucer-1.svg` | Saucer hull and pilot, fitted to the 48 × 25 hull box at `(-24, -17)` |
| `restaurant-1.svg`, `gas-1.svg`, `mushroom-1.svg`, `observatory-1.svg`, `motel-1.svg`, `crystal-1.svg`, `outpost-1.svg` | Buildings, in local coordinates matching their rectangles in `src/level-config.ts` |
| `island-0-1.svg` through `island-6-1.svg` | Island art, relative to each island's upper-left vertex |
| `pad-N-1.svg`, `pad-N-active-1.svg` | Idle and highlighted pads, relative to each pad's upper-left corner |
| `falling-obstacle-2.svg` | Meteor Shower’s falling obstacle body and trail; optional per level |
| `effects-1.svg` | Star, gear, thrust, package, service, particle, and crash-message templates |

[View the original Canvas and new SVG artwork side by side](docs/screenshots/svg-art-comparison.png).

SVG artboards are mapped into fixed game rectangles. Both the original negative-origin viewBoxes and Adobe Illustrator exports starting at `0 0` work without manual coordinate edits. For example, `saucer-1.svg` may use either `-24 -17 48 25` or `0 0 48 25`: its artboard still fits the hull box with upper-left corner `(-24, -17)` relative to the ship. Buildings, background, islands, pads, and effect templates receive the same normalization; animation coordinates are converted to the exported artwork's local units. Root presentation attributes and nested layer transforms are preserved.

In Illustrator, keep the existing artboard and export the full artboard rather than cropping to the artwork bounds. Padding and artwork placement inside the artboard affect alignment; the loader fits the artboard rather than centering the visible paths. The saucer's ship origin corresponds to `(24, 17)` on a `0 0 48 25` artboard. Export dimensions may change, but keep the artboard's aspect ratio to avoid stretching. Animated templates still need the IDs, `data-*` hooks, and editable SVG element types described below.

Keep the `data-*` hooks in the assets and the template IDs in `effects-1.svg`; the renderer uses them for twinkling, vines, beacon movement, energy rings, and changing text. Keep `background-1.svg`'s `data-sky` group to place stars between the sky and planetary scenery. SVG gradients and clipping IDs are namespaced when cloned, so repeated artwork does not conflict.

To use manifest overrides, put replacement images in `public/assets/` and edit `public/assets/manifest-1.json`:

```json
{
  "background": "./assets/alien-sky.webp",
  "saucer": "./assets/saucer-1.svg",
  "buildings": {
    "restaurant": "./assets/restaurant-1.svg",
    "gas": "./assets/gas-station.svg",
    "mushroom": "./assets/spore-house.svg",
    "observatory": "./assets/observatory-1.svg",
    "motel": "./assets/motel-1.svg",
    "crystal": "./assets/crystals.svg",
    "outpost": "./assets/outpost-1.svg"
  }
}
```

Image paths in the manifest resolve relative to the game page. Omitted or failed override images retain the default SVG artwork. The default SVG files are required assets and must be deployed with the game. The background fits the **1280 × 760** world and renders behind all interactive objects. A transparent saucer image fits the **48 × 25** hull box, with its upper-left corner at `(ship.x − 24, ship.y − 17)`; gear, energy waves, and order indicators remain dynamic SVG elements from `effects-1.svg`. Keep the hull silhouette consistent with `shipBody()` in `src/engine.ts`. Building images fit their rectangles from `src/level-config.ts`. If a designer changes a solid silhouette, update its collision geometry too. Keep island outlines in `island-N-1.svg` consistent with the vertices in `src/level-config.ts` so the visible terrain matches collision. If pad dimensions or labels change, update both pad SVG states as well.

## Level configuration

The **order of entries in `LEVEL_CONFIG` is the play order**, including the initial level, level selector, and automatic level progression. Numbers do not need to be consecutive or ascending: entries numbered `8, 1, 4` play in that order. During development, treat levels as a **LIFO stack (newest first)**: prepend each new level so it becomes the starting level. The current play order is **Obsession → Meteor Shower → Luna**. Keep each level's `number` and `id` unchanged so its graphics filenames and identity stay the same.

Edit `src/level-config.ts` to customize levels. Luna is level **1**, with the original seven pads and artwork. Each level has a unique `number` and `id`, a display `name`, a `theme` tagline, a ship `start` position, a numeric `fallingObstacleLimit`, a numeric `seekerCount`, restaurant and gas station pad IDs, and a `pads` list. The list length is the total number of pads: add or remove entries to change it. Pad IDs may be nonconsecutive. All pads except the restaurant and gas station become delivery destinations automatically; each level requires at least one delivery destination.

A pad's `x` and `y` locate the upper-left corner of its landing surface in the **1280 × 760** world. Its island and building `x` values are offsets from the pad, and building `height` positions its roof above the surface. Changing only the pad's `x`/`y` moves its island, building, graphics, and collision geometry together. Edit `width`, island dimensions, or building dimensions to resize a station. Keep the artwork aligned with these generated collision shapes. Configuration errors such as duplicate pad IDs or missing station roles fail with a level-specific message.

```ts
// Example pad entry (coordinates are world units):
{
  id: 0, name: 'Zeta Burger', x: 370, y: 560,
  width: 116, color: '#bdf77d',
  island: { x: -112, width: 254 },
  building: { x: -90, width: 76, height: 95, kind: 'restaurant' }
}
```

Every gameplay graphic appends `-<level number>` to its original name, before the extension. For level 2, supply `background-2.svg`, `saucer-2.svg`, `effects-2.svg`, each configured building such as `restaurant-2.svg`, and `island-<pad ID>-2.svg`, `pad-<pad ID>-2.svg`, `pad-<pad ID>-active-2.svg` for each pad. The loader derives required assets from that level's pad list; no renderer edits are needed for more pads, different IDs, or new building kinds. `icon.svg` stays shared for the page's branding. Optional image overrides use `manifest-<level number>.json` with the same format shown above; paths in the manifest are used exactly as written.

To add a level during development, prepend its configuration and add its graphics. The level selector appears when multiple levels exist, and completing all deliveries automatically transitions to the next configured level. Each level starts a fresh shift with the same skill setting and the usual three-second start countdown. Your signed bank balance carries into the next level, and new delivery tips add to that running total. Starting or replaying a game resets the bank to zero. There is no dialog or confirmation between completed levels. Replay remains available on wins and losses. All scenery, ships, stations, and effects reload when switching levels; failed required art prevents starting that shift. Reload the browser after config or asset edits when using the dev server, or rebuild before deploying. Skill settings live in `SKILLS` and fuel tuning in `FUEL`.

### Falling obstacles

Meteor Shower uses Luna's seven-pad layout with cool grey artwork and introduces falling obstacles, currently skinned as meteors. Set `fallingObstacleLimit` on any level: **0 disables them**, and a positive integer is the maximum active count. Meteor Shower starts at **4**. Obstacles enter from the top on fixed straight paths, with random downward angles (up to 35 degrees either side of vertical), speeds, sizes, and staggered arrivals. They keep falling during replacement delays and freeze during countdown, pause, the final ship explosion, and game over. Restarting or changing levels clears them.

An obstacle explodes at its first contact with a pad, island, building, world side or floor, another falling obstacle, or the player's hull/extended gear. Two colliding obstacles both explode; a ship collision explodes both ship and obstacle and costs one life. Docked ships remain vulnerable. Static scenery is never damaged, moved, or removed. Impacts reuse the ship's particle explosion and sound, without displaying the ship-loss message or interrupting thrust on terrain-only impacts. Continuous collision checks prevent fast obstacles or ships from passing through each other or thin pads between updates.

For every enabled level, supply `public/assets/falling-obstacle-<number>.svg`. Its artboard is mapped to `-24 -76 48 100`, with a solid octagonal body of radius **16** centered at `(0, 0)`; the upper portion is a decorative trail. The renderer scales the body to each obstacle's collision radius and aligns the trail to its flight direction. Edit this SVG to reskin falling obstacles in another theme. Spawning and flight tuning live in `FALLING_OBSTACLES` in `src/engine.ts`.

### Seekers / Obsession

**Obsession (level 3)** uses a synthwave palette: violet skies, a striped pink sun, neon cyan/pink stations, and a perspective grid. It introduces four animated, amorphous cloud **seekers**. Set `seekerCount` to a nonnegative integer on any level (0 disables them), and supply `seeker-<number>.svg`. No falling obstacles are enabled on Obsession.

![Obsession's synthwave scenery and four cloud seekers.](docs/screenshots/obsession-level.png)

Seekers pass through pads, islands, buildings, falling obstacles, and one another. While the ship is in flight, they steer toward it with eased turns and a jellyfish-like pulse/glide. While the ship is landed, it is completely immune to seekers and they drift in random directions, choosing a new heading every 2–4 seconds. Taking off or retracting the gear removes this protection. Airborne hull or extended-gear contact costs a life and uses the normal crash/respawn cycle; seekers survive contact.

The ship has no speed cap, so seekers use a fixed **30 world units/second** average target, roughly one quarter of a typical 120-unit/second flight speed, rather than scaling with the ship's instantaneous velocity. Tuning lives in `SEEKERS` in `src/engine.ts`. They stay within the flight field and begin at least 200 units from the initial ship position. Replay and level changes recreate their population. Countdown, pause, game over, and the final crash explosion freeze their movement and animation; they continue wandering during other replacement delays. The renderer animates the SVG's vapor wisps and breathing from simulation time and respects reduced-motion preferences for the decorative movement.
