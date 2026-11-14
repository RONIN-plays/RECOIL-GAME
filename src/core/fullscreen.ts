/**
 * Fullscreen and orientation-lock helpers. Every call fails silently: iPhone Safari has no
 * fullscreen API at all, and orientation lock only works in fullscreen on Android.
 */

type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

const doc = document as FsDoc;

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsEl;
  return !!((doc.fullscreenEnabled && el.requestFullscreen) || (doc.webkitFullscreenEnabled && el.webkitRequestFullscreen));
}

export function isFullscreen(): boolean {
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

function lockLandscape(): void {
  try {
    const o = screen.orientation as LockableOrientation | undefined;
    const p = o?.lock?.('landscape');
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // unsupported
  }
}

/** Enter fullscreen and lock to landscape. Must run inside a user gesture (touchend / click / key). */
export function enterFullscreen(): void {
  if (isFullscreen()) {
    lockLandscape();
    return;
  }
  if (!fullscreenSupported()) return;
  const el = document.documentElement as FsEl;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    if (p && typeof p.then === 'function') p.then(lockLandscape, () => {});
    else setTimeout(lockLandscape, 200);
  } catch {
    // refused
  }
}

export function exitFullscreen(): void {
  if (!isFullscreen()) return;
  try {
    const p = document.exitFullscreen ? document.exitFullscreen() : doc.webkitExitFullscreen?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // ignore
  }
}

export function toggleFullscreen(): void {
  if (isFullscreen()) exitFullscreen();
  else enterFullscreen();
}

export function onFullscreenChange(fn: () => void): () => void {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
  return () => {
    document.removeEventListener('fullscreenchange', fn);
    document.removeEventListener('webkitfullscreenchange', fn);
  };
}

/**
 * Run `fn` where the browser will accept it as a user gesture. Phaser fires touch `pointerdown`
 * on touchstart, which does not count as user activation, so for touches we wait for the
 * touchend that follows. Mouse and keyboard presses already count, so those run at once.
 */
export function inGesture(fn: () => void, wasTouch: boolean): void {
  if (!wasTouch) {
    fn();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener('touchend', run, true);
    fn();
  };
  window.addEventListener('touchend', run, { capture: true });
  // if the finger is already up (or touchend never arrives) give up quietly
  setTimeout(() => {
    if (!done) {
      done = true;
      window.removeEventListener('touchend', run, true);
    }
  }, 3000);
}
