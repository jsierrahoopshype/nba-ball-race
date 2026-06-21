// HUD drawing in screen space (called after drawWorld). Pure ctx functions.
// Layout respects TikTok/Reels safe zones: nothing in the bottom 15% or the
// right-edge rail where platform UI sits.

import { CONFIG } from './config.js';
import { drawBallImage, drawFaceInCircle, drawImageCover } from './draw.js';

// Faces in cards/rankings: the full head inside a colored disk (matches the
// race balls). Logos/text keep a colored disk.
function cardFace(ctx, p, cx, cy, r, rankColor) {
  if (p.image && p.imageFit === 'face') { drawFaceInCircle(ctx, p.image, cx, cy, r, p.color, p.color2, rankColor); return; }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
  if (rankColor) { ctx.lineWidth = 3; ctx.strokeStyle = rankColor; ctx.stroke(); }
  if (p.image) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); drawImageCover(ctx, p.image, cx - r, cy - r, r * 2); ctx.restore(); }
  else { ctx.fillStyle = p.textColor; ctx.font = `800 ${Math.round(r * 0.7)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.label, cx, cy + 1); }
}

const W = CONFIG.WORLD_W, H = CONFIG.VIEW_H;

// Live Top 3, compact, pinned top-left: small face + rank + NAME, on a slim
// translucent panel so it reads over any background without eating the corner.
export function drawLeaderboard(ctx, standings) {
  const top = standings.slice(0, 3);
  const x = 40, startY = 130, rowH = 84, r = 30, panelW = 360;

  ctx.save();
  ctx.fillStyle = 'rgba(12,14,20,0.42)';
  roundRect(ctx, x - 14, startY - r - 16, panelW, rowH * top.length + 18, 20);
  ctx.fill();

  for (let i = 0; i < top.length; i++) {
    const p = top[i].plugin.ball;
    const cyc = startY + i * rowH;

    ctx.fillStyle = i === 0 ? '#ffd34d' : '#ffffff';
    ctx.font = '800 38px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x + 16, cyc);

    const fx = x + 56;
    cardFace(ctx, p, fx + r, cyc, r, i === 0 ? '#ffd34d' : 'rgba(255,255,255,0.85)');

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 38px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.name || p.label, fx + r * 2 + 18, cyc);
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

export function drawCountdown(ctx, value) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#15151a';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 360px system-ui, sans-serif';
  const text = value === 0 ? 'GO!' : String(value);
  ctx.strokeText(text, W / 2, H * 0.42);
  ctx.fillText(text, W / 2, H * 0.42);
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
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText(`${(p.name || p.label).toUpperCase()} WINS`, cx, H * 0.41);

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
    ctx.fillText(rb.name || rb.label, lx + rr + 30, y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
