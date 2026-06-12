// Leader-follow camera with zoom. Tracks the ball with the most progress.
// Visible world area is (WORLD_W/ZOOM) x (VIEW_H/ZOOM); the camera pans on both
// axes (clamped to course bounds) so the zoomed view stays inside the world.

import { CONFIG } from './config.js';

export function createCamera(courseLength) {
  const visW = CONFIG.WORLD_W / CONFIG.ZOOM;
  const visH = CONFIG.VIEW_H / CONFIG.ZOOM;
  const cam = { x: (CONFIG.WORLD_W - visW) / 2, y: 0, visW, visH };

  cam.update = function update(leaderX, leaderY, snap = false) {
    const tx = Math.max(0, Math.min(leaderX - visW / 2, CONFIG.WORLD_W - visW));
    const ty = Math.max(0, Math.min(leaderY - visH * 0.38, courseLength - visH + 150));
    if (snap) { cam.x = tx; cam.y = ty; }
    else {
      cam.x += (tx - cam.x) * 0.06;
      cam.y += (ty - cam.y) * 0.08;
    }
  };

  return cam;
}
