// Course builder. A course is a stack of "blocks" (obstacle rooms) along a long
// vertical world. Each block function places static bodies starting at a given y
// and returns the y where the next block should begin.
//
// Bodies are tagged via body.label:
//   'obstacle' - plain black silhouette
//   'sticky'   - damps ball velocity on contact (grindy drama zones)
//   'bouncy'   - high restitution
//   'wall'     - side walls (drawn as nothing; world edges)
// Spinners are compound bodies collected separately so physics.js can rotate them.

import { CONFIG } from './config.js';

const W = CONFIG.WORLD_W;

function rect(x, y, w, h, opts = {}) {
  return Matter.Bodies.rectangle(x, y, w, h, {
    isStatic: true, label: 'obstacle',
    restitution: 0.1, friction: 0.05,
    ...opts,
  });
}

function peg(x, y, r, opts = {}) {
  return Matter.Bodies.circle(x, y, r, {
    isStatic: true, label: 'obstacle',
    restitution: 0.3, friction: 0.02,
    ...opts,
  });
}

// ---- Blocks ------------------------------------------------------------

// Two angled walls narrowing to a center gap. Compresses the field together.
function funnel(bodies, y, rng) {
  const gap = 230;
  const h = 480;
  const wallLen = 660;
  const angle = 0.62;
  const cx = W / 2 + rng.range(-120, 120); // gap position varies per seed
  bodies.push(rect(cx - gap / 2 - Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 34, { angle }));
  bodies.push(rect(cx + gap / 2 + Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 34, { angle: -angle }));
  return y + h + 180;
}

// Classic alternating peg grid.
function pegGrid(bodies, y, rng, rows = 5) {
  const spacingX = 196, spacingY = 175, r = 36;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2 === 0) ? 0 : spacingX / 2;
    for (let x = 60 + offset; x < W - 40; x += spacingX) {
      bodies.push(peg(x + rng.range(-8, 8), y + row * spacingY, r));
    }
  }
  return y + rows * spacingY + 160;
}

// Large ring made of segments with a gap. Balls circle inside until they find the exit.
function ring(bodies, cx, cy, radius, gapCenterAngle, gapHalfWidth) {
  const segs = 30;
  const segLen = (2 * Math.PI * radius / segs) * 1.18; // slight overlap, no leaks
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    // Leave the gap (handle wrap-around with angular distance)
    let d = Math.abs(((a - gapCenterAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d < gapHalfWidth) continue;
    bodies.push(rect(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, segLen, 26, { angle: a + Math.PI / 2 }));
  }
}

// Two stacked offset rings. Gaps point mostly downward-ish so races flow but grind.
function ringMaze(bodies, y, rng) {
  const r1 = 240, r2 = 250;
  // Placement rule: ring edge stays >= 150px from any wall. Closer than a ball
  // diameter creates a wedge pocket that traps balls permanently (found in testing).
  const cx1 = rng.range(420, 620);
  ring(bodies, cx1, y + r1 + 40, r1, rng.range(1.2, 1.95), 0.42);
  const cx2 = rng.range(W - 620, W - 420);
  ring(bodies, cx2, y + r1 * 2 + 80 + r2 + 60, r2, rng.range(1.2, 1.95), 0.42);
  // Gap center is constrained near the bottom (PI/2 in canvas coords) so a ball
  // that ends up inside a ring always drains out by gravity instead of bowl-trapping.
  return y + (r1 + r2) * 2 + 100 + 200;
}

// Grid of rotated squares (diamonds). Positions are fixed, not random: every
// passage is >= 170px (ball is 100px) and no diamond sits close enough to a wall
// to form a 45-degree wedge pocket (a guaranteed permanent trap).
function diamondLattice(bodies, y, rng, rows = 3) {
  const spacingY = 320;
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

// Alternating sticky shelves. The grindy drama core: balls creep along them.
function stickyShelves(bodies, y, rng, count = 4) {
  const shelfW = 440;
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const tilt = (left ? 1 : -1) * rng.range(0.11, 0.16); // slope toward the drop keeps balls creeping
    const cx = left ? shelfW / 2 : W - shelfW / 2;
    bodies.push(rect(cx, y + i * 280, shelfW, 30, {
      angle: tilt, label: 'sticky', friction: 0.35, restitution: 0,
    }));
  }
  return y + count * 280 + 140;
}

// Rotating crosses. Chaos agents: can fling a ball forward or smack it backward.
function spinnerPair(bodies, spinners, y, rng) {
  const positions = [
    { x: rng.range(260, 400), y: y + 120 },
    { x: rng.range(W - 400, W - 260), y: y + 540 },
  ];
  for (const p of positions) {
    const armLen = rng.range(330, 400);
    const a = Matter.Bodies.rectangle(p.x, p.y, armLen, 30);
    const b = Matter.Bodies.rectangle(p.x, p.y, armLen, 30, { angle: Math.PI / 2 });
    const cross = Matter.Body.create({
      parts: [a, b], isStatic: true, label: 'obstacle',
      restitution: 0.4, friction: 0.05,
    });
    cross.plugin.spinSpeed = rng.pick([-1, 1]) * rng.range(0.014, 0.022); // rad/step
    bodies.push(cross);
    spinners.push(cross);
  }
  return y + 540 + 380;
}

// High-restitution pegs: the pinball relief valve between grindy sections.
function bounceZone(bodies, y, rng, rows = 3) {
  const spacingX = 250, spacingY = 210;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2 === 0) ? 60 : spacingX / 2 + 60;
    for (let x = offset; x < W - 40; x += spacingX) {
      bodies.push(peg(x, y + row * spacingY, 42, { label: 'bouncy', restitution: 1.25 }));
    }
  }
  return y + rows * spacingY + 160;
}

// ---- Course assembly ----------------------------------------------------

// Phase 1 preset: one course, ~60s for 2 balls with default physics.
// Block order alternates grind and release so pacing breathes.
export function buildCourse(rng) {
  const bodies = [];
  const spinners = [];

  let y = 520; // space above first obstacle for the start area

  y = funnel(bodies, y, rng);
  y = pegGrid(bodies, y, rng, 5);
  y = stickyShelves(bodies, y, rng, 3);
  y = ringMaze(bodies, y, rng);
  y = spinnerPair(bodies, spinners, y, rng);
  y = diamondLattice(bodies, y, rng, 3);
  y = bounceZone(bodies, y, rng, 3);
  y = funnel(bodies, y, rng);
  y = pegGrid(bodies, y, rng, 4);
  y = stickyShelves(bodies, y, rng, 2);
  y = ringMaze(bodies, y, rng);
  y = diamondLattice(bodies, y, rng, 2);
  y = stickyShelves(bodies, y, rng, 2);
  y = pegGrid(bodies, y, rng, 3);
  y = bounceZone(bodies, y, rng, 2);
  y = funnel(bodies, y, rng); // squeezes the field together right before the line

  const finishY = y + 260;
  const courseLength = finishY + 600;

  // Side walls along the whole course + floor below the finish
  const wallOpts = { isStatic: true, label: 'wall', restitution: 0.2, friction: 0 };
  bodies.push(Matter.Bodies.rectangle(-40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W + 40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W / 2, courseLength + 100, W * 2, 200, wallOpts));

  // Decorative cloud positions (seeded so replays look identical too)
  const clouds = [];
  for (let cy = 200; cy < courseLength; cy += rng.range(420, 700)) {
    clouds.push({ x: rng.range(60, W - 60), y: cy, s: rng.range(0.7, 1.5) });
  }

  return { bodies, spinners, finishY, courseLength, clouds };
}
