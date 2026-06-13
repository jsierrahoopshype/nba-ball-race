// All the knobs that control race feel and pacing, in one place.
// Phase 2 retune: faster, bouncier, denser. Verified headlessly for ~60s races.

export const CONFIG = {
  // Canvas / world
  WORLD_W: 1080,           // logical world + export width
  VIEW_H: 1920,            // logical canvas height (9:16)
  ZOOM: 1.3,               // camera zoom. Visible world = (W/ZOOM) x (VIEW_H/ZOOM)
  STEP_MS: 1000 / 60,      // fixed physics timestep. Do not change: replays depend on it.

  // Physics feel: bouncy and quick, grind comes from sticky zones and gates
  GRAVITY_Y: 0.97,
  BALL_RADIUS: 54,
  BALL_RESTITUTION: 0.74,
  BALL_FRICTION: 0.015,
  BALL_AIR_FRICTION: 0.006,
  MAX_SPEED: 40,           // px/step velocity cap: prevents tunneling through thin bodies

  // Sticky surfaces: velocity multiplier applied every step while touching
  STICKY_DAMP_X: 0.97,
  STICKY_DAMP_Y: 0.96,

  // Anti-stall failsafe
  STALL_STEPS: 180,        // 3 seconds at 60 Hz
  PROGRESS_EPS: 10,
  NUDGE_X: 6.0,
  NUDGE_Y: 4.5,

  // Rubber band (moderate comebacks)
  RUBBER_GAP_MIN: 900,
  RUBBER_GAP_MAX: 2600,
  RUBBER_FORCE: 0.00075,

  // Race timing
  HARD_TIMEOUT_S: 110,
};
