// Ball creation. Phase 2: balls come from the editor panel (names, colors,
// uploaded images). Falls back to a preset palette.

import { CONFIG } from './config.js';

export const PALETTE = [
  { color: '#552583', text: '#FDB927' }, // purple/gold
  { color: '#1D428A', text: '#FFC72C' }, // blue/gold
  { color: '#CE1141', text: '#FFFFFF' }, // red/white
  { color: '#007A33', text: '#FFFFFF' }, // green/white
  { color: '#E56020', text: '#0B0B0F' }, // orange/dark
  { color: '#00538C', text: '#FFFFFF' }, // royal/white
  { color: '#FDB927', text: '#0B0B0F' }, // gold/dark
  { color: '#98002E', text: '#FFFFFF' }, // wine/white
];

export const DEFAULT_BALLS = [
  { id: 'b1', label: 'LBJ', color: PALETTE[0].color, textColor: PALETTE[0].text },
  { id: 'b2', label: 'SC',  color: PALETTE[1].color, textColor: PALETTE[1].text },
];

// Readable text color for an arbitrary user-picked background
export function contrastText(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0B0B0F' : '#FFFFFF';
}

// More balls -> smaller balls, so a crowded field stays readable and has room
// to move. 2 balls = 58px radius, 8 balls = 34px.
export function ballRadiusForCount(n) {
  return Math.max(34, Math.min(54, Math.round(54 - (n - 2) * 3.2)));
}

export function makeBalls(configs, rng) {
  const n = configs.length;
  const radius = ballRadiusForCount(n);
  // Seeded formation, varied per race so a series never drops from the same
  // spot. Spread ranges from a tight cluster to a wide line; the whole line is
  // then placed left, centre, or right (seeded). The slot SHUFFLE below still
  // decorrelates ball identity from position, so it stays fair within a race.
  const spread = rng.range(0.8, 1.95);
  const slotW = Math.min((2 * radius + 14) * spread, (CONFIG.WORLD_W - 200) / Math.max(1, n - 1));
  const lineW = slotW * (n - 1);
  const margin = 120 + radius;
  const minX = margin;
  const maxX = CONFIG.WORLD_W - margin - lineW;
  const startX = (maxX > minX) ? rng.range(minX, maxX) : (CONFIG.WORLD_W - lineW) / 2;

  // Seeded shuffle of start slots: the course can have a faster side, so we
  // decorrelate ball identity from start position. Over many seeds every ball
  // is equally likely to draw the good slot -> fair. Deterministic per seed.
  const slots = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  return configs.map((cfg, i) => {
    const body = Matter.Bodies.circle(
      startX + slots[i] * slotW + rng.range(-6, 6),
      170 + rng.range(-10, 10),
      radius,
      {
        label: 'ball',
        restitution: CONFIG.BALL_RESTITUTION,
        friction: CONFIG.BALL_FRICTION,
        frictionAir: CONFIG.BALL_AIR_FRICTION,
        density: 0.0017, // marble: heavy, carries momentum
      }
    );
    body.plugin.ball = {
      id: cfg.id || `b${i + 1}`,
      label: (cfg.label || `P${i + 1}`).toUpperCase().slice(0, 5),
      name: cfg.name || (cfg.label || `P${i + 1}`),
      color: cfg.color,
      color2: cfg.color2 || null,
      textColor: cfg.textColor || contrastText(cfg.color),
      image: cfg.image || null,    // HTMLImageElement
      imageFit: cfg.imageFit || 'cover', // 'face' for headshots, 'cover' for logos/uploads
      bestY: body.position.y,
      stallSteps: 0,
      stillSteps: 0,
      nudgeSalt: i, // per-ball deterministic salt for the anti-stick nudge direction
      nudgeCount: 0,
      ghostSteps: 0,
      finished: false,
      finishStep: null,
      place: null,
    };
    return body;
  });
}
