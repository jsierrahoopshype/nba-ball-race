// Course builder. A course is a stack of "blocks" (obstacle rooms) along a long
// vertical world. Each block function places static bodies starting at a given y
// and returns the y where the next block should begin.
//
// DESIGN RULES (learned in testing, do not violate):
// - Every intended passage must be >= 130px wide (ball diameter is 108).
// - A gap of 1..107px between an obstacle and a wall is a permanent trap. Either
//   close it (embed the obstacle into the wall) or widen it past a ball diameter.
// - 45-degree surfaces converging on a wall form rest pockets. Avoid.
// - Ring gaps must include the bottom of the ring so interiors drain by gravity.
// - Near-flat wide surfaces stall balls: tilt everything at least 0.05 rad.
// - Block-to-block vertical clearance must exceed 170px: a block's last body and
//   the next block's first body can otherwise form a wedge narrower than a ball.
//
// Body labels: 'obstacle' | 'sticky' | 'bouncy' | 'wall'

import { CONFIG } from './config.js';

const W = CONFIG.WORLD_W;

function rect(x, y, w, h, opts = {}) {
  return Matter.Bodies.rectangle(x, y, w, h, {
    isStatic: true, label: 'obstacle',
    restitution: 0.25, friction: 0.04,
    ...opts,
  });
}

function peg(x, y, r, opts = {}) {
  return Matter.Bodies.circle(x, y, r, {
    isStatic: true, label: 'obstacle',
    restitution: 0.35, friction: 0.02,
    ...opts,
  });
}

// ---- Blocks ------------------------------------------------------------

// Two angled walls narrowing to a center gap. Compresses the field together.
function funnel(bodies, y, rng) {
  const gap = 240, h = 460, wallLen = 700, angle = 0.58;
  const cx = W / 2 + rng.range(-110, 110);
  bodies.push(rect(cx - gap / 2 - Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 40, { angle }));
  bodies.push(rect(cx + gap / 2 + Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 40, { angle: -angle }));
  return y + h + 180;
}

// Full-width bars with TWO gaps per row (one per half, positions seeded).
// Convergence drama without the 800px slow-roll a single gap caused (profiled).
function gates(bodies, y, rng, rows = 3) {
  const gapW = 185, barH = 46, spacing = 300;
  for (let i = 0; i < rows; i++) {
    const gy = y + i * spacing;
    const gxL = rng.range(180, 400);
    const gxR = rng.range(W - 400, W - 180);
    const leftW = gxL - gapW / 2 + 40;
    const midW = (gxR - gapW / 2) - (gxL + gapW / 2);
    const rightW = (W - gxR - gapW / 2) + 40;
    const midTilt = rng.pick([-1, 1]) * 0.09;
    const dead = { restitution: 0.05, friction: 0.01 };
    if (leftW > 50) bodies.push(rect(leftW / 2 - 40, gy, leftW, barH, { angle: 0.10, ...dead }));
    if (midW > 50) bodies.push(rect(gxL + gapW / 2 + midW / 2, gy, midW, barH, { angle: midTilt, ...dead }));
    if (rightW > 50) bodies.push(rect(W + 40 - rightW / 2, gy, rightW, barH, { angle: -0.10, ...dead }));
  }
  return y + rows * spacing + 170;
}

// Classic alternating peg grid, sized for the bigger Phase 2 balls.
function pegGrid(bodies, y, rng, rows = 4) {
  const spacingX = 212, spacingY = 168, r = 38;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2 === 0) ? 0 : spacingX / 2;
    for (let x = 70 + offset; x < W - 50; x += spacingX) {
      bodies.push(peg(x + rng.range(-8, 8), y + row * spacingY, r));
    }
  }
  return y + rows * spacingY + 170;
}

// Rows of big chunky dots (the reference's signature look). Two layouts alternate;
// all gaps >= 120px, wall lanes are tight squeezes (slow) not traps.
function bigDots(bodies, y, rng, rows = 4) {
  const r = 80, spacingY = 225;
  const layoutA = [220, 540, 860], layoutB = [370, 710];
  for (let row = 0; row < rows; row++) {
    const xs = (row % 2 === 0) ? layoutA : layoutB;
    for (const x of xs) bodies.push(peg(x, y + row * spacingY, r));
  }
  return y + rows * spacingY + 170;
}

