# Development conventions

During development, level order behaves like a LIFO stack: the newest level is
played first. Prepend new levels to `LEVEL_CONFIG` in `src/level-config.ts`.
The array controls the starting level, selector order, and automatic progression.
Keep existing level numbers, IDs, and asset filenames stable when reordering.
The current order is Abyss (7), Event Horizon (6), Zero G (5), Trick Or Treat (4), Obsession (3), Meteor Shower (2), then Luna (1).

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
