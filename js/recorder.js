// Quick Record: captures the canvas live via MediaRecorder. Prefers MP4 (H.264),
// which Twitter/X and most platforms accept, and falls back to WebM only if the
// browser can't do MP4. For a guaranteed-clean MP4 of a single race, the offline
// "HQ MP4" button (WebCodecs) is the higher-quality path.

export function createRecorder(canvas) {
  let recorder = null;
  let chunks = [];
  let mime = '';

  function bestMime() {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E', // H.264 constrained baseline — most compatible
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    return candidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  }

  return {
    supported: !!(window.MediaRecorder && canvas.captureStream),

    // 'mp4' or 'webm' — what the next/last recording will be saved as.
    format: () => (mime.includes('mp4') ? 'mp4' : 'webm'),

    start() {
      const stream = canvas.captureStream(60);
      chunks = [];
      mime = bestMime();
      recorder = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: 12_000_000,
      });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.start(250); // gather in chunks; safer if the tab hiccups
    },

    // Stops and triggers a download. The extension is forced to match the actual
    // recorded format, so the file is always named correctly (.mp4 or .webm).
    stop(filename) {
      return new Promise((resolve) => {
        if (!recorder || recorder.state === 'inactive') return resolve(false);
        recorder.onstop = () => {
          const isMp4 = mime.includes('mp4');
          const type = isMp4 ? 'video/mp4' : 'video/webm';
          const ext = isMp4 ? 'mp4' : 'webm';
          const blob = new Blob(chunks, { type });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename.replace(/\.(webm|mp4)$/i, '') + '.' + ext;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve(true);
        };
        recorder.stop();
      });
    },

    isRecording: () => recorder && recorder.state === 'recording',
  };
}
