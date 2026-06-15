// App shell: editor (count + per-ball name/color/picker/upload), screen flow,
// fixed-timestep loop, and recording. Editor state lives in setup.js (pure,
// tested); this file only wires the DOM to it.

import { CONFIG } from './config.js';
import { freshSeed } from './rng.js';
import { createRace } from './physics.js';
import { createCamera } from './camera.js';
import { drawWorld } from './draw.js';
import { drawLeaderboard, drawCountdown, drawWinner, drawMatchup } from './hud.js';
import { createRecorder } from './recorder.js';
import { createSetup } from './setup.js';
import { loadImage } from './images.js';
import { PLAYERS, TEAMS, HEADSHOT_URL, TEAM_LOGO_URL } from './rosters.js';

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
const winModeSelect = document.getElementById('win-mode');
const hookInput = document.getElementById('hook-text');
const showIntroChk = document.getElementById('show-intro');
const coursePresetSelect = document.getElementById('course-preset');
const bgTypeSelect = document.getElementById('bg-type');
const bgFile = document.getElementById('bg-file');
const bgImgBtn = document.getElementById('bg-img-btn');

let bgImage = null; // uploaded background image, if any
bgTypeSelect.addEventListener('change', () => {
  bgImgBtn.style.display = bgTypeSelect.value === 'upload' ? '' : 'none';
});
bgFile.addEventListener('change', () => {
  const f = bgFile.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => { bgImage = img; bgTypeSelect.value = 'upload'; bgImgBtn.style.display = ''; };
  img.src = URL.createObjectURL(f);
});

function currentBg() {
  const type = bgTypeSelect.value;
  if (type === 'upload') return { type, image: bgImage };
  return { type };
}

const recorder = createRecorder(canvas);
if (!recorder.supported) { btnRec.disabled = true; btnRec.title = 'Recording not supported in this browser'; }

const setup = createSetup(parseInt(countSelect.value, 10));

// Shared <datalist> of pickable players + teams (native searchable dropdown)
const pickList = document.getElementById('pick-list');
for (const [, full] of PLAYERS) {
  const o = document.createElement('option'); o.value = full; pickList.appendChild(o);
}
for (const [, name] of TEAMS) {
  const o = document.createElement('option'); o.value = `${name} (logo)`; pickList.appendChild(o);
}

const playerByName = new Map(PLAYERS.map(p => [p[1].toLowerCase(), p]));
const teamByLabel = new Map(TEAMS.map(t => [`${t[1].toLowerCase()} (logo)`, t]));

// Resolve a typed pick to an image + short label, async. Falls back silently.
async function applyPick(i, raw, row) {
  const key = raw.trim().toLowerCase();
  const player = playerByName.get(key);
  const team = teamByLabel.get(key);
  row.classList.add('loading');
  try {
    if (player) {
      const [short, , id, file] = player;
      const img = await loadImage(HEADSHOT_URL(file));
      if (img) { setup.setImage(i, img, `player:${id}`, 'face'); setup.setName(i, short); setup.setFullName(i, player[1].split(' ').slice(-1)[0]); syncRow(row, i); }
      else status(`couldn't load ${player[1]} headshot (id may need a fix)`);
    } else if (team) {
      const [abbr, name] = team;
      const img = await loadImage(TEAM_LOGO_URL(abbr));
      if (img) { setup.setImage(i, img, `team:${abbr}`, 'cover'); setup.setName(i, abbr); syncRow(row, i); }
      else status(`couldn't load ${name} logo`);
    }
  } finally {
    row.classList.remove('loading');
  }
}

function syncRow(row, i) {
  const b = setup.balls[i];
  row.querySelector('.name').value = b.label;
  const chip = row.querySelector('.chip');
  chip.style.background = b.color;
  chip.textContent = b.image ? '✓' : '';
}

function renderRows() {
  ballRowsEl.innerHTML = '';
  setup.balls.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'ball-row';

    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = b.color;
    chip.textContent = b.image ? '✓' : '';

    const name = document.createElement('input');
    name.type = 'text'; name.maxLength = 5; name.value = b.label; name.className = 'name';
    name.title = 'Label shown on the ball';
    name.addEventListener('input', () => setup.setName(i, name.value));

    const color = document.createElement('input');
    color.type = 'color'; color.value = b.color;
    color.addEventListener('input', () => { setup.setColor(i, color.value); chip.style.background = color.value; });

    const pick = document.createElement('input');
    pick.type = 'text'; pick.className = 'pick';
    pick.setAttribute('list', 'pick-list');
    pick.placeholder = 'player or team…';
    pick.addEventListener('change', () => applyPick(i, pick.value, row));

    const file = document.createElement('input');
    file.type = 'file'; file.accept = 'image/*'; file.id = `file-${i}`; file.className = 'file-hidden';
    file.addEventListener('change', () => {
      const f = file.files[0]; if (!f) return;
      const img = new Image();
      img.onload = () => { setup.setImage(i, img, 'upload', 'cover'); chip.textContent = '✓'; };
      img.src = URL.createObjectURL(f);
    });
    const fileBtn = document.createElement('label');
    fileBtn.htmlFor = file.id; fileBtn.className = 'btn small'; fileBtn.textContent = 'IMG';

    const clear = document.createElement('button');
    clear.className = 'btn small ghost'; clear.textContent = '×'; clear.title = 'Clear image';
    clear.addEventListener('click', () => { setup.clearImage(i); pick.value = ''; chip.textContent = ''; });

    row.append(chip, name, color, pick, fileBtn, file, clear);
    ballRowsEl.appendChild(row);
  });
}

