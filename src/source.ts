// A loaded source image, with helpers to sample it at any resolution.
export class Source {
  readonly url: string;
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;

  private constructor(url: string, bitmap: ImageBitmap) {
    this.url = url;
    this.bitmap = bitmap;
    this.width = bitmap.width;
    this.height = bitmap.height;
  }

  static async from(input: Blob | string): Promise<Source> {
    const url = typeof input === 'string' ? input : URL.createObjectURL(input);
    const blob = typeof input === 'string' ? await (await fetch(input)).blob() : input;
    const bitmap = await createImageBitmap(blob);
    return new Source(url, bitmap);
  }

  /** Largest dimension capped to `maxDim`, preserving aspect ratio. */
  fitDims(maxDim: number): { w: number; h: number } {
    const scale = Math.min(1, maxDim / Math.max(this.width, this.height));
    return { w: Math.max(1, Math.round(this.width * scale)), h: Math.max(1, Math.round(this.height * scale)) };
  }

  /** Draw the image into a fresh canvas at the given size. */
  toCanvas(w: number, h: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(this.bitmap, 0, 0, w, h);
    return canvas;
  }

  dispose() {
    this.bitmap.close?.();
    if (this.url.startsWith('blob:')) URL.revokeObjectURL(this.url);
  }
}
