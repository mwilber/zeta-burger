# Development conventions

During development, level order behaves like a LIFO stack: the newest level is
played first. Prepend new levels to `LEVEL_CONFIG` in `src/level-config.ts`.
The array controls the starting level, selector order, and automatic progression.
Keep existing level numbers, IDs, and asset filenames stable when reordering.
The current order is Srormfront (11), Grotto (10), Freeman (9), Megalopolis (8), Abyss (7), Event Horizon (6), Zero G (5), Trick Or Treat (4), Obsession (3), Meteor Shower (2), then Luna (1).

Obsession introduces `seekers`: slow, animated cloud hazards that pass through
scenery and each other. They wander randomly while the ship is landed and pursue
it in flight. Landed ships are immune to seekers. Keep the generic name in code.

Trick Or Treat is a Halloween reskin of Obsession: identical layout and seeker
behavior, with white-sheet ghosts and decorated buildings in level-4 SVG assets.


Gravity is configured per level (`gravity`, world units/second²). Zero G (5)
uses 0; existing levels use 100. Its pads have optional orbital `motion` and
move as whole stations, including art and collisions. In zero gravity, hold
Down on a pad for 250 ms to clamp; releasing early floats away.
A clamped ship rides the station until upward thrust or gear retraction.
Zero G alone uses `thrustScale: .3` (70% less acceleration on every thruster).

Event Horizon (6) uses a central `blackHole` gravity well with inverse-square
pull capped near its fatal event horizon. Its seven stationary pads sit on the
periphery. It has no downward gravity and uses full thrust. Landing immediately
blocks the pull without holding Down or using fuel; upward thrust or gear
retraction restores it. Pickup/delivery take 250 ms. Keep black-hole artwork
aligned with its configured radius.

Abyss (7) is underwater with gravity 35 and a reversing horizontal `current`.
The current moves whole stations, including art and collisions; water drag
carries airborne ships even without fuel. Docked ships ride pads for free,
with normal pickup/delivery timing. Its fish use the generic seeker behavior:
pursue in flight, wander while landed, and never harm a landed ship.

Megalopolis (8) uses solid `structures` rising from street level as tower
barriers. Four pads sit on roofs (without islands) and three are attached
balconies with steel supports. Tower SVG artboards match the structure's exact
collision rectangle. Only numbered pads allow landing; all tower faces and
unmarked roof surfaces are fatal. Keep the upper flight lane and balcony
approach corridors clear. Gravity is 100, with full thrust and no seekers or
falling obstacles.

Freeman (9), named for Freeman Dyson, takes place inside a Dyson sphere. Its
central `star` shares Event Horizon’s inverse-square gravity and immediate free
docking, with half the strength and acceleration cap. Seven stationary pads use
the same peripheral layout. Gravity is 0 with full thrust, no seekers, and no
falling obstacles. The star’s visible surface matches its fatal radius; its
corona is decorative. Level-9 SVG assets show the sphere’s interior collectors.

Grotto (10) follows the mountain-cavern sketch: six pads, with the restaurant
outside in the upper left, a trailhead ledge above the entrance, and four pads
inside. Six reusable convex boulder shapes overlap to form the cavern walls,
central rock mass, and floor. Structure `outline` vertices use local world
units and must match their SVG silhouettes. Keep the entrance, routes around
both sides of the central mass, and lower passage navigable. Gravity is 100
with full thrust and no seekers or falling obstacles. Level-10 art has a blue
outdoor sky and recessed rocky cavern backdrop. Boulder geometry lives in
`src/grotto.ts`; after building, `node scripts/generate-grotto-art.mjs` regenerates
the matching SVG artwork.

Srormfront (11) is a thunderstorm with gravity 100, full thrust, and stationary
stations. Its `storm` config drives abrupt horizontal wind gusts using the same
drag model as Abyss, including with empty fuel; docked ships resist the wind.
Lightning always targets a landing pad and locks its jagged path at warning
start. Electrical arcs zap outward from that pad for 3.5 seconds, at 1, 2, 4,
then 8 sets/second, with a quiet zap for each set. Warning starts are 3.6–6.4
seconds apart (half the original strike frequency). Bolts flash for 180 ms with
thunder. Landed ships are immune; airborne hulls and gear are vulnerable. Sweep
collisions along each bolt segment. Dense, harmless blue rain renders in front of the whole scene. Weather
uses gameplay time, freezes on pause/countdown/end, and resets on restart.
Storm tuning and shared bolt geometry live in `src/storm.ts`; artwork uses -11.
