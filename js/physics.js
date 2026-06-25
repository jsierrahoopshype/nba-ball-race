// Physics core. Owns the Matter.js engine and the fixed-timestep simulation.
// Deterministic: fixed delta, seeded RNG only, sleeping off, no wall-clock reads.
//
// Race ends only when ALL balls have finished (so we get a full 1st/2nd/3rd...
// standing), with a tail timeout that force-places stragglers after the winner.

import { CONFIG } from './config.js';
import { createRNG } from './rng.js';
import { buildCourse } from './course.js';
import { makeBalls, ballRadiusForCount } from './balls.js';

export function createRace(seed, ballConfigs, opts = {}) {
  const rng = createRNG(seed);
  const mode = opts.mode === 'survivor' ? 'survivor' : 'finish';
  const bias = opts.bias && opts.bias.preset !== undefined ? opts.bias : (opts.bias || null);

  const engine = Matter.Engine.create({
    enableSleeping: false,
    gravity: { x: 0, y: CONFIG.GRAVITY_Y },
  });
  engine.positionIterations = 18;
  engine.velocityIterations = 12;

  const course = buildCourse(rng, { mode, preset: opts.preset, analysts: opts.analysts, ballR: ballRadiusForCount(ballConfigs.length), lengthScale: opts.lengthScale });
  const balls = makeBalls(ballConfigs, rng);
  Matter.Composite.add(engine.world, [...course.bodies, ...balls]);

  const pendingRemoval = [];

  // Conveyor belts + survivor-mode eliminators (label-driven, deterministic).
  Matter.Events.on(engine, 'collisionActive', (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const ball = a.label === 'ball' ? a : (b.label === 'ball' ? b : null);
      const other = ball === a ? b : a;
      if (!ball) continue;
      const push = other.plugin && other.plugin.conveyor;
      if (push) Matter.Body.setVelocity(ball, { x: push, y: ball.velocity.y });
      if (mode === 'survivor' && other.label === 'eliminator') eliminate(ball);
    }
  });

  const race = {
    seed, engine, balls, course, mode,
    step: 0,
    countdownSteps: opts.countdownS ? Math.round(opts.countdownS * 60) : 0,
    winner: null,         // first ball to cross the line (or lone survivor)
    finishOrder: [],      // balls in the order they finished (final standings)
    eliminatedOrder: [],  // survivor mode: balls in the order they were eliminated
    finished: false,
  };

  // Bias: invisible, deterministic forces that SHIFT a ball's odds (never a
  // guarantee). Per-ball luck is a steady nudge; presets add situational pulls.
  // Strengths are intentionally small so chaos still decides most races.
  function applyBias(ball, p, leadY) {
    const m = ball.mass;
    const luck = (bias.luck && bias.luck[p.id]) || 1;
    if (luck !== 1) Matter.Body.applyForce(ball, ball.position, { x: 0, y: (luck - 1) * CONFIG.LUCK_FORCE * m });

    const preset = bias.preset;
    if (!preset || preset === 'none') return;
    const F = CONFIG.BIAS_FORCE * m;
    const behind = leadY - ball.position.y;
    const isLeader = behind <= 40;
    const lateRace = ball.position.y > course.finishY * 0.68;

    if (preset === 'underdog') {
      if (behind > 200) Matter.Body.applyForce(ball, ball.position, { x: 0, y: F * Math.min(1, behind / 2600) });
    } else if (preset === 'clutch') {
      if (lateRace && behind > 150) Matter.Body.applyForce(ball, ball.position, { x: 0, y: F * 1.3 * Math.min(1, behind / 2000) });
    } else if (preset === 'chokerisk') {
      if (lateRace && isLeader) Matter.Body.applyForce(ball, ball.position, { x: 0, y: -F * 0.6 });
    } else if (preset === 'lebronhate') {
      if (bias.hateId === p.id) Matter.Body.applyForce(ball, ball.position, { x: 0, y: -F * 0.7 });
    } else if (preset === 'mediapressure') {
      for (const an of course.analysts) {
        const dx = ball.position.x - an.position.x, dy = ball.position.y - an.position.y;
        if (dx * dx + dy * dy < 250 * 250) { Matter.Body.applyForce(ball, ball.position, { x: 0, y: -F * 0.55 }); break; }
      }
    }
  }

  function placeFinish(ball, crossed = false) {
    const p = ball.plugin.ball;
    if (p.finished || p.eliminated) return;
    p.finished = true;
    p.crossed = crossed; // true only when the ball actually reached the finish line
    p.finishStep = race.step;
    p.place = race.finishOrder.length + 1;
    race.finishOrder.push(ball);
    if (!race.winner) race.winner = ball;
  }

  function eliminate(ball) {
    const p = ball.plugin.ball;
    if (p.finished || p.eliminated) return;
    p.eliminated = true;
    p.eliminatedStep = race.step;
    race.eliminatedOrder.push(ball);
    pendingRemoval.push(ball); // vanish from the world after the step
  }

  race.tick = function tick() {
    if (race.finished) return;
    race.step++;

    for (const s of course.spinners) Matter.Body.setAngle(s, s.angle + s.plugin.spinSpeed);
    for (const m of course.movers) m.update(race.step);

    // Leader position this tick (for bias presets that target leader/laggards)
    let leadY = -Infinity;
    if (bias) for (const b of balls) { const q = b.plugin.ball; if (!q.finished && !q.eliminated && b.position.y > leadY) leadY = b.position.y; }


    for (const ball of balls) {
      const p = ball.plugin.ball;
      if (p.finished || p.eliminated) continue;

      if (bias) applyBias(ball, p, leadY);

      // Velocity cap: stops fast balls tunneling through thin obstacles
      const v = ball.velocity;
      const speed = Math.hypot(v.x, v.y);
      if (speed > CONFIG.MAX_SPEED) {
        const k = CONFIG.MAX_SPEED / speed;
        Matter.Body.setVelocity(ball, { x: v.x * k, y: v.y * k });
      }

      // Progress tracking (for camera + standings ordering)
      if (ball.position.y > p.bestY) p.bestY = ball.position.y;

      // Pure gravity and collisions: no drift, nudge, rescue, anti-settle, or
      // catch-up. The course geometry alone keeps balls moving (round
      // deflectors, ball-aware gaps, wall semicircles filling the wall corner so
      // nothing wedges against the wall). A stall is a layout bug, fixed in the
      // course, not with a force here.

      // Finish line
      if (ball.position.y >= course.finishY) placeFinish(ball, true);
    }

    // Remove eliminated balls from the world so they vanish (after the loop).
    while (pendingRemoval.length) Matter.Composite.remove(engine.world, pendingRemoval.pop());

    // Survivor mode: if only one ball is still alive (others eliminated), it wins.
    if (mode === 'survivor' && race.eliminatedOrder.length) {
      const alive = balls.filter(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated);
      if (alive.length === 1) placeFinish(alive[0]);
    }

    // Tail timeout: once a winner is in, don't wait forever on stragglers.
    // Skipped in countdown mode, where the buzzer is the real cutoff and every
    // ball must get the full clock to finish (and qualify).
    if (race.winner && !race.countdownSteps) {
      const tail = race.step - race.winner.plugin.ball.finishStep;
      if (tail > CONFIG.TAIL_S * 60) {
        [...balls].filter(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated)
          .sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)
          .forEach(b => placeFinish(b));
      }
    }

    // Absolute safety cap
    if (race.step > CONFIG.HARD_TIMEOUT_S * 60) {
      [...balls].filter(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated)
        .sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)
        .forEach(b => placeFinish(b));
    }

    // Countdown mode: a hard time limit. At the buzzer, freeze and rank everyone
    // where they are. Finishers keep their order; the rest are ranked by how far
    // down the course they got. Side effect: a stuck ball just lands wherever it
    // is, so sticking never drags out the clip.
    if (race.countdownSteps && race.step >= race.countdownSteps) {
      [...balls].filter(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated)
        .sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)
        .forEach(b => placeFinish(b));
    }

    // Race ends when every ball is terminal (finished or eliminated).
    if (balls.every(b => b.plugin.ball.finished || b.plugin.ball.eliminated)) {
      // Rank eliminated balls below finishers: last eliminated places best.
      let place = race.finishOrder.length;
      for (let i = race.eliminatedOrder.length - 1; i >= 0; i--) {
        const p = race.eliminatedOrder[i].plugin.ball;
        if (p.place == null) p.place = ++place;
      }
      if (!race.winner && race.eliminatedOrder.length) {
        race.winner = race.eliminatedOrder[race.eliminatedOrder.length - 1];
      }
      race.finished = true;
    }

    Matter.Engine.update(engine, CONFIG.STEP_MS);
  };

  // Live standings: finished by place, then alive by progress, then eliminated.
  race.standings = function standings() {
    return [...balls].sort((a, b) => {
      const pa = a.plugin.ball, pb = b.plugin.ball;
      const ta = pa.finished, tb = pb.finished;
      if (ta && tb) return pa.place - pb.place;
      if (ta) return -1;
      if (tb) return 1;
      if (pa.eliminated && pb.eliminated) return pb.eliminatedStep - pa.eliminatedStep;
      if (pa.eliminated) return 1;
      if (pb.eliminated) return -1;
      return pb.bestY - pa.bestY;
    });
  };

  return race;
}
