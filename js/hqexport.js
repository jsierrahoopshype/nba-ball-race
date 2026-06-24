// HQ MP4 export: re-renders a race deterministically, offline, frame by frame at
// full 1080x1920/60fps and encodes real H.264 MP4 with WebCodecs + mp4-muxer.
// This is the same stack as the Player Comparison video tool. Because it's
// offline (not real-time), there are no dropped frames, the output is perfect.
//
// Requirements: WebCodecs (Chrome/Edge/most Chromium). No special server headers
// needed (unlike ffmpeg.wasm), so it works on GitHub Pages as-is.

import { createRace } from './physics.js';
import { createCamera } from './camera.js';
import { drawWorld } from './draw.js';
import { drawLeaderboard, drawCountdown, drawWinner, drawMatchup, drawRaceClock } from './hud.js';
import { CONFIG } from './config.js';

const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.3/+esm';
const FPS = 60;
const INTRO_S = 1.4, COUNTDOWN_S = 2.0, WINNER_S = 3.2;
const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

export function webCodecsSupported() {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

// params: { seed, configs, opts:{mode,preset,analysts,bias,bg}, hook, showIntro }
// onProgress(phase, frame, totalEstimate) is called periodically.
export async function exportHQ(params, onProgress = () => {}) {
  if (!webCodecsSupported()) {
    throw new Error('This browser lacks WebCodecs. Use Chrome or Edge for HQ MP4 export.');
  }
  const { Muxer, ArrayBufferTarget } = await import(/* @vite-ignore */ MUXER_URL);

  const W = CONFIG.WORLD_W, H = CONFIG.VIEW_H;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    fastStart: 'in-memory',
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });
  // High profile, level 5.1 (comfortably covers 1080x1920@60). Verify support
  // and fall back to a lower bitrate config if the browser is picky.
  const baseCfg = { codec: 'avc1.640033', width: W, height: H, framerate: FPS };
  let cfg = { ...baseCfg, bitrate: 12_000_000 };
  try {
    const probe = await VideoEncoder.isConfigSupported(cfg);
    if (!probe || !probe.supported) {
      const probe2 = await VideoEncoder.isConfigSupported({ ...baseCfg, bitrate: 8_000_000 });
      if (probe2 && probe2.supported) cfg = { ...baseCfg, bitrate: 8_000_000 };
      else throw new Error('No supported H.264 config for 1080x1920 in this browser.');
    }
  } catch (e) {
    if (e.message.includes('No supported')) throw e;
    // isConfigSupported not available; proceed with the base config
  }
  encoder.configure(cfg);

  // Rebuild the exact race.
  const race = createRace(params.seed, params.configs, params.opts);
  race.bg = params.opts.bg || { type: 'sky' };
  const cam = createCamera(race.course.courseLength);
  cam.update(race.balls[0].position.x, race.balls[0].position.y, true, race.balls);

  // Rough total for the progress bar (race length unknown until run).
  const introF = params.showIntro ? Math.round(INTRO_S * FPS) : 0;
  const countF = Math.round(COUNTDOWN_S * FPS);
  const winF = Math.round(WINNER_S * FPS);
  const estRaceF = Math.min(CONFIG.HARD_TIMEOUT_S, 60) * FPS;
  const estTotal = introF + countF + estRaceF + winF;

  let frame = 0;
  const emit = () => {
    const vf = new VideoFrame(canvas, {
      timestamp: Math.round((frame * 1e6) / FPS),
      duration: Math.round(1e6 / FPS),
    });
    encoder.encode(vf);
    vf.close();
    frame++;
  };
  const STEP = 24; // yield + report every STEP frames so the tab stays responsive

  // 1) Matchup card
  for (let i = 0; i < introF; i++) {
    drawMatchup(ctx, race.balls, params.hook, race.mode);
    emit();
    if (i % STEP === 0) { onProgress('intro', frame, estTotal); await yieldToUI(); }
  }

  // 2) Countdown over the frozen start
  for (let i = 0; i < countF; i++) {
    const o = race.standings(); const a = o[0];
    cam.update(a.position.x, a.plugin.ball.bestY, i === 0, race.balls);
    drawWorld(ctx, race, cam);
    drawLeaderboard(ctx, race.standings());
    drawCountdown(ctx, Math.max(0, 3 - Math.floor(i / (0.5 * FPS))));
    emit();
    if (i % STEP === 0) { onProgress('countdown', frame, estTotal); await yieldToUI(); }
  }

  // 3) The race (one sim tick per frame, deterministic)
  let guard = 0;
  const maxGuard = CONFIG.HARD_TIMEOUT_S * FPS + 300;
  while (!race.finished && guard < maxGuard) {
    race.tick(); guard++;
    const o = race.standings();
    const a = o.find((b) => !b.plugin.ball.finished && !b.plugin.ball.eliminated) || o[0];
    cam.update(a.position.x, a.plugin.ball.bestY, false, race.balls);
    drawWorld(ctx, race, cam);
    drawLeaderboard(ctx, race.standings());
    if (race.countdownSteps) drawRaceClock(ctx, (race.countdownSteps - race.step) / 60);
    emit();
    if (frame % STEP === 0) { onProgress('racing', frame, estTotal); await yieldToUI(); }
  }

  // 4) Winner reveal + hold
  for (let i = 0; i < winF; i++) {
    const o = race.standings(); const a = o[0];
    cam.update(a.position.x, a.plugin.ball.bestY, false, race.balls);
    drawWorld(ctx, race, cam);
    drawLeaderboard(ctx, race.standings());
    drawWinner(ctx, race.standings(), i / FPS);
    emit();
    if (i % STEP === 0) { onProgress('finishing', frame, estTotal); await yieldToUI(); }
  }

  onProgress('encoding', frame, frame);
  await encoder.flush();
  muxer.finalize();
  encoder.close();

  const winnerLabel = (race.winner && race.winner.plugin.ball.label) || 'race';
  return {
    blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }),
    filename: `race_${winnerLabel}_s${params.seed}_HQ.mp4`,
    frames: frame,
  };
}
