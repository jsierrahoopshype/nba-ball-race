// HUD drawing in screen space (called after drawWorld). Pure ctx functions.
// Layout respects TikTok/Reels safe zones: nothing in the bottom 15% or the
// right-edge rail where platform UI sits.

import { CONFIG } from './config.js';

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

    ctx.fillStyle = p.textColor;
    ctx.font = `800 ${Math.round(r * 0.7)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, x + r, y + 1);

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
export function drawWinner(ctx, winnerBall, t) {
  const p = winnerBall.plugin.ball;
  // Slam-in: scale overshoots then settles (cheap spring)
  const k = Math.min(1, t / 0.45);
  const scale = 1 + (1 - k) * (1 - k) * 2.2;

  ctx.save();
  ctx.fillStyle = 'rgba(10,10,16,0.78)';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2, cy = H * 0.40, r = 230 * Math.min(scale, 1.6);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#ffd34d';
  ctx.stroke();

  if (p.image) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(p.image, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = p.textColor;
    ctx.font = `900 ${Math.round(r * 0.7)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, cx, cy);
  }

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 300px system-ui, sans-serif';
  ctx.fillText('W', cx, H * 0.68);

  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillStyle = '#ffd34d';
  ctx.fillText(`${p.label} WINS`, cx, H * 0.78);
  ctx.restore();
}
