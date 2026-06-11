// Headless physics test. Runs races without a browser to verify:
// 1) Race duration lands near the 60s target across seeds
// 2) Determinism: same seed twice => identical winner and finish step
// 3) No hard timeouts (anti-stall works)

import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;

const { createRace } = await import('../js/physics.js');
const { DEFAULT_BALLS } = await import('../js/balls.js');

function runRace(seed) {
  const race = createRace(seed, DEFAULT_BALLS);
  while (!race.finished) race.tick();
  return {
    seed,
    winner: race.winner.plugin.ball.label,
    steps: race.step,
    seconds: race.step / 60,
    timedOut: race.step > 150 * 60,
  };
}

// --- Determinism check ---
const d1 = runRace(123456789);
const d2 = runRace(123456789);
const deterministic = d1.winner === d2.winner && d1.steps === d2.steps;
console.log(`DETERMINISM: ${deterministic ? 'PASS' : 'FAIL'} (run1: ${d1.winner}@${d1.steps}, run2: ${d2.winner}@${d2.steps})`);

// --- Duration + balance sweep ---
const N = 24;
const results = [];
for (let i = 0; i < N; i++) {
  const seed = (i * 2654435761 + 99991) >>> 0;
  const r = runRace(seed);
  results.push(r);
  console.log(`seed ${String(r.seed).padStart(10)} | ${r.seconds.toFixed(1).padStart(6)}s | winner ${r.winner}${r.timedOut ? ' | TIMEOUT' : ''}`);
}

const secs = results.map(r => r.seconds).sort((a, b) => a - b);
const wins = {};
for (const r of results) wins[r.winner] = (wins[r.winner] || 0) + 1;
console.log('---');
console.log(`duration min/median/max: ${secs[0].toFixed(1)} / ${secs[Math.floor(N / 2)].toFixed(1)} / ${secs[N - 1].toFixed(1)} s`);
console.log(`win split:`, wins);
console.log(`timeouts: ${results.filter(r => r.timedOut).length}`);
