// PRISM — on-device AI engine.
// All inference runs in the browser via Transformers.js (WebGPU, WASM fallback).
import { pipeline, AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';

// The pipeline overloads in Transformers.js generate a union too large for TS to
// represent at the call site, so we wrap them with a narrow local signature.
type AnyPipeline = (...args: any[]) => Promise<any>;
const makePipeline = pipeline as unknown as (
  task: string,
  model: string,
  options: Record<string, unknown>,
) => Promise<AnyPipeline>;

// Models are streamed from the Hugging Face Hub and cached by the browser.
env.allowLocalModels = false;

// GitHub Pages does not send the COOP/COEP headers required for
// SharedArrayBuffer, so multi-threaded WASM (and its proxy worker) can stall on
// load. Force single-threaded, no-proxy execution for reliability on static hosts.
try {
  const wasm = (env.backends as any)?.onnx?.wasm;
  if (wasm) {
    wasm.numThreads = 1;
    wasm.proxy = false;
    // Pin the ONNX Runtime WASM binaries to a CDN that hosts every variant for
    // this exact runtime version. Under a project subpath like /Create/, the
    // default relative resolution can 404 and hang the loader at 0%.
    wasm.wasmPaths =
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/';
  }
} catch {
  /* older/newer runtimes may shape this differently; ignore */
}

export type Backend = 'webgpu' | 'wasm';

let backend: Backend | null = null;

/** Force a specific backend and drop cached pipelines so they reload on it. */
export function forceBackend(b: Backend) {
  backend = b;
  depthModel = null;
  captionModel = null;
  cutoutModel = null;
}

/** Detect the fastest available compute backend once, then memoize it. */
export async function detectBackend(): Promise<Backend> {
  if (backend) return backend;
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) return (backend = 'webgpu');
    } catch {
      /* fall through to wasm */
    }
  }
  return (backend = 'wasm');
}

export interface LoadProgress {
  /** 0..1 across all files for the current model. */
  ratio: number;
  /** Human label for what is happening. */
  label: string;
}

type RawProgress = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
};

/** Aggregates per-file download progress into a single 0..1 ratio. */
function makeProgressAggregator(onProgress: (p: LoadProgress) => void) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (raw: RawProgress) => {
    if (raw.status === 'progress' && raw.file && raw.total) {
      files.set(raw.file, { loaded: raw.loaded ?? 0, total: raw.total });
    } else if (raw.status === 'done' && raw.file) {
      const f = files.get(raw.file);
      if (f) f.loaded = f.total;
    }
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    const ratio = total > 0 ? Math.min(loaded / total, 1) : 0;
    const label =
      raw.status === 'ready' || ratio >= 1
        ? 'Warming up…'
        : `Downloading model · ${(loaded / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB`;
    onProgress({ ratio, label });
  };
}

// ---- Lazy, memoized model singletons ----

let depthModel: Promise<AnyPipeline> | null = null;
let captionModel: Promise<AnyPipeline> | null = null;
let cutoutModel: Promise<{ model: any; processor: any }> | null = null;

export async function getDepth(onProgress: (p: LoadProgress) => void) {
  const device = await detectBackend();
  if (!depthModel) {
    depthModel = makePipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', {
      device,
      progress_callback: makeProgressAggregator(onProgress),
    });
  }
  return depthModel;
}

export async function getCaption(onProgress: (p: LoadProgress) => void) {
  const device = await detectBackend();
  if (!captionModel) {
    captionModel = makePipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
      device,
      progress_callback: makeProgressAggregator(onProgress),
    });
  }
  return captionModel;
}

export async function getCutout(onProgress: (p: LoadProgress) => void) {
  if (!cutoutModel) {
    const progress_callback = makeProgressAggregator(onProgress);
    cutoutModel = (async () => {
      const model = await AutoModel.from_pretrained('briaai/RMBG-1.4', {
        // RMBG ships a custom architecture; tell the loader not to expect a standard config.
        config: { model_type: 'custom' } as any,
        progress_callback,
      });
      const processor = await AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        } as any,
        progress_callback,
      });
      return { model, processor };
    })();
  }
  return cutoutModel;
}

export { RawImage };
