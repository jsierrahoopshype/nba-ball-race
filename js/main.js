// App shell: screen flow (ready -> countdown -> racing -> finished),
// fixed-timestep loop with an accumulator (render rate never affects physics),
// and the Phase 1 control bar (Race / Replay / New Race / seed field).

import { CONFIG } from './config.js';
import { freshSeed } from './rng.js';
import { createRace } from './physics.js';
import { createCamera } from './camera.js';
import { drawWorld } from './draw.js';
import { drawLeaderboard, drawCountdown, drawWinner } from './hud.js';
import { DEFAULT_BALLS } from './balls.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.WORLD_W;
canvas.height = CONFIG.VIEW_H;
const ctx = canvas.getContext('2d');

const seedInput = document.getElementById('seed');
const btnRace = document.getElementById('btn-race');
const btnReplay = document.getElementById('btn-replay');
const btnNew = document.getElementById('btn-new');
const statusEl = document.getElementById('status');

let race = null;
let camera = null;
let mode = 'idle';        // idle | countdown | racing | finished
let countdownT = 0;       // seconds elapsed in countdown
let winnerT = 0;          // seconds since winner decided
let accumulator = 0;
let lastTime = null;

const COUNTDOWN_BEAT = 0.5; // 3-2-1-GO at 0.5s each = 2s lead-in

function startRace(seed) {
  race = createRace(seed, DEFAULT_BALLS);
  camera = createCamera(race.course.courseLength);
  camera.update(race.balls[0].position.y, true);
  mode = 'countdown';
  countdownT = 0;
  winnerT = 0;
  accumulator = 0;
  lastTime = null;
  seedInput.value = String(seed);
  btnReplay.disabled = false;
  statusEl.textContent = `seed ${seed}`;
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!race) return;

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.25) dt = 0.25; // tab was backgrounded; don't fast-forward physics

  if (mode === 'countdown') {
    countdownT += dt;
    if (countdownT >= COUNTDOWN_BEAT * 4) mode = 'racing';
  } else if (mode === 'racing') {
    // Fixed timestep: physics always advances in exact STEP_MS slices
    accumulator += dt * 1000;
    while (accumulator >= CONFIG.STEP_MS) {
      race.tick();
      accumulator -= CONFIG.STEP_MS;
      if (race.finished) { mode = 'finished'; winnerT = 0; break; }
    }
  } else if (mode === 'finished') {
    winnerT += dt;
  }

  // Camera follows the leader
  const leader = race.standings()[0];
  camera.update(leader.plugin.ball.bestY);

  // Render
  drawWorld(ctx, race, camera.y);
  drawLeaderboard(ctx, race.standings());

  if (mode === 'countdown') {
    const beat = Math.floor(countdownT / COUNTDOWN_BEAT); // 0,1,2,3
    drawCountdown(ctx, Math.max(0, 3 - beat));
  } else if (mode === 'racing' && race.step < 45) {
    drawCountdown(ctx, 0); // GO! lingers briefly into the race
  } else if (mode === 'finished') {
    drawWinner(ctx, race.winner, winnerT);
    statusEl.textContent = `seed ${race.seed} | winner: ${race.winner.plugin.ball.label} | ${(race.step / 60).toFixed(1)}s`;
  }
}

btnRace.addEventListener('click', () => {
  const v = parseInt(seedInput.value, 10);
  startRace(Number.isFinite(v) ? (v >>> 0) : freshSeed());
});
btnReplay.addEventListener('click', () => {
  if (race) startRace(race.seed); // exact same race, bounce for bounce
});
btnNew.addEventListener('click', () => startRace(freshSeed()));

// Boot with a fresh race ready to go
seedInput.value = String(freshSeed());
requestAnimationFrame(loop);
