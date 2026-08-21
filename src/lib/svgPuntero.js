/** Convierte coordenadas de pantalla a espacio del viewBox del SVG. */
export function puntoSvg(svg, clientX, clientY) {
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(ctm.inverse());
}

/**
 * Índice del punto más cercano a (x,y) dentro de maxDist (unidades SVG).
 * puntos: [{ cx, cy }, ...]
 */
export function indiceMasCercano(puntos, x, y, maxDist) {
  const max2 = maxDist * maxDist;
  let best = -1;
  let best2 = max2;
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i];
    if (!p) continue;
    const dx = p.cx - x;
    const dy = p.cy - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= best2) {
      best2 = d2;
      best = i;
    }
  }
  return best;
}
