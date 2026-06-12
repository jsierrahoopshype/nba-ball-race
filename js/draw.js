// World drawing. Pure functions of (ctx, race, cam): no DOM, no state, so the
// future offline HQ renderer can reuse this module untouched.

import { CONFIG } from './config.js';

const SKY_TOP = '#7dd0f7';
const SKY_BOTTOM = '#5cb8ec';
const OBSTACLE = '#15151a';

// Square center-crop of any image into a circle area (headshots are not square)
export function drawImageCover(ctx, img, x, y, size) {
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, x, y, size, size);
}

export function drawWorld(ctx, race, cam) {
  const W = CONFIG.WORLD_W, H = CONFIG.VIEW_H, Z = CONFIG.ZOOM;

  // Sky (screen space)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Clouds (parallax)
  ctx.save();
  ctx.scale(Z, Z);
  ctx.translate(-cam.x * 0.8, -cam.y * 0.55);
  for (const c of race.course.clouds) {
    if (c.y < cam.y * 0.55 - 200 || c.y > cam.y * 0.55 + cam.visH + 200) continue;
    drawCloud(ctx, c.x, c.y, c.s);
  }
  ctx.restore();

  // World layer
  ctx.save();
  ctx.scale(Z, Z);
  ctx.translate(-cam.x, -cam.y);

  ctx.fillStyle = OBSTACLE;
  for (const body of race.course.bodies) {
    if (body.label === 'wall') continue;
    const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
    for (const part of parts) {
      if (part.bounds.max.y < cam.y - 100 || part.bounds.min.y > cam.y + cam.visH + 100) continue;
      if (part.circleRadius) {
        ctx.beginPath();
        ctx.arc(part.position.x, part.position.y, part.circleRadius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(part.vertices[0].x, part.vertices[0].y);
        for (let i = 1; i < part.vertices.length; i++) ctx.lineTo(part.vertices[i].x, part.vertices[i].y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawFinish(ctx, race.course.finishY);
  for (const ball of race.balls) drawBall(ctx, ball);

  ctx.restore();
}

function drawCloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x, y, 46 * s, 0, Math.PI * 2);
  ctx.arc(x + 44 * s, y + 8 * s, 34 * s, 0, Math.PI * 2);
  ctx.arc(x - 44 * s, y + 10 * s, 30 * s, 0, Math.PI * 2);
  ctx.arc(x + 8 * s, y - 18 * s, 30 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawFinish(ctx, finishY) {
  const W = CONFIG.WORLD_W, sq = 36;
  for (let row = 0; row < 2; row++) {
    for (let x = 0; x < W; x += sq) {
      ctx.fillStyle = ((x / sq + row) % 2 === 0) ? '#15151a' : '#ffffff';
      ctx.fillRect(x, finishY + row * sq, sq, sq);
    }
  }
}

export function drawBall(ctx, ball) {
  const p = ball.plugin.ball;
  const { x, y } = ball.position;
  const r = ball.circleRadius;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  ctx.restore();

  if (p.image) {
    // Headshot clipped into the circle, rotating with the body (meme physics)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(ball.angle);
    drawImageCover(ctx, p.image, -r, -r, r * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = p.textColor;
    ctx.font = `800 ${Math.round(r * 0.66)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, x, y + 2);
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
}
