// HUD drawing in screen space (called after drawWorld). Pure ctx functions.
// Layout respects TikTok/Reels safe zones: nothing in the bottom 15% or the
// right-edge rail where platform UI sits.

import { CONFIG } from './config.js';
import { drawBallImage } from './draw.js';

const W = CONFIG.WORLD_W, H = CONFIG.VIEW_H;

// Live Top 3, pinned top-left. Small stacked discs with rank numbers.
export function drawLeaderboard(ctx, standings) {
  const top = standings.slice(0, 3);
  const x = 56, startY = 150, gap = 118, r = 42;

  ctx.save();
  for (let i = 0; i < top.length; i++) {
    const p = top[i].plugin.ball;
    const y = startY + i * gap;

    ctx.beginPath();
    ctx.arc(x + r, y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = i === 0 ? '#ffd34d' : 'rgba(255,255,255,0.9)';
    ctx.stroke();

    if (p.image) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + r, y, r, 0, Math.PI * 2);
      ctx.clip();
      drawBallImage(ctx, p, x, y - r, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = p.textColor;
      ctx.font = `800 ${Math.round(r * 0.7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, x + r, y + 1);
    }

    // Rank badge
    ctx.beginPath();
    ctx.arc(x + r - 34, y - 30, 19, 0, Math.PI * 2);
    ctx.fillStyle = '#15151a';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText(String(i + 1), x + r - 34, y - 29);
  }
  ctx.restore();
}

// Countdown numbers + GO. t goes 3 -> 0; each unit is one beat.
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
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#ffd34d';
  ctx.stroke();
  if (p.image) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    drawBallImage(ctx, p, cx - r, cy - r, r * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = p.textColor;
    ctx.font = `900 ${Math.round(r * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.label, cx, cy);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText(`${p.label} WINS`, cx, H * 0.41);

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
    ctx.beginPath(); ctx.arc(lx, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = rb.color; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = i < 3 ? medals[i] : 'rgba(255,255,255,0.8)'; ctx.stroke();
    if (rb.image) {
      ctx.save(); ctx.beginPath(); ctx.arc(lx, y, rr, 0, Math.PI * 2); ctx.clip();
      drawBallImage(ctx, rb, lx - rr, y - rr, rr * 2); ctx.restore();
    } else {
      ctx.fillStyle = rb.textColor;
      ctx.font = `800 ${Math.round(rr * 0.7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(rb.label, lx, y + 1);
    }
    // name
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 52px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(rb.label, lx + rr + 30, y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
