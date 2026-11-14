/**
 * Input-mode detection shared by the menu, HUD and touch controls.
 * Touch mode is on when the URL says ?touch=1, off with ?touch=0, otherwise it follows
 * `(pointer: coarse)` and switches on at the first real touch.
 */

type Listener = (touch: boolean) => void;

const listeners = new Set<Listener>();

function initial(): boolean {
  try {
    const p = new URLSearchParams(window.location.search).get('touch');
    if (p === '1' || p === 'true') return true;
    if (p === '0' || p === 'false') return false;
  } catch {
    // ignore
  }
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

let touch = initial();

/** True when the player is using a touch screen. Forced on with ?touch=1 and off with ?touch=0. */
export function isTouch(): boolean {
  return touch;
}

/** Switch input mode at runtime (called on the first real touch event). */
export function setTouch(v: boolean): void {
  if (v === touch) return;
  touch = v;
  for (const fn of [...listeners]) fn(v);
}

/** Subscribe to mode changes; returns an unsubscribe function. */
export function onTouchChange(fn: (touch: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  const forcedOff = new URLSearchParams(window.location.search).get('touch') === '0';
  if (!forcedOff) {
    window.addEventListener('touchstart', () => setTouch(true), { once: true, passive: true, capture: true });
  }
}
