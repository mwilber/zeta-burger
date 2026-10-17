# Development conventions

During development, level order behaves like a LIFO stack: the newest level is
played first. Prepend new levels to `LEVEL_CONFIG` in `src/level-config.ts`.
The array controls the starting level, selector order, and automatic progression.
Keep existing level numbers, IDs, and asset filenames stable when reordering.
The current order is Obsession (3), Meteor Shower (2), then Luna (1).

Obsession introduces `seekers`: slow, animated cloud hazards that pass through
scenery and each other. They wander randomly while the ship is landed and pursue
it in flight. Landed ships are immune to seekers. Keep the generic name in code.
