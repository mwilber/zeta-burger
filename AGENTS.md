# Development conventions

During development, level order behaves like a LIFO stack: the newest level is
played first. Prepend new levels to `LEVEL_CONFIG` in `src/level-config.ts`.
The array controls the starting level, selector order, and automatic progression.
Keep existing level numbers, IDs, and asset filenames stable when reordering.
The current order is Zero G (5), Trick Or Treat (4), Obsession (3), Meteor Shower (2), then Luna (1).

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
Zero G alone uses `thrustScale: .75` (25% less acceleration on every thruster).