// Large ring made of segments with a gap.
function ring(bodies, cx, cy, radius, gapCenterAngle, gapHalfWidth) {
  const segs = 30;
  const segLen = (2 * Math.PI * radius / segs) * 1.18;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let d = Math.abs(((a - gapCenterAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d < gapHalfWidth) continue;
    bodies.push(rect(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, segLen, 30, { angle: a + Math.PI / 2 }));
  }
}

// Two stacked offset rings. Edges stay >= 150px from walls (trap rule).
// Gap center constrained near PI/2 (bottom) so interiors always drain.
function ringMaze(bodies, y, rng) {
  const r1 = 230, r2 = 240;
  const cx1 = rng.range(420, 620);
  ring(bodies, cx1, y + r1 + 30, r1, rng.range(1.2, 1.95), 0.44);
  const cx2 = rng.range(W - 620, W - 420);
  ring(bodies, cx2, y + r1 * 2 + 60 + r2 + 40, r2, rng.range(1.2, 1.95), 0.44);
  return y + (r1 + r2) * 2 + 70 + 180;
}

// Rotated squares. Fixed positions: every passage >= 170px, none near walls.
function diamondLattice(bodies, y, rng, rows = 3) {
  const spacingY = 295;
  for (let row = 0; row < rows; row++) {
    const ry = y + row * spacingY;
    if (row % 2 === 0) {
      bodies.push(rect(330, ry, 170, 170, { angle: Math.PI / 4 }));
      bodies.push(rect(790, ry, 170, 170, { angle: Math.PI / 4 }));
    } else {
      bodies.push(rect(540, ry, 215, 215, { angle: Math.PI / 4 }));
    }
  }
  return y + rows * spacingY + 170;
}

// Alternating sticky shelves. Wider than Phase 1 (720px) so the open drop lane
// is only ~360px and alternates sides: no straight free-fall corridor.
function stickyShelves(bodies, y, rng, count = 3) {
  const shelfW = 600;
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const tilt = (left ? 1 : -1) * rng.range(0.11, 0.16);
    const cx = left ? shelfW / 2 : W - shelfW / 2;
    bodies.push(rect(cx, y + i * 265, shelfW, 32, {
      angle: tilt, label: 'sticky', friction: 0.35, restitution: 0,
    }));
  }
  return y + count * 265 + 180;
}

// Rotating crosses. Chaos agents.
function spinnerPair(bodies, spinners, y, rng) {
  const positions = [
    { x: rng.range(280, 420), y: y + 140 },
    { x: rng.range(W - 420, W - 280), y: y + 560 },
  ];
  for (const p of positions) {
    const armLen = rng.range(340, 410);
    const a = Matter.Bodies.rectangle(p.x, p.y, armLen, 32);
    const b = Matter.Bodies.rectangle(p.x, p.y, armLen, 32, { angle: Math.PI / 2 });
    const cross = Matter.Body.create({
      parts: [a, b], isStatic: true, label: 'obstacle',
      restitution: 0.5, friction: 0.04,
    });
    cross.plugin.spinSpeed = rng.pick([-1, 1]) * rng.range(0.016, 0.024);
    bodies.push(cross);
    spinners.push(cross);
  }
  return y + 560 + 340;
}

// High-restitution pegs: pinball relief between grindy sections.
function bounceZone(bodies, y, rng, rows = 2) {
  const spacingX = 250, spacingY = 205;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2 === 0) ? 70 : spacingX / 2 + 70;
    for (let x = offset; x < W - 50; x += spacingX) {
      bodies.push(peg(x, y + row * spacingY, 46, { label: 'bouncy', restitution: 1.3 }));
    }
  }
  return y + rows * spacingY + 170;
}

// ---- Course assembly ----------------------------------------------------

// Phase 2 preset: dense, alternating grind and release, ~60s for 2 balls.
export function buildCourse(rng) {
  const bodies = [];
  const spinners = [];

  let y = 420;

  y = funnel(bodies, y, rng);
  y = gates(bodies, y, rng, 3);
  y = pegGrid(bodies, y, rng, 4);
  y = stickyShelves(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 3);
  y = ringMaze(bodies, y, rng);
  y = spinnerPair(bodies, spinners, y, rng);
  y = gates(bodies, y, rng, 2);
  y = diamondLattice(bodies, y, rng, 3);
  y = bounceZone(bodies, y, rng, 2);
  y = pegGrid(bodies, y, rng, 3);
  y = stickyShelves(bodies, y, rng, 2);
  y = funnel(bodies, y, rng); // squeezes the field together right before the line

  const finishY = y + 220;
  const courseLength = finishY + 600;

  const wallOpts = { isStatic: true, label: 'wall', restitution: 0.3, friction: 0 };
  bodies.push(Matter.Bodies.rectangle(-40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W + 40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W / 2, courseLength + 100, W * 2, 200, wallOpts));

  const clouds = [];
  for (let cy = 200; cy < courseLength; cy += rng.range(380, 620)) {
    clouds.push({ x: rng.range(60, W - 60), y: cy, s: rng.range(0.7, 1.5) });
  }

  return { bodies, spinners, finishY, courseLength, clouds };
}
