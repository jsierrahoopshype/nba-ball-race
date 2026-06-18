// Vertical-follow camera. At ZOOM=1 the full course width is always in frame, so
// the camera never pans horizontally (matches the reference). It only scrolls
// down, tracking the leading ball. The leaderX arg is ignored by design.

import { CONFIG } from './config.js';

export function createCamera(courseLength) {
  const visW = CONFIG.WORLD_W / CONFIG.ZOOM;
  const visH = CONFIG.VIEW_H / CONFIG.ZOOM;
  const cam = { x: (CONFIG.WORLD_W - visW) / 2, y: 0, visW, visH };

  cam.update = function update(_leaderX, leaderY, snap = false) {
    // x stays fixed (centered). Only y follows the leader.
    const ty = Math.max(0, Math.min(leaderY - visH * 0.27, courseLength - visH + 150));
    cam.y = snap ? ty : cam.y + (ty - cam.y) * 0.08;
  };

  return cam;
}
