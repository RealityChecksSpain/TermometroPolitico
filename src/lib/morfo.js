export function mezcla(a, b, t) {
  return a + (b - a) * t;
}

export function limitar(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export const RADIO_CABEZA = 88;
export const ALTO_FIGURA = 300;

const TENSION_BLANDA = [0.00, 0.85, 0.35, 0.10, 0.10, 0.10, 0.10, 0.35, 0.85, 0.00];

export function figura(cx, ny, s, blanda) {
  const dx = [-30, -160, -160, -244, -244, 244, 244, 160, 160, 30];
  const dy = [0, 130, 178, 178, 300, 300, 178, 178, 130, 0];
  const w = [0.30, 0.70, 1.00, 0.70, 0.30, 0.30, 0.70, 1.00, 0.70, 0.30];
  return dx.map((x, i) => ({
    x: cx + x * s,
    y: ny + dy[i] * s,
    k: blanda ? TENSION_BLANDA[i] : 0,
    w: w[i]
  }));
}

export function cabeza(cx, ny, s) {
  return { x: cx, y: ny - RADIO_CABEZA * s, r: RADIO_CABEZA * s };
}

export function pildora(x1, x2, y1, y2) {
  const r = (y2 - y1) / 2;
  const cy = (y1 + y2) / 2;
  const a = x1 + r * 1.05;
  const b = x2 - r * 1.05;
  const m1 = x1 + (x2 - x1) * 0.31;
  const m2 = x1 + (x2 - x1) * 0.69;
  return [
    { x: m1, y: y1, k: 0.55 },
    { x: a, y: y1, k: 0.55 },
    { x: x1, y: cy, k: 0.62 },
    { x: a, y: y2, k: 0.55 },
    { x: m1, y: y2, k: 0.55 },
    { x: m2, y: y2, k: 0.55 },
    { x: b, y: y2, k: 0.55 },
    { x: x2, y: cy, k: 0.62 },
    { x: b, y: y1, k: 0.55 },
    { x: m2, y: y1, k: 0.55 }
  ];
}

export function remate(x1, x2, y1, y2, hondo, pie) {
  return [
    { x: x1 + 40, y: y1, k: 0 },
    { x: x1, y: y1, k: 0 },
    { x: x1, y: y2 + hondo, k: 0 },
    { x: x1 + pie, y: y2 + hondo, k: 0 },
    { x: x1 + pie, y: y2, k: 0 },
    { x: x2 - pie, y: y2, k: 0 },
    { x: x2 - pie, y: y2 + hondo, k: 0 },
    { x: x2, y: y2 + hondo, k: 0 },
    { x: x2, y: y1, k: 0 },
    { x: x2 - 40, y: y1, k: 0 }
  ];
}

export function trazo(desde, hasta, px, py) {
  const t = limitar(py);
  const lento = px * px;
  const p = desde.map((f, i) => {
    const g = hasta[i];
    const a = mezcla(lento, px, f.w ?? 0.5);
    return { x: mezcla(f.x, g.x, a), y: mezcla(f.y, g.y, py), k: mezcla(f.k, g.k, t) };
  });
  const n = p.length;
  let d = `M ${p[0].x.toFixed(2)} ${p[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const ant = p[(i - 1 + n) % n];
    const a = p[i];
    const b = p[(i + 1) % n];
    const sig = p[(i + 2) % n];
    const c1x = a.x + (b.x - ant.x) * a.k / 6;
    const c1y = a.y + (b.y - ant.y) * a.k / 6;
    const c2x = b.x - (sig.x - a.x) * b.k / 6;
    const c2y = b.y - (sig.y - a.y) * b.k / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }
  return `${d} Z`;
}