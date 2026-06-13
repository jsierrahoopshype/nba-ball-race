// Physics core. Owns the Matter.js engine and the fixed-timestep simulation.
// Everything here must stay deterministic: fixed delta, seeded RNG only,
// sleeping disabled, no wall-clock reads inside step().

import { CONFIG } from './config.js';
import { createRNG } from './rng.js';
import { buildCourse } from './course.js';
import { makeBalls } from './balls.js';

export function createRace(seed, ballConfigs) {
  const rng = createRNG(seed);

  const engine = Matter.Engine.create({
    enableSleeping: false, // sleeping is non-deterministic across runs; keep off
    gravity: { x: 0, y: CONFIG.GRAVITY_Y },
  });
  // More solver iterations than default: fast balls vs thin segments, fewer tunnels
  engine.positionIterations = 8;
  engine.velocityIterations = 6;

  const course = buildCourse(rng);
  const balls = makeBalls(ballConfigs, rng);
  Matter.Composite.add(engine.world, [...course.bodies, ...balls]);

  // Sticky contact damping: while a ball touches a 'sticky' body, bleed velocity.
  Matter.Events.on(engine, 'collisionActive', (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const ball = a.label === 'ball' ? a : (b.label === 'ball' ? b : null);
      const other = ball === a ? b : a;
      if (!ball || other.label !== 'sticky') continue;
      Matter.Body.setVelocity(ball, {
        x: ball.velocity.x * CONFIG.STICKY_DAMP_X,
        y: ball.velocity.y * CONFIG.STICKY_DAMP_Y,
      });
    }
  });

  const race = {
    seed, engine, balls, course,
    step: 0,
    winner: null,        // ball body once decided
    finished: false,
  };

  race.tick = function tick() {
    if (race.finished) return;
    race.step++;

    // Rotate spinners (step-based, deterministic)
    for (const s of course.spinners) {
      Matter.Body.setAngle(s, s.angle + s.plugin.spinSpeed);
    }
    // Update moving obstacles (pendulums, sliders): position = f(step), deterministic
    for (const m of course.movers) m.update(race.step);

    const leaderBestY = Math.max(...balls.map(b => b.plugin.ball.bestY));

    for (const ball of balls) {
      const p = ball.plugin.ball;
      if (p.finished) continue;

      // Velocity cap: prevents fast balls from tunneling through thin obstacles
      const v = ball.velocity;
      const speed = Math.hypot(v.x, v.y);
      if (speed > CONFIG.MAX_SPEED) {
        const k = CONFIG.MAX_SPEED / speed;
        Matter.Body.setVelocity(ball, { x: v.x * k, y: v.y * k });
      }

      // Region-stall backstop (catches slow-creep that evades the step counter):
      // every CHECK steps, if the ball gained < MIN_GAIN px, phase it through.
      p.regionSteps = (p.regionSteps || 0) + 1;
      if (p.regionMarkY === undefined) p.regionMarkY = ball.position.y;
      if (p.regionSteps >= 480) { // 8 seconds
        if (ball.position.y - p.regionMarkY < 300 && p.ghostSteps === 0) {
          p.ghostSteps = 16;
          ball.collisionFilter.mask = 0;
        }
        p.regionSteps = 0;
        p.regionMarkY = ball.position.y;
      }

      // Progress tracking
      if (ball.position.y > p.bestY + CONFIG.PROGRESS_EPS) {
        p.bestY = ball.position.y;
        p.stallSteps = 0;
      } else {
        p.stallSteps++;
      }

      // Anti-stall failsafe: escalating seeded nudge, never a teleport.
      // Pushes toward the side with more horizontal room (away from the nearer
      // wall) so balls wedged at a throat get freed instead of re-jamming.
      if (p.stallSteps >= CONFIG.STALL_STEPS) {
        const toCenter = (CONFIG.WORLD_W / 2 - ball.position.x);
        const dir = Math.sign(toCenter) || (rng.chance(0.5) ? 1 : -1);
        // Escalate if it keeps failing: each retry within a short window hits harder
        p.nudgeCount = (p.nudgeCount || 0) + 1;
        const n = Math.min(p.nudgeCount, 8);
        const power = 1 + n * 0.7;
        // After several failures the ball is in a deep pocket: pop it UP and out
        // (a big bounce, not a teleport) so gravity can re-route it past the snag.
        const upPop = p.nudgeCount >= 4 ? -CONFIG.NUDGE_Y * (n - 2) : CONFIG.NUDGE_Y * power;
        Matter.Body.setVelocity(ball, {
          x: dir * CONFIG.NUDGE_X * power + rng.range(-3, 3),
          y: upPop,
        });
        p.stallSteps = 0;

        // Ultimate backstop: if nudging has failed many times, the ball is in a
        // pocket the nudge can't clear. Let it phase through obstacles briefly
        // (a quick squeeze-out) so no race can EVER hard-stall on camera. Rare
        // (<1% of races) and far better than a 150s dead clip.
        if (p.nudgeCount >= 10 && p.ghostSteps === 0) {
          p.ghostSteps = 16;
          ball.collisionFilter.mask = 0; // collide with nothing
        }
      } else if (p.stallSteps === 1) {
        p.nudgeCount = 0;
      }

      // Run/restore the ghost window
      if (p.ghostSteps > 0) {
        p.ghostSteps--;
        if (p.ghostSteps === 0) {
          ball.collisionFilter.mask = 0xFFFFFFFF; // collisions back on
          p.nudgeCount = 0;
        }
      }

      // Moderate rubber band: trailing balls get a gentle extra pull downward
      const gap = leaderBestY - p.bestY;
      if (gap > CONFIG.RUBBER_GAP_MIN) {
        const t = Math.min(1, (gap - CONFIG.RUBBER_GAP_MIN) / (CONFIG.RUBBER_GAP_MAX - CONFIG.RUBBER_GAP_MIN));
        Matter.Body.applyForce(ball, ball.position, { x: 0, y: CONFIG.RUBBER_FORCE * ball.mass * t });
      }

      // Finish detection
      if (ball.position.y >= course.finishY) {
        p.finished = true;
        p.finishStep = race.step;
        if (!race.winner) {
          race.winner = ball;
          race.finished = true; // first-to-finish mode (survivor mode comes in Phase 2)
        }
      }
    }

    // Hard timeout safety net
    if (race.step > CONFIG.HARD_TIMEOUT_S * 60 && !race.winner) {
      race.winner = [...balls].sort((a, b) => b.plugin.ball.bestY - a.plugin.ball.bestY)[0];
      race.finished = true;
    }

    Matter.Engine.update(engine, CONFIG.STEP_MS);
  };

  // Sorted standings for the leaderboard / winner logic
  race.standings = function standings() {
    return [...balls].sort((a, b) => {
      const pa = a.plugin.ball, pb = b.plugin.ball;
      if (pa.finished && pb.finished) return pa.finishStep - pb.finishStep;
      if (pa.finished) return -1;
      if (pb.finished) return 1;
      return pb.bestY - pa.bestY;
    });
  };

  return race;
}
