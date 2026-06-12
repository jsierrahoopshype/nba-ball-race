// Course builder. Dense, wall-to-wall obstacle rooms stacked along a tall world,
// modeled on the reference: the frame is almost always full of obstacles, balls
// are always interacting. Empty sky is the enemy of pace.
//
// DESIGN RULES (learned the hard way in testing, do not violate):
// - Every intended passage must be >= 130px wide (ball diameter is 108).
// - A 1..107px gap between an obstacle and a wall is a permanent trap. Close it
//   (embed into the wall) or widen it past a ball diameter.
// - 45-degree surfaces converging on a wall form rest pockets. Avoid.
// - Ring gaps must include the bottom so interiors drain by gravity.
// - Tilt near-flat wide surfaces at least 0.05 rad or balls stall on them.
// - Block-to-block vertical clearance must exceed 170px (wedge-trap rule).
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

// ---- Blocks (each spans full width, stacks tightly) --------------------

// Dense peg field: 5 rows, alternating offset, fills the whole width.
function pegField(bodies, y, rng, rows = 5) {
  const sy = 150, r = 40, x0 = 170, x1 = W - 170, sx = 148;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2 === 0) ? 0 : sx / 2;
    for (let x = x0 + off; x <= x1; x += sx) {
      bodies.push(peg(x + rng.range(-5, 5), y + row * sy, r));
    }
  }
  return y + rows * sy + 175;
}

// Big chunky dots, reference's signature. Two interlocking layouts; lanes flow.
function bigDots(bodies, y, rng, rows = 4) {
  const r = 66, sy = 205;
  const A = [230, 540, 850], B = [385, 695]; // all lanes >= 155px
  for (let row = 0; row < rows; row++) {
    for (const x of (row % 2 === 0 ? A : B)) bodies.push(peg(x, y + row * sy, r));
  }
  return y + rows * sy + 175;
}

// Full-width bars, two seeded gaps per row, gentle tilt toward the holes.
function gates(bodies, y, rng, rows = 3) {
  const gapW = 180, barH = 44, spacing = 250;
  for (let i = 0; i < rows; i++) {
    const gy = y + i * spacing;
    const gxL = rng.range(170, 400), gxR = rng.range(W - 400, W - 170);
    const leftW = gxL - gapW / 2 + 40;
    const midW = (gxR - gapW / 2) - (gxL + gapW / 2);
    const rightW = (W - gxR - gapW / 2) + 40;
    const dead = { restitution: 0.05, friction: 0.01 };
    if (leftW > 50) bodies.push(rect(leftW / 2 - 40, gy, leftW, barH, { angle: 0.10, ...dead }));
    if (midW > 50) bodies.push(rect(gxL + gapW / 2 + midW / 2, gy, midW, barH, { angle: rng.pick([-1,1]) * 0.09, ...dead }));
    if (rightW > 50) bodies.push(rect(W + 40 - rightW / 2, gy, rightW, barH, { angle: -0.10, ...dead }));
  }
  return y + rows * spacing + 175;
}

// Ring segments with a gap.
function ringBody(bodies, cx, cy, radius, gapCenter, gapHalf) {
  const segs = 32, segLen = (2 * Math.PI * radius / segs) * 1.18;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let d = Math.abs(((a - gapCenter + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d < gapHalf) continue;
    bodies.push(rect(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, segLen, 28, { angle: a + Math.PI / 2 }));
  }
}

// Stacked single rings (reference look). Each centered in the safe middle band
// (>=140px from walls), gap near the bottom so interiors always drain by gravity.
// Vertical stacking avoids the wall/inter-ring pockets that side-by-side rings form.
function ringCluster(bodies, y, rng, count = 2) {
  const r = 215, sy = 210;
  for (let i = 0; i < count; i++) {
    const cx = rng.range(360, 720); // edges stay 145..935: safe from both walls
    ringBody(bodies, cx, y + r + i * sy, r, rng.range(1.25, 1.9), 0.46);
  }
  return y + r + (count - 1) * sy + r + 175;
}

// Diamond grid filling the width. Fixed safe positions.
function diamonds(bodies, y, rng, rows = 3) {
  const sy = 280;
  for (let row = 0; row < rows; row++) {
    const ry = y + row * sy;
    if (row % 2 === 0) {
      bodies.push(rect(250, ry, 165, 165, { angle: Math.PI / 4 }));
      bodies.push(rect(540, ry, 165, 165, { angle: Math.PI / 4 }));
      bodies.push(rect(830, ry, 165, 165, { angle: Math.PI / 4 }));
    } else {
      bodies.push(rect(395, ry, 200, 200, { angle: Math.PI / 4 }));
      bodies.push(rect(685, ry, 200, 200, { angle: Math.PI / 4 }));
    }
  }
  return y + rows * sy + 175;
}

// Serpentine walls: alternating ledges from each side forcing switchbacks.
// New block, dense and original. Each ledge tilts down toward its open side.
function serpentine(bodies, y, rng, count = 4) {
  const ledgeW = 760, h = 32, sy = 230;
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const cx = left ? ledgeW / 2 - 20 : W - ledgeW / 2 + 20;
    const tilt = (left ? 1 : -1) * rng.range(0.10, 0.14);
    bodies.push(rect(cx, y + i * sy, ledgeW, h, { angle: tilt, restitution: 0.2, friction: 0.04 }));
  }
  return y + count * sy + 175;
}

