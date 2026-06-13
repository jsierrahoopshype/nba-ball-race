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

// Render both a 2-ball and a 6-ball race to check ball sizing + fixed frame
for (const [tag, nb] of [['2ball',2],['6ball',6]]) {
  const labels=['LBJ','SC','KD','GIA','LUKA','JOK'];
  const configs = PALETTE.slice(0,nb).map((p,i)=>({id:`b${i}`,label:labels[i],color:p.color,textColor:p.text}));
  const seed = 777;
  const total=(()=>{const r=createRace(seed,configs);while(!r.finished)r.tick();return r.step;})();
  const grabAt=Array.from({length:6},(_,i)=>Math.floor(total*(i+0.5)/6));
  const race=createRace(seed,configs); const camera=createCamera(race.course.courseLength);
  const canvas=createCanvas(CONFIG.WORLD_W,CONFIG.VIEW_H); const ctx=canvas.getContext('2d');
  let g=0;
  for(let s=0;s<=total&&!race.finished;s++){race.tick();const l=race.standings()[0];camera.update(l.position.x,l.plugin.ball.bestY,s===1);
    if(grabAt.includes(s)){drawWorld(ctx,race,camera);drawLeaderboard(ctx,race.standings());fs.writeFileSync(`test/${tag}_${g++}.png`,canvas.toBuffer('image/png'));}}
}
console.log('rendered');
