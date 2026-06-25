// HUD drawing in screen space (called after drawWorld). Pure ctx functions.
// Layout respects TikTok/Reels safe zones: nothing in the bottom 15% or the
// right-edge rail where platform UI sits.

import { CONFIG } from './config.js';
import { drawBallImage, drawFaceInCircle, drawImageCover, drawCardHeadshot } from './draw.js';

// Faces in cards/rankings: a clean headshot (no team-coloured ball). Logos/text
// keep a colored disk.
function cardFace(ctx, p, cx, cy, r, rankColor) {
  if (p.image && p.imageFit === "face") { drawCardHeadshot(ctx, p.image, cx, cy, r, rankColor); return; }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
  if (rankColor) { ctx.lineWidth = 3; ctx.strokeStyle = rankColor; ctx.stroke(); }
  if (p.image) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); drawImageCover(ctx, p.image, cx - r, cy - r, r * 2); ctx.restore(); }
  else { ctx.fillStyle = p.textColor; ctx.font = `800 ${Math.round(r * 0.7)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.label, cx, cy + 1); }
}

const W = CONFIG.WORLD_W, H = CONFIG.VIEW_H;

// Live full-field ranking, compact, pinned top-left: rank + small face + full
// NAME for EVERY player on one slim translucent panel. Rows shrink when the
// field is large so it always fits the safe zone.
export function drawLeaderboard(ctx, standings) {
  const n = standings.length;
  if (!n) return;
  const big = n > 9;
  const rowH = big ? 34 : 44;
  const r = big ? 13 : 16;
  const fs = big ? 20 : 24;
  const x = 24, startY = 96;
  const faceX = x + 26;
  const nameX = faceX + r * 2 + 10;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  let maxNameW = 0;
  for (const b of standings) {
    const nm = b.plugin.ball.name || b.plugin.ball.label;
    maxNameW = Math.max(maxNameW, ctx.measureText(nm).width);
  }
  const panelW = (nameX - x) + maxNameW + 18;
  const panelH = n * rowH + 14;
  ctx.fillStyle = 'rgba(8,10,14,0.55)';
  roundRect(ctx, x - 12, startY - rowH / 2 - 4, panelW, panelH, 14); ctx.fill();

  for (let i = 0; i < n; i++) {
    const p = standings[i].plugin.ball;
    const cyc = startY + i * rowH;
    const accent = i === 0 ? '#ffd34d' : i === 1 ? '#e9e9ee' : i === 2 ? '#e0a878' : '#ffffff';
    // rank number
    ctx.fillStyle = accent;
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x + 2, cyc + 1);
    // face
    cardFace(ctx, p, faceX + r, cyc, r, i === 0 ? '#ffd34d' : 'rgba(255,255,255,0.7)');
    // full name
    ctx.font = `700 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.fillText(p.name || p.label, nameX, cyc + 1);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Countdown numbers + GO. t goes 3 -> 0; each unit is one beat.
// Intro matchup card: hook text up top, every ball's face laid out below.
// Shown before the countdown; doubles as the recording's scroll-stopper frame.
export function drawMatchup(ctx, balls, hook, mode) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7dd0f7'); g.addColorStop(1, '#5cb8ec');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Hook text (wrapped), big and bold near the top
  const hookText = (hook && hook.trim()) || 'WHO WINS?';
  ctx.fillStyle = '#15151a';
  ctx.font = '900 96px system-ui, sans-serif';
  const words = hookText.toUpperCase().split(/\s+/);
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > W - 120 && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H * 0.16 + i * 104));

  // Faces grid, centered in the middle band
  const n = balls.length;
  const cols = n <= 2 ? n : (n <= 4 ? 2 : (n <= 9 ? 3 : (n <= 16 ? 4 : 5)));
  const rows = Math.ceil(n / cols);
  const r = Math.max(60, Math.min(190, 760 / cols - 40));
  const gapX = (W) / cols, gapY = Math.min(r * 2.7, 1500 / rows);
  const top = H * 0.5 - (rows - 1) * gapY / 2;

  balls.forEach((ball, i) => {
    const p = ball.plugin.ball;
    const cx = (i % cols + 0.5) * gapX;
    const cy = top + Math.floor(i / cols) * gapY;
    cardFace(ctx, p, cx, cy, r);
    if (!(p.image && p.imageFit === 'face')) {
      ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    if (n <= 8) {
      ctx.fillStyle = '#15151a';
      ctx.font = '800 38px system-ui, sans-serif';
      ctx.fillText((p.name || p.label).toUpperCase(), cx, cy + r + 34);
    }
    // "VS" between two duelists
    if (n === 2 && i === 0) {
      ctx.fillStyle = '#e23b3b';
      ctx.font = '900 110px system-ui, sans-serif';
      ctx.fillText('VS', W / 2, cy);
    }
  });

  if (mode === 'survivor') {
    ctx.fillStyle = '#e23b3b';
    ctx.font = '800 52px system-ui, sans-serif';
    ctx.fillText('LAST BALL STANDING', W / 2, H * 0.9);
  }
}

