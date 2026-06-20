// World drawing. Pure functions of (ctx, race, cam): no DOM, no state, so the
// future offline HQ renderer can reuse this module untouched.

import { CONFIG } from './config.js';

const SKY_TOP = '#7dd0f7';
const SKY_BOTTOM = '#5cb8ec';
const OBSTACLE = '#15151a';

// --- Headshots drawn BARE (no circle/ring/disk) -------------------------
// The cutouts are transparent and the bg removal also punched out white pixels
// (teeth, eye-whites). With no circle behind them those holes would show the
// background through. So we fill ONLY the interior holes (transparent pixels
// fully enclosed by the head) with a neutral tone, once per image, cached.
const _faceCache = new WeakMap();
function makeCanvas(w, h) {
  if (typeof globalThis !== 'undefined' && globalThis.__mkcanvas) return globalThis.__mkcanvas(w, h);
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}
function processFace(img) {
  if (_faceCache.has(img)) return _faceCache.get(img);
  const w = img.width, h = img.height, cv = makeCanvas(w, h);
  if (!cv) { _faceCache.set(img, img); return img; } // node fallback: raw image
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  let id;
  try { id = cx.getImageData(0, 0, w, h); } catch (e) { _faceCache.set(img, img); return img; }
  const a = id.data, n = w * h, ext = new Uint8Array(n), th = 18;
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, w - 1 + y * w); }
  while (stack.length) {
    const i = stack.pop();
    if (ext[i] || a[i * 4 + 3] > th) continue;
    ext[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < n; i++) {
    if (a[i * 4 + 3] <= th && !ext[i]) { a[i * 4] = 238; a[i * 4 + 1] = 240; a[i * 4 + 2] = 243; a[i * 4 + 3] = 255; }
  }
  cx.putImageData(id, 0, 0);
  _faceCache.set(img, cv);
  return cv;
}

// Draw a headshot at its natural framing, centered on (cx,cy), sized so the
// circle of radius r is filled by the head. No circle, ring, or disk: just the
// head, with a soft drop shadow so it reads against any background.
export function drawHeadshot(ctx, img, cx, cy, r, withShadow = true) {
  const face = processFace(img);
  // head spans ~1.75*r (a touch smaller than the ball so it doesn't dominate),
  // natural proportions, centered slightly high so less neck/shoulder shows.
  const scale = (1.75 * r) / (img.height * 0.62);
  const w = img.width * scale, h = img.height * scale;
  if (withShadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.32)'; ctx.shadowBlur = Math.max(6, r * 0.16); ctx.shadowOffsetY = Math.max(3, r * 0.08);
    ctx.drawImage(face, cx - w / 2, cy - h * 0.44, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(face, cx - w / 2, cy - h * 0.44, w, h);
  }
}

// Square center-crop of any image (logos, uploads) into a circle area.
export function drawImageCover(ctx, img, x, y, size) {
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, x, y, size, size);
}

// Face-fit crop for NBA headshots. These are transparent cutouts whose bg
// removal also punched out white pixels (teeth, eye-whites), so we paint a
// neutral backing first, otherwise the circle's team color shows through those
// holes (purple teeth). Always called inside a circle clip, so the fill is round.
export function drawFace(ctx, img, x, y, size) {
  ctx.fillStyle = '#eef0f3';
  ctx.fillRect(x, y, size, size);
  const side = Math.min(img.width, img.height) * 0.60;
  const sx = img.width * 0.5 - side / 2;
  const sy = img.height * 0.37 - side / 2;
  ctx.drawImage(img, sx, sy, side, side, x, y, size, size);
}

// Pick the right fit for a ball's image.
export function drawBallImage(ctx, p, x, y, size) {
  if (p.imageFit === 'face') drawFace(ctx, p.image, x, y, size);
  else drawImageCover(ctx, p.image, x, y, size);
}

