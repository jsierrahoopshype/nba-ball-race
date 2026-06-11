// Leader-follow camera. Tracks the ball with the most progress, keeps it at
// ~38% from the top of frame so viewers see what's coming, smooths with lerp.

import { CONFIG } from './config.js';

export function createCamera(courseLength) {
  const cam = { y: 0 };

  cam.update = function update(leaderY, snap = false) {
    const target = Math.max(0, Math.min(
      leaderY - CONFIG.VIEW_H * 0.38,
      courseLength - CONFIG.VIEW_H + 200
    ));
    cam.y = snap ? target : cam.y + (target - cam.y) * 0.08;
  };

  return cam;
}
