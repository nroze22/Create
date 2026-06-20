// A lightweight, GPU-cheap animated backdrop: slow drifting color blobs.
// Pauses when the tab is hidden and respects reduced-motion preferences.
export function startAurora(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = ['#7c5cff', '#43e7ff', '#ff5cc8', '#5c8cff'];
  type Blob = { x: number; y: number; vx: number; vy: number; r: number; c: string };
  let blobs: Blob[] = [];
  let w = 0;
  let h = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.width = Math.floor(window.innerWidth * dpr);
    h = canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const n = Math.min(5, Math.max(3, Math.round((window.innerWidth * window.innerHeight) / 300000)));
    blobs = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.7,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (Math.random() - 0.5) * 0.25 * dpr,
      r: (Math.min(w, h) * (0.32 + Math.random() * 0.22)),
      c: colors[i % colors.length],
    }));
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -b.r) b.x = w + b.r;
      if (b.x > w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = h + b.r;
      if (b.y > h + b.r) b.y = -b.r;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, b.c + '55');
      g.addColorStop(1, b.c + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (reduce) {
    frame();
    return;
  }

  let raf = 0;
  let running = true;
  const loop = () => {
    if (running) frame();
    raf = requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });
  window.addEventListener('beforeunload', () => cancelAnimationFrame(raf));
}
