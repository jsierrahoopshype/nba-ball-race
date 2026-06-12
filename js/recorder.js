// Quick Record: captures the canvas live to WebM via MediaRecorder.
// This is the "draft" tier. The offline HQ MP4 renderer arrives in Phase 4.

export function createRecorder(canvas) {
  let recorder = null;
  let chunks = [];

  function bestMime() {
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    return candidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  }

  return {
    supported: !!(window.MediaRecorder && canvas.captureStream),

    start() {
      const stream = canvas.captureStream(60);
      chunks = [];
      recorder = new MediaRecorder(stream, {
        mimeType: bestMime(),
        videoBitsPerSecond: 12_000_000,
      });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.start(250); // gather in chunks; safer if the tab hiccups
    },

    // Stops and triggers a download with a structured filename
    stop(filename) {
      return new Promise((resolve) => {
        if (!recorder || recorder.state === 'inactive') return resolve(false);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
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
