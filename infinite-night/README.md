# Infinite Night

## Architecture

The existing `index.html` remains the host for the Lipoip site. The game UI and browser runtime live in this directory and are loaded as native ES modules, so no build tool or third-party browser dependency is required. `engine.mjs` owns game state and simulation; `app.js` owns input, Canvas rendering, pages, HUD and persistence. `infinite-night-test.html` is a standalone entry point for the same `app.js`, not a second game implementation. Supabase is an optional persistence adapter: the local game remains playable without credentials.

Planned module boundaries as the game grows:

- `app.js`: screen navigation, input, Canvas rendering and browser game loop.
- `controls.mjs`: pure joystick coordinate mapping, shared by the touch handler and its unit tests.
- `engine.mjs`: simulation, entity lifecycle, weapons, enemy waves and progression. It accepts an injectable random function; normal play uses `Math.random` and the simulation tool uses a seeded generator.
- `simulate.mjs`: repeatable command-line runs with duration, seed, time step and a named movement policy; reports progression, entity density and update timing as JSON Lines.
- `benchmark.mjs`: synthetic worst-case engine-load benchmark with configurable enemy and gem counts. It does not measure Canvas rendering, browser input dispatch or device presentation.
- `engine.test.mjs`: built-in Node tests for determinism, simulation behavior and logical viewport spawning.
- `leaderboard.js`: local history and optional Supabase reads/submissions.
- `supabase/`: database schema and server-side submission validation.

## Dependencies

No dependencies are needed for the local game. The hosted backend uses Supabase Auth, Postgres and Edge Functions. Copy `config.example.js` to `config.js`, fill in the project URL and public anon/publishable key, then add `<script src="infinite-night/config.js"></script>` before the `app.js` module in `index.html`. Deploy the SQL migration and Edge Function, and enable email/password Auth in Supabase. Never put the service-role key in the browser.

## Data model

`profiles`: `id` (Auth user UUID, primary key), `username` (unique, normalized), `created_at`.

`runs`: `id` (UUID), `client_run_id` (idempotency UUID), `user_id` (nullable for future guest support), `username_snapshot`, `score` (server-derived), `survival_seconds`, `kills`, `level`, `created_at` (database time). Public reads are allowed; browser writes are denied. The submit RPC checks plausibility, computes score itself, and rate-limits repeat submissions. The server derives the score and blocks duplicate IDs, implausible statistics and rapid resubmissions. Because this prototype still simulates play in the browser, survival/kills/level are not cryptographically proven; a cheat-resistant public leaderboard still needs deterministic replay verification or server-authoritative simulation before it should be treated as a competition ranking.

## Development lots

1. Playable loop, controls, weapons and scalable entity cleanup.
2. Local history/profile/leaderboard and responsive game UI.
3. Supabase Auth, persistent global leaderboard and protected score submission.

Run the existing site through any static HTTP server (ES modules do not run reliably from `file://`).

Run the engine tests with `node --test infinite-night/engine.test.mjs`. Run simulation samples with `node infinite-night/simulate.mjs --minutes=1,10,30 --seeds=1,2`; movement policies are `kite` (moves away from nearby enemies and circles otherwise) and `stand` (no movement). Build policies are `first`, `blade`, `orbit`, `ember`, `bell`, `blood` and `guard`; targeted builds select the highest-priority matching upgrade among the three randomly offered choices, then fall back to the first offer. `--spawn-profile=classic|eased` compares the previous and adjusted spawn intervals. World spawns and upgrade offers use separate seeded streams in simulation, so changing wave frequency does not also reshuffle upgrade offers. The report includes every selected upgrade. Upgrade offers are sampled uniformly without replacement from the upgrades that are not capped. These policies are reproducible test strategies, not optimal or representative human play. Update timings depend on the machine running Node.

Run a saturated engine benchmark with `node infinite-night/benchmark.mjs --iterations=2400 --enemies=210 --gems=300`. The result includes mean, 95th percentile and maximum update duration, plus platform details. This isolates the simulation update; browser Canvas rendering and real touch interactions still require a browser/device check.

The first added relic pair adds two roles: `Cloche funèbre` deals periodic area damage around the player (rank 1–5), and `Sceau sanguin` restores 0.20 health per rank on each kill (rank 1–5). These values should be reassessed with real player sessions; simulation results do not replace hands-on balance testing.
