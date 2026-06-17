// Pure editor state: no DOM, no canvas. main.js drives the DOM; this holds the
// truth about how many balls there are and what each one looks like. Extracted
// so the count/config path is unit-testable headlessly (the path that shipped
// broken before because only the physics was ever tested).

import { PALETTE, contrastText } from './balls.js';

const NAMES = ['LBJ', 'SC', 'KD', 'GIA', 'LUKA', 'JOK', 'EMB', 'JT'];

export function createSetup(initialCount = 2) {
  let balls = [];

  function setCount(n) {
    n = Math.max(2, Math.min(30, n | 0));
    const prev = balls;
    balls = [];
    for (let i = 0; i < n; i++) {
      balls.push(prev[i] || {
        label: NAMES[i] || `P${i + 1}`,
        color: PALETTE[i % PALETTE.length].color,
        image: null,     // HTMLImageElement once a player/team/upload resolves
        source: null,
        imageFit: 'cover',
        luck: 1,         // bias: 0.5–2 odds multiplier (1 = neutral)
      });
    }
    return balls.length;
  }

  setCount(initialCount);

  return {
    get count() { return balls.length; },
    get balls() { return balls; },
    setCount,
    setName: (i, v) => { if (balls[i]) balls[i].label = v; },
    setFullName: (i, v) => { if (balls[i]) balls[i].name = v; },
    setColor: (i, v) => { if (balls[i]) balls[i].color = v; },
    setColor2: (i, v) => { if (balls[i]) balls[i].color2 = v; },
    setLuck: (i, v) => { if (balls[i]) balls[i].luck = v; },
    setImage: (i, img, source, fit) => { if (balls[i]) { balls[i].image = img; balls[i].source = source; balls[i].imageFit = fit || 'cover'; } },
    clearImage: (i) => { if (balls[i]) { balls[i].image = null; balls[i].source = null; } },
    // The exact array createRace() consumes. THIS is what RACE uses.
    toConfigs: () => balls.map((b, i) => ({
      id: `b${i + 1}`,
      label: (b.label || `P${i + 1}`),
      name: b.name || b.label || `P${i + 1}`,
      color: b.color,
      color2: b.color2 || null,
      textColor: contrastText(b.color),
      image: b.image,
      imageFit: b.imageFit || 'cover',
    })),
  };
}
