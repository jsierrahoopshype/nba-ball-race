import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;
import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
const { createRace } = await import('../js/physics.js');
const { PALETTE } = await import('../js/balls.js');
const { drawWorld } = await import('../js/draw.js');
const { drawLeaderboard } = await import('../js/hud.js');
const { createCamera } = await import('../js/camera.js');
const { CONFIG } = await import('../js/config.js');

const configs = PALETTE.slice(0, 4).map((p, i) => ({ id: `b${i}`, label: ['LBJ','SC','KD','GIA'][i], color: p.color, textColor: p.text }));
const race = createRace(98765, configs);
const camera = createCamera(race.course.courseLength);
const canvas = createCanvas(CONFIG.WORLD_W, CONFIG.VIEW_H);
const ctx = canvas.getContext('2d');

const grabAt = [240, 720, 1500, 2280, 3000];
let g = 0;
for (let s = 0; s <= 9000 && !race.finished; s++) {
  race.tick();
  const lead = race.standings()[0];
  camera.update(lead.position.x, lead.plugin.ball.bestY, s === 1);
  if (grabAt.includes(s)) {
    drawWorld(ctx, race, camera);
    drawLeaderboard(ctx, race.standings());
    fs.writeFileSync(`test/frame_${g++}.png`, canvas.toBuffer('image/png'));
  }
}
console.log('race finished at', (race.step/60).toFixed(1), 's');