countSelect.addEventListener('change', () => { setup.setCount(parseInt(countSelect.value, 10)); renderRows(); autoloadFaces(); });
renderRows();

// Auto-load headshots for any ball whose label matches a known player short-name,
// so default races show faces (like the reference) without the user picking.
// Safe: a failed fetch leaves the color+initials fallback untouched.
const playerByShort = new Map(PLAYERS.map(p => [p[0], p]));
function autoloadFaces() {
  setup.balls.forEach((b, i) => {
    if (b.image) return;
    const p = playerByShort.get((b.label || '').toUpperCase());
    if (!p) return;
    loadImage(HEADSHOT_URL(p[3])).then(img => {
      if (img && !setup.balls[i].image) {
        setup.setImage(i, img, `player:${p[2]}`, 'face'); setup.setFullName(i, p[1].split(' ').slice(-1)[0]); // p[1]=full name
        const row = ballRowsEl.children[i];
        if (row) { const chip = row.querySelector('.chip'); if (chip) chip.textContent = '✓'; }
      }
    });
  });
}
autoloadFaces();

function status(msg) { statusEl.textContent = msg; }

// ---- Race state machine --------------------------------------------------

let race = null, camera = null, mode = 'idle';
let countdownT = 0, winnerT = 0, accumulator = 0, lastTime = null, introT = 0;
let recordingThisRace = false, downloadFired = false;
let raceHook = '', raceMode = 'finish';
const COUNTDOWN_BEAT = 0.5;
const INTRO_S = 1.4;

function startRace(seed, record = false) {
  raceMode = winModeSelect.value === 'survivor' ? 'survivor' : 'finish';
  raceHook = hookInput.value || '';
  const racePreset = coursePresetSelect ? coursePresetSelect.value : 'classic';
  race = createRace(seed, setup.toConfigs(), { mode: raceMode, preset: racePreset });
  race.bg = currentBg();
  camera = createCamera(race.course.courseLength);
  const lead = race.balls[0];
  camera.update(lead.position.x, lead.position.y, true);
  mode = (showIntroChk && !showIntroChk.checked) ? 'countdown' : 'intro';
  introT = 0; countdownT = 0; winnerT = 0; accumulator = 0; lastTime = null;
  downloadFired = false; recordingThisRace = record;
  seedInput.value = String(seed);
  btnReplay.disabled = false;
  if (record) {
    try { recorder.start(); status(`● REC | seed ${seed}`); }
    catch (e) { recordingThisRace = false; status(`record failed: ${e.message}`); }
  } else {
    status(`seed ${seed}`);
  }
}

function finishRecording() {
  if (!recordingThisRace || downloadFired) return;
  downloadFired = true;
  const names = race.balls.map(b => b.plugin.ball.label.toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 4).join('-');
  recorder.stop(`race_${names}_s${race.seed}.webm`)
    .then(ok => status(ok ? `saved race_${names}_s${race.seed}.webm to Downloads` : 'recording stopped (no data)'))
    .catch(e => status(`save failed: ${e.message}`));
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!race) return;
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000; lastTime = now;
  if (dt > 0.25) dt = 0.25;

  if (mode === 'intro') {
    introT += dt;
    if (introT >= INTRO_S) mode = 'countdown';
    drawMatchup(ctx, race.balls, raceHook, race.mode);
    return;
  } else if (mode === 'countdown') {
    countdownT += dt;
    if (countdownT >= COUNTDOWN_BEAT * 4) mode = 'racing';
  } else if (mode === 'racing') {
    accumulator += dt * 1000;
    while (accumulator >= CONFIG.STEP_MS) {
      race.tick(); accumulator -= CONFIG.STEP_MS;
      if (race.finished) { mode = 'finished'; winnerT = 0; break; }
    }
  } else if (mode === 'finished') {
    winnerT += dt;
    if (winnerT > 3.2) finishRecording();
  }

  const order = race.standings();
  const active = order.find(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated) || order[0];
  camera.update(active.position.x, active.plugin.ball.bestY);

  drawWorld(ctx, race, camera);
  drawLeaderboard(ctx, race.standings());

  if (mode === 'countdown') {
    drawCountdown(ctx, Math.max(0, 3 - Math.floor(countdownT / COUNTDOWN_BEAT)));
  } else if (mode === 'racing' && race.step < 45) {
    drawCountdown(ctx, 0);
  } else if (mode === 'finished') {
    drawWinner(ctx, race.standings(), winnerT);
    if (!recordingThisRace) status(`seed ${race.seed} | winner: ${race.winner.plugin.ball.label} | ${(race.winner.plugin.ball.finishStep / 60).toFixed(1)}s`);
  }
}

