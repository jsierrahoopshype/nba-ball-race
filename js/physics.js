// Physics core. Owns the Matter.js engine and the fixed-timestep simulation.
// Deterministic: fixed delta, seeded RNG only, sleeping off, no wall-clock reads.
//
// Race ends only when ALL balls have finished (so we get a full 1st/2nd/3rd...
// standing), with a tail timeout that force-places stragglers after the winner.

import { CONFIG } from './config.js';
import { createRNG } from './rng.js';
import { buildCourse } from './course.js';
import { makeBalls } from './balls.js';

export function createRace(seed, ballConfigs) {
  const rng = createRNG(seed);

  const engine = Matter.Engine.create({
    enableSleeping: false,
    gravity: { x: 0, y: CONFIG.GRAVITY_Y },
  });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;

  const course = buildCourse(rng);
  const balls = makeBalls(ballConfigs, rng);
  Matter.Composite.add(engine.world, [...course.bodies, ...balls]);

  // Conveyor belts: shove balls sideways on contact (label-driven, deterministic).
  Matter.Events.on(engine, 'collisionActive', (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const ball = a.label === 'ball' ? a : (b.label === 'ball' ? b : null);
      const other = ball === a ? b : a;
      if (!ball) continue;
      const push = other.plugin && other.plugin.conveyor;
      if (push) Matter.Body.setVelocity(ball, { x: push, y: ball.velocity.y });
    }
  });

  const race = {
    seed, engine, balls, course,
    step: 0,
    winner: null,         // first ball to cross the line
    finishOrder: [],      // balls in the order they finished (final standings)
    finished: false,      // true once every ball has finished
  };

  function placeFinish(ball) {
    const p = ball.plugin.ball;
    if (p.finished) return;
    p.finished = true;
    p.finishStep = race.step;
    p.place = race.finishOrder.length + 1;
    race.finishOrder.push(ball);
    if (!race.winner) race.winner = ball;
  }

  race.tick = function tick() {
    if (race.finished) return;
    race.step++;

    for (const s of course.spinners) Matter.Body.setAngle(s, s.angle + s.plugin.spinSpeed);
    for (const m of course.movers) m.update(race.step);


    for (const ball of balls) {
      const p = ball.plugin.ball;
      if (p.finished) continue;

      // Velocity cap: stops fast balls tunneling through thin obstacles
      const v = ball.velocity;
      const speed = Math.hypot(v.x, v.y);
      if (speed > CONFIG.MAX_SPEED) {
        const k = CONFIG.MAX_SPEED / speed;
        Matter.Body.setVelocity(ball, { x: v.x * k, y: v.y * k });
      }

      // Progress tracking (for camera + standings ordering)
      if (ball.position.y > p.bestY) p.bestY = ball.position.y;

      // Thriller finish: in the final stretch, trailing balls get a gentle extra
      // pull scaled by how far behind the leader they are, so the pack bunches and
      // the lead can change in the last second. Subtle enough to look natural.
      if (ball.position.y > course.finishY * CONFIG.SURGE_ZONE) {
        const leadY = Math.max(...balls.map(bb => bb.position.y));
        const behind = leadY - ball.position.y;
        if (behind > 120) {
          Matter.Body.applyForce(ball, ball.position,
            { x: 0, y: CONFIG.SURGE_FORCE * ball.mass * Math.min(1, behind / 1400) });
        }
      }

      // Anti-settle micro-liveliness (replaces the old visible "bump"): while a
      // ball is nearly stationary, apply a tiny seeded impulse, downward-biased,
      // every frame. Too small to read as a pop; it just means balls never sit
      // perfectly still in a saddle, so they always creep off and keep flowing.
      const sp = Math.hypot(ball.velocity.x, ball.velocity.y);
      if (sp < 1.2) {
        Matter.Body.setVelocity(ball, {
          x: ball.velocity.x + rng.range(-1.1, 1.1),
          y: ball.velocity.y + rng.range(0.3, 1.3),
        });
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

    // Tail timeout: once the winner is in, don't wait forever on stragglers.
    if (race.winner) {
      const tail = race.step - race.winner.plugin.ball.finishStep;
      if (tail > CONFIG.TAIL_S * 60) {
        [...balls].filter(b => !b.plugin.ball.finished)
          .sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)
          .forEach(placeFinish);
      }
    }

    // Absolute safety cap
    if (race.step > CONFIG.HARD_TIMEOUT_S * 60) {
      [...balls].filter(b => !b.plugin.ball.finished)
        .sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)
        .forEach(placeFinish);
    }

    if (balls.every(b => b.plugin.ball.finished)) race.finished = true;

    Matter.Engine.update(engine, CONFIG.STEP_MS);
  };

  // Live standings: finished balls by place, then the rest by progress.
  race.standings = function standings() {
    return [...balls].sort((a, b) => {
      const pa = a.plugin.ball, pb = b.plugin.ball;
      if (pa.finished && pb.finished) return pa.place - pb.place;
      if (pa.finished) return -1;
      if (pb.finished) return 1;
      return pb.bestY - pa.bestY;
    });
  };

  return race;
}
