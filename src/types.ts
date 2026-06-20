import type { Source } from './source';
import type { LoadProgress } from './ai';

/** Everything a lens needs to render into the shared workspace. */
export interface LensContext {
  source: Source;
  container: HTMLElement; // the .canvas-wrap surface
  onProgress: (p: LoadProgress) => void;
  setHint: (text: string) => void;
  setCaption: (text: string | null) => void;
  /** Pass a handler to reveal the Download button, or null to hide it. */
  enableDownload: (fn: (() => void) | null) => void;
}

export interface LensResult {
  /** Tear down anything long-lived (renderers, observers, RAF loops). */
  dispose?: () => void;
}

export interface Lens {
  run(ctx: LensContext): Promise<LensResult>;
  /** Title shown on the loading overlay before the model is cached. */
  loadTitle: string;
}
