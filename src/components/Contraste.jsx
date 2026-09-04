import React, { useMemo, useState } from 'react';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057',
  tenue: '#7C8288', linea: '#E3DFD1', acento: '#E0492E'
};

const EJES = [
  ['economico', 'Económico', 'prog_economico', 'voto_economico', 'izquierda', 'derecha'],
  ['social', 'Social', 'prog_social', 'voto_social', 'progresista', 'conservador']
];

function ordenar(datos, campo) {
  return datos
    .filter(d => d[campo] !== null && d[campo] !== undefined)
    .sort((a, b) => Number(a[campo]) - Number(b[campo]))
    .map((d, i) => ({ ...d, puesto: i + 1 }));
}

export default function Contraste({ datos }) {
  const [eje, setEje] = useState('economico');
  const def = EJES.find(e => e[0] === eje);
  const [, , campoProg, campoVoto, extremoA, extremoB] = def;

  const filas = useMemo(() => {
    if (!datos?.length) return [];
    const prog = ordenar(datos, campoProg);
    const voto = ordenar(datos, campoVoto);
    const puestoVoto = new Map(voto.map(d => [d.partido, d.puesto]));
    return prog
      .filter(d => puestoVoto.has(d.partido))
      .map(d => ({
        partido: d.partido,
        siglas: d.siglas,
        color: d.color || '#8E9299',
        prometido: d.puesto,
        votado: puestoVoto.get(d.partido)
      }));
  }, [datos, campoProg, campoVoto]);

  if (filas.length < 3) return null;

  const n = filas.length;
  const alto = 26;
  const H = n * alto + 54;
  const xIzq = 118;
  const xDer = 352;

  const y = puesto => 38 + (puesto - 1) * alto;

  const mayorSalto = filas.reduce((a, f) =>
    Math.abs(f.prometido - f.votado) > Math.abs(a.prometido - a.votado) ? f : a, filas[0]);

  return (
    <div style={{
      marginTop: 14, padding: 15, background: C.superficie,
      border: `1px solid ${C.linea}`, borderRadius: 3
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>De lo prometido a lo votado</div>
        <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
          {EJES.map(([k, t]) => (
            <button key={k} onClick={() => setEje(k)} className="em" style={{
              padding: '4px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 2,
              background: eje === k ? C.tinta : 'transparent',
              color: eje === k ? '#F3F1E8' : C.media,
              border: `1px solid ${eje === k ? C.tinta : C.linea}`
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 8 }}>
        Compara el <strong>orden</strong> de los partidos, no su posición. Las dos escalas no son
        la misma: el programa mide distancia relativa al resto y el voto tiene cero absoluto, así
        que sumarlas o dibujarlas en el mismo eje engañaría. El puesto sí se puede comparar.
      </div>

      <svg viewBox={`0 0 470 ${H}`} style={{ width: '100%', maxWidth: 470, height: 'auto', marginTop: 12, display: 'block' }}>
        <text x={xIzq} y="20" textAnchor="end" fontSize="10" fontFamily="DM Mono, monospace"
          fill={C.tenue} letterSpacing="0.06">PROMETIDO</text>
        <text x={xDer} y="20" fontSize="10" fontFamily="DM Mono, monospace"
          fill={C.tenue} letterSpacing="0.06">VOTADO</text>

        <text x={xIzq + 8} y={y(1) - 12} fontSize="8.5" fontFamily="DM Mono, monospace" fill={C.tenue}>
          {extremoA}
        </text>
        <text x={xIzq + 8} y={y(n) + 18} fontSize="8.5" fontFamily="DM Mono, monospace" fill={C.tenue}>
          {extremoB}
        </text>

        {filas.map(f => {
          const salto = f.votado - f.prometido;
          return (
            <g key={f.partido}>
              <line
                x1={xIzq + 6} y1={y(f.prometido)} x2={xDer - 6} y2={y(f.votado)}
                stroke={f.color} strokeWidth={Math.abs(salto) >= 3 ? 2 : 1}
                strokeOpacity={Math.abs(salto) >= 3 ? 0.85 : 0.35} />
              <circle cx={xIzq + 6} cy={y(f.prometido)} r="3.5" fill={f.color} />
              <circle cx={xDer - 6} cy={y(f.votado)} r="3.5" fill={f.color} />
              <text x={xIzq - 2} y={y(f.prometido) + 3.5} textAnchor="end"
                fontSize="10.5" fontFamily="DM Mono, monospace" fill={C.tinta}>{f.siglas}</text>
              <text x={xDer + 2} y={y(f.votado) + 3.5}
                fontSize="10.5" fontFamily="DM Mono, monospace" fill={C.tinta}>
                {f.siglas}{salto !== 0 ? ` ${salto > 0 ? '↓' : '↑'}${Math.abs(salto)}` : ''}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
        Una línea plana significa que el partido ocupa el mismo puesto en lo que prometió y en lo
        que votó. Las líneas gruesas son saltos de tres puestos o más. El mayor es{' '}
        <strong>{mayorSalto.siglas}</strong>, que pasa del puesto {mayorSalto.prometido} al{' '}
        {mayorSalto.votado}.
      </div>
      <div style={{ fontSize: 11.5, color: C.tenue, lineHeight: 1.55, marginTop: 8 }}>
        Cambiar de puesto no es incumplir. Un partido puede votar distinto de lo que prometió
        porque negocia, porque gobierna o porque la norma concreta no es la que imaginaba. Esto
        señala dónde mirar, no quién miente.
      </div>
    </div>
  );
}