// Tournament screens: the between-race round card and the final champion card.
// `info` = { format, raceNum, wins:{id:count}, balls, championId }.
export function drawTournamentCard(ctx, info, isChampion) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7dd0f7'); g.addColorStop(1, '#5cb8ec');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  const need = Math.ceil(info.format / 2);
  ctx.fillStyle = '#15151a';
  if (isChampion) {
    const champ = info.balls.find(b => b.plugin.ball.id === info.championId);
    const p = champ ? champ.plugin.ball : null;
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.fillText(`BEST OF ${info.format}`, W / 2, H * 0.12);
    if (p) {
      const r = 200, cx = W / 2, cy = H * 0.36;
      cardFace(ctx, p, cx, cy, r);
      ctx.fillStyle = '#15151a'; ctx.font = '900 76px system-ui, sans-serif';
      ctx.fillText(`${(p.name || p.label).toUpperCase()}`, W / 2, H * 0.58);
      ctx.fillStyle = '#e23b3b'; ctx.font = '800 48px system-ui, sans-serif';
      ctx.fillText('WINS THE SERIES', W / 2, H * 0.65);
    }
  } else {
    ctx.font = '900 110px system-ui, sans-serif';
    ctx.fillText(`RACE ${info.raceNum}`, W / 2, H * 0.16);
    ctx.font = '700 56px system-ui, sans-serif';
    ctx.fillText(`of ${info.format}`, W / 2, H * 0.24);
  }

  // Series score: every ball's face with its win pips
  const scored = [...info.balls].sort((a, b) => (info.wins[b.plugin.ball.id] || 0) - (info.wins[a.plugin.ball.id] || 0));
  const startY = isChampion ? H * 0.74 : H * 0.42;
  const rowH = Math.min(120, (H * 0.5) / Math.max(1, scored.length));
  const rr = Math.min(46, rowH * 0.4);
  scored.forEach((ball, i) => {
    const p = ball.plugin.ball, wins = info.wins[p.id] || 0;
    const cy = startY + i * rowH, lx = W * 0.5 - 300;
    cardFace(ctx, p, lx, cy, rr);
    ctx.fillStyle = '#15151a'; ctx.textAlign = 'left'; ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText((p.name || p.label).toUpperCase(), lx + rr + 20, cy);
    // win pips
    for (let w = 0; w < info.format; w++) {
      const px = W * 0.5 + 150 + w * 52;
      ctx.beginPath(); ctx.arc(px, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = w < wins ? (wins >= need ? '#ffd54a' : '#4ad17a') : 'rgba(0,0,0,0.18)';
      ctx.fill();
    }
  });
}

