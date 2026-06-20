import './style.css';
import { startAurora } from './aurora';
import { detectBackend, forceBackend, type Backend } from './ai';
import { Source } from './source';
import { createSample } from './sample';
import { showLoader, updateLoader, hideLoader, setLoaderTitle, showError, toast } from './ui';
import type { Lens, LensContext, LensResult } from './types';
import { depthLens } from './depth';
import { cutoutLens } from './cutout';
import { describeLens } from './describe';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const lenses: Record<string, Lens> = {
  depth: depthLens,
  cutout: cutoutLens,
  describe: describeLens,
};

// ---- Element refs ----
const dropzone = $('dropzone');
const fileInput = $<HTMLInputElement>('file');
const cameraInput = $<HTMLInputElement>('camera');
const surface = $('surface');
const canvasWrap = $('canvasWrap');
const captionEl = $('caption');
const hintEl = $('hint');
const runBtn = $<HTMLButtonElement>('run');
const resetBtn = $<HTMLButtonElement>('reset');
const downloadBtn = $<HTMLButtonElement>('download');

// ---- State ----
let activeLens = 'depth';
let source: Source | null = null;
let result: LensResult | null = null;
let downloadFn: (() => void) | null = null;
let running = false;
const loaded = new Set<string>();
const backendLabel: Record<Backend, string> = { webgpu: 'GPU · WebGPU', wasm: 'CPU · WASM' };
let backend: Backend = 'wasm';

// ---- Boot ----
startAurora($<HTMLCanvasElement>('aurora'));

detectBackend().then((b) => {
  backend = b;
  const accel = $('accel');
  accel.classList.add(b === 'webgpu' ? 'gpu' : 'cpu');
  (accel.querySelector('.accel-label') as HTMLElement).textContent = backendLabel[b];
});

$('footModels').textContent = 'Depth Anything V2 · RMBG-1.4 · ViT-GPT2';

// ---- Lens tabs ----
document.querySelectorAll<HTMLButtonElement>('.lens').forEach((btn) => {
  btn.addEventListener('click', () => {
    const lens = btn.dataset.lens!;
    if (lens === activeLens) return;
    activeLens = lens;
    document.querySelectorAll('.lens').forEach((b) =>
      b.setAttribute('aria-selected', String(b === btn)),
    );
    if (source) void runLens();
  });
});

// ---- Source input ----
function pick(input: HTMLInputElement) {
  input.value = '';
  input.click();
}
$('pickFile').addEventListener('click', (e) => (e.stopPropagation(), pick(fileInput)));
$('pickCamera').addEventListener('click', (e) => (e.stopPropagation(), pick(cameraInput)));
$('pickSample').addEventListener('click', async (e) => {
  e.stopPropagation();
  try {
    await setSource(await createSample());
  } catch {
    toast('Could not create the sample.');
  }
});
dropzone.addEventListener('click', () => pick(fileInput));
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    pick(fileInput);
  }
});

fileInput.addEventListener('change', () => fileInput.files?.[0] && setSource(fileInput.files[0]));
cameraInput.addEventListener('change', () => cameraInput.files?.[0] && setSource(cameraInput.files[0]));

// Drag & drop
['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  }),
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
  }),
);
dropzone.addEventListener('drop', (e) => {
  const file = (e as DragEvent).dataTransfer?.files?.[0];
  if (file?.type.startsWith('image/')) setSource(file);
  else if (file) toast('That does not look like an image.');
});

// ---- Buttons ----
runBtn.addEventListener('click', () => void runLens());
resetBtn.addEventListener('click', reset);
downloadBtn.addEventListener('click', () => downloadFn?.());

// ---- Core flow ----
async function setSource(input: Blob | string) {
  try {
    const next = await Source.from(input);
    source?.dispose();
    source = next;
    dropzone.hidden = true;
    surface.hidden = false;
    await runLens();
  } catch (err) {
    console.error(err);
    toast('Could not read that image.');
  }
}

