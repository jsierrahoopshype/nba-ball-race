// Course builder. Goal: wall-to-wall density like the reference, near-zero sky,
// plus MOVING obstacles for drama. Feature blocks embed in safe peg grids.
//
// Returns { bodies, spinners, movers, finishY, courseLength, clouds }.
//   spinners: rotated each step (legacy, kept).
//   movers:   [{ body, update(step) }] set deterministically each step by physics.
//
// DESIGN RULES (do not violate, learned in testing):
// - Passages >= 130px (ball diameter up to ~116).
// - No round obstacle edge within 135px of a wall (wall-shoulder trap).
// - Ring gaps must include the bottom so interiors drain.
// - 45-deg surfaces converging on a wall form pockets. Avoid.
// - Block-to-block vertical clearance >= 130px (wedge-trap rule).
// - Moving obstacles: keep a clear margin (no pegs in their swept path) or balls
//   wedge between the mover and a static peg.
//
// Body labels: 'obstacle' | 'sticky' | 'bouncy' | 'wall'

import { CONFIG } from './config.js';

const W = CONFIG.WORLD_W;
let curBallR = 36; // set at the start of buildCourse so gates/gaps scale with ball size

function rect(x, y, w, h, opts = {}) {
  const b = Matter.Bodies.rectangle(x, y, w, h, { isStatic: true, label: 'obstacle', friction: 0.004, ...opts });
  // assign restitution AFTER creation (Matter zeroes it for static bodies set
  // via options) so balls bounce off and keep flowing instead of dead-stopping.
  b.restitution = opts.restitution != null ? opts.restitution : 0.46;
  return b;
}
function peg(x, y, r, opts = {}) {
  const b = Matter.Bodies.circle(x, y, r, { isStatic: true, label: 'obstacle', friction: 0.004, ...opts });
  b.restitution = opts.restitution != null ? opts.restitution : 0.5;
  return b;
}

function gridPegs(bodies, y, h, rng, r = 32, skipFn = null) {
  const sx = 2 * r + Math.round(2.9 * curBallR), sy = Math.round(2 * r + 1.7 * curBallR);
  // first peg sits far enough from the wall that the channel between them is
  // always wider than a ball (peg radius + ~1.5x ball diameter).
  const x0 = r + Math.round(3 * curBallR), x1 = W - r - Math.round(3 * curBallR);
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

// Round wall posts down both margins so a ball can't free-fall the edge, but
// being round they just deflect it inward (no V-notch to wedge in). Global pass.
function edgePosts(bodies, yTop, yBot, rng) {
  const R = 74, spacing = 230;
  let i = 0;
  for (let yy = yTop; yy < yBot; yy += spacing, i++) {
    if (i % 2 === 0) bodies.push(peg(64, yy, R, { restitution: 0.45 }));
    else bodies.push(peg(W - 64, yy + spacing / 2, R, { restitution: 0.45 }));
  }
}

// Edge guards for OPEN blocks: a near-solid column of dots at x=95 / W-95, the
// SAME column the dot fields use, so they're collinear (never form a saddle with
// a neighbor) and just block the margin so balls can't free-fall the side.
// Sparse big-dot scatter across the FULL width (reaches the walls) that skips
// around a central feature. Fills the side margins so balls can't free-fall the
// edge, while the skip-zone keeps dots off the feature so no pocket forms. Round
// + wide-spaced (gap ~119px > ball) so balls pass through, nothing wedges.
function scatterDots(bodies, y, h, rng, skip) {
  const R = 58, x0 = 92, x1 = W - 92;
  const sx = 2 * R + Math.round(2.9 * curBallR);
  const sy = Math.round(2 * R + 1.6 * curBallR);
  let row = 0;
  for (let yy = y + 70; yy < y + h - 40; yy += sy, row++) {
    const off = (row % 2) ? sx / 2 : 0;
    for (let x = x0 + off; x <= x1; x += sx) {
      if (skip && skip(x, yy)) continue;
      bodies.push(peg(x + rng.range(-6, 6), yy, R, { restitution: 0.5 }));
    }
  }
}

// Wall ramps: flush at the wall (no gap behind), sloping down-and-inward to a
// free tip, so a ball riding the margin slides off into open space toward center
// instead of free-falling or wedging. Alternating sides down the block. Used in
// OPEN blocks whose central feature is kept clear of the margin.
function rampLine(bodies, yTop, yBot, rng) {
  // Round bumps half-embedded in the wall, alternating sides. They nudge balls
  // back toward centre but, being round and flush to the wall, present no corner
  // or ledge a ball can wedge or rest on. Pure deflection, no trap.
  const R = 96, sp = 300;
  let i = Math.floor(yTop / sp);
  for (let yy = yTop + 60; yy < yBot - 20; yy += sp, i++) {
    const left = i % 2 === 0;
    const x = left ? -R * 0.35 : W + R * 0.35; // mostly inside the wall, bulges ~62px in
    bodies.push(peg(x, yy, R, { restitution: 0.3 }));
  }
}

// Half-disk flush on a side wall, flat edge ON the wall (no gap behind it to
// wedge in), curved face bulging inward. Labeled 'obstacle' so it renders.
function wallSemi(side, cy, R) {
  const wallX = side === 'L' ? 0 : W, sign = side === 'L' ? 1 : -1, steps = 10, verts = [];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (i / steps) * Math.PI;
    verts.push({ x: wallX + sign * R * Math.cos(t), y: cy + R * Math.sin(t) });
  }
  const cxoff = sign * (4 * R / (3 * Math.PI));
  return Matter.Bodies.fromVertices(wallX + cxoff, cy, [verts],
    { isStatic: true, label: 'obstacle', restitution: 0.45, friction: 0.004 });
}

