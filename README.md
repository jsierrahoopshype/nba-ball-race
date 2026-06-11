# NBA Ball Race

Vertical (9:16) physics racing game for NBA social clips. Phase 1 of 5.

## Run it

GitHub Pages (recommended): create a repo, upload everything except `node_modules/`,
enable Pages on main. Open the URL. That's it: no build step, no install.

Note: opening index.html directly from disk will NOT work (ES modules need a server).
Always test through the GitHub Pages URL.

## Controls

- RACE: run the seed shown in the seed field
- REPLAY: re-run the exact same race, bounce for bounce
- NEW RACE: fresh random seed
- Paste any seed into the field + RACE to bring back a past race

## Phase 1 includes

Fixed-timestep Matter.js physics, fully seeded/deterministic (replays are exact),
one preset course (~60s for 2 balls, verified 50-70s across seeds, zero stalls),
leader-follow camera, anti-stall failsafe, moderate rubber band, sticky shelves,
spinners, countdown, Top 3 leaderboard, winner screen.

## Headless testing (optional, for Claude Code)

`npm install` then `node test/headless.mjs` (duration/determinism sweep),
`node test/fairness.mjs` (80-race win split), `node test/render.mjs` (frame renders,
needs `npm install @napi-rs/canvas`).

## Roadmap

Phase 2: HUD polish, field sizes 2-30, survivor mode, matchup/intro screens.
Phase 3: editor panel, headshots/logos, courses + shuffle, templates, character library.
Phase 4: recording (WebM quick + offline MP4 HQ), tournaments, stitching.
Phase 5: bias system + presets, polish.
