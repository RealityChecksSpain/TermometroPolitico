import React, { useEffect, useMemo, useState } from 'react';

const esTactil = typeof window !== 'undefined' &&
  (window.matchMedia?.('(hover: none)').matches || 'ontouchstart' in window);
import { traerMapaPartidos, traerSesgo } from '../lib/cliente.js';

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3'
};

export default function Mapa({ onDiputados }) {
  const [datos, setDatos] = useState(null);
  const [fuente, setFuente] = useState('programa');
  const [encima, setEncima] = useState(null);
  const [sesgo, setSesgo] = useState(null);

  useEffect(() => {
    traerMapaPartidos().then(setDatos).catch(() => setDatos([]));
    traerSesgo().then(setSesgo).catch(() => setSesgo(null));
  }, []);

  const puntos = useMemo(() => {
    if (!datos) return [];
    return datos
      .map(d => ({
        ...d,
        x: fuente === 'programa' ? d.prog_economico : d.voto_economico,
        y: fuente === 'programa' ? d.prog_social : d.voto_social,
        n: fuente === 'programa' ? d.promesas_codificadas : d.leyes_valoradas
      }))
      .filter(d => d.x !== null && d.x !== undefined && d.y !== null && d.y !== undefined);
  }, [datos, fuente]);

  if (datos === null) return <div style={{ padding: 40, textAlign: 'center', color: C.tenue, fontSize: 13 }}>Cargando…</div>;

  const activo = encima ? puntos.find(p => p.partido === encima) : null;
  const r = escanos => 0.035 + Math.sqrt(Number(escanos ?? 1)) * 0.011;

  const conEtiqueta = (() => {
    const orden = [...puntos].sort((a, b) => Number(a.x) - Number(b.x) || Number(b.y) - Number(a.y));
    const puestas = [];
    return orden.map(p => {
      const px = Number(p.x);
      const base = -Number(p.y) + r(p.escanos) + 0.095;
      let ly = base;
      let intentos = 0;
      while (puestas.some(q => Math.abs(q.x - px) < 0.30 && Math.abs(q.y - ly) < 0.085) && intentos < 8) {
        ly += 0.088;
        intentos++;
      }
      puestas.push({ x: px, y: ly });
      return { ...p, labelY: ly };
    });
  })();

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
        <div style={{ background: C.pizarra, borderRadius: 3, padding: 'clamp(16px, 3vw, 28px)' }}>
          <svg viewBox="-1.45 -1.5 2.9 3.05"
            style={{ width: '100%', maxHeight: '62vh', display: 'block', margin: '0 auto' }}>
            <line x1="-1.24" y1="0" x2="1.24" y2="0" stroke="#3A4048" strokeWidth="0.006" />
            <line x1="0" y1="-1.24" x2="0" y2="1.24" stroke="#3A4048" strokeWidth="0.006" />

            <text x="-1.32" y="-1.30" fill="#8E959C" fontSize="0.058" fontFamily="DM Mono, monospace">IZQUIERDA</text>
            <text x="1.32" y="-1.30" fill="#8E959C" fontSize="0.058" textAnchor="end" fontFamily="DM Mono, monospace">DERECHA</text>
            <text x="0" y="-1.38" fill="#8E959C" fontSize="0.058" textAnchor="middle" fontFamily="DM Mono, monospace">CONSERVADOR</text>
            <text x="0" y="1.46" fill="#8E959C" fontSize="0.058" textAnchor="middle" fontFamily="DM Mono, monospace">PROGRESISTA</text>

            {conEtiqueta.map(p => {
              const on = !encima || encima === p.partido;
              const radio = r(p.escanos);
              const px = Number(p.x), py = -Number(p.y);
              const desviada = p.labelY > py + radio + 0.12;
              return (
                <g key={p.partido}
                  onMouseEnter={() => !esTactil && setEncima(p.partido)}
                  onMouseLeave={() => !esTactil && setEncima(null)}
                  onClick={() => setEncima(encima === p.partido ? null : p.partido)}
                  tabIndex={0}
                  onFocus={() => setEncima(p.partido)}
                  role="button"
                  aria-label={`${p.siglas}, ${p.escanos} escaños`}
                  style={{ cursor: 'pointer', transition: 'opacity 160ms ease', outline: 'none' }}
                  opacity={on ? 1 : 0.16}>
                  {desviada && (
                    <line x1={px} y1={py + radio} x2={px} y2={p.labelY - 0.045}
                      stroke="#5A6067" strokeWidth="0.005" />
                  )}
                  <circle cx={px} cy={py} r={radio * 1.9} fill="transparent" pointerEvents="all" />
                  <circle cx={px} cy={py}
                    r={encima === p.partido ? radio * 1.22 : radio}
                    fill={p.color || '#8E9299'} stroke={C.pizarra} strokeWidth="0.014"
                    style={{ transition: 'r 200ms cubic-bezier(.34,1.56,.64,1)' }} />
                  <text x={px} y={p.labelY}
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
              </div>
            )}
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

      <div className="ejesGuia" style={{ marginTop: 14 }}>
        <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 15 }}>
          <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>Qué es izquierda y derecha aquí</div>
          <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 8 }}>
            Este eje mide <strong>una sola cosa</strong>: qué papel debe tener el Estado en la economía.
            No mide simpatías ni identidades.
          </div>

          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
            <div className="em" style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
              Izquierda económica
            </div>
            <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>
              El mercado por sí solo genera desigualdad, así que el Estado debe corregirla: más gasto
              público, impuestos progresivos y reglas que limiten el poder de las empresas.
              Es la línea que va de Marx a la socialdemocracia de posguerra: para el primero el conflicto
              está en quién posee los medios de producción; para la segunda basta con redistribuir
              lo que el mercado reparte mal.
            </div>
          </div>

          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
            <div className="em" style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
              Derecha económica
            </div>
            <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>
              El mercado asigna mejor que cualquier planificador porque nadie reúne toda la información
              necesaria para decidir por los demás: menos gasto, impuestos bajos y menos regulación.
              Es el argumento de Hayek y Friedman, y su corolario es que ampliar el Estado reduce
              la libertad individual aunque se haga con buena intención.
            </div>
          </div>

          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
            <div className="em" style={{ fontSize: 10, color: C.tenue, letterSpacing: '.05em', fontWeight: 600 }}>
              LO QUE MIRAMOS
            </div>
            <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>
              Si cada medida sube o baja el <strong>gasto público</strong>, si sube o baja los
              <strong> impuestos</strong>, y si añade o quita <strong>regulación</strong> a las empresas.
              Nada más.
            </div>
          </div>
        </div>

        <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 15 }}>
          <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>Qué es progresista y conservador</div>
          <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 8 }}>
            Es un eje <strong>independiente</strong> del anterior. Se puede ser de izquierda económica
            y socialmente conservador, o al revés. En España se confunden los dos ejes constantemente,
            y por eso el mapa los separa.
          </div>

          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
            <div className="em" style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
              Conservador
            </div>
            <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>
              Las instituciones y costumbres heredadas acumulan una sabiduría que nadie diseñó y que
              conviene no desmontar a la ligera. Es la tesis de Burke: prudencia frente al cambio
              rápido, y prioridad de la comunidad, la familia y la nación sobre la elección individual.
            </div>
          </div>

          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
            <div className="em" style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
              Progresista
            </div>
            <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>
              Cada persona debe poder decidir sobre su vida mientras no dañe a otros, y las costumbres
              heredadas no bastan para justificar una restricción. Viene de Mill y del liberalismo de
              los derechos: ampliar la autonomía personal y quitar límites que no protegen a nadie.
            </div>
          </div>

          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
            <div className="em" style={{ fontSize: 10, color: C.tenue, letterSpacing: '.05em', fontWeight: 600 }}>
              LO QUE MIRAMOS
            </div>
            <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>
              Si cada medida amplía o restringe <strong>derechos individuales</strong>, y si facilita o
              endurece la <strong>entrada y regularización de migrantes</strong>. Nada más.
            </div>
          </div>
        </div>
      </div>

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
          <strong>Lo que prometieron</strong> sale de los programas de 2023. <strong>Lo que han votado</strong>,
          de las normas que cada partido apoyó o rechazó. La distancia entre ambos puntos es lo interesante.
        </div>
      </div>
    </div>
  );
}