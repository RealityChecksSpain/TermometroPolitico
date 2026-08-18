import React, { useMemo, useState } from 'react';

export default function Ejes({ diputados, ejes, onSeleccionar }) {
  const [encima, setEncima] = useState(null);
  const conEje = useMemo(() => diputados.filter(d => d.eje1 !== null && d.eje2 !== null), [diputados]);

  const centroides = useMemo(() => {
    const m = new Map();
    conEje.forEach(d => {
      const k = d.partido_siglas || d.grupo;
      if (!k) return;
      const a = m.get(k) ?? { n: 0, x: 0, y: 0, color: d.color };
      a.n++; a.x += d.eje1; a.y += d.eje2;
      m.set(k, a);
    });
    return Array.from(m.entries())
      .map(([k, a]) => ({ siglas: k, x: a.x / a.n, y: a.y / a.n, n: a.n, color: a.color }))
      .sort((a, b) => b.n - a.n);
  }, [conEje]);

  if (conEje.length === 0) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#7C8288', fontSize: 12 }}>
      Ejecuta npm run ejes para calcular las posiciones.
    </div>;
  }

  const activo = encima ? centroides.find(c => c.siglas === encima) : null;

  return (
    <div>
      <div style={{ background: '#1F2328', borderRadius: 3, padding: 16 }}>
        <svg viewBox="-1.3 -1.3 2.6 2.6" style={{ width: '100%', display: 'block' }}>
          <line x1="-1.2" y1="0" x2="1.2" y2="0" stroke="#363B42" strokeWidth="0.006" />
          <line x1="0" y1="-1.2" x2="0" y2="1.2" stroke="#363B42" strokeWidth="0.006" />

          {conEje.map(d => (
            <circle key={d.mandato_id} cx={d.eje1} cy={-d.eje2} r="0.022"
              fill={d.color || '#8E9299'}
              opacity={!encima || (d.partido_siglas || d.grupo) === encima ? 0.55 : 0.08}
              style={{ transition: 'opacity 160ms ease', cursor: 'pointer' }}
              onClick={() => onSeleccionar?.(d)} />
          ))}

          {centroides.map(c => (
            <g key={c.siglas}
              onMouseEnter={() => setEncima(c.siglas)}
              onMouseLeave={() => setEncima(null)}
              style={{ cursor: 'pointer' }}>
              <circle cx={c.x} cy={-c.y} r={encima === c.siglas ? 0.075 : 0.055}
                fill={c.color || '#8E9299'} stroke="#1F2328" strokeWidth="0.018"
                style={{ transition: 'r 200ms cubic-bezier(.34,1.56,.64,1)' }} />
            </g>
          ))}
        </svg>

        <div className="em" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#6E747A', marginTop: 8 }}>
          <span>← OPOSICIÓN</span>
          <span>BLOQUE DE INVESTIDURA →</span>
        </div>
        <div className="em" style={{ textAlign: 'center', fontSize: 9, color: '#5A6067', marginTop: 3 }}>
          NO es un eje izquierda-derecha
        </div>

        <div style={{ minHeight: 34, marginTop: 10, paddingTop: 10, borderTop: '1px solid #363B42' }}>
          {activo ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 10, height: 10, borderRadius: 10, background: activo.color, flexShrink: 0 }} />
              <span style={{ color: '#F2F3F0', fontSize: 13, fontWeight: 600 }}>{activo.siglas}</span>
              <span className="em" style={{ color: '#9AA0A6', fontSize: 10.5 }}>{activo.n} diputados</span>
            </div>
          ) : (
            <div style={{ color: '#6E747A', fontSize: 11.5 }}>
              Cada punto pequeño es un diputado. Los grandes son la media de su partido.
            </div>
          )}
        </div>
      </div>

      {ejes[0] && (
        <div style={{ marginTop: 12, padding: 13, background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 3 }}>
          <div style={{ fontSize: 10, color: '#6B5518', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Qué mide este eje
          </div>
          <div style={{ fontSize: 12.5, color: '#6B5518', lineHeight: 1.55, marginTop: 7 }}>
            <strong>{ejes[0].etiqueta}</strong>, {(ejes[0].varianza_explicada * 100).toFixed(0)}% de la varianza.
            Se calcula con análisis de componentes principales sobre {ejes[0].votaciones_usadas} votaciones
            reales de {ejes[0].mandatos_usados} diputados. Nadie asigna la posición: la determina con quién
            ha votado cada uno.
            {ejes[0].metodo?.includes('bimodal') && (
              <> Este eje resultó <strong>bimodal</strong>: separa dos bloques en vez de formar un continuo,
              así que mide pertenencia a bloque parlamentario y <strong>no</strong> ideología. La disciplina
              de voto en España impide extraer un eje izquierda-derecha de los votos.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}