export function drawWorld(ctx, race, cam) {
  const W = CONFIG.WORLD_W, H = CONFIG.VIEW_H, Z = cam.zoom;
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
    if (body.label === 'wall' || body.label === 'analyst' || body.label === 'analystbubble' || body.label === 'analystemoji') continue;
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
    if (body.bounds.max.y < cam.y - 450 || body.bounds.min.y > cam.y + cam.visH + 450) continue;
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

// Analyst: a massive headshot the balls bounce off, with a comic speech bubble
// orbiting it (the bubble is its own moving obstacle, positioned by the engine).
function drawAnalyst(ctx, body, a) {
  const x = body.position.x, y = body.position.y, r = body.circleRadius;
  if (a.image) {
    drawHeadshot(ctx, a.image, x, y, r);
  } else {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#1b1d27'; ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(r * 0.42)}px system-ui, sans-serif`;
    ctx.fillText((a.name || '?').slice(0, 6).toUpperCase(), x, y);
    ctx.lineWidth = 10; ctx.strokeStyle = '#ffd54a';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }

  // Orbiting comic bubble (drawn at the engine-positioned bubble body)
  const bub = a.bubbleBody;
  if (bub && bub.plugin.bubble && bub.plugin.bubble.speech) {
    drawComicBubble(ctx, bub.position.x, bub.position.y, bub.circleRadius, bub.plugin.bubble.speech, x, y);
  }
  // Orbiting emoji obstacles
  for (const eb of (a.emojiBodies || [])) {
    const ex = eb.position.x, ey = eb.position.y, er = eb.circleRadius;
    ctx.save();
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#15151a'; ctx.stroke();
    ctx.font = `${Math.round(er * 1.4)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(eb.plugin.emoji.glyph, ex, ey + 1);
    ctx.restore();
  }
}

// Classic comic word balloon as ONE shape: the ellipse outline detours out to a
// tail tip aimed at the speaker and back, so it fills and strokes as a single
// continuous unit (no oval-plus-triangle seam).
function drawComicBubble(ctx, x, y, r, text, faceX, faceY) {
  const rx = r * 1.55, ry = r * 1.14;
  const ang = Math.atan2(faceY - y, faceX - x);
  const gap = 0.30;                 // half-width of the tail base along the ellipse
  const tip = r * 1.95;             // tail tip distance from bubble center
  const tipX = x + Math.cos(ang) * tip, tipY = y + Math.sin(ang) * tip;

  ctx.save();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#15151a'; ctx.lineWidth = 8; ctx.lineJoin = 'round';
  ctx.beginPath();
  const steps = 60, a0 = ang + gap, a1 = ang - gap + Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    const px = x + rx * Math.cos(a), py = y + ry * Math.sin(a);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // text (wrapped, uppercase comic), sized to fit
  ctx.fillStyle = '#15151a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = 34; ctx.font = `900 ${fs}px system-ui, sans-serif`;
  const words = text.toUpperCase().split(/\s+/); const lines = []; let line = '';
  const maxW = rx * 1.45;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  while (lines.length * (fs + 4) > ry * 1.8 && fs > 16) { fs -= 2; ctx.font = `900 ${fs}px system-ui, sans-serif`; }
  const lh = fs + 4, startY = y - (lines.length - 1) * lh / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lh));
  ctx.restore();
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

  if (p.image && p.imageFit === 'face') {
    // FALLING HEADSHOT: bare head, no circle, no ring. Natural proportions.
    drawHeadshot(ctx, p.image, x, y, r);
    return;
  }

  // Logos / uploads / text still use a colored disk.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = p.color; ctx.fill();
  ctx.restore();
  if (p.image) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    drawImageCover(ctx, p.image, x - r, y - r, r * 2); ctx.restore();
  } else {
    ctx.fillStyle = p.textColor;
    ctx.font = `800 ${Math.round(r * 0.66)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.label, x, y + 2);
  }
  if (p.color2) {
    const bw = Math.max(3, r * 0.07);
    ctx.beginPath(); ctx.arc(x, y, r - bw / 2, 0, Math.PI * 2);
    ctx.lineWidth = bw; ctx.strokeStyle = p.color; ctx.stroke();
  }
}