export function drawCountdown(ctx, value, hook) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "WHO WINS?" above the count, in the middle of the course screen
  ctx.lineWidth = 9; ctx.strokeStyle = '#15151a'; ctx.fillStyle = '#ffffff';
  const title = (hook && hook.trim()) ? hook.trim().toUpperCase() : 'WHO WINS?';
  // shrink the font if the custom question is long so it fits the width
  let fs = 120;
  ctx.font = `900 ${fs}px system-ui, sans-serif`;
  while (ctx.measureText(title).width > W - 80 && fs > 50) { fs -= 6; ctx.font = `900 ${fs}px system-ui, sans-serif`; }
  ctx.strokeText(title, W / 2, H * 0.27);
  ctx.fillText(title, W / 2, H * 0.27);

  ctx.lineWidth = 14;
  ctx.strokeStyle = '#15151a';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 360px system-ui, sans-serif';
  const text = value === 0 ? 'GO!' : String(value);
  ctx.strokeText(text, W / 2, H * 0.52);
  ctx.fillText(text, W / 2, H * 0.52);
  ctx.restore();
}

// Winner screen: scrim, oversized winner ball, W, hold for the cut point.
// Final reveal: winner slams in big, then a ranked standings list (1st..Nth)
// rises below. `standings` is the finish-ordered array of ball bodies.
export function drawWinner(ctx, standings, t) {
  const winnerBall = standings[0];
  const p = winnerBall.plugin.ball;
  const k = Math.min(1, t / 0.45);
  const scale = 1 + (1 - k) * (1 - k) * 2.2;

  ctx.save();
  ctx.fillStyle = 'rgba(10,10,16,0.82)';
  ctx.fillRect(0, 0, W, H);

  // Winner portrait
  const cx = W / 2, cy = H * 0.26, r = 190 * Math.min(scale, 1.6);
  cardFace(ctx, p, cx, cy, r);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  const wtext = `${(p.name || p.label).toUpperCase()} WINS`;
  let wfs = 84;
  ctx.font = `900 ${wfs}px system-ui, sans-serif`;
  while (ctx.measureText(wtext).width > W - 70 && wfs > 34) { wfs -= 4; ctx.font = `900 ${wfs}px system-ui, sans-serif`; }
  ctx.fillText(wtext, cx, H * 0.41);

  // Standings list, staggered reveal (each row fades in slightly after the prior)
  const rows = standings.slice(0, Math.min(8, standings.length));
  const top = H * 0.50, rowH = Math.min(140, (H * 0.44) / rows.length);
  const medals = ['#ffd34d', '#c8d0dc', '#cd7f32']; // gold, silver, bronze
  for (let i = 0; i < rows.length; i++) {
    const rb = rows[i].plugin.ball;
    const rowT = Math.min(1, Math.max(0, (t - 0.5 - i * 0.12) / 0.3));
    if (rowT <= 0) continue;
    const y = top + i * rowH;
    const rr = rowH * 0.36;
    const lx = W * 0.28;

    ctx.globalAlpha = rowT;
    // rank
    ctx.fillStyle = i < 3 ? medals[i] : '#ffffff';
    ctx.font = '900 56px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${i + 1}`, lx - rr - 28, y + 18);

    // ball
    cardFace(ctx, rb, lx, y, rr, i < 3 ? medals[i] : 'rgba(255,255,255,0.8)');
    // name
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 52px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const timeStr = rb.crossed ? `${(rb.finishStep / 60).toFixed(2)}s` : 'DNF';
    // name, shrunk if needed so it never collides with the time on the right
    const nameRight = W * 0.80, nameLeft = lx + rr + 30;
    let nm = rb.name || rb.label, nfs = 52;
    ctx.font = `700 ${nfs}px system-ui, sans-serif`;
    while (ctx.measureText(nm).width > (nameRight - 150) - nameLeft && nfs > 30) { nfs -= 3; ctx.font = `700 ${nfs}px system-ui, sans-serif`; }
    ctx.fillText(nm, nameLeft, y);
    // exact finish time (hundredths), right-aligned within the safe zone
    ctx.fillStyle = i < 3 ? medals[i] : 'rgba(255,255,255,0.9)';
    ctx.font = '800 46px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, nameRight, y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Running race clock for time-limit mode: a bold MM:SS pill at the top centre,
// turning red and pulsing under the final 5 seconds. `secsLeft` is clamped >= 0.
export function drawRaceClock(ctx, secsLeft) {
  const s = Math.max(0, secsLeft);
  const txt = s.toFixed(2); // always show hundredths (live stopwatch feel)
  const urgent = s <= 5;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = W / 2, cy = 96;
  // pill
  ctx.font = '900 72px system-ui, sans-serif';
  const w = Math.max(190, ctx.measureText(txt + 's').width + 80), h = 116;
  const pulse = urgent ? 1 + 0.05 * Math.sin(s * Math.PI * 4) : 1;
  ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy);
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 26);
  ctx.fillStyle = urgent ? 'rgba(200,16,46,0.92)' : 'rgba(21,21,26,0.82)';
  ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(txt + 's', cx, cy + 4);
  ctx.restore();
}

