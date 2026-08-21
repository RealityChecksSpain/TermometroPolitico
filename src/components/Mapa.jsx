import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { DestelloSuave } from './Destello.jsx';
import { traerMapaPartidos, traerSesgo } from '../lib/cliente.js';
import { puntoSvg, indiceMasCercano } from '../lib/svgPuntero.js';

const esTactil = typeof window !== 'undefined' &&
  (window.matchMedia?.('(hover: none)').matches || 'ontouchstart' in window);

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3'
};

function GuiaEje({ titulo, intro, a, b, miramos, colorA, colorB }) {
  return (
    <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 15, height: '100%' }}>
      <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 8 }}>{intro}</div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{
          fontSize: 11, color: colorA || C.tinta, textTransform: 'uppercase',
          letterSpacing: '.06em', fontWeight: 700
        }}>
          {a.titulo}
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{a.texto}</div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{
          fontSize: 11, color: colorB || C.tinta, textTransform: 'uppercase',
          letterSpacing: '.06em', fontWeight: 700
        }}>
          {b.titulo}
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{b.texto}</div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{ fontSize: 10, color: C.tenue, letterSpacing: '.05em', fontWeight: 600 }}>
          LO QUE MIRAMOS
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{miramos}</div>
      </div>
    </div>
  );
}