// ---- Static filler blocks ----------------------------------------------

// Reference-style BLOB CHANNEL: a full-width mass of big overlapping circles with
// a wide serpentine channel carved through it. Rounded walls + a wide, roughly
// constant gap mean balls flow down smoothly and cannot wedge or bridge (the
// failure mode of thin bars and narrow funnel holes). This is the signature look.
function blobChannel(bodies, y, rng, rows = 12) {
  const R = 82, sx = 104, sy = 96, halfGap = 250; // dense overlap = smooth blob surface, no saddles
  const amp = rng.range(70, 115), freq = rng.range(0.006, 0.010), phase = rng.range(0, 6.28); // gentle bends, free flow
  const h = rows * sy + 80;
  for (let r = 0; r < rows; r++) {
    const yy = y + 60 + r * sy;
    const cx = W / 2 + amp * Math.sin((y + r * sy) * freq + phase);
    const off = (r % 2) ? sx / 2 : 0;
    for (let x = -10 + off; x <= W + 10; x += sx) {
      if (Math.abs(x - cx) < halfGap) continue; // carve the wide flowing channel
      bodies.push(peg(x, yy, R, { restitution: 0.4, friction: 0.004 }));
    }
  }
  return y + h + 90;
}

// Big dots, generously spaced and staggered (reference frames 5-6). Edge dots
// sit against the walls so the margins aren't a clear drop. Round + wide-spaced,
// so balls cascade through without jamming.
// Symmetric pachinko opener. Mirror-symmetric about the centre line and full
// width, so every spawn position (left, centre, right) meets the same wall of
// pegs and no ball gets a free side lane or a faster side. This is the first
// thing the field hits, so the start is fair; the seeded slot shuffle in
// makeBalls then decorrelates identity from position across seeds.
function fairStart(bodies, y, rng) {
  // A big round splitter dead-centre, right under the spawn: the cluster hits it
  // and rolls off to both sides (symmetric, so fair; round, so nothing settles).
  // Then two symmetric rows of round pegs mix the field. Gaps are ball-aware.
  bodies.push(peg(W / 2, y + 150, 150, { restitution: 0.5 }));
  const R = 58;
  const sx = 2 * R + Math.round(2.9 * curBallR);
  const sy = Math.round(2 * R + 1.7 * curBallR);
  const half = Math.ceil((W / 2) / sx) + 1;
  for (let r = 0; r < 2; r++) {
    const ry = y + 150 + 230 + r * sy;
    const centred = (r % 2 === 1);
    for (let k = -half; k <= half; k++) {
      const x = W / 2 + (centred ? k * sx : (k + 0.5) * sx);
      if (x < 80 || x > W - 80) continue;
      bodies.push(peg(x, ry, R, { restitution: 0.5 }));
    }
  }
  return y + 150 + 230 + 2 * sy + 90;
}

function bigDots(bodies, y, rng, rows = 4) {
  const R = 72, semiR = 84;
  const sx = 2 * R + Math.round(2.9 * curBallR);
  const sy = Math.round(2 * R + 1.6 * curBallR);
  // first interior dot sits far enough from the wall bump that the channel
  // between them is always wider than a ball (semi bulge + dot radius + gap).
  const edge = semiR + R + Math.round(2.9 * curBallR);
  for (let r = 0; r < rows; r++) {
    const ry = y + 70 + r * sy;
    const off = (r % 2) ? sx / 2 : 0;
    for (let x = edge + off; x <= W - edge; x += sx) {
      bodies.push(peg(x + rng.range(-8, 8), ry, R, { restitution: 0.5 }));
    }
    const L = wallSemi('L', ry, semiR); if (L) bodies.push(L);
    const Rr = wallSemi('R', ry, semiR); if (Rr) bodies.push(Rr);
  }
  return y + rows * sy + 120;
}

// Big smooth domes (reference's rounded caps): balls roll up and over, shedding
// to either side. Convex only, so nothing pools. Gap fully open below.
function archRamps(bodies, y, rng, count = 2) {
  const h = 620;
  const domes = [];
  for (let i = 0; i < count; i++) {
    const radius = rng.range(200, 250);
    const cx = rng.range(210 + radius, W - 210 - radius); // keep dome clear of the margin
    const cy = y + 260 + i * 280;
    domes.push({ cx, cy, radius });
    const segs = Math.round(radius / 11);
    for (let k = 0; k <= segs; k++) {
      const a = Math.PI + (k / segs) * Math.PI;
      const px = cx + Math.cos(a) * radius, py = cy + Math.sin(a) * radius;
      const segLen = (Math.PI * radius / segs) * 1.25;
      bodies.push(rect(px, py, segLen, 24, { angle: a + Math.PI / 2, restitution: 0.42 }));
    }
  }
  rampLine(bodies, y, y + h, rng);
  return y + h + 100;
}

function pegField(bodies, y, rng, rows = 5) {
  gridPegs(bodies, y, rows * 150 + 40, rng, 36); // gap 184-72=112 > ball d100
  return y + rows * 150 + 140;
}

function dotsOnField(bodies, y, rng, rows = 4) {
  const dotR = 56, dotSy = 200, h = rows * dotSy + 110;
  const dots = [];
  for (let row = 0; row < rows; row++) {
    const xs = (row % 2 === 0) ? [260, 540, 820] : [150, 400, 680, 930]; // edge dots on B rows
    for (const x of xs) { bodies.push(peg(x, y + 60 + row * dotSy, dotR)); dots.push({x, y: y + 60 + row * dotSy}); }
  }
  // staggered pegs fill remaining gaps incl. the side gutters (no clear margin)
  gridPegs(bodies, y, h, rng, 30, (px, py) => dots.some(d => Math.hypot(px - d.x, py - d.y) < dotR + 55));
  return y + h;
}

