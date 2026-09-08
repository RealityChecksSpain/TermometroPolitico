import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  traerDemocraciaActual, traerDemocraciaSerie, cuadrante, CUADRANTE
} from '../lib/democracia.js';
import { puntoSvg, indiceMasCercano } from '../lib/svgPuntero.js';

const C = {
  papel: '#F3F1E8', superficie: '#FFFFFF', pizarra: '#18211E',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1'
};

const esTactil = typeof window !== 'undefined' &&
  (window.matchMedia?.('(hover: none)').matches || 'ontouchstart' in window);

const BORDE = 1.24;
const VB = { x: -1.45, y: -1.5, w: 2.9, h: 3.05 };
const MARCAS = [0, 0.25, 0.5, 0.75, 1];
const MAXIMO = 5;

const proyX = v => (v - 0.5) * 2 * BORDE;
const proyY = v => -(v - 0.5) * 2 * BORDE;

const HITOS = [1789, 1850, 1900, 1931, 1950, 1975, 2000, 2025];

function Serie({ datos, nombre }) {
  if (!datos?.length) return null;
  const anios = datos.map(d => d.anio);
  const min = Math.min(...anios);
  const max = Math.max(...anios);
  const ancho = 560;
  const alto = 150;
  const px = a => ((a - min) / Math.max(1, max - min)) * ancho;
  const py = v => alto - v * alto;

  const linea = clave => datos
    .filter(d => Number.isFinite(d[clave]))
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(d.anio).toFixed(2)} ${py(d[clave]).toFixed(2)}`)
    .join(' ');

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, color: C.media, marginBottom: 6 }}>
        {nombre}, de {min} a {max}
      </div>
      <svg viewBox={`-6 -12 ${ancho + 12} ${alto + 34}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.5, 1].map(v => (
          <line key={v} x1="0" y1={py(v)} x2={ancho} y2={py(v)}
            stroke={C.linea} strokeWidth="0.8" />
        ))}
        {HITOS.filter(a => a >= min && a <= max).map(a => (
          <g key={a}>
            <line x1={px(a)} y1="0" x2={px(a)} y2={alto} stroke={C.linea} strokeWidth="0.6" />
            <text x={px(a)} y={alto + 16} fill={C.tenue} fontSize="10" textAnchor="middle"
              fontFamily="DM Mono, monospace">{a}</text>
          </g>
        ))}
        <path d={linea('y')} fill="none" stroke="#2FA98F" strokeWidth="1.8" />
        <path d={linea('x')} fill="none" stroke="#14161A" strokeWidth="1.8" />
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: C.media, marginTop: 4 }}>
        <span><span style={{ display: 'inline-block', width: 14, height: 2, background: '#14161A', verticalAlign: 'middle', marginRight: 5 }} />elecciones</span>
        <span><span style={{ display: 'inline-block', width: 14, height: 2, background: '#2FA98F', verticalAlign: 'middle', marginRight: 5 }} />contrapesos</span>
      </div>
    </div>
  );
}

