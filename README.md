# Zeta Burger

Hot burgers. Cold space. A side-view arcade game about flying a saucer on an alien world's night shift. Inspired by the flight and landing mechanics of Space Taxi, with original art and a burger delivery loop.

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

Serve `dist/` with any static HTTP host. The game uses root-relative asset URLs and should be hosted at the domain root. No server APIs, remote fonts, or runtime dependencies are needed. TypeScript is the only development dependency, approved for compilation and type checking.

## Play

- **Arrow keys or W/A/D:** thrust up, left, and right. There is no rotation or pitch control.
- **G or Space:** extend/retract landing gear. Extended gear disables sideways thrust. All existing momentum continues; use opposite thrust to brake before extending gear.
- **P or Escape:** pause/resume. Switching tabs or losing focus automatically pauses the game.
- **Enter:** start a shift or replay after game over.
- **Touch:** hold the on-screen arrows; tap GEAR. Multiple simultaneous touches are supported. Landscape offers a larger flight field with controls beside it.
- **♫:** enable or mute synthesized arcade sound. Sound begins muted.
- **?:** open the flight manual; the active shift pauses while it is open.

Start at the home dock, **pad 6**. Lift off with gear extended, retract it once clear of the dock, and fly to **pad 0** at the restaurant. Touch down gently with gear extended and remain docked for 0.8 seconds to load an order. The HUD and a beacon identify its numbered destination. Land there to unload, collect the current tip, and return to the restaurant for another order.

A new order starts with a **$5–$10** tip that decreases **$0.15 per second**. Tips can become negative and are applied to your bank as signed values. There is no timeout that cancels an order. Three saucers are available per shift. A crash costs one life and respawns you at home after 1.5 seconds; your order stays aboard and its tip keeps falling during respawn. Best bank is saved locally when browser storage is available.

Landings require both feet to be completely inside the pad, a downward speed at or below **85 world units/second**, and sideways speed at or below **35**. The speed readout turns pink when unsafe. Hull contact, gear contact against pad sides/undersides, buildings, islands, and the world boundary are fatal. The stars, distant planets, and atmospheric mountains are background scenery.

## Project layout

| File | Purpose |
| --- | --- |
| `src/engine.ts` | Browser-independent physics, landing, lives, orders, signed tips, and game state |
| `src/world.ts` | Numbered pads, station coordinates, terrain silhouettes, and convex polygon collision |
| `src/renderer.ts` | Original Canvas art, stars, saucer, beacons, buildings, particles, and asset loading |
| `src/main.ts` | Fixed-step render loop, keyboard/multitouch input, HUD, pause, help, and local best bank |
| `src/audio.ts` | Optional sound made with the browser's Web Audio API |
| `public/index.html`, `public/style.css` | Responsive game shell and accessible controls |
| `public/assets/manifest.json` | Optional custom image overrides |
| `tests/engine.test.mjs` | Flight, collision, landing, delivery, scoring, pause, and life-cycle checks |
| `tests/routes.test.mjs` | Actual control-driven flights from home to every destination and back, without teleporting |
| `scripts/dev.mjs` | Development server and TypeScript watch process using Node built-ins |

The simulation runs at **120 Hz** independent of rendering rate. Long frame gaps are discarded to avoid catching up across obstacles. The physics has gravity and independent thrusters, with no artificial horizontal drag. Gear changes never reset velocity. Touch inputs use pointer capture and clear on release/cancellation; keyboard and touch inputs can coexist.

## Add designer assets

The game ships with original procedural artwork; image replacements are optional. Put PNG, WebP, or SVG assets in `public/assets/` and edit `public/assets/manifest.json`:

```json
{
  "background": "/assets/alien-sky.webp",
  "saucer": "/assets/saucer.svg",
  "buildings": {
    "restaurant": "/assets/restaurant.svg",
    "home": "/assets/home.svg",
    "mushroom": "/assets/spore-house.svg",
    "observatory": "/assets/observatory.svg",
    "motel": "/assets/motel.svg",
    "crystal": "/assets/crystals.svg",
    "outpost": "/assets/outpost.svg"
  }
}
```

Omitted or failed images retain the built-in artwork. The background fits the **1280 × 760** world and renders behind all interactive objects. A transparent saucer image fits the **48 × 25** hull box, with its upper-left corner at `(ship.x − 24, ship.y − 17)`; gear, exhaust, and order indicators remain dynamic Canvas elements. Keep the hull silhouette consistent with `shipBody()` in `src/engine.ts`. Building images fit their rectangles from `src/world.ts`. If a designer changes a solid silhouette, update its collision geometry too. All island silhouettes use the same vertices for drawing and collision.

To add locations or change route spacing, edit `PADS` in `src/world.ts` and the destination-selection logic in `src/engine.ts`. Route tests provide executable examples of paths through this level.