// Qualifier series cards. `info` = { round, totalRounds, qualifyS, advancers:[balls],
// eliminated:[balls], championBall }. phase 'round' between rounds, 'champion' at the end.
const ROUND_NAMES = ['HEATS', 'SEMIS', 'FINAL'];
export function drawQualifierCard(ctx, info, phase, t = 0) {
  if (phase === 'champion') { drawEpicChampion(ctx, info, t); return; }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7dd0f7'); g.addColorStop(1, '#5cb8ec');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Between-round card: who advanced, and what's next.
  const justFinished = info.round;            // round number that just ran (1-based)
  const nextName = ROUND_NAMES[Math.min(justFinished, info.totalRounds - 1)];
  ctx.fillStyle = '#15151a';
  ctx.font = '900 96px system-ui, sans-serif';
  ctx.fillText(`${ROUND_NAMES[justFinished - 1]} DONE`, W / 2, H * 0.12);
  ctx.fillStyle = '#1c7a3a'; ctx.font = '800 52px system-ui, sans-serif';
  ctx.fillText(`${info.advancers.length} ADVANCE TO ${nextName}`, W / 2, H * 0.19);
  if (info.qualifyS) {
    ctx.fillStyle = 'rgba(21,21,26,0.7)'; ctx.font = '700 38px system-ui, sans-serif';
    ctx.fillText(`finish under ${info.qualifyS}s to qualify`, W / 2, H * 0.235);
  }

  // Advancers grid of faces.
  const adv = info.advancers;
  const cols = adv.length <= 6 ? Math.min(3, adv.length) : 4;
  const rows = Math.ceil(adv.length / cols);
  const cellW = Math.min(280, (W - 120) / cols);
  const r = Math.min(86, cellW * 0.32);
  const gridY = H * 0.32;
  const cellH = r * 2 + 64;
  adv.forEach((ball, i) => {
    const p = ball.plugin.ball;
    const col = i % cols, row = Math.floor(i / cols);
    const cx = W / 2 + (col - (cols - 1) / 2) * cellW;
    const cy = gridY + row * cellH;
    cardFace(ctx, p, cx, cy, r, '#1c7a3a');
    ctx.fillStyle = '#15151a'; ctx.font = `800 ${Math.round(r * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const nm = (p.name || p.label).toUpperCase();
    let fs = Math.round(r * 0.42);
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    while (ctx.measureText(nm).width > cellW - 10 && fs > 18) { fs -= 2; ctx.font = `800 ${fs}px system-ui, sans-serif`; }
    ctx.fillText(nm, cx, cy + r + 26);
  });
}

// Epic series champion finale: animated sunburst, confetti, glowing portrait,
// crown, and big titles slamming in. `t` is seconds since the card appeared.
function drawEpicChampion(ctx, info, t) {
  const p = info.championBall ? info.championBall.plugin.ball : null;
  const cx = W / 2, cy = H * 0.40;

  // deep radial backdrop, slowly breathing
  const bgR = H * (0.6 + 0.03 * Math.sin(t * 1.6));
  const bg = ctx.createRadialGradient(cx, cy, 60, cx, cy, bgR);
  bg.addColorStop(0, '#3a2c05'); bg.addColorStop(0.5, '#1a1408'); bg.addColorStop(1, '#08060a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // rotating golden sunburst behind the portrait
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.25);
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    ctx.rotate((Math.PI * 2) / rays);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-70, H);
    ctx.lineTo(70, H);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,209,77,0.10)' : 'rgba(255,209,77,0.04)';
    ctx.fill();
  }
  ctx.restore();

  // confetti (deterministic, time-driven)
  const COLORS = ['#ffd34d', '#ff5d5d', '#5ad17a', '#5db8ec', '#c77dff', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const seedx = (i * 73) % 100 / 100, seeds = 0.6 + ((i * 37) % 50) / 100;
    const x = ((seedx + Math.sin(i * 1.3) * 0.04) * W);
    const fall = ((t * seeds * 320) + i * 53) % (H + 80) - 40;
    const sway = Math.sin(t * 2 + i) * 16;
    const size = 9 + (i % 4) * 4;
    ctx.save();
    ctx.translate(x + sway, fall);
    ctx.rotate(t * 3 + i);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-size / 2, -size / 2, size, size * 0.6);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (!p) return;

  // title slams down in the first 0.4s
  const tIn = Math.min(1, t / 0.4);
  const titleY = H * 0.13 - (1 - tIn) * 80;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = tIn;
  ctx.lineWidth = 10; ctx.strokeStyle = '#0c0a06';
  ctx.fillStyle = '#ffd34d';
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.strokeText('SERIES CHAMPION', cx, titleY);
  ctx.fillText('SERIES CHAMPION', cx, titleY);
  ctx.globalAlpha = 1;

  // portrait pops in (overshoot) then gently pulses
  const popK = Math.min(1, t / 0.5);
  const overshoot = 1 + (1 - popK) * (1 - popK) * 1.8;
  const pulse = 1 + 0.025 * Math.sin(t * 3.2);
  const r = 220 * Math.min(overshoot, 1.8) * pulse;

  // glow halo
  const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.7);
  halo.addColorStop(0, 'rgba(255,209,77,0.55)'); halo.addColorStop(1, 'rgba(255,209,77,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, Math.PI * 2); ctx.fill();

  // thick gold ring + portrait
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd34d'; ctx.fill();
  cardFace(ctx, p, cx, cy, r);

  // crown above the head
  drawCrown(ctx, cx, cy - r - 30, r * 0.62, t);

  // name + subtitle rise in after the portrait
  const nameK = Math.min(1, Math.max(0, (t - 0.5) / 0.4));
  ctx.globalAlpha = nameK;
  const nameY = cy + r + 96;
  ctx.lineWidth = 9; ctx.strokeStyle = '#0c0a06'; ctx.fillStyle = '#ffffff';
  let nm = (p.name || p.label).toUpperCase(), nfs = 96;
  ctx.font = `900 ${nfs}px system-ui, sans-serif`;
  while (ctx.measureText(nm).width > W - 90 && nfs > 44) { nfs -= 4; ctx.font = `900 ${nfs}px system-ui, sans-serif`; }
  ctx.strokeText(nm, cx, nameY); ctx.fillText(nm, cx, nameY);

  ctx.fillStyle = '#ffd34d'; ctx.font = '800 50px system-ui, sans-serif';
  ctx.fillText('WINS THE SERIES', cx, nameY + 78);
  if (p.crossed) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText(`final ${(p.finishStep / 60).toFixed(2)}s`, cx, nameY + 134);
  }
  ctx.globalAlpha = 1;
}

function drawCrown(ctx, cx, cy, w, t) {
  const bob = Math.sin(t * 2.4) * 6;
  const y = cy + bob, h = w * 0.7;
  ctx.save();
  ctx.translate(cx, y);
  ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#0c0a06'; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, -h * 0.1);
  ctx.lineTo(-w * 0.25, h * 0.25);
  ctx.lineTo(0, -h / 2);
  ctx.lineTo(w * 0.25, h * 0.25);
  ctx.lineTo(w / 2, -h * 0.1);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // gems
  ctx.fillStyle = '#ff5d5d';
  for (const gx of [-w * 0.28, 0, w * 0.28]) { ctx.beginPath(); ctx.arc(gx, h * 0.18, w * 0.06, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
