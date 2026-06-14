import MatterPkg from 'matter-js'; globalThis.Matter=MatterPkg;
const { createRace } = await import('../js/physics.js');
const { PALETTE } = await import('../js/balls.js');
// Replay the EXACT race: seed + 4 balls
const labels=['ANT','AD','WEMB','ZION'];
const configs=labels.map((l,i)=>({id:`b${i}`,label:l,color:PALETTE[i].color,textColor:'#fff'}));
const SEED=1124861776;
const race=createRace(SEED, configs);

const ghostEvents=[]; // {label, y, step}
const slowRuns={};     // consecutive slow(micro-impulse) steps per ball -> records long runs
const dwell={};        // longest stuck window per ball {steps, y}
const prevGhost={}; const slowCount={}; const markY={}; const markStep={};
for (const b of race.balls){ slowCount[b.plugin.ball.id]=0; markY[b.plugin.ball.id]=b.position.y; markStep[b.plugin.ball.id]=0; dwell[b.plugin.ball.id]={steps:0,y:0}; prevGhost[b.plugin.ball.id]=0;}

while(!race.finished){
  // detect slow (micro-impulse will fire) BEFORE tick
  for(const b of race.balls){ if(b.plugin.ball.finished)continue;
    const sp=Math.hypot(b.velocity.x,b.velocity.y);
    const id=b.plugin.ball.id;
    if(sp<1.2){ slowCount[id]++; } else { if(slowCount[id]>90){ (slowRuns[id]=slowRuns[id]||[]).push({steps:slowCount[id], y:Math.round(b.position.y)});} slowCount[id]=0; }
  }
  race.tick();
  for(const b of race.balls){ if(b.plugin.ball.finished)continue;
    const id=b.plugin.ball.id;
    // ghost (pass-through) edge
    if(b.plugin.ball.ghostSteps>0 && prevGhost[id]===0) ghostEvents.push({label:b.plugin.ball.label, y:Math.round(b.position.y), step:race.step});
    prevGhost[id]=b.plugin.ball.ghostSteps;
    // dwell: longest window with <60px progress
    if(b.position.y - markY[id] < 60){ const w=race.step-markStep[id]; if(w>dwell[id].steps) dwell[id]={steps:w,y:Math.round(b.position.y)}; }
    else { markY[id]=b.position.y; markStep[id]=race.step; }
  }
}
console.log('=== REPLAY seed',SEED,'finishY',race.course.finishY,'winner',race.winner.plugin.ball.label,'in',(race.winner.plugin.ball.finishStep/60).toFixed(1),'s ===');
console.log('\nGHOST (pass-through-obstacle) events:', ghostEvents.length);
for(const g of ghostEvents) console.log(`  ${g.label} phased through at y=${g.y} (t=${(g.step/60).toFixed(1)}s)`);
console.log('\nLONG SLOW/SLIDE runs (>1.5s of micro-impulse creeping):');
for(const id in slowRuns) for(const r of slowRuns[id]) console.log(`  ${id}: ${(r.steps/60).toFixed(1)}s creeping at y=${r.y}`);
console.log('\nLONGEST DWELL (stuck-in-spot) per ball:');
for(const id in dwell) console.log(`  ${id}: ${(dwell[id].steps/60).toFixed(1)}s near y=${dwell[id].y}`);
