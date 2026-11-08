# Infinite Night

## Architecture

The existing `index.html` remains the host for the Lipoip site. The game UI and browser runtime live in this directory and are loaded as a native ES module, so no build tool or third-party browser dependency is required. The Canvas simulation owns movement, spawning, attacks, upgrades and entity cleanup; the UI owns pages, HUD, touch controls and local history. Supabase is an optional persistence adapter: the local game remains playable without credentials.

Planned module boundaries as the game grows:

- `app.js`: screen navigation, input, Canvas rendering and current game loop.
- `engine.js`: deterministic simulation, entity lifecycle, weapons, enemy waves and progression.
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
