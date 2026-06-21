// A tiny status bus so the AI engine can report live progress phases to the UI.
// This turns an opaque hang into something we can actually read on screen.
type Listener = (msg: string) => void;

let listener: Listener | null = null;

export function onStatus(l: Listener) {
  listener = l;
}

export function status(msg: string) {
  // Always log, so it shows in the browser console too.
  console.log('[PRISM]', msg);
  listener?.(msg);
}
