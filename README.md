# NBA Ball Race

Vertical (9:16) physics racing game for NBA social clips. Phase 2.36 of 5.

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

## Phase 2.1 includes

Dense, wall-to-wall course (peg fields, gates, serpentine ledges, stacked rings,
diamonds, spinners, bounce zones) modeled on the reference. Bouncier/faster
physics with a tunneling-proof speed cap and an escalating direction-aware
anti-stall failsafe. Zoomed leader-tracking camera. Race setup panel: 2-8 balls,
per-ball name + color + IMAGE. Three ways to put a face/logo in a ball:
  - Picker: type a player ("LeBron James") or team ("Lakers (logo)"); pulls the
    NBA headshot / team logo automatically.
  - IMG button: upload your own image.
  - (color + initials if no image)
Quick Record (REC) captures the race in the seed field to a WebM in Downloads.

Verified headlessly: 62s avg / 52-84s range for 2 balls, 44-54s for 8 balls,
41/39 win split over 80 races, zero stalls, determinism exact. Editor count->config
path and DOM wiring covered by test/setup.test.mjs and test/dom.test.mjs.

IMPORTANT - cache busting: index.html loads JS with ?v=N query strings. When you
deploy a new version, bump those numbers (or hard-refresh with Ctrl+Shift+R), or
the browser may keep serving the old cached JS. (That cache is exactly what made
the ball selector and REC look broken last build.)

## Headless testing (optional, for Claude Code)

`npm install` then `node test/headless.mjs` (duration/determinism sweep),
`node test/fairness.mjs` (80-race win split), `node test/setup.test.mjs` and
`node test/dom.test.mjs` (editor logic + DOM wiring, needs `npm install jsdom`),
`node test/render.mjs` (frame renders, needs `npm install @napi-rs/canvas`).

## Roadmap

Phase 3: headshot auto-fetch, courses + shuffle, templates, character library,
matchup/intro screens, survivor mode, fields up to 30.
Phase 4: offline MP4 HQ render, tournaments, stitching.
Phase 5: bias system + presets, polish.