function clearSurface() {
  result?.dispose?.();
  result = null;
  canvasWrap.replaceChildren();
  canvasWrap.className = 'canvas-wrap';
  captionEl.hidden = true;
  captionEl.textContent = '';
  downloadBtn.hidden = true;
  downloadFn = null;
  hintEl.textContent = '';
}

async function runLens() {
  if (!source || running) return;
  running = true;
  runBtn.disabled = true;
  clearSurface();

  const lens = lenses[activeLens];

  const ctx: LensContext = {
    source,
    container: canvasWrap,
    onProgress: () => {},
    setHint: (t) => (hintEl.textContent = t),
    setCaption: (t) => {
      if (t === null) {
        captionEl.hidden = true;
      } else {
        captionEl.hidden = false;
        captionEl.textContent = t;
      }
    },
    enableDownload: (fn) => {
      downloadFn = fn;
      downloadBtn.hidden = !fn;
    },
  };

  try {
    result = await runAttempt(lens, ctx);
    loaded.add(activeLens);
  } catch (err) {
    console.error(err);
    // If the GPU path stalled or failed, retry once on CPU before giving up.
    if (backend === 'webgpu') {
      try {
        forceBackend('wasm');
        backend = 'wasm';
        $('accel').className = 'accel cpu';
        (document.querySelector('.accel-label') as HTMLElement).textContent = backendLabel.wasm;
        toast('GPU path failed — retrying on CPU…');
        result = await runAttempt(lens, ctx, true);
        loaded.add(activeLens);
        return;
      } catch (err2) {
        console.error(err2);
        showError('Could not load the model', describeError(err2));
        clearSurface();
        return;
      }
    }
    showError('Could not load the model', describeError(err));
    clearSurface();
  } finally {
    // On success runAttempt hid the loader; on error we leave the error card up.
    running = false;
    runBtn.disabled = false;
  }
}

function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/stall/i.test(msg))
    return 'The model did not start downloading. Check your connection, then Reload. On some browsers, disabling strict privacy/shield settings for this site helps.';
  if (/fetch|network|load model|Failed to/i.test(msg))
    return `Network error while fetching the model from Hugging Face. ${msg}`;
  return msg;
}

/**
 * Run a lens with a stall watchdog. The watchdog only guards the cold-start
 * download: if no progress arrives within the timeout it rejects, so the caller
 * can fall back to another backend instead of hanging forever.
 */
async function runAttempt(lens: Lens, ctx: LensContext, cpuRetry = false): Promise<LensResult> {
  const isCached = loaded.has(activeLens) || cpuRetry;
  showLoader(isCached ? `Running on ${backendLabel[backend]}…` : lens.loadTitle, {
    determinate: !isCached,
    note: isCached ? 'Crunching pixels on your device — no servers involved.' : undefined,
  });

  let started = isCached;
  ctx.onProgress = (p) => {
    if (p.ratio > 0) started = true;
    updateLoader(p);
    if (p.ratio >= 1) setLoaderTitle(`Running on ${backendLabel[backend]}…`);
  };

  const STALL_MS = 40000;
  let lastTick = Date.now();
  const origProgress = ctx.onProgress;
  ctx.onProgress = (p) => {
    lastTick = Date.now();
    origProgress(p);
  };

  const run = lens.run(ctx);
  if (isCached) {
    const res = await run;
    hideLoader();
    return res;
  }

  const watchdog = new Promise<never>((_, reject) => {
    const tick = () => {
      if (started) return; // download began; let it finish at its own pace
      if (Date.now() - lastTick > STALL_MS) {
        reject(new Error('Model load stalled (no data received)'));
        return;
      }
      setTimeout(tick, 2500);
    };
    setTimeout(tick, 2500);
  });

  const res = await Promise.race([run, watchdog]);
  hideLoader();
  return res;
}

function reset() {
  clearSurface();
  source?.dispose();
  source = null;
  surface.hidden = true;
  dropzone.hidden = false;
}
