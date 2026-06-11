import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;
const { createRace } = await import('../js/physics.js');
const { DEFAULT_BALLS } = await import('../js/balls.js');
const wins = {}; let totalSecs = 0;
const N = 80;
for (let i = 0; i < N; i++) {
  const seed = (i * 1103515245 + 12345) >>> 0;
  const race = createRace(seed, DEFAULT_BALLS);
  while (!race.finished) race.tick();
  wins[race.winner.plugin.ball.label] = (wins[race.winner.plugin.ball.label] || 0) + 1;
  totalSecs += race.step / 60;
}
console.log(`N=${N}, wins:`, wins, `avg duration: ${(totalSecs/N).toFixed(1)}s`);
