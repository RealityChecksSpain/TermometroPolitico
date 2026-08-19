import React, { useMemo, useState, useRef } from 'react';

const esTactil = typeof window !== 'undefined' &&
  (window.matchMedia?.('(hover: none)').matches || 'ontouchstart' in window);

const FORMA = { si: 'relleno', no: 'anillo', abstencion: 'punto', no_vota: 'tenue', ausente: 'tenue' };
const ETIQUETA = { si: 'Sí', no: 'No', abstencion: 'Abstención', no_vota: 'No votó' };

function calcularAsientos(total, filas) {
  const radios = [];
  for (let i = 0; i < filas; i++) radios.push(1 + (i * 1.5) / (filas - 1));
  const suma = radios.reduce((a, b) => a + b, 0);
  const porFila = radios.map(r => Math.round((r / suma) * total));

  let dif = total - porFila.reduce((a, b) => a + b, 0);
  let idx = filas - 1;
  while (dif !== 0) {
    porFila[idx] += dif > 0 ? 1 : -1;
    dif += dif > 0 ? -1 : 1;
    idx = (idx - 1 + filas) % filas;
  }

  const puntos = [];
  porFila.forEach((n, f) => {
    const radio = radios[f];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = Math.PI - t * Math.PI;
      puntos.push({ ang, cx: Math.cos(ang) * radio, cy: -Math.sin(ang) * radio });
    }
  });
  return puntos.sort((a, b) => b.ang - a.ang);
}

export default function Hemiciclo({
  diputados, votos = null, resaltado = null,
  onSeleccionar, seleccionado = null, filas = 11, compacto = false
}) {
  const [encima, setEncima] = useState(null);
  const svgRef = useRef(null);

  const asientos = useMemo(() => calcularAsientos(diputados.length, filas), [diputados.length, filas]);
  const mapaVotos = useMemo(() => votos ? new Map(votos.map(v => [v.mandato_id, v.voto])) : null, [votos]);

  const r = 0.062;
  const activo = encima !== null ? diputados.find(d => d.mandato_id === encima) : null;
  const votoActivo = activo && mapaVotos ? mapaVotos.get(activo.mandato_id) : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox="-2.64 -2.64 5.28 2.78"
        style={{ width: '100%', display: 'block' }}
        onMouseLeave={() => setEncima(null)}
        role="img" aria-label={votos ? 'Resultado de la votación por escaño' : 'Composición del hemiciclo'}>
        <defs>
          <filter id="brillo" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.05" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {diputados.map((d, i) => {
          const a = asientos[i];
          if (!a) return null;

          const voto = mapaVotos?.get(d.mandato_id);
          const forma = votos ? FORMA[voto] ?? 'tenue' : 'relleno';
          const visible = !resaltado || resaltado(d);
          const hover = encima === d.mandato_id;
          const sel = seleccionado === d.mandato_id;
          const color = d.color || '#8E9299';
          const op = visible ? (hover ? 1 : 0.94) : 0.1;
          const escala = hover ? 1.55 : sel ? 1.4 : 1;

          const comun = {
            onMouseEnter: () => !esTactil && setEncima(d.mandato_id),
            onFocus: () => setEncima(d.mandato_id),
            onClick: () => {
              if (esTactil && encima !== d.mandato_id) { setEncima(d.mandato_id); return; }
              onSeleccionar?.(d);
            },
            tabIndex: visible ? 0 : -1,
            style: {
              cursor: 'pointer',
              transition: 'opacity 180ms ease, r 220ms cubic-bezier(.34,1.56,.64,1), stroke-width 220ms ease',
              filter: hover ? 'url(#brillo)' : 'none',
              outline: 'none'
            },
            onMouseLeave: () => setEncima(null),
            'aria-label': `${d.nombre_completo}, ${d.partido_siglas || d.grupo || ''}${voto ? `, ${ETIQUETA[voto]}` : ''}`
          };

          const marca =
            forma === 'anillo' ? (
              <circle cx={a.cx} cy={a.cy} r={r * 0.9 * escala} fill="none" stroke={color}
                strokeWidth={r * (hover ? 0.75 : 0.6)} opacity={op} />
            ) : forma === 'punto' ? (
              <>
                <circle cx={a.cx} cy={a.cy} r={r * escala} fill={color} opacity={op * 0.2} />
                <circle cx={a.cx} cy={a.cy} r={r * 0.36 * escala} fill={color} opacity={op} />
              </>
            ) : forma === 'tenue' ? (
              <circle cx={a.cx} cy={a.cy} r={r * 0.55 * escala} fill={color} opacity={op * 0.32} />
            ) : (
              <circle cx={a.cx} cy={a.cy} r={r * escala} fill={color} opacity={op}
                stroke={sel ? '#FFFFFF' : 'none'} strokeWidth={sel ? r * 0.4 : 0} />
            );

          return (
            <g key={d.mandato_id} {...comun}>
              {marca}
              <circle cx={a.cx} cy={a.cy} r={r * 1.75} fill="transparent" pointerEvents="all" />
            </g>
          );
        })}
      </svg>

      <div style={{
        minHeight: compacto ? 34 : 44, marginTop: 10, paddingTop: 10,
        borderTop: '1px solid #363B42', transition: 'opacity 160ms ease'
      }}>
        {activo ? (
          <div
            onClick={() => esTactil && onSeleccionar?.(activo)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: esTactil ? 'pointer' : 'default' }}>
            <span style={{ width: 10, height: 10, borderRadius: 10, background: activo.color || '#8E9299', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#F2F3F0', fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>
                {activo.nombre_completo}
              </div>
              <div className="em" style={{ color: '#B4BAC0', fontSize: 11, marginTop: 3 }}>
                {activo.partido_siglas || activo.grupo} · {activo.circunscripcion ?? '—'}
                {votoActivo && (
                  <span style={{
                    marginLeft: 8, color: votoActivo === 'si' ? '#5FBF92'
                      : votoActivo === 'no' ? '#E08278' : votoActivo === 'abstencion' ? '#E0BB6A' : '#7C8288',
                    fontWeight: 500
                  }}>votó {ETIQUETA[votoActivo]}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#A0A6AC', fontSize: 12 }}>
            {esTactil
              ? (votos ? 'Toca un escaño para ver quién es y qué votó.' : 'Toca un escaño para ver quién lo ocupa.')
              : (votos ? 'Pasa por encima de un escaño para ver quién es y qué votó.' : 'Pasa por encima de un escaño para ver quién lo ocupa.')}
          </div>
        )}
      </div>
    </div>
  );
}

export function LeyendaVoto({ totales }) {
  const items = [
    ['relleno', 'Sí', totales?.si],
    ['anillo', 'No', totales?.no],
    ['punto', 'Abstención', totales?.abstencion],
    ['tenue', 'No votó', totales?.no_vota]
  ];
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map(([forma, etiqueta, n]) => (
        <span key={forma} className="em" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#9AA0A6' }}>
          <svg width="15" height="15" viewBox="-8 -8 16 16">
            {forma === 'relleno' && <circle r="6" fill="#D8D8D0" />}
            {forma === 'anillo' && <circle r="5.3" fill="none" stroke="#D8D8D0" strokeWidth="3.5" />}
            {forma === 'punto' && <><circle r="6" fill="#D8D8D0" opacity="0.18" /><circle r="2.1" fill="#D8D8D0" /></>}
            {forma === 'tenue' && <circle r="3.3" fill="#D8D8D0" opacity="0.32" />}
          </svg>
          {etiqueta}{n !== undefined && n !== null && ` ${n}`}
        </span>
      ))}
    </div>
  );
}