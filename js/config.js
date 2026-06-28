// All the knobs that control race feel and pacing, in one place.
// Phase 2 retune: faster, bouncier, denser. Verified headlessly for ~60s races.

export const CONFIG = {
  // Canvas / world
  WORLD_W: 1080,           // logical world + export width
  VIEW_H: 1920,            // logical canvas height (9:16)
  ZOOM: 1.0,               // max zoom (tightest framing); the camera zooms OUT from here to fit the pack
  STEP_MS: 1000 / 60,      // fixed physics timestep. Do not change: replays depend on it.

  // Physics feel: bouncy and quick, grind comes from sticky zones and gates
  GRAVITY_Y: 1.05,
  BALL_RADIUS: 54,        // base; actual radius scales with ball count (see balls.js)
  BALL_RESTITUTION: 0.46,   // 20% bouncier balls
  LEADER_BOUNCE: 0.726,     // leader bounce on the normal course (was 0.66, +10%)
  LEADER_BOUNCE_FINISH: 0.924, // leader bounce in the 0.84 finish plinko (+10% over it)
  BALL_FRICTION: 0.001,    // marble glides
  BALL_AIR_FRICTION: 0.0034,  // calmer descent
  MAX_SPEED: 30,           // lower top speed: calmer motion, no tunneling

  // Sticky surfaces: velocity multiplier applied every step while touching
  STICKY_DAMP_X: 0.97,
  STICKY_DAMP_Y: 0.96,

  // Anti-stall failsafe
  STALL_STEPS: 180,        // 3 seconds at 60 Hz
  PROGRESS_EPS: 10,
  NUDGE_X: 5.0,
  NUDGE_Y: 3.0,
  // Minimal anti-stick: a ball moving slower than STILL_SPEED for STILL_STEPS is
  // resting on an obstacle; give it ONE small nudge to roll off. Fires only when
  // stuck, so normal falling is untouched.
  STILL_SPEED: 0.9,
  STILL_STEPS: 42,         // ~0.7s without progress before a dislodge

  // Rubber band (moderate comebacks)
  RUBBER_GAP_MIN: 900,
  RUBBER_GAP_MAX: 2600,
  RUBBER_FORCE: 0.00075,

  // Race timing
  HARD_TIMEOUT_S: 120,
  TAIL_S: 14,              // after the winner finishes, force-place any ball still going

  LUCK_FORCE: 0.00016,     // per-ball luck: steady nudge per (luck-1). Subtle: shifts odds, never guarantees
  BIAS_FORCE: 0.0012,      // strength of preset bias pulls (underdog/clutch/choke/etc.)
  SURGE_ZONE: 0.72,        // last fraction of course where trailing balls catch up
  SURGE_FORCE: 0.0016,     // strength of the late catch-up (keeps finishes close)
};