// Full-width bars, two seeded gaps per row. Bars are now bouncy (was dead/sluggish).
function gates(bodies, y, rng, rows = 3) {
  const gapW = 185, barH = 44, spacing = 235;
  for (let i = 0; i < rows; i++) {
    const gy = y + i * spacing + 40;
    const gxL = rng.range(180, 400), gxR = rng.range(W - 400, W - 180);
    const leftW = gxL - gapW / 2 + 40;
    const midW = (gxR - gapW / 2) - (gxL + gapW / 2);
    const rightW = (W - gxR - gapW / 2) + 40;
    const live = { restitution: 0.32, friction: 0.02 }; // bouncier so balls don't deaden
    if (leftW > 50) bodies.push(rect(leftW / 2 - 40, gy, leftW, barH, { angle: 0.10, ...live }));
    if (midW > 50) bodies.push(rect(gxL + gapW / 2 + midW / 2, gy, midW, barH, { angle: rng.pick([-1,1]) * 0.09, ...live }));
    if (rightW > 50) bodies.push(rect(W + 40 - rightW / 2, gy, rightW, barH, { angle: -0.10, ...live }));
  }
  return y + rows * spacing + 120;
}

function ringSegments(bodies, cx, cy, radius, gapCenter, gapHalf) {
  const segs = 32, segLen = (2 * Math.PI * radius / segs) * 1.18;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let d = Math.abs(((a - gapCenter + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (d < gapHalf) continue;
    bodies.push(rect(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, segLen, 28, { angle: a + Math.PI / 2, restitution: 0.45 }));
  }
}

function ringsInField(bodies, y, rng, count = 2) {
  const r = 200, sy = 215;
  const rings = [];
  for (let i = 0; i < count; i++) {
    const cx = rng.range(460, W - 460); // ring edges clear the ramp tips by >100px
    const cy = y + r + 40 + i * sy;
    rings.push({ cx, cy });
    ringSegments(bodies, cx, cy, r, rng.range(1.25, 1.9), 0.46);
  }
  const h = r + (count - 1) * sy + r + 80;
  gridPegs(bodies, y, h, rng, 32, (px, py) => px < 215 || px > W - 215 || rings.some(rg => Math.hypot(px - rg.cx, py - rg.cy) < r + 140));
  rampLine(bodies, y, y + h, rng);
  return y + h + 120;
}

function diamondsOnField(bodies, y, rng, rows = 2) {
  const sy = 280, h = rows * sy + 40;
  const dia = [];
  for (let row = 0; row < rows; row++) {
    const ry = y + 60 + row * sy;
    const xs = (row % 2 === 0) ? [300, 540, 780] : [420, 660];
    for (const x of xs) { bodies.push(rect(x, ry, 160, 160, { angle: Math.PI / 4 })); dia.push({ x, y: ry }); }
  }
  gridPegs(bodies, y, h, rng, 30, (px, py) => dia.some(d => Math.abs(px - d.x) < 165 && Math.abs(py - d.y) < 165));
  return y + h + 120;
}

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
    const cross = Matter.Body.create({ parts: [a, b], isStatic: true, label: 'obstacle', restitution: 0.55, friction: 0.04 });
    cross.plugin.spinSpeed = rng.pick([-1, 1]) * rng.range(0.009, 0.014);
    bodies.push(cross); spinnerList.push(cross);
  }
  const h = 620;
  gridPegs(bodies, y, h, rng, 32, (px, py) => spots.some(s => Math.hypot(px - s.x, py - s.y) < 285));
  return y + h + 120;
}

function bounceField(bodies, y, rng, rows = 3) {
  const sx = 195, sy = 175, x0 = 150, x1 = W - 150; // gap 195-84=111 > d100
  for (let row = 0; row < rows; row++) {
    const off = (row % 2 === 0) ? 0 : sx / 2;
    for (let x = x0 + off; x <= x1; x += sx) {
      bodies.push(peg(x, y + 40 + row * sy, 42, { label: 'bouncy', restitution: 0.9 }));
    }
  }
  return y + rows * sy + 120;
}

function stickyZone(bodies, y, rng, count = 2) {
  const shelfW = 600, h = count * 250 + 40;
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const tilt = (left ? 1 : -1) * rng.range(0.12, 0.17);
    const cx = left ? shelfW / 2 : W - shelfW / 2;
    bodies.push(rect(cx, y + 50 + i * 250, shelfW, 32, { angle: tilt, label: 'sticky', friction: 0.3, restitution: 0 }));
  }
  return y + h + 120;
}

function funnel(bodies, y, rng) {
  const gap = 360, h = 360, wallLen = 520, angle = 0.48;
  const cx = W / 2 + rng.range(-80, 80);
  bodies.push(rect(cx - gap / 2 - Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 54, { angle, restitution: 0.4 }));
  bodies.push(rect(cx + gap / 2 + Math.cos(angle) * wallLen / 2, y + h / 2, wallLen, 54, { angle: -angle, restitution: 0.4 }));
  return y + h + 120;
}

