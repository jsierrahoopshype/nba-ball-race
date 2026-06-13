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

const labels = ['LBJ','SC','KD','GIA','LUKA'];
const configs = PALETTE.slice(0,5).map((p,i)=>({id:`b${i}`,label:labels[i],color:p.color,textColor:p.text}));
const race = createRace(3646226548, configs);
const camera = createCamera(race.course.courseLength);
const canvas = createCanvas(CONFIG.WORLD_W, CONFIG.VIEW_H);
const ctx = canvas.getContext('2d');
// grab 8 frames spread across the race
const total = (()=>{ const r=createRace(3646226548,configs); while(!r.finished) r.tick(); return r.step; })();
const grabAt = Array.from({length:8},(_,i)=>Math.floor(total*(i+0.5)/8));
let g=0;
for (let s=0; s<=total && !race.finished; s++) {
  race.tick();
  const lead = race.standings()[0];
  camera.update(lead.position.x, lead.plugin.ball.bestY, s===1);
  if (grabAt.includes(s)) { drawWorld(ctx,race,camera); drawLeaderboard(ctx,race.standings()); fs.writeFileSync(`test/frame_${g++}.png`, canvas.toBuffer('image/png')); }
}
console.log('finished at', (race.step/60).toFixed(1),'s, frames:', g);
