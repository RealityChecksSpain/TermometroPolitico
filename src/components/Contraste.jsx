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
  const [activo, setActivo] = useState(null);
  const def = EJES.find(e => e[0] === eje);
  const [, , campoProg, campoVoto, extremoA, extremoB] = def;

  const filas = useMemo(() => {
    if (!datos?.length) return [];
    const comunes = datos.filter(d =>
      d[campoProg] !== null && d[campoProg] !== undefined &&
      d[campoVoto] !== null && d[campoVoto] !== undefined);
    const prog = ordenar(comunes, campoProg);
    const voto = ordenar(comunes, campoVoto);
    const puestoVoto = new Map(voto.map(d => [d.partido, d.puesto]));
    return prog.map(d => ({
      partido: d.partido,
      siglas: d.siglas,
      color: d.color || '#8E9299',
      prometido: d.puesto,
      votado: puestoVoto.get(d.partido)
    }));
  }, [datos, campoProg, campoVoto]);

  if (filas.length < 3) return null;

  const n = filas.length;
  const alto = 34;
  const margenSup = 58;
  const H = margenSup + (n - 1) * alto + 56;
  const anchoSigla = filas.reduce((a, f) => Math.max(a, String(f.siglas).length), 0) * 7.4;
  const xNum = 26;
  const xIzq = xNum + 14 + anchoSigla + 14;
  const anchoSalto = 52;
  const xDer = xIzq + 300;
  const W = xDer + 16 + anchoSigla + 12 + anchoSalto;

  const y = puesto => margenSup + (puesto - 1) * alto;

  const mayorSalto = filas.reduce((a, f) =>
    Math.abs(f.prometido - f.votado) > Math.abs(a.prometido - a.votado) ? f : a, filas[0]);

  const curva = (y1, y2) => {
    const c = (xDer - xIzq) * 0.45;
    return `M ${xIzq + 7} ${y1} C ${xIzq + 7 + c} ${y1}, ${xDer - 7 - c} ${y2}, ${xDer - 7} ${y2}`;
  };

  return (
    <div style={{
      marginTop: 14, padding: 18, background: C.superficie,
      border: `1px solid ${C.linea}`, borderRadius: 3
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>De lo prometido a lo votado</div>
        <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
          {EJES.map(([k, t]) => (
            <button key={k} onClick={() => { setEje(k); setActivo(null); }} className="em" style={{
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

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 14, display: 'block' }}
        onMouseLeave={() => setActivo(null)}>

        <text x={xIzq + 7} y="22" textAnchor="middle" fontSize="10.5" fontFamily="DM Mono, monospace"
          fill={C.tenue} letterSpacing="0.08">LO QUE PROMETIERON</text>
        <text x={xDer - 7} y="22" textAnchor="middle" fontSize="10.5" fontFamily="DM Mono, monospace"
          fill={C.tenue} letterSpacing="0.08">LO QUE VOTARON</text>

        <text x={xIzq - 14} y="42" textAnchor="end" fontSize="9.5" fontFamily="DM Mono, monospace" fill={C.tenue}>
          ↑ {extremoA}
        </text>
        <text x={xIzq - 14} y={y(n) + 30} textAnchor="end" fontSize="9.5" fontFamily="DM Mono, monospace" fill={C.tenue}>
          ↓ {extremoB}
        </text>

        <line x1={xIzq + 7} y1={y(1) - 14} x2={xIzq + 7} y2={y(n) + 14}
          stroke={C.linea} strokeWidth="1" />
        <line x1={xDer - 7} y1={y(1) - 14} x2={xDer - 7} y2={y(n) + 14}
          stroke={C.linea} strokeWidth="1" />

        {filas.map(f => {
          const salto = f.votado - f.prometido;
          const grande = Math.abs(salto) >= 3;
          const encendido = activo === f.partido;
          const apagado = activo !== null && !encendido;
          return (
            <path key={`l-${f.partido}`} d={curva(y(f.prometido), y(f.votado))}
              fill="none" stroke={f.color}
              strokeWidth={encendido ? 3.2 : grande ? 2.2 : 1.2}
              strokeOpacity={apagado ? 0.1 : encendido ? 1 : grande ? 0.8 : 0.3}
              strokeLinecap="round" />
          );
        })}

        {filas.map(f => {
          const salto = f.votado - f.prometido;
          const encendido = activo === f.partido;
          const apagado = activo !== null && !encendido;
          const op = apagado ? 0.25 : 1;
          return (
            <g key={f.partido} onMouseEnter={() => setActivo(f.partido)} style={{ cursor: 'default' }}>
              <rect x="0" y={y(f.prometido) - alto / 2} width={xIzq - 8} height={alto} fill="transparent" />
              <rect x={xDer} y={y(f.votado) - alto / 2} width={W - xDer} height={alto} fill="transparent" />

              <text x={xNum} y={y(f.prometido) + 4} textAnchor="end" opacity={op}
                fontSize="10" fontFamily="DM Mono, monospace" fill={C.tenue}>{f.prometido}</text>
              <text x={xIzq - 14} y={y(f.prometido) + 4} textAnchor="end" opacity={op}
                fontSize="12" fontFamily="DM Mono, monospace" fontWeight={encendido ? 700 : 400}
                fill={C.tinta}>{f.siglas}</text>
              <circle cx={xIzq + 7} cy={y(f.prometido)} r={encendido ? 5 : 4}
                fill={f.color} opacity={op} />

              <circle cx={xDer - 7} cy={y(f.votado)} r={encendido ? 5 : 4}
                fill={f.color} opacity={op} />
              <text x={xDer + 16} y={y(f.votado) + 4} opacity={op}
                fontSize="12" fontFamily="DM Mono, monospace" fontWeight={encendido ? 700 : 400}
                fill={C.tinta}>{f.siglas}</text>
              <text x={xDer + 16 + anchoSigla + 12} y={y(f.votado) + 4} opacity={op}
                fontSize="10.5" fontFamily="DM Mono, monospace"
                fill={salto === 0 ? C.tenue : Math.abs(salto) >= 3 ? C.acento : C.media}>
                {salto === 0 ? 'igual' : `${salto > 0 ? '↓' : '↑'}${Math.abs(salto)}`}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 12 }}>
        Cada partido ocupa un puesto en lo que prometió y otro en lo que votó. Una línea plana
        significa el mismo puesto en los dos. Las líneas gruesas son saltos de tres puestos o más.
        El mayor es <strong>{mayorSalto.siglas}</strong>, que pasa del puesto {mayorSalto.prometido}
        {' '}al {mayorSalto.votado}. Pasa el ratón por encima de un partido para seguir su línea.
      </div>
      <div style={{ fontSize: 11.5, color: C.tenue, lineHeight: 1.55, marginTop: 8 }}>
        Cambiar de puesto no es incumplir. Un partido puede votar distinto de lo que prometió
        porque negocia, porque gobierna o porque la norma concreta no es la que imaginaba. Esto
        señala dónde mirar, no quién miente.
      </div>
    </div>
  );
}