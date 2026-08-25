import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { cabeza, figura, limitar, mezcla, remate, trazo } from '../lib/morfo.js';

const HUECO = 30;
const LIENZO = 30;
const ESCALA = 0.045;
const NEUTRO = 10.5;
const RESPIRO = 900;
const ARCO = 5;

const BANDA_ALTA = 19;
const BANDA_BAJA = 24;
const ALA = 4;
const MELLA = 26;
const COLA = 30;
const CABEZA_R = 8;

export default function Marca({ tinta = '#15171A', acento = '#E0492E', quieta = false }) {
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

  const util = Math.max(ancho, 1);
  const cola = Math.min(COLA, util * 0.05);
  const mella = Math.min(MELLA, util * 0.045);
  const ala = Math.min(ALA, util * 0.009);
  const radio = Math.min(CABEZA_R, util * 0.022);

  const cx = Math.min(60, util / 2);
  const silueta = figura(cx, NEUTRO, ESCALA);
  const linea = remate(0, util, BANDA_ALTA, BANDA_BAJA, ala, mella, cola);

  const cabezaIni = cabeza(cx, NEUTRO, ESCALA);
  const cabezaFin = { x: util - mella - radio, y: (BANDA_ALTA + BANDA_BAJA) / 2, r: radio };

  const d = useTransform([px, py], ([a, b]) => trazo(silueta, linea, a, b));
  const bolaX = useTransform(ph, v => mezcla(cabezaIni.x, cabezaFin.x, v));
  const bolaY = useTransform(ph, v => mezcla(cabezaIni.y, cabezaFin.y, v) - ARCO * Math.sin(Math.PI * limitar(v)));
  const bolaR = useTransform(ph, v => mezcla(cabezaIni.r, cabezaFin.r, limitar(v)));

  return (
    <div ref={caja} aria-hidden="true" style={{
      position: 'relative', width: '100%', height: HUECO, marginTop: -10, marginBottom: 4, pointerEvents: 'none'
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