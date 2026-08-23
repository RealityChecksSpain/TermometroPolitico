import React, { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const MUELLE = { type: 'spring', stiffness: 130, damping: 21, mass: 1 };
const W = 1120;
const H = 520;

const FILAS = [
  { r: 66, n: 10 }, { r: 90, n: 14 }, { r: 114, n: 18 },
  { r: 138, n: 22 }, { r: 162, n: 26 }
];
const CX = 880;
const CY = 300;

const ESCANOS = FILAS.flatMap(({ r, n }, fila) =>
  Array.from({ length: n }, (_, i) => {
    const t = Math.PI * (i + 0.5) / n;
    return { x: CX - r * Math.cos(t), y: CY - r * Math.sin(t), fila, i };
  })
);

const CUERPO = {
  silueta: { x: 806, y: 236, width: 148, height: 128, rx: 62 },
  ui: { x: 40, y: 372, width: 640, height: 58, rx: 29 }
};
const CABEZA = {
  silueta: { cx: 880, cy: 190, r: 40 },
  ui: { cx: 648, cy: 401, r: 22 }
};
const ATRIL = {
  silueta: { x: 775, y: 378, width: 210, height: 24, rx: 4 },
  ui: { x: 40, y: 462, width: 640, height: 3, rx: 1.5 }
};

const MUESTRA = [
  { clave: 'a', palabra: 'MUTUALIDADES', color: '#1F7A72', titular: 'Cribado neonatal obligatorio cada dos años', afecta: 'Menores · Familias' },
  { clave: 'b', palabra: 'VIVIENDA', color: '#C88A1E', titular: 'Medidas fiscales contra la especulación', afecta: 'Inquilinos · Propietarios' },
  { clave: 'c', palabra: 'MENOS IMPUESTOS', color: '#B4552F', titular: 'Deducciones para damnificados por la DANA', afecta: 'Damnificados · Autónomos' }
];

export function pulsoEscanos() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('escano:pulso'));
}