// Embudo (full-width funnel): two ramps span the ENTIRE width down to a center
// hole. Every ball, even one hugging a wall, slides to the hole. This hard-gates
// the field (slows + bunches the pack) and makes edge-diving impossible here.
// Safe: ramps slope DOWN toward the hole, so the wall corner is the high point
// (no pooling). Below the hole, a short lip on each side stops a straight shot.
function embudo(bodies, y, rng) {
  const holeW = rng.range(190, 240);
  const cx = W / 2 + rng.range(-60, 60);
  const rampLen = (W / 2) + 80;
  const ang = 0.42;
  const ry = y + 240;
  // left ramp: wall end high, hole end low (slopes down toward the hole)
  bodies.push(rect(cx - holeW / 2 - Math.cos(ang) * rampLen / 2, ry - Math.sin(ang) * rampLen / 2,
                   rampLen, 40, { angle: ang, restitution: 0.3, friction: 0.01 }));
  // right ramp: mirror
  bodies.push(rect(cx + holeW / 2 + Math.cos(ang) * rampLen / 2, ry - Math.sin(ang) * rampLen / 2,
                   rampLen, 40, { angle: -ang, restitution: 0.3, friction: 0.01 }));
  // (No catch-lips: two converging bars below a hole form an undrained V that
  // traps balls. The clean V above drains through the hole; that's enough.)
  return y + 460;
}

// Turbine: a big 4-arm rotor (bigger, slower than a spinner) that sweeps the lane.
function turbine(bodies, movers, y, rng) {
  const cx = W / 2, cy = y + 320, arm = 360;
  const parts = [];
  for (let k = 0; k < 4; k++) parts.push(Matter.Bodies.rectangle(cx, cy, arm, 46, { angle: k * Math.PI / 4 }));
  const rotor = Matter.Body.create({ parts, isStatic: true, label: 'obstacle', restitution: 0.6, friction: 0.03 });
  const spd = rng.pick([-1, 1]) * rng.range(0.007, 0.012);
  bodies.push(rotor);
  movers.push({ body: rotor, update(step) { Matter.Body.setAngle(rotor, step * spd); } });
  bodies.push(peg(cx, cy, 64)); // solid hub: balls bounce off instead of wedging between blades
  // pegs around it (clear of the swept circle)
  gridPegs(bodies, y, 640, rng, 30, (px, py) => px < 215 || px > W - 215 || Math.hypot(px - cx, py - cy) < arm / 2 + 70);
  rampLine(bodies, y, y + 640, rng);
  return y + 640 + 120;
}

// Pop-bumper cluster: pinball-style ACTIVE bumpers (very high restitution) that
// fling balls. Adds chaos and keeps energy up without speeding the descent.
// Choke point: two big smooth bulges from the walls narrowing the lane to a wide
// neck (~330px, well above bridging width), then opening back up. Big radius =
// gentle curve, so the field bunches as it funnels through but nothing wedges.
// Placed before chaotic sections so the re-sorted pack can swap the lead.
function chokePoint(bodies, y, rng, ballR = curBallR) {
  const R = 360, neck = Math.max(380, Math.round(ballR * 8)), cy = y + R - 40;
  const xL = (W - neck) / 2 - R;
  const xR = (W + neck) / 2 + R;
  bodies.push(peg(xL, cy, R, { restitution: 0.4, friction: 0.004 }));
  bodies.push(peg(xR, cy, R, { restitution: 0.4, friction: 0.004 }));
  return y + 2 * R - 40;
}

function popBumpers(bodies, y, rng) {
  const spots = [[330, 150], [540, 280], [750, 150], [430, 430], [650, 430]];
  for (const [x, dy] of spots) bodies.push(peg(x, y + dy, 58, { label: 'bouncy', restitution: 0.95 }));
  rampLine(bodies, y, y + 600, rng);
  return y + 600;
}

// Zigzag chute: alternating baffles from each wall force a single-file S-path.
// Big slowdown (balls queue). Channel openings >= 150px so no jam.
function zigzagChute(bodies, y, rng, steps = 5) {
  const baffleW = W * 0.66, baffleH = 30, sy = 230;
  for (let i = 0; i < steps; i++) {
    const left = i % 2 === 0;
    const cx = left ? baffleW / 2 - 20 : W - baffleW / 2 + 20;
    const tilt = (left ? 1 : -1) * 0.16; // slope toward the opening
    bodies.push(rect(cx, y + 120 + i * sy, baffleW, baffleH, { angle: tilt, restitution: 0.25, friction: 0.01 }));
  }
  return y + steps * sy + 200;
}

// Spiral maze: nested ~300-degree arcs with offset openings. A ball winds around
// each arc to its gap, drops inward, repeats, exiting at the center-bottom.
function spiralMaze(bodies, y, rng) {
  const cx = W / 2, cy = y + 360;
  const radii = [320, 230, 140];
  let gap = rng.range(0, Math.PI * 2);
  for (const r of radii) {
    const segs = Math.round(r / 9);
    const gapHalf = 0.55;
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      let d = Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < gapHalf) continue;
      const segLen = (2 * Math.PI * r / segs) * 1.2;
      bodies.push(rect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, segLen, 24, { angle: a + Math.PI / 2, restitution: 0.35 }));
    }
    gap += Math.PI; // offset each ring's opening so the ball has to travel around
  }
  return y + 720 + 120;
}

