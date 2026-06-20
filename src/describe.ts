// DESCRIBE lens — an on-device vision-language model narrates what it sees.
import { getCaption } from './ai';
import type { Lens, LensContext, LensResult } from './types';

export const describeLens: Lens = {
  loadTitle: 'Loading vision-language model…',

  async run(ctx: LensContext): Promise<LensResult> {
    const pipe = await getCaption(ctx.onProgress);

    const img = document.createElement('img');
    img.src = ctx.source.url;
    img.alt = 'Source image';
    ctx.container.appendChild(img);

    ctx.setHint('Reading the image…');
    const out = (await pipe(ctx.source.url)) as Array<{ generated_text: string }>;
    const raw = (out[0]?.generated_text ?? '').trim();
    const caption = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/[.\s]+$/, '') + '.' : 'I could not find words for this one.';

    // Type the caption out, one character at a time.
    let i = 0;
    ctx.setCaption('');
    const timer = window.setInterval(() => {
      i++;
      ctx.setCaption(caption.slice(0, i) + (i < caption.length ? '▍' : ''));
      if (i >= caption.length) window.clearInterval(timer);
    }, 28);

    ctx.setHint('Described entirely on your device — the image was never uploaded.');

    return {
      dispose() {
        window.clearInterval(timer);
        img.remove();
      },
    };
  },
};