export default function MapaDemocracia() {
  const [paises, setPaises] = useState(null);
  const [error, setError] = useState(null);
  const [encima, setEncima] = useState(null);
  const [fijados, setFijados] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [serie, setSerie] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const svgRef = useRef(null);

  useEffect(() => {
    traerDemocraciaActual().then(setPaises).catch(e => { setError(e); setPaises([]); });
  }, []);

  useEffect(() => {
    if (!detalle) { setSerie(null); return; }
    let vivo = true;
    setSerie(null);
    traerDemocraciaSerie(detalle.codigo)
      .then(d => { if (vivo) setSerie(d); })
      .catch(() => { if (vivo) setSerie([]); });
    return () => { vivo = false; };
  }, [detalle]);

  const alternar = useCallback(p => {
    setFijados(prev => {
      const dentro = prev.some(f => f.codigo === p.codigo);
      if (dentro) {
        const resto = prev.filter(f => f.codigo !== p.codigo);
        setDetalle(d => (d && d.codigo === p.codigo ? resto[0] ?? null : d));
        return resto;
      }
      if (prev.length >= MAXIMO) return prev;
      setDetalle(p);
      return [...prev, p];
    });
  }, []);

  const puntos = useMemo(() => (paises ?? []).map(p => ({
    ...p,
    cx: proyX(p.x),
    cy: proyY(p.y)
  })), [paises]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return puntos.filter(p =>
      p.nombre.toLowerCase().includes(q) || p.nombreFuente.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [puntos, busqueda]);

  const seleccion = useMemo(
    () => [...fijados].sort((a, b) => (b.x + b.y) - (a.x + a.y)),
    [fijados]);
  const codigosFijados = useMemo(() => new Set(fijados.map(f => f.codigo)), [fijados]);
  const activo = encima ?? detalle;

  const alMover = useCallback(e => {
    if (esTactil || !svgRef.current || !puntos.length) return;
    const p = puntoSvg(svgRef.current, e.clientX, e.clientY);
    if (!p) return;
    const i = indiceMasCercano(puntos, p.x, p.y, 0.075);
    setEncima(i >= 0 ? puntos[i] : null);
  }, [puntos]);

  const alPulsar = useCallback(e => {
    if (!svgRef.current || !puntos.length) return;
    const p = puntoSvg(svgRef.current, e.clientX, e.clientY);
    if (!p) return;
    const i = indiceMasCercano(puntos, p.x, p.y, 0.09);
    if (i < 0) return;
    alternar(puntos[i]);
  }, [puntos, alternar]);

  if (paises === null) {
    return <div style={{ padding: 24, color: C.tenue, fontSize: 13 }}>Cargando países…</div>;
  }

  if (!puntos.length) {
    return (
      <div style={{ padding: 24, background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 3, fontSize: 13, color: '#6B5518', lineHeight: 1.6 }}>
        {error
          ? 'No se puede leer la serie de democracia ahora mismo.'
          : 'Todavía no hay ningún país publicado en esta capa. Los datos entran sin publicar y hay que verificar los polos antes de que salgan aquí.'}
      </div>
    );
  }

  const anio = puntos[0]?.anio;

  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.media, lineHeight: 1.7, margin: '0 0 12px' }}>
        Este mapa no mide ideología. No hay izquierda ni derecha aquí, y no se puede comparar
        con las otras pestañas. Mide dos preguntas distintas sobre cómo funciona un país:
        si el gobierno se puede perder en unas elecciones, y si quien gana encuentra límites.
        Un país puede puntuar alto en una y bajo en la otra, y ahí está lo interesante.
      </p>

      <div style={{ marginBottom: 10 }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar un país"
          style={{
            padding: '8px 12px', fontSize: 13, width: '100%', maxWidth: 280,
            border: `1px solid ${C.linea}`, borderRadius: 2, background: C.superficie, color: C.tinta
          }}
        />
        {filtrados.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {filtrados.map(p => (
              <button key={p.codigo}
                onClick={() => { alternar(p); setBusqueda(''); }}
                style={{
                  padding: '5px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 2,
                  background: 'transparent', color: C.media, border: `1px solid ${C.linea}`
                }}>{p.nombre}</button>
            ))}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        onPointerMove={alMover}
        onPointerLeave={() => setEncima(null)}
        onPointerDown={alPulsar}
        style={{ width: '100%', height: 'auto', background: C.papel, borderRadius: 3, touchAction: 'none', cursor: 'crosshair' }}
      >
        <line x1={-BORDE} y1="0" x2={BORDE} y2="0" stroke={C.linea} strokeWidth="0.006" />
        <line x1="0" y1={-BORDE} x2="0" y2={BORDE} stroke={C.linea} strokeWidth="0.006" />

        {MARCAS.map(v => (
          <g key={`mx-${v}`}>
            <line x1={proyX(v)} y1="-0.028" x2={proyX(v)} y2="0.028"
              stroke="#EDE7D4" strokeOpacity="0.45" strokeWidth="0.011" />
            <text x={proyX(v)} y="0.115" fill={C.tenue} fontSize="0.058" textAnchor="middle"
              fontFamily="DM Mono, monospace">{v.toFixed(2)}</text>
          </g>
        ))}
        {MARCAS.map(v => (
          <g key={`my-${v}`}>
            <line x1="-0.028" y1={proyY(v)} x2="0.028" y2={proyY(v)}
              stroke="#EDE7D4" strokeOpacity="0.45" strokeWidth="0.011" />
            <text x="0.055" y={proyY(v) + 0.021} fill={C.tenue} fontSize="0.058"
              fontFamily="DM Mono, monospace">{v.toFixed(2)}</text>
          </g>
        ))}

        <text x={-BORDE} y="-1.34" fill={C.tenue} fontSize="0.062" fontFamily="DM Mono, monospace">
          AUTOCRACIA CON REGLAS
        </text>
        <text x={BORDE} y="-1.34" fill={C.tenue} fontSize="0.062" textAnchor="end" fontFamily="DM Mono, monospace">
          DEMOCRACIA LIBERAL
        </text>
        <text x={-BORDE} y="1.36" fill={C.tenue} fontSize="0.062" fontFamily="DM Mono, monospace">
          AUTOCRACIA CERRADA
        </text>
        <text x={BORDE} y="1.36" fill={C.tenue} fontSize="0.062" textAnchor="end" fontFamily="DM Mono, monospace">
          DEMOCRACIA ILIBERAL
        </text>

        <text x="0" y="1.46" fill={C.tinta} fontSize="0.092" fontWeight="700" textAnchor="middle"
          fontFamily="DM Mono, monospace" letterSpacing="0.02">SE PUEDE PERDER EL PODER VOTANDO →</text>
        <text x="-1.36" y="0" fill={C.tinta} fontSize="0.092" fontWeight="700" textAnchor="middle"
          fontFamily="DM Mono, monospace" letterSpacing="0.02" transform="rotate(-90 -1.36 0)">
          MÁS LÍMITES A QUIEN GANA →
        </text>

        {puntos.map(p => {
          const fijo = codigosFijados.has(p.codigo);
          const esActivo = activo && activo.codigo === p.codigo;
          const esEspana = p.codigo === 'ESP';
          return (
            <circle key={p.codigo} cx={p.cx} cy={p.cy}
              r={fijo || esActivo ? 0.032 : esEspana ? 0.026 : 0.016}
              fill={fijo ? C.tinta : esEspana ? '#C4453B' : esActivo ? C.tinta : C.tenue}
              fillOpacity={fijo || esActivo || esEspana ? 1 : 0.35}
              stroke={fijo || esActivo ? C.papel : 'none'}
              strokeWidth="0.01" />
          );
        })}

        {seleccion.map((p, i) => (
          <g key={`et-${p.codigo}`}>
            <text x={p.cx} y={p.cy - 0.058} fill={C.papel} stroke={C.papel} strokeWidth="0.05"
              paintOrder="stroke" strokeLinejoin="round" fontSize="0.068"
              textAnchor="middle" fontWeight="700" fontFamily="DM Mono, monospace">
              {i + 1}. {p.nombre}
            </text>
            <text x={p.cx} y={p.cy - 0.058} fill={C.tinta} fontSize="0.068"
              textAnchor="middle" fontWeight="700" fontFamily="DM Mono, monospace">
              {i + 1}. {p.nombre}
            </text>
          </g>
        ))}

        {activo && !codigosFijados.has(activo.codigo) && (
          <text x={activo.cx} y={activo.cy - 0.055} fill={C.media} fontSize="0.066"
            textAnchor="middle" fontFamily="DM Mono, monospace">
            {activo.nombre}
          </text>
        )}
      </svg>

      <div style={{ fontSize: 11.5, color: C.tenue, marginTop: 6 }}>
        {puntos.length} países, todos medidos en {anio}. España en rojo.
        {' '}Puedes fijar hasta {MAXIMO}{fijados.length >= MAXIMO ? ' y ya has llegado al tope' : ''}.
        {esTactil ? ' Toca un punto para fijarlo o soltarlo.' : ' Pasa por encima para verlo, pulsa para fijarlo o soltarlo.'}
      </div>

      {seleccion.length > 0 && (
        <div style={{
          marginTop: 12, padding: 14, background: C.superficie,
          border: `1px solid ${C.linea}`, borderRadius: 3
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.tinta }}>
              {seleccion.length === 1 ? 'País fijado' : `${seleccion.length} países fijados`}
            </div>
            <button onClick={() => { setFijados([]); setDetalle(null); }} style={{
              marginLeft: 'auto', padding: '4px 10px', fontSize: 11, cursor: 'pointer',
              background: 'transparent', color: C.media, border: `1px solid ${C.linea}`, borderRadius: 2
            }}>Soltar todos</button>
          </div>

          {seleccion.length > 1 && (
            <div style={{ fontSize: 12, color: C.tenue, marginTop: 6, lineHeight: 1.6 }}>
              Ordenados por cercanía a la esquina superior derecha, que es donde coinciden
              elecciones que se pueden perder y límites al que gana. No es una nota: es la
              posición en el plano.
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            {seleccion.map((p, i) => {
              const abierto = detalle && detalle.codigo === p.codigo;
              const q = cuadrante(p.x, p.y);
              return (
                <div key={p.codigo} style={{
                  padding: '8px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.linea}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.tenue, fontFamily: 'DM Mono, monospace', minWidth: 16 }}>
                      {i + 1}
                    </span>
                    <button onClick={() => setDetalle(abierto ? null : p)} style={{
                      fontSize: 14, fontWeight: 600, color: C.tinta, background: 'none',
                      border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left'
                    }}>{p.nombre}</button>
                    <span className="em" style={{ fontSize: 11.5, color: C.media, fontFamily: 'DM Mono, monospace' }}>
                      elecciones {p.x.toFixed(3)} · contrapesos {p.y.toFixed(3)}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.tenue }}>{CUADRANTE[q].titulo}</span>
                    <button onClick={() => alternar(p)} style={{
                      marginLeft: 'auto', padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                      background: 'transparent', color: C.tenue, border: `1px solid ${C.linea}`, borderRadius: 2
                    }}>Soltar</button>
                  </div>

                  {abierto && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 13, color: C.media, lineHeight: 1.65 }}>
                        {CUADRANTE[q].texto}
                      </div>
                      {serie === null
                        ? <div style={{ fontSize: 12, color: C.tenue, marginTop: 10 }}>Cargando la serie…</div>
                        : <Serie datos={serie} nombre={p.nombre} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {seleccion.length === 1 && !detalle && (
            <div style={{ fontSize: 12, color: C.tenue, marginTop: 8 }}>
              Pulsa el nombre para ver su serie histórica.
            </div>
          )}
        </div>
      )}


      <p style={{ fontSize: 12.5, color: C.tenue, lineHeight: 1.7, marginTop: 16 }}>
        Los dos índices son de V-Dem, del Instituto V-Dem de la Universidad de Gotemburgo,
        que los construye preguntando a expertos de cada país. No son una nota: son dos
        descripciones concretas de cómo funciona un sistema, con su libro de códigos público.
        Cada índice va de 0 a 1 y el año de referencia es el mismo para todos los países,
        así que se pueden comparar entre sí. Las entidades históricas que dejaron de existir
        no salen en este mapa; su serie completa sigue disponible al fijar un país.
      </p>
    </div>
  );
}