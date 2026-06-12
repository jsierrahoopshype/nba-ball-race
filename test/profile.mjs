import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;
const { createRace } = await import('../js/physics.js');
const { DEFAULT_BALLS } = await import('../js/balls.js');

// Average seconds the WINNER spends per 1000px band, over several seeds
const bands = {};
const N = 8;
for (let i = 0; i < N; i++) {
  const seed = (i * 2654435761 + 7777) >>> 0;
  const race = createRace(seed, DEFAULT_BALLS);
  let lastBand = 0, lastStep = 0;
  const winnerHistory = [];
  while (!race.finished) {
    race.tick();
    const leader = race.standings()[0];
    const band = Math.floor(leader.plugin.ball.bestY / 1000);
    if (band > lastBand) {
      winnerHistory.push([lastBand, (race.step - lastStep) / 60]);
      lastBand = band; lastStep = race.step;
    }
  }
  winnerHistory.push([lastBand, (race.step - lastStep) / 60]);
  for (const [b, secs] of winnerHistory) {
    bands[b] = (bands[b] || []); bands[b].push(secs);
  }
}
console.log('avg seconds per 1000px band (leader):');
for (const b of Object.keys(bands).sort((a,z)=>a-z)) {
  const arr = bands[b];
  const avg = arr.reduce((s,v)=>s+v,0)/arr.length;
  console.log(`  ${String(b*1000).padStart(5)}-${(+b+1)*1000}: ${avg.toFixed(1)}s`);
}