export default function Mapa({ onDiputados }) {
  const [datos, setDatos] = useState(null);
  const [fuente, setFuente] = useState('programa');
  const [encima, setEncima] = useState(null);
  const [sesgo, setSesgo] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    traerMapaPartidos().then(setDatos).catch(() => setDatos([]));
    traerSesgo().then(setSesgo).catch(() => setSesgo(null));
  }, []);

  const puntos = useMemo(() => {
    if (!datos) return [];
    let list = datos
      .map(d => ({
        ...d,
        x: fuente === 'programa' ? d.prog_economico : d.voto_economico,
        y: fuente === 'programa' ? d.prog_social : d.voto_social,
        n: fuente === 'programa' ? d.promesas_codificadas : d.leyes_valoradas
      }))
      .filter(d => d.x !== null && d.x !== undefined && d.y !== null && d.y !== undefined)
      .map(d => ({ ...d, cx: Number(d.x), cy: -Number(d.y) }));

    // Si el eje de votos deja al PP a la izquierda del PSOE pero el de programa
    // no, el signo del eje de votos está invertido respecto al criterio declarado.
    if (fuente === 'votos') {
      const ppV = list.find(p => p.siglas === 'PP');
      const psoeV = list.find(p => p.siglas === 'PSOE');
      const ppP = datos.find(d => d.siglas === 'PP');
      const psoeP = datos.find(d => d.siglas === 'PSOE');
      const votosEcoInvertidos = ppV && psoeV && Number(ppV.x) < Number(psoeV.x);
      const programaEcoOk = ppP && psoeP
        && ppP.prog_economico != null && psoeP.prog_economico != null
        && Number(ppP.prog_economico) > Number(psoeP.prog_economico);
      if (votosEcoInvertidos && programaEcoOk) {
        list = list.map(p => ({ ...p, x: -Number(p.x), cx: -Number(p.x) }));
      }

      // Misma salvaguarda en el eje social: PP debería quedar más conservador que PSOE
      // si el programa ya lo dice así.
      const ppVs = list.find(p => p.siglas === 'PP');
      const psoeVs = list.find(p => p.siglas === 'PSOE');
      const votosSocInvertidos = ppVs && psoeVs && Number(ppVs.y) < Number(psoeVs.y);
      const programaSocOk = ppP && psoeP
        && ppP.prog_social != null && psoeP.prog_social != null
        && Number(ppP.prog_social) > Number(psoeP.prog_social);
      if (votosSocInvertidos && programaSocOk) {
        list = list.map(p => ({ ...p, y: -Number(p.y), cy: Number(p.y) }));
      }
    }
    return list;
  }, [datos, fuente]);

  const r = escanos => 0.035 + Math.sqrt(Number(escanos ?? 1)) * 0.011;

  const conEtiqueta = useMemo(() => {
    const orden = [...puntos].sort((a, b) => a.cx - b.cx || b.cy - a.cy);
    const puestas = [];
    return orden.map(p => {
      const radio = r(p.escanos);
      const base = p.cy + radio + 0.095;
      let ly = base;
      let intentos = 0;
      while (puestas.some(q => Math.abs(q.x - p.cx) < 0.30 && Math.abs(q.y - ly) < 0.085) && intentos < 8) {
        ly += 0.088;
        intentos++;
      }
      puestas.push({ x: p.cx, y: ly });
      return { ...p, labelY: ly, radio };
    });
  }, [puntos]);

  const resolver = useCallback((clientX, clientY) => {
    const p = puntoSvg(svgRef.current, clientX, clientY);
    if (!p) return null;
    const coords = conEtiqueta.map(q => ({ cx: q.cx, cy: q.cy }));
    const maxR = Math.max(0.12, ...conEtiqueta.map(q => q.radio * 2.4));
    const idx = indiceMasCercano(coords, p.x, p.y, maxR);
    if (idx < 0) return null;
    return conEtiqueta[idx];
  }, [conEtiqueta]);

  const onPointerMove = useCallback(e => {
    const hit = resolver(e.clientX, e.clientY);
    setEncima(hit ? hit.partido : null);
  }, [resolver]);

  const onPointerLeave = useCallback(() => setEncima(null), []);

  const onPointerUp = useCallback(e => {
    const hit = resolver(e.clientX, e.clientY);
    if (!hit) return;
    setEncima(prev => (prev === hit.partido ? null : hit.partido));
  }, [resolver]);

  if (datos === null) return <div style={{ padding: 40, textAlign: 'center', color: C.tenue, fontSize: 13 }}>Cargando…</div>;

  const activo = encima ? conEtiqueta.find(p => p.partido === encima) : null;
  const faltan = 13 - (datos?.length ?? 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['programa', 'Lo que prometieron'], ['votos', 'Lo que han votado']].map(([k, t]) => (
          <button key={k} onClick={() => setFuente(k)} style={{
            padding: '9px 16px', fontSize: 13.5, cursor: 'pointer', borderRadius: 2,
            fontWeight: fuente === k ? 600 : 400,
            background: fuente === k ? C.tinta : 'transparent',
            color: fuente === k ? C.papel : C.media,
            border: `1px solid ${fuente === k ? C.tinta : C.linea}`
          }}>{t}</button>
        ))}
      </div>

      {puntos.length === 0 ? (
        <div style={{ padding: 24, background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 3, fontSize: 13, color: '#6B5518', lineHeight: 1.6 }}>
          {fuente === 'programa'
            ? 'Todavía no hay suficientes compromisos codificados. Ejecuta npm run codificar.'
            : 'Todavía no hay suficientes leyes codificadas. Ejecuta npm run codificar:leyes.'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
          alignItems: 'stretch'
        }}
          className="mapaLayout">
          <style>{`
            @media(min-width:960px){
              .mapaLayout{grid-template-columns:minmax(200px,.85fr) minmax(320px,1.3fr) minmax(200px,.85fr)!important}
            }
          `}</style>

          <div className="mapaLado">
            <GuiaEje
              titulo="Eje económico"
              intro="Mide una sola cosa: qué papel debe tener el Estado en la economía. No mide simpatías ni identidades."
              colorA="#C45C52"
              colorB="#3D7AB8"
              a={{
                titulo: 'Izquierda económica',
                texto: 'El mercado por sí solo genera desigualdad, así que el Estado debe corregirla: más gasto público, impuestos progresivos y reglas que limiten el poder de las empresas. Es la línea que va de Marx a la socialdemocracia de posguerra.'
              }}
              b={{
                titulo: 'Derecha económica',
                texto: 'El mercado asigna mejor que cualquier planificador porque nadie reúne toda la información necesaria para decidir por los demás: menos gasto, impuestos bajos y menos regulación. Es el argumento de Hayek y Friedman.'
              }}
              miramos={<>Gasto público, impuestos y regulación empresarial. Nada más.</>}
            />
          </div>

          <div style={{
            position: 'relative',
            background: C.pizarra, borderRadius: 3, padding: 'clamp(14px, 2.5vw, 22px)', minWidth: 0
          }}>
            <DestelloSuave color="rgba(232,197,106,0.35)" n={6} />
            <svg ref={svgRef}
              viewBox="-1.45 -1.5 2.9 3.05"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: 'auto', maxHeight: '58vh', display: 'block', margin: '0 auto', touchAction: 'manipulation', cursor: 'crosshair' }}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onPointerUp={onPointerUp}
              role="img"
              aria-label="Mapa de partidos en dos ejes">
              <rect x="-1.45" y="-1.5" width="2.9" height="3.05" fill="transparent" />
              <line x1="-1.24" y1="0" x2="1.24" y2="0" stroke="#3A4048" strokeWidth="0.006" />
              <line x1="0" y1="-1.24" x2="0" y2="1.24" stroke="#3A4048" strokeWidth="0.006" />

              {/* Ejes resaltados: color + peso para leer el mapa de un vistazo */}
              <text x="-1.32" y="-1.28" fill="#F2A7A0" fontSize="0.092" fontWeight="700"
                fontFamily="DM Mono, monospace" letterSpacing="0.02">IZQUIERDA</text>
              <text x="1.32" y="-1.28" fill="#8EB8F0" fontSize="0.092" fontWeight="700"
                textAnchor="end" fontFamily="DM Mono, monospace" letterSpacing="0.02">DERECHA</text>
              <text x="0" y="-1.40" fill="#E8C56A" fontSize="0.092" fontWeight="700"
                textAnchor="middle" fontFamily="DM Mono, monospace" letterSpacing="0.02">CONSERVADOR</text>
              <text x="0" y="1.48" fill="#6ECFBC" fontSize="0.092" fontWeight="700"
                textAnchor="middle" fontFamily="DM Mono, monospace" letterSpacing="0.02">PROGRESISTA</text>

              {conEtiqueta.map(p => {
                const on = !encima || encima === p.partido;
                const desviada = p.labelY > p.cy + p.radio + 0.12;
                return (
                  <g key={p.partido}
                    style={{ transition: 'opacity 160ms ease' }}
                    opacity={on ? 1 : 0.16}
                    pointerEvents="none">
                    {desviada && (
                      <line x1={p.cx} y1={p.cy + p.radio} x2={p.cx} y2={p.labelY - 0.045}
                        stroke="#5A6067" strokeWidth="0.005" />
                    )}
                    <circle cx={p.cx} cy={p.cy}
                      r={encima === p.partido ? p.radio * 1.22 : p.radio}
                      fill={p.color || '#8E9299'} stroke={C.pizarra} strokeWidth="0.014"
                      style={{ transition: 'r 200ms cubic-bezier(.34,1.56,.64,1)' }} />
                    <text x={p.cx} y={p.labelY}
                      fill={encima === p.partido ? '#FFFFFF' : '#C9CDD2'}
                      fontSize="0.058" textAnchor="middle" fontFamily="DM Mono, monospace"
                      fontWeight={encima === p.partido ? 500 : 400}>
                      {p.siglas}
                    </text>
                  </g>
                );
              })}
            </svg>

            {faltan > 0 && (
              <div className="em" style={{ fontSize: 10.5, color: '#8E959C', marginBottom: 8 }}>
                {datos.length} de 13 partidos con datos suficientes. El resto aparecerá cuando termine la codificación.
              </div>
            )}

            <div style={{ minHeight: 56, marginTop: 12, paddingTop: 12, borderTop: '1px solid #3A4048' }}>
              {activo ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 11, background: activo.color, flexShrink: 0 }} />
                    <span style={{ color: '#F2F3F0', fontSize: 14.5, fontWeight: 600 }}>{activo.siglas}</span>
                    <span className="em" style={{ color: '#9AA0A6', fontSize: 11 }}>{activo.escanos} escaños</span>
                  </div>
                  <div className="em" style={{ color: '#A8AEB4', fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
                    económico {Number(activo.x).toFixed(2)} · social {Number(activo.y).toFixed(2)}
                    {' · '}calculado sobre {activo.n} {fuente === 'programa' ? 'compromisos' : 'leyes'}
                  </div>
                  {fuente === 'programa' && activo.prog_bruto_economico != null && (
                    <div className="em" style={{ color: '#7C8288', fontSize: 10.5, marginTop: 3 }}>
                      valor absoluto sin comparar: {Number(activo.prog_bruto_economico).toFixed(2)}
                    </div>
                  )}
                  {activo.mas_disidente && Number(activo.disidencias_max) > 0 && (
                    <div style={{ color: '#8E959C', fontSize: 11.5, marginTop: 5 }}>
                      Quien más se separa del partido: {activo.mas_disidente} ({activo.disidencias_max} veces)
                    </div>
                  )}
                </div>
              ) : (
          <div style={{ color: '#8E959C', fontSize: 12, lineHeight: 1.5 }}>
            Cada círculo es un partido y su tamaño es el número de escaños.
            {esTactil ? ' Toca uno' : ' Pasa por encima de uno'} para ver su posición exacta.
            {fuente === 'votos' && (
              <span> La posición por votos cuenta solo los <em>sí</em> a normas ya codificadas:
                es una aproximación y puede diferir del sentido político habitual.
                El mapa de <em>programa</em> es la referencia más estable.</span>
            )}
          </div>
              )}
            </div>
          </div>

          <div className="mapaLado">
            <GuiaEje
              titulo="Eje social"
              intro="Es un eje independiente del económico. Se puede situar a un lado en economía y al otro en este. En España se confunden a menudo; por eso el mapa los separa."
              colorA="#B8912E"
              colorB="#2A9A86"
              a={{
                titulo: 'Conservador',
                texto: 'Las instituciones y costumbres heredadas acumulan una sabiduría que nadie diseñó y que conviene no desmontar a la ligera. Es la tesis de Burke: prudencia frente al cambio rápido, y prioridad de la comunidad, la familia y la nación sobre la elección individual.'
              }}
              b={{
                titulo: 'Progresista',
                texto: 'Cada persona debe poder decidir sobre su vida mientras no dañe a otros, y las costumbres heredadas no bastan para justificar una restricción. Viene de Mill y del liberalismo de los derechos: ampliar la autonomía personal y quitar límites que no protegen a nadie.'
              }}
              miramos={<>Derechos individuales y reglas de entrada/regularización de migrantes. Nada más.</>}
            />
          </div>
        </div>
      )}

      {fuente === 'programa' && sesgo && sesgo.partidos > 0 && (
        <div style={{ marginTop: 14, padding: 16, background: C.pizarra, borderRadius: 3 }}>
          <div className="ed" style={{ color: '#F2F3F0', fontSize: 16, fontWeight: 700 }}>
            {sesgo.prometen_expandir} de {sesgo.partidos} programas solo prometen gastar más
          </div>
          <div style={{ color: '#A8AEB4', fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Contando en bruto, sin comparar unos con otros, casi todos los partidos emiten muchas más
            señales de aumentar gasto, ayudas y servicios que de reducirlos:
            {' '}<strong style={{ color: '#F2F3F0' }}>{Number(sesgo.señales_expansivas).toLocaleString('es')}</strong> frente a
            {' '}<strong style={{ color: '#F2F3F0' }}>{Number(sesgo.señales_restrictivas).toLocaleString('es')}</strong>.
            Ningún programa dice que va a recortar, ni siquiera los que después lo hacen.
          </div>
          <div style={{ color: '#8E959C', fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
            Por eso el mapa muestra posiciones relativas: en términos absolutos todos caerían a la
            izquierda y la escala no distinguiría nada.
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: 15, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
        <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>Cómo se calcula esta posición</div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 8 }}>
          Nadie decide si un partido es de izquierdas o de derechas. Cada compromiso electoral y cada
          norma se etiqueta según <strong>seis preguntas de hecho</strong>: ¿sube o baja el gasto público?
          ¿sube o baja los impuestos? ¿añade o quita regulación? ¿amplía o restringe derechos individuales?
          ¿facilita o endurece la migración? ¿transfiere o recentraliza competencias?
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          La posición es <strong>relativa a los demás partidos españoles</strong>, no absoluta. Se cuenta
          cuántas señales de cada tipo emite cada partido y se compara con la media del conjunto. Hace falta
          así porque todos los programas prometen sobre todo gastar y ampliar: en términos absolutos todos
          saldrían a la izquierda. Lo que distingue a unos de otros es <em>cuánto</em> lo hacen comparados
          entre sí.
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          <strong>Lo que prometieron</strong> sale de los programas de 2023. <strong>Lo que han votado</strong>
          {' '}cuenta solo los votos a favor sobre normas codificadas (votar en contra no empuja al
          partido al otro polo: la oposición sistemática no equivale a una ideología). La distancia
          entre ambos puntos es lo interesante.
        </div>
      </div>
    </div>
  );
}
