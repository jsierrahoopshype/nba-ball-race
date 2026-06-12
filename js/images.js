// Image loading for balls. Loads team logos and player headshots with
// crossOrigin='anonymous' so the canvas stays UNtainted (tainted canvas breaks
// recording/export). If a fetch fails (404 or missing CORS header), we resolve
// null and the ball falls back to color+initials, so a bad image never breaks a race.

const cache = new Map();

export function loadImage(url) {
  if (cache.has(url)) return cache.get(url);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // graceful: caller keeps the color fallback
    img.src = url;
  });
  cache.set(url, promise);
  return promise;
}

// White-background headshots (NBA CDN) look better as a circle if we keep them
// as-is; the cover-crop in draw.js centers them. Nothing extra needed here.
