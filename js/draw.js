// World drawing. Pure functions of (ctx, race, cam): no DOM, no state, so the
// future offline HQ renderer can reuse this module untouched.

import { CONFIG } from './config.js';

const SKY_TOP = '#7dd0f7';
const SKY_BOTTOM = '#5cb8ec';
const OBSTACLE = '#15151a';

// Square center-crop of any image (logos, uploads) into a circle area.
export function drawImageCover(ctx, img, x, y, size) {
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, x, y, size, size);
}

// Face-fit crop for NBA headshots: their face content sits in the center ~60%
// with transparent sides and the head fills the height, so a plain square crop
// reads as a narrow strip. This crops a square biased toward the face and fills
// the circle with it.
export function drawFace(ctx, img, x, y, size) {
  const side = Math.min(img.width, img.height) * 0.80;
  const sx = img.width * 0.5 - side / 2;
  const sy = img.height * 0.44 - side / 2;
  ctx.drawImage(img, sx, sy, side, side, x, y, size, size);
}

// Pick the right fit for a ball's image.
export function drawBallImage(ctx, p, x, y, size) {
  if (p.imageFit === 'face') drawFace(ctx, p.image, x, y, size);
  else drawImageCover(ctx, p.image, x, y, size);
}

export function drawWorld(ctx, race, cam) {
  const W = CONFIG.WORLD_W, H = CONFIG.VIEW_H, Z = CONFIG.ZOOM;
  const bg = race.bg || { type: 'sky' };

  drawBackground(ctx, bg, race, cam, W, H);

  // Clouds (parallax) only over sky-like backgrounds
  if (bg.type === 'sky' || bg.type === 'gradient') {
    ctx.save();
    ctx.scale(Z, Z);
    ctx.translate(-cam.x * 0.8, -cam.y * 0.55);
    for (const c of race.course.clouds) {
      if (c.y < cam.y * 0.55 - 200 || c.y > cam.y * 0.55 + cam.visH + 200) continue;
      drawCloud(ctx, c.x, c.y, c.s);
    }
    ctx.restore();
  }

  // World layer
  ctx.save();
  ctx.scale(Z, Z);
  ctx.translate(-cam.x, -cam.y);

  for (const body of race.course.bodies) {
    if (body.label === 'wall' || body.label === 'analyst') continue;
    ctx.fillStyle = body.label === 'eliminator' ? '#e23b3b' : OBSTACLE;
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

  // Analyst face obstacles + speech bubbles (world space, above obstacles)
  for (const body of (race.course.analysts || [])) {
    const a = body.plugin.analyst;
    if (body.bounds.max.y < cam.y - 200 || body.bounds.min.y > cam.y + cam.visH + 200) continue;
    drawAnalyst(ctx, body, a);
  }

  for (const ball of race.balls) { if (!ball.plugin.ball.eliminated) drawBall(ctx, ball); }

  ctx.restore();
}

// Selectable backgrounds. Cosmetic only (never affects physics). Stored on
// race.bg so replays and the future HQ render reproduce the same look.
function drawBackground(ctx, bg, race, cam, W, H) {
  if (bg.type === 'upload' && bg.image) {
    // cover the full 9:16 frame, center-cropped to fill without distortion
    const img = bg.image, ir = img.width / img.height, fr = W / H;
    let sw, sh, sx, sy;
    if (ir > fr) { sh = img.height; sw = sh * fr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / fr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return;
  }
  if (bg.type === 'court') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#caa15e'); g.addColorStop(0.5, '#b9792f'); g.addColorStop(1, '#9c6328');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint wood plank lines
    ctx.strokeStyle = 'rgba(80,45,15,0.18)'; ctx.lineWidth = 3;
    for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    return;
  }
  if (bg.type === 'arena') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1d27'); g.addColorStop(1, '#0c0d13');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W / 2, H * 0.32, 80, W / 2, H * 0.32, H * 0.7);
    r.addColorStop(0, 'rgba(120,150,200,0.18)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    return;
  }
  if (bg.type === 'gradient') {
    // team-color gradient: blend the first two balls' colors (matchup colors)
    const cols = race.balls.map(b => b.plugin.ball.color);
    const a = bg.colorA || cols[0] || SKY_TOP;
    const c = bg.colorB || cols[1] || cols[0] || SKY_BOTTOM;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, a); g.addColorStop(1, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return;
  }
  // sky (default)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, SKY_TOP); g.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// Analyst obstacle: headshot in a ringed disk, with a speech bubble alongside.
function drawAnalyst(ctx, body, a) {
  const x = body.position.x, y = body.position.y, r = body.circleRadius;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1b1d27'; ctx.fill();
  ctx.restore();
  if (a.image) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    drawFace(ctx, a.image, x - r, y - r, r * 2); ctx.restore();
  } else {
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(r * 0.5)}px system-ui, sans-serif`;
    ctx.fillText((a.name || '?').slice(0, 3).toUpperCase(), x, y);
  }
  ctx.lineWidth = 6; ctx.strokeStyle = '#ffd54a';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

  if (a.speech && a.speech.trim()) {
    const right = a.bubbleSide === 'R';
    const bw = 300, pad = 18, lh = 34;
    ctx.font = '700 28px system-ui, sans-serif';
    const words = a.speech.trim().split(/\s+/); const lines = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > bw - pad * 2 && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);
    const bh = lines.length * lh + pad * 2;
    const bx = right ? x + r + 24 : x - r - 24 - bw;
    const by = y - bh / 2;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#15151a'; ctx.lineWidth = 4;
    roundRectPath(ctx, bx, by, bw, bh, 18); ctx.fill(); ctx.stroke();
    // tail toward the face
    ctx.beginPath();
    const tx = right ? bx : bx + bw;
    ctx.moveTo(tx, y - 14); ctx.lineTo(tx + (right ? -22 : 22), y); ctx.lineTo(tx, y + 14);
    ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = '#15151a'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((ln, i) => ctx.fillText(ln, bx + pad, by + pad + i * lh));
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
    // Face/logo stays UPRIGHT regardless of ball spin (clipped to the circle).
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    drawBallImage(ctx, p, x - r, y - r, r * 2);
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
