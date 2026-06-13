// Course builder. Goal: wall-to-wall density like the reference, near-zero sky.
// Key technique: feature blocks (rings, spinners, diamonds) are embedded INSIDE a
// safe peg grid via gridPegs(), so nothing ever floats alone in blue.
//
// DESIGN RULES (do not violate, learned in testing):
// - Passages >= 130px (ball diameter 108).
// - No round obstacle edge within 135px of a wall (wall-shoulder trap). Tilted
//   ledges may embed into walls if they slope downward (balls slide off).
// - Ring gaps must include the bottom so interiors drain.
// - 45-deg surfaces converging on a wall form pockets. Avoid.
// - Block-to-block vertical clearance >= 150px (wedge-trap rule).
//
// Body labels: 'obstacle' | 'sticky' | 'bouncy' | 'wall'

import { CONFIG } from './config.js';

const W = CONFIG.WORLD_W;

function rect(x, y, w, h, opts = {}) {
  return Matter.Bodies.rectangle(x, y, w, h, {
    isStatic: true, label: 'obstacle', restitution: 0.35, friction: 0.03, ...opts,
  });
}
function peg(x, y, r, opts = {}) {
  return Matter.Bodies.circle(x, y, r, {
    isStatic: true, label: 'obstacle', restitution: 0.6, friction: 0.02, ...opts,
  });
}

// Safe peg grid filling a vertical region [y, y+h). Pegs sit on a staggered grid
// (predictable spacing, no traps) inset from walls. skipFn(x,y) lets feature
// blocks carve out space for rings/spinners so pegs don't overlap them.
function gridPegs(bodies, y, h, rng, r = 34, skipFn = null) {
  const sx = 150, sy = 150, x0 = 175, x1 = W - 175;
  let row = 0;
  for (let py = y + 40; py < y + h - 20; py += sy, row++) {
    const off = (row % 2 === 0) ? 0 : sx / 2;
    for (let px = x0 + off; px <= x1; px += sx) {
      const jx = px + rng.range(-5, 5);
      if (skipFn && skipFn(jx, py)) continue;
      bodies.push(peg(jx, py, r));
    }
  }
}

// ---- Dense filler blocks -----------------------------------------------

function pegField(bodies, y, rng, rows = 5) {
  gridPegs(bodies, y, rows * 150 + 40, rng, 38);
  return y + rows * 150 + 150;
}

// Big chunky dots over a fine peg field (reference's layered look).
function dotsOnField(bodies, y, rng, rows = 4) {
  // r56 + dy200 chosen so EVERY gap (incl. diagonal) exceeds a ball diameter:
  // diagonal neighbor distance ~244 - 2*56 = 132 > 108. Verified trap-free.
  const dotR = 56, dotSy = 200;
  const A = [260, 540, 820], B = [400, 680];
  for (let row = 0; row < rows; row++) {
    for (const x of (row % 2 === 0 ? A : B)) bodies.push(peg(x, y + 60 + row * dotSy, dotR));
  }
  return y + rows * dotSy + 120;
}

// Full-width bars, two seeded gaps per row.
function gates(bodies, y, rng, rows = 3) {
  const gapW = 180, barH = 44, spacing = 235;
  const barYs = [];
  for (let i = 0; i < rows; i++) {
    const gy = y + i * spacing + 40;
    barYs.push(gy);
    const gxL = rng.range(180, 400), gxR = rng.range(W - 400, W - 180);
    const leftW = gxL - gapW / 2 + 40;
    const midW = (gxR - gapW / 2) - (gxL + gapW / 2);
    const rightW = (W - gxR - gapW / 2) + 40;
    const dead = { restitution: 0.05, friction: 0.01 };
    if (leftW > 50) bodies.push(rect(leftW / 2 - 40, gy, leftW, barH, { angle: 0.10, ...dead }));
    if (midW > 50) bodies.push(rect(gxL + gapW / 2 + midW / 2, gy, midW, barH, { angle: rng.pick([-1,1]) * 0.09, ...dead }));
    if (rightW > 50) bodies.push(rect(W + 40 - rightW / 2, gy, rightW, barH, { angle: -0.10, ...dead }));
  }
  return y + rows * spacing + 130;
}

