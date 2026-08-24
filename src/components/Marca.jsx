import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { cabeza, figura, limitar, mezcla, remate, trazo } from '../lib/morfo.js';

const HUECO = 92;
const LIENZO = 92;
const ESCALA = 0.155;
const NEUTRO = 30;
const RESPIRO = 900;

export default function Marca({ tinta = '#15171A', acento = '#B4552F', quieta = false }) {
  const reducido = useReducedMotion();
  const caja = useRef(null);
  const [ancho, setAncho] = useState(0);

  const avance = useMotionValue(reducido || quieta ? 1 : 0);
  const px = useSpring(avance, { stiffness: 118, damping: 12.5, mass: 1 });
  const py = useSpring(avance, { stiffness: 220, damping: 30, mass: 1 });
  const ph = useSpring(avance, { stiffness: 100, damping: 14, mass: 1 });

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reducido || quieta) {
      avance.set(1);
      return;
    }
    const t = setTimeout(() => avance.set(1), RESPIRO);
    return () => clearTimeout(t);
  }, [reducido, quieta, avance]);

  const cx = Math.min(56, ancho / 2);
  const silueta = figura(cx, NEUTRO, ESCALA);
  const linea = remate(0, Math.max(ancho, 1), 79, 83, 8, 22);

  const cabezaIni = cabeza(cx, NEUTRO, ESCALA);
  const cabezaFin = { x: Math.max(ancho - 7, 7), y: 81, r: 7 };

  const d = useTransform([px, py], ([a, b]) => trazo(silueta, linea, a, b));
  const bolaX = useTransform(ph, v => mezcla(cabezaIni.x, cabezaFin.x, v));
  const bolaY = useTransform(ph, v => mezcla(cabezaIni.y, cabezaFin.y, v) - 14 * Math.sin(Math.PI * limitar(v)));
  const bolaR = useTransform(ph, v => mezcla(cabezaIni.r, cabezaFin.r, limitar(v)));

  return (
    <div ref={caja} aria-hidden="true" style={{
      position: 'relative', width: '100%', height: HUECO, marginBottom: 16, pointerEvents: 'none'
    }}>
      {ancho > 0 && (
        <svg width="100%" height={LIENZO} viewBox={`0 0 ${ancho} ${LIENZO}`} preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, bottom: 0, display: 'block' }}>
          <motion.path d={d} fill={tinta} />
          <motion.circle cx={bolaX} cy={bolaY} r={bolaR} fill={acento} />
        </svg>
      )}
    </div>
  );
}