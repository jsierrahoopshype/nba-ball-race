import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;
const { createRace } = await import('../js/physics.js');
const { PALETTE } = await import('../js/balls.js');
// 8-ball field: verify no timeouts and sane durations
const configs = PALETTE.map((p, i) => ({ id: `b${i}`, label: `P${i+1}`, color: p.color, textColor: p.text }));
for (let i = 0; i < 10; i++) {
  const seed = (i * 7654321 + 1234) >>> 0;
  const race = createRace(seed, configs);
  while (!race.finished) race.tick();
  console.log(`8 balls, seed ${seed}: ${(race.step/60).toFixed(1)}s, winner ${race.winner.plugin.ball.label}${race.step > 145*60 ? ' TIMEOUT' : ''}`);
}
