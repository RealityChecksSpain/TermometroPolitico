import React, { useEffect, useState, useCallback } from 'react';
import { traerHallazgos } from '../lib/cliente.js';

export default function Hallazgos({ onIr }) {
  const [lista, setLista] = useState([]);
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    traerHallazgos().then(setLista).catch(() => setLista([]));
  }, []);

  useEffect(() => {
    if (pausa || lista.length < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % lista.length), 7000);
    return () => clearInterval(t);
  }, [pausa, lista.length]);

  const ir = useCallback(n => {
    setI(v => (v + n + lista.length) % lista.length);
  }, [lista.length]);

  if (!lista.length) return null;
  const h = lista[i];

  return (
    <section className="hallazgos"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      aria-live="polite">
      <div className="hallazgosCab">
        <span className="em rotulo">Hallazgos</span>
        <div className="hallazgosNav">
          <button onClick={() => ir(-1)} aria-label="Anterior">‹</button>
          <span className="em contador">{i + 1}/{lista.length}</span>
          <button onClick={() => ir(1)} aria-label="Siguiente">›</button>
        </div>
      </div>

      <button className="hallazgoCuerpo" onClick={() => h.seccion && onIr?.(h.seccion)}>
        <span key={h.titular} className="ed hallazgoTitular">{h.titular}</span>
        <span className="hallazgoDetalle">{h.detalle}</span>
      </button>

      <div className="hallazgosPuntos">
        {lista.map((_, n) => (
          <button key={n} onClick={() => setI(n)} data-on={n === i ? '1' : '0'}
            aria-label={`Hallazgo ${n + 1}`} />
        ))}
      </div>
    </section>
  );
}