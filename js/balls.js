// Ball creation. Phase 1 uses placeholder discs (color + initials).
// Phase 3 swaps `image` for real headshots/logos; the schema is already in place.

import { CONFIG } from './config.js';

// Default Phase 1 matchup. Edit freely to test.
export const DEFAULT_BALLS = [
  { id: 'b1', label: 'LBJ', color: '#552583', textColor: '#FDB927' },
  { id: 'b2', label: 'SC',  color: '#1D428A', textColor: '#FFC72C' },
];

export function makeBalls(configs, rng) {
  const n = configs.length;
  const slotW = Math.min(160, (CONFIG.WORLD_W - 200) / Math.max(1, n - 1));
  const startX = CONFIG.WORLD_W / 2 - slotW * (n - 1) / 2;

  return configs.map((cfg, i) => {
    const body = Matter.Bodies.circle(
      startX + i * slotW + rng.range(-6, 6), // tiny seeded spawn jitter
      170 + rng.range(-10, 10),
      CONFIG.BALL_RADIUS,
      {
        label: 'ball',
        restitution: CONFIG.BALL_RESTITUTION,
        friction: CONFIG.BALL_FRICTION,
        frictionAir: CONFIG.BALL_AIR_FRICTION,
        density: 0.0011,
      }
    );
    body.plugin.ball = {
      id: cfg.id,
      label: cfg.label,
      color: cfg.color,
      textColor: cfg.textColor,
      image: cfg.image || null,    // Phase 3: HTMLImageElement
      bestY: body.position.y,      // progress tracking for anti-stall + leaderboard
      stallSteps: 0,
      finished: false,
      finishStep: null,
    };
    return body;
  });
}
