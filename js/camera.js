// Leader-follow camera at a FIXED zoom (no dynamic zoom-out). It tracks the
// front of the race: the midpoint of the top two balls, so the leader and
// runner-up are always framed. Trailing balls may drift off the top; that's by
// design. Horizontal stays centered (no pan).

import { CONFIG } from './config.js';

export function createCamera(courseLength) {
  const visW = CONFIG.WORLD_W / CONFIG.ZOOM;
  const visH = CONFIG.VIEW_H / CONFIG.ZOOM;
  const cam = { x: (CONFIG.WORLD_W - visW) / 2, y: 0, zoom: CONFIG.ZOOM, visW, visH };

  // update(leaderX, leaderY, snap, balls?) - leaderX unused. If balls are
  // passed, focus on the midpoint of the two frontrunners; otherwise leaderY.
  cam.update = function update(_leaderX, leaderY, snap = false, balls = null) {
    let focus = leaderY;
    if (balls) {
      const ys = balls
        .filter((b) => !b.plugin.ball.finished && !b.plugin.ball.eliminated)
        .map((b) => b.position.y)
        .sort((a, b) => b - a); // furthest down first
      if (ys.length >= 2) focus = (ys[0] + ys[1]) / 2;
      else if (ys.length) focus = ys[0];
    }
    // leader sits a bit below centre so there's room to see what's coming
    const ty = Math.max(0, Math.min(focus - visH * 0.42, courseLength - visH + 150));
    cam.y = snap ? ty : cam.y + (ty - cam.y) * 0.12;
  };

  return cam;
}
