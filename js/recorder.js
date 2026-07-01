// Live recording. MediaRecorder ignores the bitrate cap for MP4 (it was writing
// ~70-90 Mbps regardless of the setting, hence multi-GB files), so the primary
// path is now WebCodecs: it captures the live canvas at a real, enforced bitrate
// and muxes a clean H.264 MP4 (~6 Mbps => a 3-min series is ~135 MB). If a browser
// lacks WebCodecs, it falls back to the old MediaRecorder path so recording still
// works (just larger). This captures whatever is on screen, so full series record
// fine.

const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.3/+esm';
const FPS = 60;              // matches the game's smoothness
const BITRATE = 8_000_000;   // real, enforced bitrate (~180 MB for a 3-min series)

export function createRecorder(canvas) {
  const W = canvas.width, H = canvas.height;
  const canWebCodecs = typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;

  // WebCodecs state
  let muxer = null, encoder = null, rafId = 0, frameCount = 0, startTs = 0;
  let active = false, wcReady = false, wcFailed = false;

  // MediaRecorder fallback state
  let mr = null, chunks = [], mrMime = '';
  let chosenFmt = 'mp4';

  function download(blob, filename, ext) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.(webm|mp4)$/i, '') + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function startWebCodecs() {
    const { Muxer, ArrayBufferTarget } = await import(/* @vite-ignore */ MUXER_URL);
    muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: FPS },
      fastStart: 'in-memory',
    });
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { console.error('encoder error', e); wcFailed = true; },
    });
    encoder.configure({ codec: 'avc1.640033', width: W, height: H, framerate: FPS, bitrate: BITRATE });
    wcReady = true;
    startTs = performance.now();
    frameCount = 0;

    // Capture the canvas at a steady FPS off the real clock, so playback speed is
    // correct regardless of how fast the game's own rAF loop runs.
    const tick = () => {
      if (!active) return;
      if (encoder && encoder.state === 'configured') {
        const want = Math.floor(((performance.now() - startTs) / 1000) * FPS);
        // avoid unbounded catch-up if the tab was backgrounded
        const cap = frameCount + 4;
        while (frameCount < want && frameCount < cap) {
          const vf = new VideoFrame(canvas, {
            timestamp: Math.round((frameCount * 1e6) / FPS),
            duration: Math.round(1e6 / FPS),
          });
          encoder.encode(vf, { keyFrame: frameCount % (FPS * 2) === 0 });
          vf.close();
          frameCount++;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function bestMime() {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
    ];
    return candidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  }

  function startMediaRecorder() {
    const stream = canvas.captureStream(FPS);
    chunks = [];
    mrMime = bestMime();
    chosenFmt = mrMime.includes('mp4') ? 'mp4' : 'webm';
    mr = new MediaRecorder(stream, { mimeType: mrMime || undefined, videoBitsPerSecond: BITRATE });
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.start(250);
  }

  function stopMediaRecorder(filename) {
    return new Promise((resolve) => {
      if (!mr || mr.state === 'inactive') return resolve(false);
      mr.onstop = () => {
        const isMp4 = mrMime.includes('mp4');
        const blob = new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
        download(blob, filename, isMp4 ? 'mp4' : 'webm');
        resolve(true);
      };
      mr.stop();
    });
  }

  return {
    supported: canWebCodecs || !!(window.MediaRecorder && canvas.captureStream),

    // 'mp4' or 'webm' — what the current recording will be saved as.
    format: () => chosenFmt,

    start() {
      active = true;
      if (canWebCodecs) {
        chosenFmt = 'mp4'; wcReady = false; wcFailed = false;
        startWebCodecs().catch((e) => {
          console.error('WebCodecs unavailable, falling back to MediaRecorder', e);
          wcFailed = true; startMediaRecorder();
        });
      } else {
        startMediaRecorder();
      }
    },

    async stop(filename) {
      active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (wcReady && !wcFailed && encoder) {
        try {
          await encoder.flush();
          muxer.finalize();
          const buf = muxer.target.buffer;
          download(new Blob([buf], { type: 'video/mp4' }), filename, 'mp4');
          encoder = null; muxer = null;
          return true;
        } catch (e) {
          console.error('MP4 finalize failed', e);
          encoder = null; muxer = null;
          return false;
        }
      }
      return stopMediaRecorder(filename);
    },

    isRecording: () => active,
  };
}
