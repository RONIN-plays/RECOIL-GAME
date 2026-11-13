export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(dist2(ax, ay, bx, by));

/** Frame-rate independent smoothing toward a target. */
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-lambda * dt));

/** Shortest signed difference from angle a to angle b. */
export function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function rotateToward(a: number, b: number, maxStep: number): number {
  const d = angDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

export const deg = (d: number) => (d * Math.PI) / 180;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInQuad = (t: number) => t * t;