// Sticky shelves: the grind zones. Wide, alternating, tilted to keep balls creeping.
function stickyShelves(bodies, y, rng, count = 3) {
  const shelfW = 640;
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const tilt = (left ? 1 : -1) * rng.range(0.11, 0.16);
    const cx = left ? shelfW / 2 : W - shelfW / 2;
    bodies.push(rect(cx, y + i * 255, shelfW, 32, { angle: tilt, label: 'sticky', friction: 0.35, restitution: 0 }));
  }
  return y + count * 255 + 175;
}

// Rotating crosses.
function spinners(bodies, spinnerList, y, rng) {
  const spots = [
    { x: rng.range(260, 380), y: y + 150 },
    { x: W / 2, y: y + 470 },
    { x: rng.range(W - 380, W - 260), y: y + 150 },
  ];
  for (const p of spots) {
    const len = rng.range(300, 360);
    const a = Matter.Bodies.rectangle(p.x, p.y, len, 30);
    const b = Matter.Bodies.rectangle(p.x, p.y, len, 30, { angle: Math.PI / 2 });
    const cross = Matter.Body.create({ parts: [a, b], isStatic: true, label: 'obstacle', restitution: 0.5, friction: 0.04 });
    cross.plugin.spinSpeed = rng.pick([-1, 1]) * rng.range(0.016, 0.024);
    bodies.push(cross); spinnerList.push(cross);
  }
  return y + 620 + 175;
}

// Bouncy pinball pegs: relief valve + visual variety.
function bounceZone(bodies, y, rng, rows = 3) {
  const sx = 196, sy = 195, x0 = 175, x1 = W - 175;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2 === 0) ? 0 : sx / 2;
    for (let x = x0 + off; x <= x1; x += sx) {
      bodies.push(peg(x, y + row * sy, 44, { label: 'bouncy', restitution: 1.32 }));
    }
  }
  return y + rows * sy + 175;
}

// Narrowing funnel.
function funnel(bodies, y, rng) {
  const gap = 360, h = 380, wallLen = 560, angle = 0.50;
  const cx = W / 2 + rng.range(-90, 90);
  bodies.push(rect(cx - gap / 2 - Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 38, { angle }));
  bodies.push(rect(cx + gap / 2 + Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 38, { angle: -angle }));
  return y + h + 175;
}

// ---- Assembly -----------------------------------------------------------

export function buildCourse(rng) {
  const bodies = [], spinnerList = [];
  let y = 380;

  y = pegField(bodies, y, rng, 4);
  y = gates(bodies, y, rng, 2);
  y = serpentine(bodies, y, rng, 3);
  y = bigDots(bodies, y, rng, 3);
  y = ringCluster(bodies, y, rng);
  y = diamonds(bodies, y, rng, 2);
  y = bounceZone(bodies, y, rng, 2);
  y = spinners(bodies, spinnerList, y, rng);
  y = serpentine(bodies, y, rng, 3);
  y = funnel(bodies, y, rng);

  const finishY = y + 200;
  const courseLength = finishY + 600;

  const wallOpts = { isStatic: true, label: 'wall', restitution: 0.3, friction: 0 };
  bodies.push(Matter.Bodies.rectangle(-40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W + 40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W / 2, courseLength + 100, W * 2, 200, wallOpts));

  const clouds = [];
  for (let cy = 200; cy < courseLength; cy += rng.range(420, 680)) {
    clouds.push({ x: rng.range(60, W - 60), y: cy, s: rng.range(0.7, 1.4) });
  }

  return { bodies, spinners: spinnerList, finishY, courseLength, clouds };
}
