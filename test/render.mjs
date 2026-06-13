import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;
import { createCanvas, loadImage as nl } from '@napi-rs/canvas';
import fs from 'fs';
const { createRace } = await import('../js/physics.js');
const { drawWorld } = await import('../js/draw.js');
const { drawLeaderboard } = await import('../js/hud.js');
const { createCamera } = await import('../js/camera.js');
const { CONFIG } = await import('../js/config.js');
const B='https://raw.githubusercontent.com/jsierrahoopshype/nba-headshots/claude/bulk-download-nba-assets-PP6lk/players/headshots/face';
const files={LBJ:'2544-lebron-james',SC:'201939-stephen-curry',KD:'201142-kevin-durant',GIA:'203507-giannis-antetokounmpo'};
const cols={LBJ:'#552583',SC:'#1D428A',KD:'#CE1141',GIA:'#00471B'};
const imgs={}; for(const k in files){const r=await fetch(`${B}/${files[k]}.png`);const buf=Buffer.from(await r.arrayBuffer());imgs[k]=await nl(buf);}
const configs=Object.keys(files).map((l,i)=>({id:`b${i}`,label:l,color:cols[l],textColor:'#fff',image:imgs[l],imageFit:'face'}));
const seed=20260613;
const total=(()=>{const r=createRace(seed,configs);while(!r.finished)r.tick();return r.winner.plugin.ball.finishStep;})();
const grabAt=Array.from({length:10},(_,i)=>Math.floor(total*(i+0.5)/10));
const race=createRace(seed,configs); const camera=createCamera(race.course.courseLength);
const canvas=createCanvas(CONFIG.WORLD_W,CONFIG.VIEW_H); const ctx=canvas.getContext('2d');
let g=0;
for(let s=0;s<=total&&!race.finished;s++){race.tick();const o=race.standings();const a=o.find(b=>!b.plugin.ball.finished)||o[o.length-1];camera.update(a.position.x,a.plugin.ball.bestY,s===1);
  if(grabAt.includes(s)){drawWorld(ctx,race,camera);drawLeaderboard(ctx,race.standings());fs.writeFileSync(`test/n_${g++}.png`,canvas.toBuffer('image/png'));}}
console.log('winner at',(total/60).toFixed(0),'s');
