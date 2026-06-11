// Seeded RNG (mulberry32). Every piece of randomness in the game flows through
// one instance of this per race. Same seed => same course, same bounces, same winner.
// NEVER use Math.random() anywhere in simulation or course-building code.

export function createRNG(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,                                            // float [0,1)
    range: (min, max) => min + next() * (max - min), // float [min,max)
    int: (min, max) => Math.floor(min + next() * (max - min + 1)), // int [min,max]
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

// Non-deterministic seed generator, used only when the user asks for a NEW race.
export function freshSeed() {
  return (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
}