function ringSegments(bodies, cx, cy, radius, gapCenter, gapHalf) {
  const segs = 32, segLen = (2 * Math.PI * radius / segs) * 1.18;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let d = Math.abs(((a - gapCenter + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d < gapHalf) continue;
    bodies.push(rect(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, segLen, 28, { angle: a + Math.PI / 2 }));
  }
}

// Stacked rings embedded in a peg field. Rings centered in safe band; pegs fill
// the surrounding sky (skipped inside/near each ring).
function ringsInField(bodies, y, rng, count = 2) {
  const r = 200, sy = 215;
  const rings = [];
  for (let i = 0; i < count; i++) {
    const cx = rng.range(360, 720);
    const cy = y + r + 40 + i * sy;
    rings.push({ cx, cy });
    ringSegments(bodies, cx, cy, r, rng.range(1.25, 1.9), 0.46);
  }
  const h = r + (count - 1) * sy + r + 80;
  gridPegs(bodies, y, h, rng, 32, (px, py) => rings.some(rg => Math.hypot(px - rg.cx, py - rg.cy) < r + 140));
  return y + h + 130;
}

// Diamond grid over a peg field.
function diamondsOnField(bodies, y, rng, rows = 2) {
  const sy = 280, h = rows * sy + 40;
  const dia = [];
  for (let row = 0; row < rows; row++) {
    const ry = y + 60 + row * sy;
    const xs = (row % 2 === 0) ? [300, 540, 780] : [420, 660];
    for (const x of xs) { bodies.push(rect(x, ry, 160, 160, { angle: Math.PI / 4 })); dia.push({ x, y: ry }); }
  }
  gridPegs(bodies, y, h, rng, 30, (px, py) => dia.some(d => Math.abs(px - d.x) < 165 && Math.abs(py - d.y) < 165));
  return y + h + 130;
}

// Rotating crosses embedded in a peg field.
function spinnersInField(bodies, spinnerList, y, rng) {
  const spots = [
    { x: rng.range(280, 380), y: y + 180 },
    { x: W / 2, y: y + 440 },
    { x: rng.range(W - 380, W - 280), y: y + 180 },
  ];
  for (const p of spots) {
    const len = rng.range(290, 340);
    const a = Matter.Bodies.rectangle(p.x, p.y, len, 30);
    const b = Matter.Bodies.rectangle(p.x, p.y, len, 30, { angle: Math.PI / 2 });
    const cross = Matter.Body.create({ parts: [a, b], isStatic: true, label: 'obstacle', restitution: 0.5, friction: 0.04 });
    cross.plugin.spinSpeed = rng.pick([-1, 1]) * rng.range(0.016, 0.024);
    cross.plugin.spinRadius = len / 2;
    bodies.push(cross); spinnerList.push(cross);
  }
  const h = 620;
  gridPegs(bodies, y, h, rng, 32, (px, py) => spots.some(s => Math.hypot(px - s.x, py - s.y) < 285));
  return y + h + 130;
}

// Bouncy pinball pegs (denser, full field).
function bounceField(bodies, y, rng, rows = 3) {
  const sx = 165, sy = 175, x0 = 175, x1 = W - 175;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2 === 0) ? 0 : sx / 2;
    for (let x = x0 + off; x <= x1; x += sx) {
      bodies.push(peg(x, y + 40 + row * sy, 42, { label: 'bouncy', restitution: 1.32 }));
    }
  }
  return y + rows * sy + 130;
}

// Sticky shelves over a sparse peg field: grind zone, still dense visually.
function stickyZone(bodies, y, rng, count = 3) {
  const shelfW = 620, h = count * 250 + 40;
  const shelves = [];
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const tilt = (left ? 1 : -1) * rng.range(0.11, 0.16);
    const cx = left ? shelfW / 2 : W - shelfW / 2;
    const cy = y + 50 + i * 250;
    bodies.push(rect(cx, cy, shelfW, 32, { angle: tilt, label: 'sticky', friction: 0.35, restitution: 0 }));
    shelves.push({ cx, cy });
  }
  // No embedded pegs here: sticky damping + pegs wedge balls (damping beats the
  // anti-stall nudge). Shelves alone are verified trap-free.
  return y + h + 130;
}

function funnel(bodies, y, rng) {
  const gap = 360, h = 360, wallLen = 520, angle = 0.48;
  const cx = W / 2 + rng.range(-80, 80);
  bodies.push(rect(cx - gap / 2 - Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 38, { angle }));
  bodies.push(rect(cx + gap / 2 + Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 38, { angle: -angle }));
  return y + h + 130;
}

// ---- Assembly: dense throughout ----------------------------------------

export function buildCourse(rng) {
  const bodies = [], spinnerList = [];
  let y = 360;

  y = pegField(bodies, y, rng, 4);
  y = gates(bodies, y, rng, 2);
  y = dotsOnField(bodies, y, rng, 4);
  y = ringsInField(bodies, y, rng, 2);
  y = stickyZone(bodies, y, rng, 2);
  y = spinnersInField(bodies, spinnerList, y, rng);
  y = diamondsOnField(bodies, y, rng, 2);
  y = bounceField(bodies, y, rng, 3);
  y = gates(bodies, y, rng, 2);
  y = dotsOnField(bodies, y, rng, 3);
  y = pegField(bodies, y, rng, 3);
  y = funnel(bodies, y, rng);

  const finishY = y + 160;
  const courseLength = finishY + 600;

  const wallOpts = { isStatic: true, label: 'wall', restitution: 0.3, friction: 0 };
  bodies.push(Matter.Bodies.rectangle(-40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W + 40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W / 2, courseLength + 100, W * 2, 200, wallOpts));

  const clouds = [];
  for (let cy = 200; cy < courseLength; cy += rng.range(500, 800)) {
    clouds.push({ x: rng.range(60, W - 60), y: cy, s: rng.range(0.6, 1.2) });
  }

  return { bodies, spinners: spinnerList, finishY, courseLength, clouds };
}
