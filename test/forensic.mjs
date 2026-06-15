import MatterPkg from 'matter-js'; globalThis.Matter=MatterPkg;
const { createRace } = await import('../js/physics.js');
const { PALETTE } = await import('../js/balls.js');
const labels=['SGA','DAME','JB','SPIDA'];
const configs=labels.map((l,i)=>({id:`b${i}`,label:l,color:PALETTE[i].color,textColor:'#fff'}));
const SEED=1205365270;
const race=createRace(SEED, configs);
const dwell={}, mark={}, markS={}, ghosts=[];
const pg={};
for(const b of race.balls){const id=b.plugin.ball.id;dwell[id]={steps:0,y:0,x:0};mark[id]=b.position.y;markS[id]=0;pg[id]=0;}
while(!race.finished){
  race.tick();
  for(const b of race.balls){if(b.plugin.ball.finished)continue;const id=b.plugin.ball.id;
    if(b.plugin.ball.ghostSteps>0&&pg[id]===0)ghosts.push({l:b.plugin.ball.label,x:Math.round(b.position.x),y:Math.round(b.position.y)});pg[id]=b.plugin.ball.ghostSteps;
    if(b.position.y-mark[id]<60){const w=race.step-markS[id];if(w>dwell[id].steps)dwell[id]={steps:w,y:Math.round(b.position.y),x:Math.round(b.position.x)};}
    else{mark[id]=b.position.y;markS[id]=race.step;}}
}
console.log(`seed ${SEED} finishY ${race.course.finishY} winner ${race.winner.plugin.ball.label} ${(race.winner.plugin.ball.finishStep/60).toFixed(1)}s`);
console.log('GHOST (pass-through) events:', ghosts.length);
for(const g of ghosts.slice(0,8)) console.log(`  ${g.l} at (x${g.x}, y${g.y})`);
console.log('LONGEST DWELL per ball (x shows if near a wall: <120 or >960):');
for(const id in dwell) console.log(`  ${id}: ${(dwell[id].steps/60).toFixed(1)}s at (x${dwell[id].x}, y${dwell[id].y})`);
