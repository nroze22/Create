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
  const actions = document.getElementById('loaderActions');
  if (actions) actions.hidden = true;
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
  bar.hidden = false;
  loaderPct.hidden = false;
}

/** Turn the loading overlay into a visible, dismissable error card. */
export function showError(title: string, detail: string) {
  loader.hidden = false;
  loaderTitle.textContent = title;
  loaderNote.textContent = detail;
  bar.hidden = true;
  loaderPct.hidden = true;

  let actions = document.getElementById('loaderActions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'loaderActions';
    actions.style.marginTop = '18px';
    const reload = document.createElement('button');
    reload.className = 'btn';
    reload.textContent = 'Reload';
    reload.addEventListener('click', () => location.reload());
    const dismiss = document.createElement('button');
    dismiss.className = 'btn ghost';
    dismiss.style.marginLeft = '10px';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => {
      loader.hidden = true;
    });
    actions.append(reload, dismiss);
    barFill.closest('.loader-card')?.appendChild(actions);
  }
  actions.hidden = false;
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
