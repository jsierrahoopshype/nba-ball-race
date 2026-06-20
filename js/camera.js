// Pack-framing camera. It keeps ALL active racers in frame by zooming to fit
// the pack's vertical extent, then centering on the pack. When the field is
// tight it zooms in (big faces); when it strings out it zooms out so nobody
// falls off the top or bottom. Horizontal stays centered (no pan).

import { CONFIG } from './config.js';

export function createCamera(courseLength) {
  const MAXZ = CONFIG.ZOOM;   // tightest framing (biggest faces)
  const MINZ = 0.5;           // widest framing (pack very spread)
  const cam = { x: 0, y: 0, zoom: MAXZ, visW: CONFIG.WORLD_W / MAXZ, visH: CONFIG.VIEW_H / MAXZ };

  function applyZoom(z) {
    cam.zoom = z;
    cam.visW = CONFIG.WORLD_W / z;
    cam.visH = CONFIG.VIEW_H / z;
    cam.x = (CONFIG.WORLD_W - cam.visW) / 2; // centered; negative when zoomed out (shows sky margins)
  }
  applyZoom(MAXZ);

  // update(leaderX, leaderY, snap, balls?) - leaderX kept for call-site
  // compatibility but unused. If `balls` is passed we frame the whole pack;
  // otherwise we fall back to following leaderY.
  cam.update = function update(_leaderX, leaderY, snap = false, balls = null) {
    let minY = null, maxY = null;
    if (balls) {
      for (const b of balls) {
        const p = b.plugin.ball;
        if (p.finished || p.eliminated) continue;
        const y = b.position.y;
        if (minY === null || y < minY) minY = y;
        if (maxY === null || y > maxY) maxY = y;
      }
    }
    let targetZoom = MAXZ, centerY = leaderY;
    if (minY !== null) {
      // margin leaves room for the head overhang above the topmost face and a
      // little lead room below the lowest so it isn't glued to the edge.
      const margin = 620;
      const extent = (maxY - minY) + margin;
      targetZoom = Math.max(MINZ, Math.min(MAXZ, CONFIG.VIEW_H / extent));
      centerY = (minY + maxY) / 2;
    }
    const z = snap ? targetZoom : cam.zoom + (targetZoom - cam.zoom) * 0.05;
    applyZoom(z);
    const ty = Math.max(0, Math.min(centerY - cam.visH * 0.5, courseLength - cam.visH + 150));
    cam.y = snap ? ty : cam.y + (ty - cam.y) * 0.09;
  };

  return cam;
}
