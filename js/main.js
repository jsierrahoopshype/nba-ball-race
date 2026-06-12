// App shell: editor panel, screen flow (ready -> countdown -> racing -> finished),
// fixed-timestep loop, and recording. Physics never depends on render rate.

import { CONFIG } from './config.js';
import { freshSeed } from './rng.js';
import { createRace } from './physics.js';
import { createCamera } from './camera.js';
import { drawWorld } from './draw.js';
import { drawLeaderboard, drawCountdown, drawWinner } from './hud.js';
import { PALETTE, contrastText } from './balls.js';
import { createRecorder } from './recorder.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.WORLD_W;
canvas.height = CONFIG.VIEW_H;
const ctx = canvas.getContext('2d');

const seedInput = document.getElementById('seed');
const btnRace = document.getElementById('btn-race');
const btnReplay = document.getElementById('btn-replay');
const btnNew = document.getElementById('btn-new');
const btnRec = document.getElementById('btn-rec');
const statusEl = document.getElementById('status');
const countSelect = document.getElementById('ball-count');
const ballRowsEl = document.getElementById('ball-rows');

const recorder = createRecorder(canvas);
if (!recorder.supported) btnRec.disabled = true;

// ---- Editor panel -------------------------------------------------------

const DEFAULT_NAMES = ['LBJ', 'SC', 'KD', 'GIA', 'LUKA', 'JOK', 'AE', 'WEMB'];
let ballSetup = []; // [{label, color, image}]

function initSetup(n) {
  const prev = ballSetup;
  ballSetup = [];
  for (let i = 0; i < n; i++) {
    ballSetup.push(prev[i] || {
      label: DEFAULT_NAMES[i] || `P${i + 1}`,
      color: PALETTE[i % PALETTE.length].color,
      image: null,
    });
  }
  renderRows();
}

function renderRows() {
  ballRowsEl.innerHTML = '';
  ballSetup.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'ball-row';

    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = 4;
    name.value = b.label;
    name.title = 'Name shown on the ball (max 4 chars)';
    name.addEventListener('input', () => { b.label = name.value; });

    const color = document.createElement('input');
    color.type = 'color';
    color.value = b.color;
    color.addEventListener('input', () => { b.color = color.value; updateChip(); });

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.id = `file-${i}`;
    file.className = 'file-hidden';
    file.addEventListener('change', () => {
      const f = file.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => { b.image = img; updateChip(); };
      img.src = URL.createObjectURL(f);
    });

    const fileBtn = document.createElement('label');
    fileBtn.htmlFor = file.id;
    fileBtn.className = 'btn small';
    fileBtn.textContent = 'IMG';

    const chip = document.createElement('span');
    chip.className = 'chip';

    function updateChip() {
      chip.style.background = b.color;
      chip.textContent = b.image ? '✓' : '';
    }
    updateChip();

    row.append(chip, name, color, fileBtn, file);
    ballRowsEl.appendChild(row);
  });
}

countSelect.addEventListener('change', () => initSetup(parseInt(countSelect.value, 10)));
initSetup(parseInt(countSelect.value, 10));

function currentConfigs() {
  return ballSetup.map((b, i) => ({
    id: `b${i + 1}`,
    label: b.label || `P${i + 1}`,
    color: b.color,
    textColor: contrastText(b.color),
    image: b.image,
  }));
}

// ---- Race state machine --------------------------------------------------

let race = null;
let camera = null;
let mode = 'idle';        // idle | countdown | racing | finished
let countdownT = 0;
let winnerT = 0;
let accumulator = 0;
let lastTime = null;
let recordingThisRace = false;
let downloadFired = false;

const COUNTDOWN_BEAT = 0.5;

function startRace(seed, record = false) {
  race = createRace(seed, currentConfigs());
  camera = createCamera(race.course.courseLength);
  const lead = race.balls[0];
  camera.update(lead.position.x, lead.position.y, true);
  mode = 'countdown';
  countdownT = 0;
  winnerT = 0;
  accumulator = 0;
  lastTime = null;
  downloadFired = false;
  recordingThisRace = record;
  seedInput.value = String(seed);
  btnReplay.disabled = false;
  statusEl.textContent = record ? `● REC | seed ${seed}` : `seed ${seed}`;
  if (record) recorder.start();
}

function finishRecording() {
  if (!recordingThisRace || downloadFired) return;
  downloadFired = true;
  const names = race.balls.map(b => b.plugin.ball.label.toLowerCase()).slice(0, 4).join('-');
  recorder.stop(`race_${names}_s${race.seed}.webm`).then(() => {
    statusEl.textContent = `saved race_${names}_s${race.seed}.webm to Downloads`;
  });
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!race) return;

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.25) dt = 0.25;

  if (mode === 'countdown') {
    countdownT += dt;
    if (countdownT >= COUNTDOWN_BEAT * 4) mode = 'racing';
  } else if (mode === 'racing') {
    accumulator += dt * 1000;
    while (accumulator >= CONFIG.STEP_MS) {
      race.tick();
      accumulator -= CONFIG.STEP_MS;
      if (race.finished) { mode = 'finished'; winnerT = 0; break; }
    }
  } else if (mode === 'finished') {
    winnerT += dt;
    if (winnerT > 2.2) finishRecording(); // winner screen held, clip complete
  }

  const leader = race.standings()[0];
  camera.update(leader.position.x, leader.plugin.ball.bestY);

  drawWorld(ctx, race, camera);
  drawLeaderboard(ctx, race.standings());

  if (mode === 'countdown') {
    const beat = Math.floor(countdownT / COUNTDOWN_BEAT);
    drawCountdown(ctx, Math.max(0, 3 - beat));
  } else if (mode === 'racing' && race.step < 45) {
    drawCountdown(ctx, 0);
  } else if (mode === 'finished') {
    drawWinner(ctx, race.winner, winnerT);
    if (!recordingThisRace) {
      statusEl.textContent = `seed ${race.seed} | winner: ${race.winner.plugin.ball.label} | ${(race.step / 60).toFixed(1)}s`;
    }
  }
}

btnRace.addEventListener('click', () => {
  const v = parseInt(seedInput.value, 10);
  startRace(Number.isFinite(v) ? (v >>> 0) : freshSeed());
});
btnReplay.addEventListener('click', () => { if (race) startRace(race.seed); });
btnNew.addEventListener('click', () => startRace(freshSeed()));
btnRec.addEventListener('click', () => {
  // Records the seed currently in the field (replay-record workflow:
  // find a great race, then hit REC to capture that exact race)
  const v = parseInt(seedInput.value, 10);
  startRace(Number.isFinite(v) ? (v >>> 0) : freshSeed(), true);
});

seedInput.value = String(freshSeed());
requestAnimationFrame(loop);
