// CUTOUT lens — remove the background with RMBG-1.4, fully on-device.
// Produces a transparent PNG; press-and-hold to compare with the original.
import { getCutout, RawImage } from './ai';
import type { Lens, LensContext, LensResult } from './types';

const MAX_OUTPUT = 1600; // cap output canvas so phones stay responsive

export const cutoutLens: Lens = {
  loadTitle: 'Loading RMBG background remover…',

  async run(ctx: LensContext): Promise<LensResult> {
    const { model, processor } = await getCutout(ctx.onProgress);

    const image = await RawImage.fromURL(ctx.source.url);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });

    const { w, h } = ctx.source.fitDims(MAX_OUTPUT);
    const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(w, h);

    const canvas = ctx.source.toCanvas(w, h);
    const c = canvas.getContext('2d')!;
    const frame = c.getImageData(0, 0, w, h);
    const maskData = mask.data as Uint8Array;
    for (let i = 0; i < w * h; i++) {
      frame.data[i * 4 + 3] = maskData[i];
    }
    c.putImageData(frame, 0, 0);

    const container = ctx.container;
    container.classList.add('checker');
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    container.appendChild(canvas);

    // Press and hold to reveal the original underneath.
    const original = document.createElement('img');
    original.src = ctx.source.url;
    Object.assign(original.style, {
      position: 'absolute',
      maxWidth: '100%',
      maxHeight: '100%',
      opacity: '0',
      transition: 'opacity 0.15s ease',
      pointerEvents: 'none',
    } as CSSStyleDeclaration);
    container.appendChild(original);

    const show = () => (original.style.opacity = '1');
    const hide = () => (original.style.opacity = '0');
    canvas.addEventListener('pointerdown', show);
    window.addEventListener('pointerup', hide);

    ctx.setHint('Background erased. Press and hold to compare with the original.');
    ctx.enableDownload(() => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.download = 'prism-cutout.png';
        a.href = URL.createObjectURL(blob);
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, 'image/png');
    });

    return {
      dispose() {
        window.removeEventListener('pointerup', hide);
        canvas.remove();
        original.remove();
        container.classList.remove('checker');
      },
    };
  },
};