btnRace.addEventListener('click', () => {
  const v = parseInt(seedInput.value, 10);
  startRace(Number.isFinite(v) ? (v >>> 0) : freshSeed());
});
btnReplay.addEventListener('click', () => { if (race) startRace(race.seed); });
btnNew.addEventListener('click', () => startRace(freshSeed()));
btnRec.addEventListener('click', () => {
  const v = parseInt(seedInput.value, 10);
  startRace(Number.isFinite(v) ? (v >>> 0) : freshSeed(), true);
});

seedInput.value = String(freshSeed());
requestAnimationFrame(loop);

// ---- Templates: save/load editor config as JSON --------------------------
// Saves labels, colors, image *references* (player/team), and all the race
// options. Uploaded ball/bg images can't be serialized, so they're skipped and
// the ball falls back to its color until re-picked.
const playerById = new Map(PLAYERS.map(p => [String(p[2]), p]));
const teamByAbbr = new Map(TEAMS.map(t => [t[0], t]));

function buildTemplate() {
  return {
    app: 'nba-ball-race', version: 1,
    count: setup.count,
    mode: winModeSelect.value,
    hook: hookInput.value || '',
    showIntro: !!(showIntroChk && showIntroChk.checked),
    course: coursePresetSelect ? coursePresetSelect.value : 'classic',
    bg: bgTypeSelect ? bgTypeSelect.value : 'sky',
    balls: setup.balls.map(b => ({
      label: b.label, name: b.name || '', color: b.color,
      source: b.source || null, imageFit: b.imageFit || 'cover',
    })),
  };
}

document.getElementById('btn-save-tpl').addEventListener('click', () => {
  const data = JSON.stringify(buildTemplate(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ballrace-template-${setup.count}balls.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  status('template saved to Downloads');
});

const tplFile = document.getElementById('tpl-file');
tplFile.addEventListener('change', () => {
  const f = tplFile.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { applyTemplate(JSON.parse(reader.result)); }
    catch (e) { status(`couldn't load template: ${e.message}`); }
    tplFile.value = '';
  };
  reader.readAsText(f);
});

function applyTemplate(t) {
  if (!t || !Array.isArray(t.balls)) { status('not a valid template'); return; }
  const n = Math.max(2, Math.min(30, t.count || t.balls.length));
  setup.setCount(n);
  countSelect.value = String(n);
  t.balls.slice(0, n).forEach((bt, i) => {
    setup.setName(i, bt.label || `P${i + 1}`);
    if (bt.name) setup.setFullName(i, bt.name);
    if (bt.color) setup.setColor(i, bt.color);
    setup.clearImage(i);
    // re-fetch image from its reference (uploads can't be restored)
    const src = bt.source || '';
    if (src.startsWith('player:')) {
      const p = playerById.get(src.slice(7));
      if (p) loadImage(HEADSHOT_URL(p[3])).then(img => { if (img) { setup.setImage(i, img, src, 'face'); refreshChip(i); } });
    } else if (src.startsWith('team:')) {
      const tm = teamByAbbr.get(src.slice(5));
      if (tm) loadImage(TEAM_LOGO_URL(tm[0])).then(img => { if (img) { setup.setImage(i, img, src, 'cover'); refreshChip(i); } });
    }
  });
  if (t.mode) winModeSelect.value = t.mode;
  hookInput.value = t.hook || '';
  if (showIntroChk) showIntroChk.checked = t.showIntro !== false;
  if (coursePresetSelect && t.course) coursePresetSelect.value = t.course;
  if (bgTypeSelect && t.bg) { bgTypeSelect.value = t.bg; bgImgBtn.style.display = t.bg === 'upload' ? '' : 'none'; }
  renderRows();
  status(`template loaded (${n} balls)`);
}

function refreshChip(i) {
  const row = ballRowsEl.children[i];
  if (row) { const chip = row.querySelector('.chip'); if (chip) chip.textContent = '✓'; }
}