// Trapdoors: a funnel to a center hole with a sliding DOOR that covers/uncovers
// the hole on a timer. Balls pool on the funnel while shut, then drop when open.
function trapdoors(bodies, movers, y, rng) {
  const cx = W / 2, holeW = 200, ry = y + 240, rampLen = (W / 2) + 80, ang = 0.40;
  bodies.push(rect(cx - holeW / 2 - Math.cos(ang) * rampLen / 2, ry - Math.sin(ang) * rampLen / 2, rampLen, 38, { angle: ang, restitution: 0.3, friction: 0.01 }));
  bodies.push(rect(cx + holeW / 2 + Math.cos(ang) * rampLen / 2, ry - Math.sin(ang) * rampLen / 2, rampLen, 38, { angle: -ang, restitution: 0.3, friction: 0.01 }));
  // the door: a bar that slides across the hole, fully clearing it when "open"
  const door = Matter.Bodies.rectangle(cx, ry + 30, holeW + 40, 30, { isStatic: true, label: 'obstacle', restitution: 0.2, friction: 0.02 });
  bodies.push(door);
  const period = rng.range(150, 210); // steps per open/close cycle
  movers.push({
    body: door,
    update(step) {
      const open = (Math.floor(step / period) % 2) === 1;
      // slide the door fully off to the side when open, back over the hole when shut
      Matter.Body.setPosition(door, { x: open ? cx + W : cx, y: ry + 30 });
    },
  });
  return y + 480;
}

// Conveyor: a wide near-flat belt that shoves balls sideways on contact (label
// carries the push direction). Handled in physics via collisionActive.
function conveyor(bodies, y, rng) {
  const dir = rng.pick([-1, 1]);
  const belt = rect(W / 2, y + 160, W - 220, 36, { angle: dir * 0.04, restitution: 0.1, friction: 0.2 });
  belt.plugin.conveyor = dir * 7; // px/step horizontal push
  bodies.push(belt);
  // a wall on the push-side end so balls don't ride straight off into the gutter;
  // they spill over a gap at the far end
  return y + 360;
}

// Seesaw: a center-pivoted bar that tilts smoothly back and forth on a timer
// (kinematic, set each step). The earlier dynamic version vibrated; this is a
// clean, deterministic see-saw motion that still bats balls left/right.
function seesaw(bodies, movers, y, rng) {
  const cx = W / 2, cy = y + 220;
  const bar = Matter.Bodies.rectangle(cx, cy, 520, 52, {
    isStatic: true, label: 'obstacle', restitution: 0.35, friction: 0.04,
  });
  bodies.push(bar);
  bodies.push(peg(cx, cy, 40)); // hub: keeps balls off the dead-centre pivot
  const amp = rng.range(0.42, 0.55);
  const spd = rng.range(0.016, 0.024);
  const phase = rng.range(0, Math.PI * 2);
  movers.push({
    body: bar,
    update(step) { Matter.Body.setAngle(bar, amp * Math.sin(step * spd + phase)); },
  });
  rampLine(bodies, y, y + 440, rng);
  return y + 440;
}

// Plinko nested funnels: a big funnel whose hole drops onto two smaller funnels,
// splitting the field. Classic Plinko branching.
function plinkoFunnels(bodies, y, rng) {
  const ang = 0.46;
  const big = (cx, yy, holeW, span) => {
    const len = span;
    bodies.push(rect(cx - holeW / 2 - Math.cos(ang) * len / 2, yy - Math.sin(ang) * len / 2, len, 34, { angle: ang, restitution: 0.3 }));
    bodies.push(rect(cx + holeW / 2 + Math.cos(ang) * len / 2, yy - Math.sin(ang) * len / 2, len, 34, { angle: -ang, restitution: 0.3 }));
  };
  big(W / 2, y + 200, 180, W / 2 + 60);          // top funnel spanning full width
  big(W * 0.28, y + 470, 150, W * 0.40);          // lower-left
  big(W * 0.72, y + 470, 150, W * 0.40);          // lower-right
  return y + 680;
}

// ---- MOVING obstacle blocks (deterministic, position = f(step)) ---------

// Pendulum bars: rigid bars that swing from a fixed pivot, sweeping the lane and
// batting balls sideways. Top end stays at the pivot; angle = amp*sin(step*spd).
function pendulums(bodies, movers, y, rng, count = 4) {
  const L = 360, barH = 28, h = 640;
  const pivotY = y + 120;
  for (let i = 0; i < count; i++) {
    const px = (count === 1) ? W / 2 : 200 + i * ((W - 400) / (count - 1));
    const amp = rng.range(0.7, 1.0);
    const spd = rng.range(0.010, 0.016) * rng.pick([-1, 1]);
    const phase = rng.range(0, Math.PI * 2);
    bodies.push(peg(px, pivotY, 16)); // visual pivot anchor
    const bar = Matter.Bodies.rectangle(px, pivotY + L / 2, barH, L, {
      isStatic: true, label: 'obstacle', restitution: 0.55, friction: 0.03,
    });
    bodies.push(bar);
    movers.push({
      body: bar,
      update(step) {
        const theta = amp * Math.sin(step * spd + phase);
        Matter.Body.setPosition(bar, { x: px + Math.sin(theta) * (L / 2), y: pivotY + Math.cos(theta) * (L / 2) });
        Matter.Body.setAngle(bar, theta);
      },
    });
  }
  // light peg fill below the swing arc only (keep the arc clear)
  gridPegs(bodies, y + L + 120, h - L - 120, rng, 32);
  return y + h + 120;
}

// Sliding bars: horizontal bars that oscillate left-right across the lane,
// offset in phase so the gaps shift like sliding doors.
function sliders(bodies, movers, y, rng, count = 3) {
  const barW = 440, barH = 52, sy = 200, h = count * sy + 60;
  for (let i = 0; i < count; i++) {
    const cy = y + 80 + i * sy;
    const base = (i % 2 === 0) ? W * 0.35 : W * 0.65;
    const amp = rng.range(170, 230);
    const spd = rng.range(0.011, 0.018);
    const phase = rng.range(0, Math.PI * 2);
    const bar = Matter.Bodies.rectangle(base, cy, barW, barH, {
      isStatic: true, label: 'obstacle', restitution: 0.45, friction: 0.02,
    });
    bodies.push(bar);
    movers.push({
      body: bar,
      update(step) {
        Matter.Body.setPosition(bar, { x: base + Math.sin(step * spd + phase) * amp, y: cy });
      },
    });
  }
  return y + h + 120;
}

