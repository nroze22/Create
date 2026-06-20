// A fully offline, generative sample image: a layered dusk landscape.
// Atmospheric perspective gives the depth model clear, dramatic layers to work
// with — and it taints no canvas, since it never touches the network.
export function createSample(): Promise<Blob> {
  const w = 1024;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Sky — dusk gradient.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1b1140');
  sky.addColorStop(0.4, '#5b2a6b');
  sky.addColorStop(0.7, '#c0497a');
  sky.addColorStop(1, '#ffb070');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun with glow.
  const sunX = w * 0.5;
  const sunY = h * 0.62;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.45);
  glow.addColorStop(0, 'rgba(255, 230, 180, 0.95)');
  glow.addColorStop(0.15, 'rgba(255, 200, 140, 0.7)');
  glow.addColorStop(1, 'rgba(255, 180, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(sunX, sunY, h * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 244, 224, 1)';
  ctx.fill();

  // Mountain ridges, far → near. Closer ridges are darker and taller.
  const layers = [
    { base: 0.66, amp: 0.07, color: '#7a3f73', seed: 11 },
    { base: 0.72, amp: 0.1, color: '#5d2f63', seed: 29 },
    { base: 0.8, amp: 0.13, color: '#3f2150', seed: 47 },
    { base: 0.9, amp: 0.16, color: '#241338', seed: 83 },
  ];

  const ridge = (seed: number, x: number) => {
    // Cheap layered sine "noise" for a natural silhouette.
    return (
      Math.sin(x * 0.006 + seed) * 0.5 +
      Math.sin(x * 0.013 + seed * 1.7) * 0.3 +
      Math.sin(x * 0.027 + seed * 2.3) * 0.2
    );
  };

  for (const layer of layers) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const y = (layer.base + ridge(layer.seed, x) * layer.amp) * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = layer.color;
    ctx.fill();
    // Haze along each ridgeline for atmospheric depth.
    ctx.strokeStyle = 'rgba(255, 200, 170, 0.12)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92));
}
