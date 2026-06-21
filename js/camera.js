// Leader-follow camera at a FIXED zoom (no dynamic zoom-out). It tracks the
// front of the race: the midpoint of the top two balls, so the leader and
// runner-up are always framed. Trailing balls may drift off the top; that's by
// design. Horizontal stays centered (no pan).

import { CONFIG } from './config.js';

export function createCamera(courseLength) {
  const visW = CONFIG.WORLD_W / CONFIG.ZOOM;
  const visH = CONFIG.VIEW_H / CONFIG.ZOOM;
  const cam = { x: (CONFIG.WORLD_W - visW) / 2, y: 0, zoom: CONFIG.ZOOM, visW, visH };

  // update(leaderX, leaderY, snap, balls?) - always follows the FIRST ball
  // (the leader = furthest down the course). Trailing balls drift off the top.
  cam.update = function update(_leaderX, leaderY, snap = false, balls = null) {
    let focus = leaderY;
    if (balls) {
      let maxY = -Infinity;
      for (const b of balls) {
        const p = b.plugin.ball;
        if (p.finished || p.eliminated) continue;
        if (b.position.y > maxY) maxY = b.position.y;
      }
      if (maxY > -Infinity) focus = maxY;
    }
    // leader sits a bit above centre so the course ahead is visible
    const ty = Math.max(0, Math.min(focus - visH * 0.4, courseLength - visH + 150));
    cam.y = snap ? ty : cam.y + (ty - cam.y) * 0.14;
  };

  return cam;
}
