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
- **G or Space:** extend/retract landing gear. The first upward thrust after landing automatically retracts it. Extended gear disables sideways thrust. All existing momentum continues; use opposite thrust to brake before extending gear.
- **P or Escape:** pause/resume. Switching tabs or losing focus automatically pauses the game.
- **Enter:** start a shift or replay after game over.
- **Touch:** hold the on-screen arrows; tap GEAR. Multiple simultaneous touches are supported. Landscape offers a larger flight field with controls beside it.
- **♫:** enable or mute synthesized arcade sound. Sound begins muted.
- **?:** open the flight manual; the active shift pauses while it is open.

Start floating at the **top center of the play field**, with no initial drift and gear retracted. Choose a skill setting before starting, then fly to **pad 0** at the restaurant. Touch down gently with gear extended and remain docked for 0.8 seconds to load the oldest waiting order. You carry one order at a time. The HUD and a beacon identify its numbered destination. Land there to unload, collect the current signed tip, and return to the restaurant for another order.

Each level begins with a fixed schedule of orders. The first order always arrives **five seconds after the level starts**, with its tip countdown beginning on arrival. Later orders arrive at random intervals measured from the previous arrival, even while another order is aboard. Every order starts its own **$5–$10** tip countdown on arrival; waiting and onboard orders lose tip value independently. Current tips hover above the package icons in flight and at the restaurant; the dispatch strip shows every active order. Negative tips subtract from your bank on delivery.

| Skill | Total orders | Arrival interval | Tip decrease |
| --- | --- | --- | --- |
| Casual | 4 | 12–22 seconds | $0.06/second |
| Normal | 6 | 8–16 seconds | $0.08/second |
| Expert | 8 | 5–10 seconds | $0.12/second |

The level ends when all orders are delivered, or when all scheduled orders have arrived and **every undelivered tip is below zero**. A single negative tip does not end the shift while other tips remain viable or orders are still incoming. The result screen identifies the end reason and shows delivered/total progress. Only Zeta Prime is available for now.

Fuel starts at **100%**. Upward thrust consumes **1.8%/second** and sideways thrust **0.9%/second**; using both consumes both rates. Coasting and locked sideways controls use no fuel. At zero fuel, gravity and momentum continue but thrust stops. Land on **pad 6** to refill for free at **25%/second**. Below 25%, the HUD warns you and the gas station lights up. Refueling takes time while all order tips continue falling.

Three saucers are available per shift. A crash costs one life and respawns you at the gas station with a full tank after 1.5 seconds; your onboard order survives, and all tip clocks and arrivals continue during respawn. Losing all three saucers also ends the shift. Pause freezes arrivals, tips, fuel, and flight. Best bank is saved locally when browser storage is available.

Landings require both feet to be completely inside the pad, a downward speed at or below **93.5 world units/second**, and sideways speed at or below **38.5**. The speed readout turns pink when unsafe. A surviving touchdown within 25% of either crash speed makes the saucer bounce four times in **0.8 seconds**, with a close-call message. These visual hops leave the ship docked; thrust or gear retraction cancels them. Hull contact, gear contact against pad sides/undersides, buildings, islands, and the world boundary are fatal. The stars, distant planets, and atmospheric mountains are background scenery.

## Project layout

| File | Purpose |
| --- | --- |
| `src/engine.ts` | Browser-independent physics, landing, lives, orders, signed tips, and game state |
| `src/levels.ts` | Level definitions, station roles, destinations, and skill settings |
| `src/world.ts` | Numbered pads, station coordinates, terrain silhouettes, and convex polygon collision |
| `src/renderer.ts` | Original Canvas art, stars, saucer, beacons, buildings, particles, and asset loading |
| `src/main.ts` | Fixed-step render loop, keyboard/multitouch input, HUD, pause, help, and local best bank |
| `src/audio.ts` | Optional sound made with the browser's Web Audio API |
| `public/index.html`, `public/style.css` | Responsive game shell and accessible controls |
| `public/assets/manifest.json` | Optional custom image overrides |
| `tests/engine.test.mjs` | Flight, collision, landing, delivery, scoring, pause, and life-cycle checks |
| `tests/routes.test.mjs` | Actual control-driven flights from the top center to every destination and back, without teleporting |
| `scripts/dev.mjs` | Development server and TypeScript watch process using Node built-ins |

The simulation runs at **120 Hz** independent of rendering rate. Long frame gaps are discarded to avoid catching up across obstacles. The physics has gravity and independent thrusters, with no artificial horizontal drag. Gear changes never reset velocity. Holding left or right with gear retracted tips the saucer toward 25 degrees in that direction; releasing the control immediately starts its return upright, even while coasting. Banking responds three times faster than the original velocity-based tilt; the hull and gear collision shapes remain upright. Expanding energy rings replace rocket exhaust. Touch inputs use pointer capture and clear on release/cancellation; keyboard and touch inputs can coexist.

## Add designer assets

The game ships with original procedural artwork; image replacements are optional. Put PNG, WebP, or SVG assets in `public/assets/` and edit `public/assets/manifest.json`:

```json
{
  "background": "/assets/alien-sky.webp",
  "saucer": "/assets/saucer.svg",
  "buildings": {
    "restaurant": "/assets/restaurant.svg",
    "gas": "/assets/gas-station.svg",
    "mushroom": "/assets/spore-house.svg",
    "observatory": "/assets/observatory.svg",
    "motel": "/assets/motel.svg",
    "crystal": "/assets/crystals.svg",
    "outpost": "/assets/outpost.svg"
  }
}
```

Omitted or failed images retain the built-in artwork. The background fits the **1280 × 760** world and renders behind all interactive objects. A transparent saucer image fits the **48 × 25** hull box, with its upper-left corner at `(ship.x − 24, ship.y − 17)`; gear, energy waves, and order indicators remain dynamic Canvas elements. Keep the hull silhouette consistent with `shipBody()` in `src/engine.ts`. Building images fit their rectangles from `src/world.ts`. If a designer changes a solid silhouette, update its collision geometry too. All island silhouettes use the same vertices for drawing and collision.

To add levels, extend `LEVELS` in `src/levels.ts` with pads, collision solids, a starting position, restaurant/gas-station IDs, and eligible destinations. `Game.start(skill, level)` selects the level; flight, services, and rendering use its geometry and station roles. Levels share the 1280 × 760 flight field. Skill order counts, random arrival ranges, and tip rates live in `SKILLS`; fuel tuning lives in `FUEL`. To change Zeta Prime locations or route spacing, edit `PADS` in `src/world.ts`. Route tests provide executable examples of paths through this level.
