import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;
import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
const { createRace } = await import('../js/physics.js');
const { DEFAULT_BALLS } = await import('../js/balls.js');
const { drawWorld } = await import('../js/draw.js');
const { drawLeaderboard } = await import('../js/hud.js');
const { createCamera } = await import('../js/camera.js');
const { CONFIG } = await import('../js/config.js');

const race = createRace(535303433, DEFAULT_BALLS);
const camera = createCamera(race.course.courseLength);
const canvas = createCanvas(CONFIG.WORLD_W, CONFIG.VIEW_H);
const ctx = canvas.getContext('2d');

const grabAt = [300, 900, 1800, 2700, 3300]; // steps: 5s, 15s, 30s, 45s, 55s
let g = 0;
for (let s = 0; s <= 3600 && !race.finished; s++) {
  race.tick();
  camera.update(race.standings()[0].plugin.ball.bestY, s === 1);
  if (grabAt.includes(s)) {
    drawWorld(ctx, race, camera.y);
    drawLeaderboard(ctx, race.standings());
    fs.writeFileSync(`test/frame_${g++}.png`, canvas.toBuffer('image/png'));
  }
}
console.log('frames rendered, race finished at', (race.step/60).toFixed(1), 's');
