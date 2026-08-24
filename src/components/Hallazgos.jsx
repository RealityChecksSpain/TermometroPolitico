import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { traerHallazgos } from '../lib/cliente.js';
import { Entrada, SALIDA } from './Movimiento.jsx';

const TEMAS = {
  promesas: { nombre: 'Promesas', color: '#C88A1E' },
  patrimonio: { nombre: 'Patrimonio', color: '#B4552F' },
  migracion: { nombre: 'Migración', color: '#8A6BB5' },
  derechos: { nombre: 'Derechos', color: '#2E7D5B' },
  gasto: { nombre: 'Gasto público', color: '#1F7A72' },
  impuestos: { nombre: 'Impuestos', color: '#8A6D1F' },
  empresas: { nombre: 'Empresas', color: '#4A6FA5' },
  asistencia: { nombre: 'Asistencia', color: '#4A6FA5' },
  bloques: { nombre: 'Bloques', color: '#8A6BB5' },
  vivienda: { nombre: 'Vivienda', color: '#C88A1E' }
};

export default function Hallazgos({ onIr }) {
  const reducido = useReducedMotion();
  const [lista, setLista] = useState([]);
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [sentido, setSentido] = useState(1);

  useEffect(() => {
    traerHallazgos().then(setLista).catch(() => setLista([]));
  }, []);

  useEffect(() => {
    if (pausa || reducido || lista.length < 2) return;
    const t = setInterval(() => { setSentido(1); setI(v => (v + 1) % lista.length); }, 7000);
    return () => clearInterval(t);
  }, [pausa, reducido, lista.length]);

  const ir = useCallback(n => {
    setSentido(n);
    setI(v => (v + n + lista.length) % lista.length);
  }, [lista.length]);

  const h = lista[i];
  const tema = useMemo(() => (h?.tema ? TEMAS[h.tema] : null), [h]);

  if (!lista.length) return null;

  const variantes = {
    entra: s => ({ opacity: 0, y: s > 0 ? 18 : -18 }),
    centro: { opacity: 1, y: 0 },
    sale: s => ({ opacity: 0, y: s > 0 ? -18 : 18 })
  };

  return (
    <Entrada desde={18}>
      <section className="hallazgos"
        onMouseEnter={() => setPausa(true)}
        onMouseLeave={() => setPausa(false)}
        aria-live="polite">
        <div className="hallazgosCab">
          <span className="em rotulo">Hallazgos</span>
          {tema && (
            <motion.span key={tema.nombre} className="em"
              initial={reducido ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                color: '#F3F1E8', background: tema.color, padding: '3px 8px', borderRadius: 2,
                marginLeft: 10
              }}>{tema.nombre}</motion.span>
          )}
          <div className="hallazgosNav">
            <button onClick={() => ir(-1)} aria-label="Anterior">‹</button>
            <span className="em contador">{i + 1}/{lista.length}</span>
            <button onClick={() => ir(1)} aria-label="Siguiente">›</button>
          </div>
        </div>

        <button className="hallazgoCuerpo" onClick={() => h.seccion && onIr?.(h.seccion)}
          style={{ display: 'grid' }}>
          <AnimatePresence mode="wait" custom={sentido} initial={false}>
            <motion.span key={h.titular} custom={sentido} variants={variantes}
              initial={reducido ? false : 'entra'} animate="centro" exit={reducido ? undefined : 'sale'}
              transition={SALIDA} style={{ display: 'block' }}>
              <span className="ed hallazgoTitular" style={{ display: 'block' }}>{h.titular}</span>
              <span className="hallazgoDetalle" style={{ display: 'block' }}>{h.detalle}</span>
            </motion.span>
          </AnimatePresence>
        </button>

        <div className="hallazgosPuntos">
          {lista.map((_, n) => (
            <button key={n} onClick={() => { setSentido(n > i ? 1 : -1); setI(n); }}
              data-on={n === i ? '1' : '0'} aria-label={`Hallazgo ${n + 1}`} />
          ))}
        </div>
      </section>
    </Entrada>
  );
}