// Wall deflectors: short ledges jutting from each wall, sloping DOWN toward the
// center, staggered down both walls. They kill the side-gutter free-fall exploit
// (a ball hugging a wall gets kicked back inward) without trapping: the inner end
// is the low end, so balls always slide off it and drop back into play.
function wallDeflectors(bodies, yTop, yBot, rng) {
  const len = 300, hH = 26, spacing = 300, ang = 0.24;
  let i = 0;
  for (let y = yTop; y < yBot; y += spacing, i++) {
    const left = (i % 2 === 0);
    if (left) {
      // wall end high (x small), inner end low: positive slope. Center placed so
      // the bar spans x:[0..~290].
      const cx = Math.cos(ang) * len / 2;
      bodies.push(rect(cx, y + Math.sin(ang) * len / 2, len, hH, { angle: ang, restitution: 0.3, friction: 0.005 }));
    } else {
      const cx = W - Math.cos(ang) * len / 2;
      bodies.push(rect(cx, y + Math.sin(ang) * len / 2, len, hH, { angle: -ang, restitution: 0.3, friction: 0.005 }));
    }
  }
}

// Rotating ring: a ring whose GAP sweeps around, so balls must time their exit.
// Embedded in a peg field. Added to movers (angle = step * speed).
function rotatingRing(bodies, movers, y, rng) {
  const r = 210;
  const cx = W / 2, cy = y + r + 60;
  const segs = 30, gapHalf = 0.5;
  const parts = [];
  for (let k = 0; k < segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    if (Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI) < gapHalf) continue;
    const segLen = (2 * Math.PI * r / segs) * 1.2;
    parts.push(Matter.Bodies.rectangle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, segLen, 26, { angle: a + Math.PI / 2 }));
  }
  const ring = Matter.Body.create({ parts, isStatic: true, label: 'obstacle', restitution: 0.45, friction: 0.01 });
  const spd = rng.pick([-1, 1]) * rng.range(0.008, 0.014);
  bodies.push(ring);
  movers.push({ body: ring, update(step) { Matter.Body.setAngle(ring, step * spd); } });
  const h = r * 2 + 120;
  gridPegs(bodies, y, h, rng, 32, (px, py) => Math.hypot(px - cx, py - cy) < r + 130);
  return y + h + 120;
}

// ---- Assembly: dense, varied, longer -----------------------------------

// Narrow finish: two big smooth bulges funnel the whole field into a tight gate
// (~240px) right at the goal line. Makes the end hard, kills free-fall to the
// line, and forces a bottleneck finish instead of a wide-open drop-in.
function finishFunnel(bodies, y, rng, ballR = curBallR) {
  // Narrow finish, but the gate scales with ball size so big balls still pass.
  const R = 460, gate = Math.max(235, Math.round(ballR * 5.2));
  const cy = y + R - 150;
  const xL = (W - gate) / 2 - R;
  const xR = (W + gate) / 2 + R;
  bodies.push(peg(xL, cy, R, { friction: 0.006 }));
  bodies.push(peg(xR, cy, R, { friction: 0.006 }));
  return cy; // the gate (narrowest point) is the goal line
}

// One orbiting body (bubble or emoji) circling a center. Static + kinematic
// (engine sets its position each step), so balls bounce off it as it moves.
function makeOrbiter(bodies, movers, cx, cy, orbitR, bodyR, label, rng, phase0) {
  const phase = phase0 != null ? phase0 : rng.range(0, Math.PI * 2);
  const speed = rng.pick([-1, 1]) * rng.range(0.012, 0.019);
  const body = Matter.Bodies.circle(cx + Math.cos(phase) * orbitR, cy + Math.sin(phase) * orbitR, bodyR,
    { isStatic: true, label, restitution: 0.8, friction: 0.002 });
  bodies.push(body);
  movers.push({
    update: (step) => {
      const a = phase + step * speed;
      Matter.Body.setPosition(body, { x: cx + Math.cos(a) * orbitR, y: cy + Math.sin(a) * orbitR });
    },
  });
  return body;
}

// Analyst gauntlet: a dedicated, dots-free stretch where analysts stand in PAIRS
// side by side, blocking most of the width (balls squeeze the channels between
// and beside them). Each face carries an orbiting comic bubble and orbiting
// emoji obstacles. Returns the new y and the face bodies.
function analystGauntlet(bodies, movers, y, rng, aList) {
  const faces = [];
  if (!aList.length) return { y, faces };
  const bandH = 760, faceR = 175;
  for (let i = 0; i < aList.length; i += 2) {
    const pair = aList.slice(i, i + 2);
    const cy = y + bandH / 2;
    const xs = pair.length === 2 ? [W * 0.29, W * 0.71] : [W * 0.5];
    pair.forEach((a, k) => {
      const ax = xs[k];
      const face = peg(ax, cy, faceR, { restitution: 0.5, friction: 0.004 });
      face.label = 'analyst';
      face.plugin.analyst = {
        name: a.name || '', image: a.image || null, speech: a.speech || '',
        bubbleBody: null, emojiBodies: [],
      };
      bodies.push(face); faces.push(face);

      if (a.speech && a.speech.trim()) {
        const bubble = makeOrbiter(bodies, movers, ax, cy, faceR + 72, 70, 'analystbubble', rng, 0);
        bubble.plugin.bubble = { cx: ax, cy, orbitR: faceR + 72, faceR, speech: a.speech.trim() };
        face.plugin.analyst.bubbleBody = bubble;
      }
      const glyphs = [...((a.emoji || '').trim())].filter((g) => g.trim()).slice(0, 4);
      glyphs.forEach((g, gi) => {
        const phase = Math.PI + (gi + 1) * (Math.PI * 1.2 / (glyphs.length + 1));
        const eb = makeOrbiter(bodies, movers, ax, cy, faceR + 66, 58, 'analystemoji', rng, phase);
        eb.plugin.emoji = { glyph: g };
        face.plugin.analyst.emojiBodies.push(eb);
      });
    });
    y += bandH;
  }
  return { y, faces };
}

