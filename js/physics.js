// Physics core. Owns the Matter.js engine and the fixed-timestep simulation.
// Deterministic: fixed delta, seeded RNG only, sleeping off, no wall-clock reads.
//
// Race ends only when ALL balls have finished (so we get a full 1st/2nd/3rd...
// standing), with a tail timeout that force-places stragglers after the winner.

import { CONFIG } from './config.js';
import { createRNG } from './rng.js';
import { buildCourse } from './course.js';
import { makeBalls } from './balls.js';

export function createRace(seed, ballConfigs, opts = {}) {
  const rng = createRNG(seed);
  const mode = opts.mode === 'survivor' ? 'survivor' : 'finish';
  const bias = opts.bias && opts.bias.preset !== undefined ? opts.bias : (opts.bias || null);

  const engine = Matter.Engine.create({
    enableSleeping: false,
    gravity: { x: 0, y: CONFIG.GRAVITY_Y },
  });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;

  const course = buildCourse(rng, { mode, preset: opts.preset, analysts: opts.analysts });
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

  function placeFinish(ball) {
    const p = ball.plugin.ball;
    if (p.finished || p.eliminated) return;
    p.finished = true;
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

      // (No catch-up surge or rubber-band: laggards are never sped up. Balance
      // comes from the course itself, choke points that bunch the field, not
      // from invisible forces.)

      // Anti-settle: while nearly stationary, nudge with a downward-biased seeded
      // impulse that RAMPS UP the longer it stays slow, so a ball that lands in a
      // saddle pops free within ~1s instead of creeping visibly for many seconds.
      const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
      if (sp < 1.2) {
        p.slowSteps = (p.slowSteps || 0) + 1;
        const ramp = Math.min(1, p.slowSteps / 36); // 0 -> 1 over ~0.6s
        Matter.Body.setVelocity(ball, {
          x: ball.velocity.x + rng.range(-1.1, 1.1) * (0.5 + ramp),
          y: ball.velocity.y + rng.range(0.4, 1.2) + ramp * 3.2,
        });
      } else {
        p.slowSteps = 0;
      }

      // Silent last-resort insurance only: if a ball still gains almost nothing
      // for 7s (a freak pocket), let it phase through obstacles for a few frames.
      // Designed to essentially never fire now that nothing settles.
      p.regionSteps = (p.regionSteps || 0) + 1;
      if (p.regionMarkY === undefined) p.regionMarkY = ball.position.y;
      if (p.regionSteps >= 420) {
        if (ball.position.y - p.regionMarkY < 250 && p.ghostSteps === 0) {
          p.ghostSteps = 24;
          ball.collisionFilter.mask = 0;
          // strong downward shove WHILE ghosted so it clears the pocket and
          // doesn't just fall back in
          Matter.Body.setVelocity(ball, { x: rng.range(-2, 2), y: 13 });
        }
        p.regionSteps = 0;
        p.regionMarkY = ball.position.y;
      }
      if (p.ghostSteps > 0) {
        p.ghostSteps--;
        if (p.ghostSteps === 0) ball.collisionFilter.mask = 0xFFFFFFFF;
      }

      // Finish line
      if (ball.position.y >= course.finishY) placeFinish(ball);
    }

    // Remove eliminated balls from the world so they vanish (after the loop).
    while (pendingRemoval.length) Matter.Composite.remove(engine.world, pendingRemoval.pop());

    // Survivor mode: if only one ball is still alive (others eliminated), it wins.
    if (mode === 'survivor' && race.eliminatedOrder.length) {
      const alive = balls.filter(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated);
      if (alive.length === 1) placeFinish(alive[0]);
    }

    // Tail timeout: once a winner is in, don't wait forever on stragglers.
    if (race.winner) {
      const tail = race.step - race.winner.plugin.ball.finishStep;
      if (tail > CONFIG.TAIL_S * 60) {
        [...balls].filter(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated)
          .sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)
          .forEach(placeFinish);
      }
    }

    // Absolute safety cap
    if (race.step > CONFIG.HARD_TIMEOUT_S * 60) {
      [...balls].filter(b => !b.plugin.ball.finished && !b.plugin.ball.eliminated)
        .sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)
        .forEach(placeFinish);
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
