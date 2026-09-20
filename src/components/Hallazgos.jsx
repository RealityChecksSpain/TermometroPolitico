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

const MAXIMO = 8;

function baseDe(h) {
  if (h.base_texto) return String(h.base_texto);
  if (h.denominador_texto) return String(h.denominador_texto);
  const n = h.base_n ?? h.denominador ?? null;
  if (n == null) return null;
  const que = h.base_unidad ?? h.unidad ?? 'registros';
  return `Calculado sobre ${Number(n).toLocaleString('es')} ${que}.`;
}

function utilizable(h) {
  if (!h?.titular) return false;
  if (!h.detalle || String(h.detalle).trim().length < 20) return false;
  return true;
}

export default function Hallazgos({ onIr }) {
  const reducido = useReducedMotion();
  const [lista, setLista] = useState([]);
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [manual, setManual] = useState(false);
  const [sentido, setSentido] = useState(1);
  const [verTodos, setVerTodos] = useState(false);
  const [descartados, setDescartados] = useState(0);

  useEffect(() => {
    traerHallazgos()
      .then(filas => {
        const buenos = (filas ?? []).filter(utilizable);
        setDescartados((filas ?? []).length - buenos.length);
        setLista(buenos.slice(0, MAXIMO));
      })
      .catch(() => setLista([]));
  }, []);

  useEffect(() => {
    if (pausa || manual || reducido || lista.length < 2) return;
    const t = setInterval(() => { setSentido(1); setI(v => (v + 1) % lista.length); }, 9000);
    return () => clearInterval(t);
  }, [pausa, manual, reducido, lista.length]);

  const ir = useCallback(n => {
    setManual(true);
    setSentido(n);
    setI(v => (v + n + lista.length) % lista.length);
  }, [lista.length]);

  const h = lista[i];
  const tema = useMemo(() => (h?.tema ? TEMAS[h.tema] : null), [h]);
  const base = useMemo(() => (h ? baseDe(h) : null), [h]);

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
                color: '#F3F1E8', background: tema.color, padding: '3px 8px', borderRadius: 2
              }}>{tema.nombre}</motion.span>
          )}
          <div className="hallazgosNav">
            <button onClick={() => ir(-1)} aria-label="Hallazgo anterior">‹</button>
            <span className="em contador">{i + 1}/{lista.length}</span>
            <button onClick={() => ir(1)} aria-label="Hallazgo siguiente">›</button>
          </div>
        </div>

        {verTodos ? (
          <div>
            {lista.map((x, n) => (
              <button key={x.titular} className="hallazgoCuerpo"
                onClick={() => x.seccion && onIr?.(x.seccion)}
                style={{
                  minHeight: 0, padding: '11px 0',
                  borderTop: n ? '1px solid #2C3339' : 'none'
                }}>
                <span className="ed hallazgoTitular" style={{ fontSize: 15.5 }}>{x.titular}</span>
                <span className="hallazgoDetalle" style={{ fontSize: 12.5 }}>{x.detalle}</span>
                {baseDe(x) && <span className="hallazgoBase">{baseDe(x)}</span>}
              </button>
            ))}
          </div>
        ) : (
          <button className="hallazgoCuerpo" onClick={() => h.seccion && onIr?.(h.seccion)}
            style={{ display: 'grid' }}>
            <AnimatePresence mode="wait" custom={sentido} initial={false}>
              <motion.span key={h.titular} custom={sentido} variants={variantes}
                initial={reducido ? false : 'entra'} animate="centro" exit={reducido ? undefined : 'sale'}
                transition={SALIDA} style={{ display: 'block' }}>
                <span className="ed hallazgoTitular" style={{ display: 'block' }}>{h.titular}</span>
                <span className="hallazgoDetalle" style={{ display: 'block' }}>{h.detalle}</span>
                {base && <span className="hallazgoBase">{base}</span>}
              </motion.span>
            </AnimatePresence>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {!verTodos && (
            <div className="hallazgosPuntos">
              {lista.map((_, n) => (
                <button key={n} onClick={() => { setManual(true); setSentido(n > i ? 1 : -1); setI(n); }}
                  data-on={n === i ? '1' : '0'} aria-label={`Hallazgo ${n + 1}`} />
              ))}
            </div>
          )}
          <button onClick={() => setVerTodos(v => !v)} className="em" style={{
            marginLeft: 'auto', marginTop: 12, background: 'none', border: '1px solid #3A4048',
            borderRadius: 2, color: '#9AA4AC', fontSize: 10.5, padding: '4px 9px', cursor: 'pointer'
          }}>
            {verTodos ? 'ver de uno en uno' : `ver los ${lista.length}`}
          </button>
        </div>

        {descartados > 0 && (
          <div className="em" style={{ fontSize: 10, color: '#6C737B', marginTop: 10, lineHeight: 1.5 }}>
            {descartados === 1
              ? 'Un hallazgo no se enseña porque no trae el dato en que se apoya.'
              : `${descartados} hallazgos no se enseñan porque no traen el dato en que se apoyan.`}
          </div>
        )}
      </section>
    </Entrada>
  );
}