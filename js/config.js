// All the knobs that control race feel and pacing, in one place.
// Tuned in headless testing for a ~60s two-ball race on the default course.

export const CONFIG = {
  // Canvas / world
  WORLD_W: 1080,           // logical world + export width
  VIEW_H: 1920,            // logical viewport height (9:16)
  STEP_MS: 1000 / 60,      // fixed physics timestep. Do not change: replays depend on it.

  // Physics feel ("grindy with drama")
  GRAVITY_Y: 0.78,
  BALL_RADIUS: 50,
  BALL_RESTITUTION: 0.45,
  BALL_FRICTION: 0.02,
  BALL_AIR_FRICTION: 0.014,

  // Sticky surfaces: velocity multiplier applied every step while touching
  STICKY_DAMP_X: 0.97,
  STICKY_DAMP_Y: 0.96,

  // Anti-stall failsafe: if a ball makes < PROGRESS_EPS px of downward progress
  // for STALL_STEPS steps, give it a small seeded nudge.
  STALL_STEPS: 180,        // 3 seconds at 60 Hz
  PROGRESS_EPS: 10,
  NUDGE_X: 6.0,            // max horizontal nudge velocity
  NUDGE_Y: 4.5,

  // Rubber band (moderate comebacks): gentle extra pull on trailing balls.
  RUBBER_GAP_MIN: 900,     // px behind the leader before it kicks in
  RUBBER_GAP_MAX: 2600,    // gap at which the effect maxes out
  RUBBER_FORCE: 0.00075,   // per unit mass, scaled by gap. Keep small: must be invisible.

  // Race timing
  HARD_TIMEOUT_S: 150,     // absolute cap so a broken race can never run forever
};