// Start funnel: right below the spawn, two big bulges leave a central gate so
// the WHOLE field is channeled through the middle together. Kills the long
// open drop where outer balls used to free-fall and build a lead. Returns the y
// where the real course should begin.
function startFunnel(bodies, rng, ballR = curBallR) {
  // Gate scales with ball size so big balls (few players) never wedge.
  const R = 460, gate = Math.max(440, Math.round(ballR * 8)), cy = 300 + R - 150;
  bodies.push(peg((W - gate) / 2 - R, cy, R, { friction: 0.005 }));
  bodies.push(peg((W + gate) / 2 + R, cy, R, { friction: 0.005 }));
  return cy + 200;
}

// Zigzag cascade: alternating angled ledges that overlap horizontally, so a
// ball can never drop straight through (no free-fall) and never rest flat
// (every ledge is tilted downhill toward its open end). Balls weave left-right
// down the cascade. Ledges alternate sides so nothing piles in the middle.
function baffleComb(bodies, y, rng, rows = 3, ballR = curBallR) {
  const barH = 58, slope = 0.52, ledgeLen = W * 0.5;
  for (let r = 0; r < rows; r++) {
    const ry = y + 130 + r * 200;
    const left = r % 2 === 0;
    // overlap the wall by 60px so there's NO gap between wall and ledge end for
    // a ball to wedge into; the ledge tilts downhill toward the open centre.
    const cx = left ? (ledgeLen / 2 - 60) : (W - ledgeLen / 2 + 60);
    const angle = left ? slope : -slope;
    bodies.push(rect(cx, ry, ledgeLen, barH, { angle, restitution: 0.45, friction: 0.0005 }));
  }
  return y + 130 + rows * 200 + 60;
}

// Spinner bar: a long bar pinned at center that rotates across the whole lane,
// sweeping balls sideways and blocking a clean vertical drop as it turns.
function spinnerBar(bodies, movers, y, rng) {
  const cy = y + 260, len = 560;
  const bar = rect(W / 2, cy, len, 50, { restitution: 0.4, friction: 0.01 });
  bodies.push(bar);
  const spin = rng.pick([-1, 1]) * rng.range(0.013, 0.02);
  const phase = rng.range(0, Math.PI);
  movers.push({ update: (step) => Matter.Body.setAngle(bar, phase + step * spin) });
  return y + 520;
}

// ---- Course presets -----------------------------------------------------
// Each layout returns the final y. They compose only blocks proven not to stick
// (dots with wall semicircles, ramps, chokes, bumpers, the tested movers).
// 'classic' is the balanced default and is left exactly as it was.
function layoutClassic(bodies, movers, rng, startY = 360) {
  let y = startY;
  y = fairStart(bodies, y, rng);
  y = bigDots(bodies, y, rng, 4);
  y = chokePoint(bodies, y, rng);
  y = baffleComb(bodies, y, rng, 3);
  y = bigDots(bodies, y, rng, 4);
  y = turbine(bodies, movers, y, rng);
  y = chokePoint(bodies, y, rng);
  y = bigDots(bodies, y, rng, 4);
  y = pendulums(bodies, movers, y, rng, 3);
  y = baffleComb(bodies, y, rng, 3);
  y = bigDots(bodies, y, rng, 4);
  y = spinnerBar(bodies, movers, y, rng);
  y = chokePoint(bodies, y, rng);
  y = bigDots(bodies, y, rng, 4);
  y = pendulums(bodies, movers, y, rng, 3);
  y = seesaw(bodies, movers, y, rng);
  y = baffleComb(bodies, y, rng, 3);
  y = bigDots(bodies, y, rng, 4);
  y = chokePoint(bodies, y, rng);
  y = turbine(bodies, movers, y, rng);
  y = bigDots(bodies, y, rng, 4);
  y = sliders(bodies, movers, y, rng, 3);
  y = baffleComb(bodies, y, rng, 3);
  y = bigDots(bodies, y, rng, 4);
  return y;
}

function layoutChaos(bodies, movers, rng, startY = 360) {
  let y = startY;
  y = archRamps(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 3);
  y = chokePoint(bodies, y, rng);
  y = turbine(bodies, movers, y, rng);
  y = bigDots(bodies, y, rng, 3);
  y = pendulums(bodies, movers, y, rng, 4);
  y = chokePoint(bodies, y, rng);
  y = popBumpers(bodies, y, rng);
  y = bigDots(bodies, y, rng, 3);
  y = sliders(bodies, movers, y, rng, 3);
  y = chokePoint(bodies, y, rng);
  y = turbine(bodies, movers, y, rng);
  y = bigDots(bodies, y, rng, 3);
  y = popBumpers(bodies, y, rng);
  y = bigDots(bodies, y, rng, 3);
  return y;
}