export default function Portada({ onIr, onLey, escanos = 350, leyes, ultimas = [] }) {
  const reducido = useReducedMotion();
  const [fase, setFase] = useState(reducido ? 'ui' : 'silueta');
  const [onda, setOnda] = useState(0);
  const [encima, setEncima] = useState(null);

  const disparar = useCallback(() => setOnda(n => n + 1), []);

  useEffect(() => {
    if (reducido) return;
    const t = setTimeout(() => setFase('ui'), 1400);
    return () => clearTimeout(t);
  }, [reducido]);

  useEffect(() => {
    window.addEventListener('escano:pulso', disparar);
    return () => window.removeEventListener('escano:pulso', disparar);
  }, [disparar]);

  const esUi = fase === 'ui';
  const tarjetas = (ultimas.length ? ultimas : MUESTRA).slice(0, 3);
  const ANCHO = 640 / 3 - 6;

  return (
    <section className="portada">
      <div className="portadaInterior">
        <div className="portadaTitulo">
          <motion.p className="em rotulo"
            initial={reducido ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.5 }}>
            Congreso de los Diputados · XV Legislatura
          </motion.p>
          <motion.h1 className="ed portadaTitular"
            initial={reducido ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.6 }}>
            ¿Sabes lo que está<br />haciendo tu gobierno?
          </motion.h1>
          <motion.p className="portadaBajada"
            initial={reducido ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44, duration: 0.58 }}>
            {escanos} escaños{leyes ? `, ${leyes} leyes votadas` : ''}. Lo que prometieron en 2023
            y lo que han votado desde entonces, uno al lado del otro.
          </motion.p>
        </div>

        <svg className="portadaLienzo" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {ESCANOS.map((p, i) => (
            <motion.circle key={i} cx={p.x} cy={p.y} r="5.6"
              fill={p.fila % 2 ? '#1F7A72' : '#C88A1E'}
              initial={reducido ? false : { scale: 0, opacity: 0 }}
              animate={reducido || !onda ? { scale: 1, opacity: 1 } : { scale: [1, 1.5, 1], opacity: 1 }}
              transition={onda
                ? { duration: 0.6, delay: p.fila * 0.05, ease: [0.3, 1.5, 0.4, 1] }
                : { delay: 0.1 + p.fila * 0.06 + (p.i % 6) * 0.02, duration: 0.34 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
          ))}

          <motion.rect fill="#15171A" initial={CUERPO.silueta}
            animate={esUi ? CUERPO.ui : CUERPO.silueta} transition={MUELLE}
            style={{ cursor: 'pointer' }}
            onClick={() => (esUi ? (disparar(), onIr?.('leyes')) : setFase('ui'))} />

          <motion.rect fill="#15171A" initial={ATRIL.silueta}
            animate={esUi ? ATRIL.ui : ATRIL.silueta} transition={MUELLE} />

          <motion.circle fill="#B4552F" initial={CABEZA.silueta}
            animate={esUi ? CABEZA.ui : CABEZA.silueta} transition={MUELLE}
            style={{ cursor: 'pointer' }}
            onClick={() => (esUi ? (disparar(), onIr?.('leyes')) : setFase('ui'))} />

          <motion.g initial={{ opacity: 0 }} animate={{ opacity: esUi ? 1 : 0 }}
            transition={{ delay: esUi ? 0.42 : 0, duration: 0.34 }} pointerEvents="none">
            <text x="66" y="407" fill="#B9AE96" fontFamily="Archivo, system-ui, sans-serif"
              fontSize="15">Busca una ley, un diputado o tu situación</text>
            <circle cx="643" cy="396" r="7.4" fill="none" stroke="#EFE1C4" strokeWidth="2.2" />
            <path d="M649 402 L656 409" stroke="#EFE1C4" strokeWidth="2.2" strokeLinecap="round" />
          </motion.g>

          <motion.g initial={{ opacity: 0 }} animate={{ opacity: esUi ? 1 : 0 }}
            transition={{ delay: esUi ? 0.5 : 0, duration: 0.3 }}>
            <text x="40" y="452" fill="#7A6132" fontFamily="DM Mono, ui-monospace, monospace"
              fontSize="10.5" letterSpacing="1.4">LO ÚLTIMO VOTADO EN EL PLENO</text>

            {tarjetas.map((t, i) => {
              const x = 40 + i * (ANCHO + 9);
              const activo = encima === i;
              return (
                <motion.g key={t.clave ?? i}
                  onHoverStart={() => setEncima(i)}
                  onHoverEnd={() => setEncima(null)}
                  onClick={() => { disparar(); t.votacionId ? onLey?.(t.votacionId) : onIr?.('leyes'); }}
                  style={{ cursor: 'pointer' }}>
                  <motion.rect x={x} width={ANCHO} rx="3" fill={t.color ?? '#1F7A72'}
                    initial={{ y: 476, height: 38 }}
                    animate={{ y: activo ? 476 : 476, height: activo ? 92 : 38 }}
                    transition={MUELLE} />
                  <text x={x + 12} y={499} fill="#EFE1C4"
                    fontFamily="Archivo, system-ui, sans-serif" fontSize="12"
                    fontWeight="700" letterSpacing="0.6">{t.palabra}</text>
                  <motion.g initial={{ opacity: 0 }} animate={{ opacity: activo ? 1 : 0 }}
                    transition={{ duration: 0.22, delay: activo ? 0.1 : 0 }} pointerEvents="none">
                    <text x={x + 12} y={521} fill="#F2E9D6"
                      fontFamily="Archivo, system-ui, sans-serif" fontSize="10.5">
                      {(t.titular ?? '').slice(0, 34)}
                    </text>
                    <text x={x + 12} y={537} fill="#E3D2B4"
                      fontFamily="DM Mono, ui-monospace, monospace" fontSize="9">
                      {(t.afecta ?? '').slice(0, 34)}
                    </text>
                  </motion.g>
                </motion.g>
              );
            })}
          </motion.g>
        </svg>
      </div>
    </section>
  );
}