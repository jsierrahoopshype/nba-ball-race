// App shell: editor (count + per-ball name/color/picker/upload), screen flow,
// fixed-timestep loop, and recording. Editor state lives in setup.js (pure,
// tested); this file only wires the DOM to it.

import { CONFIG } from './config.js';
import { freshSeed } from './rng.js';
import { createRace } from './physics.js';
import { createCamera } from './camera.js';
import { drawWorld } from './draw.js';
import { drawLeaderboard, drawCountdown, drawWinner, drawMatchup, drawTournamentCard, drawRaceClock, drawQualifierCard } from './hud.js';
import { exportHQ, webCodecsSupported } from './hqexport.js';
import { createRecorder } from './recorder.js';
import { createSetup } from './setup.js';
import { loadImage } from './images.js';
import { PLAYERS, TEAMS, HEADSHOT_URL, TEAM_LOGO_URL, TEAM_COLORS, teamColorsForPlayer } from './rosters.js';

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
const biasPresetSelect = document.getElementById('bias-preset');

// Build the bias config: per-ball luck + the chosen preset. Invisible at runtime.
function currentBias() {
  const preset = biasPresetSelect ? biasPresetSelect.value : 'none';
  const luck = {};
  setup.balls.forEach((b, i) => { if (b.luck && b.luck !== 1) luck[`b${i + 1}`] = b.luck; });
  let hateId = null;
  if (preset === 'lebronhate') {
    const idx = setup.balls.findIndex(b => /lebron|lbj/i.test(`${b.name || ''} ${b.label || ''}`));
    hateId = `b${(idx >= 0 ? idx : 0) + 1}`;
  }
  return { preset, luck, hateId };
}
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
      if (img) {
        setup.setImage(i, img, `player:${id}`, 'face'); setup.setName(i, short); setup.setFullName(i, player[1]);
        const tc = teamColorsForPlayer(id);
        if (tc) { setup.setColor(i, tc[0]); setup.setColor2(i, tc[1]); }
        syncRow(row, i);
      }
      else status(`couldn't load ${player[1]} headshot (id may need a fix)`);
    } else if (team) {
      const [abbr, name] = team;
      const img = await loadImage(TEAM_LOGO_URL(abbr));
      if (img) {
        setup.setImage(i, img, `team:${abbr}`, 'cover'); setup.setName(i, abbr);
        const tc = TEAM_COLORS[abbr];
        if (tc) { setup.setColor(i, tc[0]); setup.setColor2(i, tc[1]); }
        syncRow(row, i);
      }
      else status(`couldn't load ${name} logo`);
    } else if (raw.trim()) {
      // Not a known player or team: treat it as a custom racer (e.g. a draft
      // prospect). Keep any image already uploaded via IMG; use the full typed
      // name in the ranking, and a short label on the ball.
      const words = raw.trim().split(/\s+/);
      setup.setFullName(i, raw.trim());
      if (!setup.balls[i].image) setup.setName(i, words[words.length - 1].slice(0, 5).toUpperCase());
      syncRow(row, i);
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

    // Bias: per-ball luck (0.5–2x). Neutral at 1. Invisible during the race.
    const luckWrap = document.createElement('label');
    luckWrap.className = 'luck';
    const luck = document.createElement('input');
    luck.type = 'range'; luck.min = '0.5'; luck.max = '2'; luck.step = '0.1';
    luck.value = String(b.luck || 1);
    const luckVal = document.createElement('span');
    luckVal.className = 'luck-val'; luckVal.textContent = `${(b.luck || 1).toFixed(1)}x`;
    luck.title = 'Luck: shifts this ball\u2019s odds (never guarantees)';
    luck.addEventListener('input', () => {
      const v = parseFloat(luck.value); setup.setLuck(i, v);
      luckVal.textContent = `${v.toFixed(1)}x`;
      luckVal.style.color = v > 1 ? '#4ad17a' : (v < 1 ? '#e2683b' : '#9a9aa6');
    });
    luckVal.style.color = (b.luck || 1) > 1 ? '#4ad17a' : ((b.luck || 1) < 1 ? '#e2683b' : '#9a9aa6');
    luckWrap.append(luck, luckVal);

    row.append(chip, name, color, pick, fileBtn, file, clear, luckWrap);
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
        setup.setImage(i, img, `player:${p[2]}`, 'face'); setup.setFullName(i, p[1]); // p[1]=full name
        const tc = teamColorsForPlayer(p[2]);
        if (tc) { setup.setColor(i, tc[0]); setup.setColor2(i, tc[1]); }
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
let tournament = null, winnerRecorded = false, cardT = 0;
const tournamentSelect = document.getElementById('tournament');
const CARD_S = 2.4;
let raceHook = '', raceMode = 'finish';
const COUNTDOWN_BEAT = 0.5;
const INTRO_S = 1.4;

function startRace(seed, record = false, configsOverride = null, countdownOverride = null, lengthScaleOverride = null, tailSOverride = null) {
  raceMode = winModeSelect.value === 'survivor' ? 'survivor' : 'finish';
  raceHook = hookInput.value || '';
  const racePreset = coursePresetSelect ? coursePresetSelect.value : 'classic';
  const timeLimitEl = document.getElementById('time-limit');
  const uiCountdown = timeLimitEl ? (parseInt(timeLimitEl.value, 10) || 0) : 0;
  const countdownS = countdownOverride != null ? countdownOverride : uiCountdown;
  const lengthScale = lengthScaleOverride != null ? lengthScaleOverride : 1;
  const tailS = tailSOverride != null ? tailSOverride : 0;
  const configs = configsOverride || setup.toConfigs();
  const raceOpts = { mode: raceMode, preset: racePreset, analysts: buildAnalystsForRace(), bias: currentBias(), countdownS, lengthScale, tailS };
  race = createRace(seed, configs, raceOpts);
  race.bg = currentBg();
  // remember exactly how this race was built so HQ export reproduces it
  race._params = {
    seed, configs, opts: { ...raceOpts, bg: race.bg },
    hook: raceHook, showIntro: !!(showIntroChk && showIntroChk.checked),
  };
  camera = createCamera(race.course.courseLength);
  const lead = race.balls[0];
  camera.update(lead.position.x, lead.position.y, true, race.balls);
  mode = 'countdown'; // no intro card: go straight to the WHO WINS? countdown
  introT = 0; countdownT = 0; winnerT = 0; accumulator = 0; lastTime = null;
  winnerRecorded = false; cardT = 0;
  downloadFired = false;
  seedInput.value = String(seed);
  btnReplay.disabled = false;
  if (record) {
    try { recorder.start(); recordingThisRace = true; status(`● REC | seed ${seed}`); }
    catch (e) { recordingThisRace = false; status(`record failed: ${e.message}`); }
  } else if (!recordingThisRace) {
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

  if (mode === 'countdown') {
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
    // Record the result into the series exactly once.
    if (tournament && tournament.type === 'qualifier' && !tournament.championId && !winnerRecorded) {
      winnerRecorded = true;
      resolveQualifierRound();
    } else if (tournament && !tournament.championId && !winnerRecorded && race.winner) {
      winnerRecorded = true;
      const id = race.winner.plugin.ball.id;
      tournament.wins[id] = (tournament.wins[id] || 0) + 1;
      const need = Math.ceil(tournament.format / 2);
      if (tournament.wins[id] >= need || tournament.raceNum >= tournament.format) {
        tournament.championId = Object.keys(tournament.wins).sort((a, b) => tournament.wins[b] - tournament.wins[a])[0];
      }
    }
    if (winnerT > 3.2) {
      // A single race ends here. A series keeps recording through every round and
      // only stops after the champion finale (handled in champion mode).
      if (!tournament) finishRecording();
      if (tournament && !tournament.championId) { mode = 'roundcard'; cardT = 0; }
      else if (tournament && tournament.championId) { mode = 'champion'; cardT = 0; }
    }
  } else if (mode === 'roundcard') {
    cardT += dt;
    if (tournament.type === 'qualifier') drawQualifierCard(ctx, qualifierInfo(), 'round');
    else drawTournamentCard(ctx, tournamentInfo(), false);
    if (cardT >= CARD_S) {
      if (tournament.type === 'qualifier') {
        tournament.round++;
        // The final is reached once 3 or fewer balls have qualified.
        const isFinal = tournament.roster.length <= 3;
        tournament.currentIsFinal = isFinal;
        startRace((tournament.baseSeed + tournament.round * 7919) >>> 0, false,
          tournament.roster, isFinal ? 0 : tournament.qualifyS, isFinal ? 1 : tournament.qScale,
          isFinal ? 45 : null);
      } else {
        tournament.raceNum++;
        startRace((tournament.baseSeed + tournament.raceNum * 7919) >>> 0);
      }
    }
    return;
  } else if (mode === 'champion') {
    cardT += dt;
    const champBall = tournament.type === 'qualifier'
      ? (tournament.championBall || race.winner)
      : (race.balls.find(b => b.plugin.ball.id === tournament.championId) || race.winner);
    drawQualifierCard(ctx, { championBall: champBall }, 'champion', cardT);
    // Record through the finale, then stop and save the whole-series clip.
    if (cardT > 6) finishRecording();
    status('series champion crowned');
    return;
  }

  const order = race.standings();
  const active = order.find(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated) || order[0];
  camera.update(active.position.x, active.plugin.ball.bestY, false, race.balls);

  drawWorld(ctx, race, camera);
  drawLeaderboard(ctx, race.standings());

  if (mode === 'countdown') {
    drawCountdown(ctx, Math.max(0, 3 - Math.floor(countdownT / COUNTDOWN_BEAT)), raceHook);
  } else if (mode === 'racing' && race.step < 45) {
    drawCountdown(ctx, 0, raceHook);
  } else if (mode === 'finished') {
    drawWinner(ctx, race.standings(), winnerT);
    if (!recordingThisRace) status(`seed ${race.seed} | winner: ${race.winner.plugin.ball.label} | ${(race.winner.plugin.ball.finishStep / 60).toFixed(1)}s`);
  }
  // Running clock for time-limit mode, shown once the GO! countdown clears.
  if (race.countdownSteps && (mode === 'racing' || mode === 'finished') && !(mode === 'racing' && race.step < 45)) {
    drawRaceClock(ctx, (race.countdownSteps - race.step) / 60);
  }
}

// Snapshot of the series for the round/champion cards (uses current race balls).
function tournamentInfo() {
  return {
    format: tournament.format, raceNum: tournament.raceNum,
    wins: tournament.wins, balls: race.balls, championId: tournament.championId,
  };
}

// Begin from the UI: start a single race, or kick off a tournament series.
function beginRace(seed, record = false) {
  // A fresh race/series: clear any prior recording state. For a series, recording
  // (when requested) spans every round through the champion finale.
  recordingThisRace = false; downloadFired = false;
  const sv = tournamentSelect ? tournamentSelect.value : '1';
  if (sv === 'qual') {
    const timeLimitEl = document.getElementById('time-limit');
    let qS = timeLimitEl ? (parseInt(timeLimitEl.value, 10) || 0) : 0;
    if (!qS) qS = 30; // a qualifier needs a cutoff; default to 30s if none chosen
    // Scale the heat course so roughly half the field finishes under the cutoff,
    // whatever cutoff was chosen (a fixed-length course makes the cutoff useless).
    const qScale = Math.min(0.7, Math.max(0.2, qS / 100));
    const roster = setup.toConfigs();
    const firstIsFinal = roster.length <= 3;
    tournament = {
      type: 'qualifier', round: 1, qualifyS: qS, qScale,
      roster, baseSeed: seed >>> 0, championId: null,
      advancersBalls: [], championBall: null, lastQualified: 0,
      currentIsFinal: firstIsFinal,
    };
    startRace(seed, record, roster, firstIsFinal ? 0 : qS, firstIsFinal ? 1 : qScale, firstIsFinal ? 45 : null);
  } else {
    const format = parseInt(sv, 10) || 1;
    tournament = format > 1
      ? { type: 'bestof', format, raceNum: 1, wins: {}, baseSeed: seed >>> 0, championId: null }
      : null;
    startRace(seed, record);
  }
}

// Rebuild a config from a finished ball so qualifiers can re-race next round.
function ballToConfig(p) {
  return {
    id: p.id, label: p.name || p.label, name: p.name || p.label,
    color: p.color, color2: p.color2, textColor: p.textColor,
    image: p.image, imageFit: p.imageFit,
  };
}

// Decide what happens after the round that just ran. The final (no buzzer) is
// reached once 3 or fewer balls have qualified; its winner is champion.
// Qualifying rounds: only balls that crossed the line before the buzzer advance.
function resolveQualifierRound() {
  if (tournament.currentIsFinal) {
    tournament.championBall = race.winner;
    tournament.championId = race.winner ? race.winner.plugin.ball.id : null;
    return;
  }
  // Qualify = finish before the buzzer. At most HALF the field advances each
  // round (the fastest finishers), even if everyone makes the time.
  const crossed = race.balls.filter(b => b.plugin.ball.crossed)
    .sort((a, b) => a.plugin.ball.finishStep - b.plugin.ball.finishStep);
  const cap = Math.floor(race.balls.length / 2);
  let advBalls = crossed.slice(0, cap);
  // Safety: if nobody finished in time, carry the closest few so the series
  // can't dead-end.
  if (advBalls.length === 0) advBalls = race.standings().slice(0, Math.min(Math.max(cap, 1), 3));
  tournament.advancersBalls = advBalls;
  tournament.lastQualified = advBalls.length;
  tournament.roster = advBalls.map(b => ballToConfig(b.plugin.ball));
}

function qualifierInfo() {
  return {
    round: tournament.round,
    finalNext: tournament.roster.length <= 3,
    qualifyS: tournament.qualifyS, advancers: tournament.advancersBalls || [],
    championBall: tournament.championBall || race.winner,
  };
}

btnRace.addEventListener('click', () => {
  const v = parseInt(seedInput.value, 10);
  beginRace(Number.isFinite(v) ? (v >>> 0) : freshSeed());
});
btnReplay.addEventListener('click', () => { if (race) { tournament = null; startRace(race.seed); } });
btnNew.addEventListener('click', () => beginRace(freshSeed()));
btnRec.addEventListener('click', () => {
  const v = parseInt(seedInput.value, 10);
  beginRace(Number.isFinite(v) ? (v >>> 0) : freshSeed(), true);
});

// HQ MP4: offline deterministic render of the current race (or the current
// editor setup if none has run yet) to a full-quality MP4.
const btnHq = document.getElementById('btn-hq');
let hqBusy = false;
btnHq.addEventListener('click', async () => {
  if (hqBusy) return;
  if (!webCodecsSupported()) { status('HQ MP4 needs Chrome or Edge (WebCodecs).'); return; }
  // Use the exact params of the race on screen; otherwise build from the editor.
  const params = (race && race._params) ? race._params : {
    seed: (parseInt(seedInput.value, 10) >>> 0) || freshSeed(),
    configs: setup.toConfigs(),
    opts: { mode: winModeSelect.value === 'survivor' ? 'survivor' : 'finish',
      preset: coursePresetSelect ? coursePresetSelect.value : 'classic',
      analysts: buildAnalystsForRace(), bias: currentBias(), bg: currentBg() },
    hook: hookInput.value || '', showIntro: !!(showIntroChk && showIntroChk.checked),
  };
  hqBusy = true; btnHq.disabled = true; btnRace.disabled = true;
  try {
    const result = await exportHQ(params, (phase, f, total) => {
      const pct = total ? Math.min(99, Math.round((f / total) * 100)) : 0;
      status(phase === 'encoding' ? `HQ MP4: encoding ${f} frames…` : `HQ MP4: rendering ${phase} ${pct}%`);
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.blob);
    a.download = result.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status(`HQ MP4 saved to Downloads (${result.frames} frames)`);
  } catch (e) {
    status(`HQ MP4 failed: ${e.message}`);
  } finally {
    hqBusy = false; btnHq.disabled = false; btnRace.disabled = false;
  }
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
    bias: biasPresetSelect ? biasPresetSelect.value : 'none',
    analysts: analysts.map(a => ({ name: a.name, source: a.source || null, speech: a.speech || '', emoji: a.emoji || '' })),
    balls: setup.balls.map(b => ({
      label: b.label, name: b.name || '', color: b.color, color2: b.color2 || null,
      source: b.source || null, imageFit: b.imageFit || 'cover', luck: b.luck || 1,
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
    if (bt.color2 !== undefined) setup.setColor2(i, bt.color2);
    if (bt.luck != null) setup.setLuck(i, bt.luck);
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
  if (biasPresetSelect && t.bias) biasPresetSelect.value = t.bias;
  if (bgTypeSelect && t.bg) { bgTypeSelect.value = t.bg; bgImgBtn.style.display = t.bg === 'upload' ? '' : 'none'; }
  analysts = (t.analysts || []).map(a => ({ name: a.name || '', source: a.source || null, speech: a.speech || '', emoji: a.emoji || '', image: null }));
  renderAnalystRows();
  analysts.forEach(async (a, idx) => { if (a.source) { const img = await resolveImageFromSource(a.source); if (img) { a.image = img; markAnalystChip(idx); } } });
  renderRows();
  status(`template loaded (${n} balls)`);
}

function refreshChip(i) {
  const row = ballRowsEl.children[i];
  if (row) { const chip = row.querySelector('.chip'); if (chip) chip.textContent = '✓'; }
}

// ---- Analysts + character library ----------------------------------------
// Analysts are face-obstacles with speech bubbles. The library persists named
// characters (face reference + default line) in localStorage so you set up a
// personality once and drop it into any race.
const LIB_KEY = 'ballrace-characters';
let analysts = []; // in-session: { name, source, speech, image }
const analystRowsEl = document.getElementById('analyst-rows');
const charLibrarySelect = document.getElementById('char-library');

function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch { return []; }
}
function saveLibrary(list) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(list)); } catch {}
}
function refreshLibraryDropdown() {
  const lib = loadLibrary();
  charLibrarySelect.innerHTML = '<option value="">saved characters…</option>';
  lib.forEach((c, i) => {
    const o = document.createElement('option'); o.value = String(i);
    o.textContent = c.name || `character ${i + 1}`; charLibrarySelect.appendChild(o);
  });
}

async function resolveImageFromSource(source) {
  if (!source) return null;
  if (source.startsWith('player:')) { const p = playerById.get(source.slice(7)); return p ? loadImage(HEADSHOT_URL(p[3])) : null; }
  if (source.startsWith('team:')) { const t = teamByAbbr.get(source.slice(5)); return t ? loadImage(TEAM_LOGO_URL(t[0])) : null; }
  return null;
}

async function resolveAnalystPick(idx, raw) {
  const key = raw.trim().toLowerCase();
  const player = playerByName.get(key), team = teamByLabel.get(key);
  if (player) {
    const img = await loadImage(HEADSHOT_URL(player[3]));
    if (img) { analysts[idx].image = img; analysts[idx].source = `player:${player[2]}`; if (!analysts[idx].name) analysts[idx].name = player[0]; markAnalystChip(idx); }
  } else if (team) {
    const img = await loadImage(TEAM_LOGO_URL(team[0]));
    if (img) { analysts[idx].image = img; analysts[idx].source = `team:${team[0]}`; markAnalystChip(idx); }
  }
}

function markAnalystChip(idx) {
  const row = analystRowsEl.children[idx];
  if (row) { const chip = row.querySelector('.a-chip'); if (chip) chip.textContent = analysts[idx].image ? '✓' : ''; }
}

function renderAnalystRows() {
  analystRowsEl.innerHTML = '';
  analysts.forEach((a, i) => {
    const row = document.createElement('div'); row.className = 'analyst-row';
    const chip = document.createElement('span'); chip.className = 'a-chip'; chip.textContent = a.image ? '✓' : '';
    const name = document.createElement('input'); name.className = 'a-name'; name.placeholder = 'name'; name.value = a.name || '';
    name.addEventListener('input', () => { a.name = name.value; });
    const pick = document.createElement('input'); pick.className = 'a-pick'; pick.placeholder = 'face: player/team'; pick.setAttribute('list', 'pick-list');
    pick.addEventListener('change', () => resolveAnalystPick(i, pick.value));
    const speech = document.createElement('input'); speech.className = 'a-speech'; speech.placeholder = 'speech bubble'; speech.maxLength = 40; speech.value = a.speech || '';
    speech.addEventListener('input', () => { a.speech = speech.value; });
    const emoji = document.createElement('input'); emoji.className = 'a-emoji'; emoji.placeholder = '🔥💀'; emoji.maxLength = 8; emoji.value = a.emoji || '';
    emoji.title = 'emojis to orbit the face as obstacles (up to 4)';
    emoji.addEventListener('input', () => { a.emoji = emoji.value; });
    const star = document.createElement('button'); star.className = 'btn small'; star.textContent = '★ Save'; star.title = 'save this analyst to your library';
    star.addEventListener('click', () => {
      if (!a.name && !a.source) { status('name the analyst first'); return; }
      const lib = loadLibrary(); lib.push({ name: a.name || '', source: a.source || null, speech: a.speech || '', emoji: a.emoji || '' });
      saveLibrary(lib); refreshLibraryDropdown(); status(`saved ${a.name || 'character'} to library`);
    });
    const del = document.createElement('button'); del.className = 'btn small'; del.textContent = '×'; del.title = 'remove';
    del.addEventListener('click', () => { analysts.splice(i, 1); renderAnalystRows(); });
    row.append(chip, name, pick, speech, emoji, star, del);
    analystRowsEl.appendChild(row);
  });
}

document.getElementById('btn-add-analyst').addEventListener('click', () => {
  if (analysts.length >= 8) { status('8 analysts max'); return; }
  analysts.push({ name: '', source: null, speech: '', emoji: '', image: null });
  renderAnalystRows();
});

charLibrarySelect.addEventListener('change', async () => {
  const idx = charLibrarySelect.value; if (idx === '') return;
  const c = loadLibrary()[+idx]; charLibrarySelect.value = '';
  if (!c) return;
  const a = { name: c.name || '', source: c.source || null, speech: c.speech || '', emoji: c.emoji || '', image: null };
  analysts.push(a); renderAnalystRows();
  if (a.source) { const img = await resolveImageFromSource(a.source); if (img) { a.image = img; markAnalystChip(analysts.indexOf(a)); } }
});

// Resolved analyst list for the race (only those with a face or a name)
function buildAnalystsForRace() {
  return analysts.filter(a => a.image || a.name).map(a => ({ name: a.name, image: a.image, speech: a.speech, emoji: a.emoji }));
}

refreshLibraryDropdown();