function layoutGrind(bodies, movers, rng, startY = 360) {
  let y = startY;
  y = archRamps(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 4);
  y = chokePoint(bodies, y, rng);
  y = bigDots(bodies, y, rng, 4);
  y = chokePoint(bodies, y, rng);
  y = ringsInField(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 4);
  y = chokePoint(bodies, y, rng);
  y = bigDots(bodies, y, rng, 4);
  y = seesaw(bodies, movers, y, rng);
  y = bigDots(bodies, y, rng, 4);
  y = chokePoint(bodies, y, rng);
  y = bigDots(bodies, y, rng, 4);
  return y;
}

function layoutPinball(bodies, movers, rng, startY = 360) {
  let y = startY;
  y = archRamps(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 3);
  y = popBumpers(bodies, y, rng);
  y = ringsInField(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 3);
  y = popBumpers(bodies, y, rng);
  y = chokePoint(bodies, y, rng);
  y = popBumpers(bodies, y, rng);
  y = ringsInField(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 3);
  y = popBumpers(bodies, y, rng);
  y = bigDots(bodies, y, rng, 4);
  return y;
}

// Shuffle: a seeded random ordering of self-contained feature segments, each
// ending in a dot field so balls always re-settle into a sortable channel.
function layoutShuffle(bodies, movers, rng, startY = 360) {
  let y = startY;
  y = archRamps(bodies, y, rng, 2);
  y = bigDots(bodies, y, rng, 3);
  const segs = [
    (yy) => { yy = turbine(bodies, movers, yy, rng); return bigDots(bodies, yy, rng, 3); },
    (yy) => { yy = pendulums(bodies, movers, yy, rng, 3); return bigDots(bodies, yy, rng, 3); },
    (yy) => { yy = ringsInField(bodies, yy, rng, 2); return bigDots(bodies, yy, rng, 3); },
    (yy) => { yy = seesaw(bodies, movers, yy, rng); return bigDots(bodies, yy, rng, 3); },
    (yy) => { yy = sliders(bodies, movers, yy, rng, 3); return bigDots(bodies, yy, rng, 3); },
    (yy) => { yy = popBumpers(bodies, yy, rng); return bigDots(bodies, yy, rng, 3); },
  ];
  // Fisher-Yates with the seeded rng
  for (let i = segs.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [segs[i], segs[j]] = [segs[j], segs[i]];
  }
  segs.forEach((seg, i) => {
    if (i % 2 === 0) y = chokePoint(bodies, y, rng); // choke before every other feature
    y = seg(y);
  });
  y = bigDots(bodies, y, rng, 3);
  return y;
}

const LAYOUTS = {
  classic: layoutClassic, chaos: layoutChaos, grind: layoutGrind,
  pinball: layoutPinball, shuffle: layoutShuffle,
};

export function buildCourse(rng, opts = {}) {
  const mode = opts.mode === 'survivor' ? 'survivor' : 'finish';
  curBallR = opts.ballR || 36;
  const layout = LAYOUTS[opts.preset] || layoutClassic;
  const bodies = [], spinnerList = [], movers = [];
  const startY = startFunnel(bodies, rng);
  let y = layout(bodies, movers, rng, startY);

  // Analyst gauntlet: dedicated paired walls right before the finish.
  const gaunt = analystGauntlet(bodies, movers, y, rng, opts.analysts || []);
  y = gaunt.y;
  const analysts = gaunt.faces;

  // Shared hard finish for every preset: one last dense bumper scatter then a
  // narrow funnel gate. No free-fall to the line; the goal is a tight bottleneck.
  y = popBumpers(bodies, y, rng);
  const finishY = finishFunnel(bodies, y, rng);

  const courseLength = finishY + 600;

  // (edge posts temporarily disabled for isolation)

  const wallOpts = { isStatic: true, label: 'wall', restitution: 0.3, friction: 0 };
  bodies.push(Matter.Bodies.rectangle(-40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W + 40, courseLength / 2, 80, courseLength + 800, wallOpts));
  bodies.push(Matter.Bodies.rectangle(W / 2, courseLength + 100, W * 2, 200, wallOpts));

  const clouds = [];
  for (let cy = 200; cy < courseLength; cy += rng.range(500, 800)) {
    clouds.push({ x: rng.range(60, W - 60), y: cy, s: rng.range(0.6, 1.2) });
  }

  // Survivor mode: scatter eliminator hazards (red spinning blades) through the
  // mid-lane. A ball that touches one is out. Spaced so the field thins steadily
  // rather than all at once. Deterministic spin via the spinners list.
  const eliminators = [];
  if (mode === 'survivor') {
    const first = 1500, last = finishY - 700;
    for (let ey = first; ey < last; ey += rng.range(1500, 2100)) {
      const ex = rng.range(330, W - 330);
      const arm = rng.range(150, 200);
      const a = Matter.Bodies.rectangle(ex, ey, arm, 30, { label: 'eliminator' });
      const b2 = Matter.Bodies.rectangle(ex, ey, arm, 30, { angle: Math.PI / 2, label: 'eliminator' });
      const blade = Matter.Body.create({
        parts: [a, b2], isStatic: true, label: 'eliminator', restitution: 0.5,
      });
      blade.plugin.spinSpeed = rng.pick([-1, 1]) * rng.range(0.03, 0.05);
      bodies.push(blade);
      spinnerList.push(blade);
      eliminators.push(blade);
    }
  }

  return { bodies, spinners: spinnerList, movers, finishY, courseLength, clouds, eliminators, analysts, mode };
}
