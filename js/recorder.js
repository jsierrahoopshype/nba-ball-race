// Live recording. MediaRecorder ignores the bitrate cap for MP4 (it writes
// ~70-90 Mbps regardless, hence multi-GB files), so the primary path is WebCodecs,
// which enforces the bitrate and muxes a clean H.264 MP4 (~8 Mbps).
//
// The key gotcha: 1080x1920 at 60fps needs H.264 level 5.1 (High profile), which
// many hardware encoders reject. So we PROBE several codec/framerate combos with
// VideoEncoder.isConfigSupported and use the first that works, dropping to 30fps
// if 60 isn't available. Only if nothing works do we fall back to MediaRecorder
// (larger file). The status callback reports exactly which path ran.

const MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.0.3/+esm';
const BITRATE = 8_000_000;

export function createRecorder(canvas, onStatus = () => {}) {
  const W = canvas.width, H = canvas.height;
  const canWebCodecs = typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;

  let muxer = null, encoder = null, rafId = 0, frameCount = 0, startTs = 0, fps = 60;
  let active = false, wcReady = false, wcFailed = false;
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

  // Find a codec/framerate the encoder actually supports for this resolution.
  async function pickConfig() {
    const combos = [
      ['avc1.640033', 60, 'High@60'], ['avc1.4d0033', 60, 'Main@60'],
      ['avc1.640032', 30, 'High@30'], ['avc1.4d0032', 30, 'Main@30'],
      ['avc1.42e032', 30, 'Baseline@30'], ['avc1.42001f', 30, 'Baseline4.0@30'],
    ];
    for (const [codec, f, label] of combos) {
      const cfg = { codec, width: W, height: H, framerate: f, bitrate: BITRATE };
      try {
        const s = await VideoEncoder.isConfigSupported(cfg);
        if (s && s.supported) return { cfg, fps: f, label };
      } catch { /* try next */ }
    }
    return null;
  }

  async function startWebCodecs() {
    const picked = await pickConfig();
    if (!picked) throw new Error('no supported H.264 encoder config');
    fps = picked.fps;
    const { Muxer, ArrayBufferTarget } = await import(/* @vite-ignore */ MUXER_URL);
    muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: fps },
      fastStart: 'in-memory',
    });
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { console.error('encoder error', e); wcFailed = true; onStatus(`\u25cf REC encoder error: ${e.message}`); },
    });
    encoder.configure(picked.cfg);
    wcReady = true;
    startTs = performance.now();
    frameCount = 0;
    onStatus(`\u25cf REC \u2192 MP4 via WebCodecs (${picked.label})`);

    const tick = () => {
      if (!active) return;
      if (encoder && encoder.state === 'configured') {
        const want = Math.floor(((performance.now() - startTs) / 1000) * fps);
        const cap = frameCount + 4; // avoid a huge catch-up burst after a stall
        while (frameCount < want && frameCount < cap) {
          const vf = new VideoFrame(canvas, {
            timestamp: Math.round((frameCount * 1e6) / fps),
            duration: Math.round(1e6 / fps),
          });
          encoder.encode(vf, { keyFrame: frameCount % (fps * 2) === 0 });
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

  function startMediaRecorder(reason) {
    const stream = canvas.captureStream(30);
    chunks = [];
    mrMime = bestMime();
    chosenFmt = mrMime.includes('mp4') ? 'mp4' : 'webm';
    mr = new MediaRecorder(stream, { mimeType: mrMime || undefined, videoBitsPerSecond: BITRATE });
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.start(250);
    onStatus(`\u25cf REC (fallback: MediaRecorder ${chosenFmt}${reason ? ' \u2013 ' + reason : ''})`);
  }

  function stopMediaRecorder(filename) {
    return new Promise((resolve) => {
      if (!mr || mr.state === 'inactive') return resolve(false);
      mr.onstop = () => {
        const isMp4 = mrMime.includes('mp4');
        download(new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' }), filename, isMp4 ? 'mp4' : 'webm');
        resolve(true);
      };
      mr.stop();
    });
  }

  return {
    supported: canWebCodecs || !!(window.MediaRecorder && canvas.captureStream),
    format: () => chosenFmt,

    start() {
      active = true;
      if (canWebCodecs) {
        chosenFmt = 'mp4'; wcReady = false; wcFailed = false;
        startWebCodecs().catch((e) => {
          console.error('WebCodecs start failed, using MediaRecorder', e);
          startMediaRecorder(e.message);
        });
      } else {
        startMediaRecorder('no WebCodecs');
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
          onStatus(`save failed: ${e.message}`);
          return false;
        }
      }
      return stopMediaRecorder(filename);
    },

    isRecording: () => active,
  };
}
