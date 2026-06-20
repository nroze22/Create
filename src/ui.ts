// Cross-cutting UI helpers: the model-loading overlay and toast notifications.
import type { LoadProgress } from './ai';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loader = $('loader');
const loaderTitle = $('loaderTitle');
const loaderNote = $('loaderNote');
const barFill = $('barFill');
const loaderPct = $('loaderPct');
const bar = barFill.parentElement as HTMLElement;

export function showLoader(title: string, opts: { note?: string; determinate?: boolean } = {}) {
  const determinate = opts.determinate ?? true;
  loaderTitle.textContent = title;
  loaderNote.textContent = opts.note ?? 'First run downloads the AI to your device. It is cached afterward.';
  barFill.style.width = determinate ? '0%' : '100%';
  loaderPct.textContent = '0%';
  bar.hidden = !determinate;
  loaderPct.hidden = !determinate;
  loader.hidden = false;
}

export function updateLoader({ ratio, label }: LoadProgress) {
  const pct = Math.round(ratio * 100);
  barFill.style.width = `${pct}%`;
  loaderPct.textContent = `${pct}%`;
  if (label) loaderNote.textContent = label;
}

export function setLoaderTitle(title: string) {
  loaderTitle.textContent = title;
}

export function hideLoader() {
  loader.hidden = true;
}

let toastTimer: number | undefined;
export function toast(message: string, ms = 3200) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  // force reflow so the transition replays
  void el.offsetWidth;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.remove('show');
    window.setTimeout(() => (el.hidden = true), 350);
  }, ms);
}
