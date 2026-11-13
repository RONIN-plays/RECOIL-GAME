/** Small canvas-2D drawing helpers shared by all procedural art. */
export type Ctx = CanvasRenderingContext2D;

export const INK = '#17120f';

/** Lighten (amt > 0) or darken (amt < 0) a colour. Accepts '#rrggbb' or 'rgb(r,g,b)'. */
export function shade(col: string, amt: number): string {
  let r: number;
  let g: number;
  let b: number;
  if (col.startsWith('#')) {
    const n = parseInt(col.slice(1), 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    const m = col.match(/\d+/g) ?? ['0', '0', '0'];
    r = Number(m[0]);
    g = Number(m[1]);
    b = Number(m[2]);
  }
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function circle(c: Ctx, x: number, y: number, r: number, fill?: string, stroke?: string, lw = 2): void {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill?: string, stroke?: string, lw = 2, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 2): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

export function poly(c: Ctx, pts: number[], fill?: string, stroke?: string, lw = 2): void {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.lineJoin = 'round';
    c.stroke();
  }
}

/** A thick rounded line with an ink outline: used for arms and barrels. */
export function limb(c: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string, outline = INK): void {
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.strokeStyle = outline;
  c.lineWidth = w + 4;
  c.stroke();
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.strokeStyle = color;
  c.lineWidth = w;
  c.stroke();
  c.lineCap = 'butt';
}

export function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 1): void {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.strokeStyle = color;
  c.lineWidth = w;
  c.stroke();
}

export function radial(c: Ctx, x: number, y: number, r: number, stops: [number, string][]): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Outlined steel box with a top highlight, the building block for guns. */
export function steel(c: Ctx, x: number, y: number, w: number, h: number, col = '#3b3e46', r = 1.5): void {
  rrect(c, x, y, w, h, r, col, INK, 2);
  c.fillStyle = shade(col, 0.28);
  c.fillRect(x + 1.5, y + 1.2, Math.max(0, w - 3), Math.max(1, h * 0.22));
}

export function wood(c: Ctx, x: number, y: number, w: number, h: number, col = '#7d5230', r = 2): void {
  rrect(c, x, y, w, h, r, col, INK, 2);
  c.fillStyle = shade(col, 0.2);
  c.fillRect(x + 1.5, y + 1.2, Math.max(0, w - 3), Math.max(1, h * 0.25));
}
