# NBA Ball Race

Vertical (9:16) physics racing game for NBA social clips. Phase 2 of 5.

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

## Phase 2 includes

Everything from Phase 1 (seeded determinism, anti-stall, rubber band, Top 3 HUD,
winner screen) plus: dense course (gates, big dots, wider shelves, no free-fall
lanes), bouncier/faster physics with a tunneling-proof speed cap, zoomed camera
with horizontal leader tracking, a race setup panel (2-8 balls, names, colors,
image upload per ball), and Quick Record (REC button captures the race in the
seed field to a WebM in Downloads, named race_<names>_s<seed>.webm).

Record workflow: run NEW RACE until a finish you like, then hit REC: it replays
and records that exact race. Verified: 62s avg for 2 balls, 46-66s for 8 balls,
50/50 fairness over 80 races, zero stalls.

## Headless testing (optional, for Claude Code)

`npm install` then `node test/headless.mjs` (duration/determinism sweep),
`node test/fairness.mjs` (80-race win split), `node test/render.mjs` (frame renders,
needs `npm install @napi-rs/canvas`).

## Roadmap

Phase 3: headshot auto-fetch, courses + shuffle, templates, character library,
matchup/intro screens, survivor mode, fields up to 30.
Phase 4: offline MP4 HQ render, tournaments, stitching.
Phase 5: bias system + presets, polish.
