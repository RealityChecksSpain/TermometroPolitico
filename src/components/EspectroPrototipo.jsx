import React, { useState, useMemo } from 'react';

const PARTIDOS = {
  psoe: { siglas: 'PSOE', nombre: 'Partido Socialista Obrero Español', color: '#C8102E', suave: '#FBE9EC', texto: '#8E0B20', escanos: 121, x: -0.42, y: -0.18 },
  pp: { siglas: 'PP', nombre: 'Partido Popular', color: '#0B4DA2', suave: '#E7EEF8', texto: '#083A79', escanos: 137, x: 0.55, y: -0.52 },
  vox: { siglas: 'VOX', nombre: 'VOX', color: '#5BC236', suave: '#EDF9E8', texto: '#33701E', escanos: 33, x: 0.88, y: -0.91 },
  sumar: { siglas: 'SUMAR', nombre: 'Sumar', color: '#B5227A', suave: '#F9E9F2', texto: '#84195A', escanos: 31, x: -0.79, y: 0.24 },
  erc: { siglas: 'ERC', nombre: 'Esquerra Republicana', color: '#F2A81C', suave: '#FDF3E2', texto: '#8A5D06', escanos: 7, x: -0.61, y: 0.88 },
  junts: { siglas: 'JUNTS', nombre: 'Junts per Catalunya', color: '#6FD3E8', suave: '#EAF9FC', texto: '#186273', escanos: 7, x: 0.14, y: 0.94 },
  bildu: { siglas: 'EH BILDU', nombre: 'Euskal Herria Bildu', color: '#8A9B0F', suave: '#F3F5E3', texto: '#5C6709', escanos: 6, x: -0.86, y: 0.79 },
  pnv: { siglas: 'PNV', nombre: 'Partido Nacionalista Vasco', color: '#00693C', suave: '#E3F1EA', texto: '#004E2C', escanos: 5, x: 0.08, y: 0.71 },
  bng: { siglas: 'BNG', nombre: 'Bloque Nacionalista Galego', color: '#1B9AD6', suave: '#E5F3FB', texto: '#116A94', escanos: 1, x: -0.74, y: 0.66 },
  cc: { siglas: 'CC', nombre: 'Coalición Canaria', color: '#E8D019', suave: '#FCF9E0', texto: '#7D700A', escanos: 1, x: 0.31, y: 0.42 },
  upn: { siglas: 'UPN', nombre: 'Unión del Pueblo Navarro', color: '#8E9299', suave: '#F1F2F3', texto: '#5A5E64', escanos: 1, x: 0.62, y: -0.61 }
};

const ORDEN = ['bildu', 'sumar', 'bng', 'erc', 'psoe', 'pnv', 'junts', 'cc', 'pp', 'upn', 'vox'];

const NOMBRES = ['Ana', 'Carlos', 'Lucía', 'Javier', 'Marta', 'Diego', 'Elena', 'Pablo', 'Rocío', 'Sergio', 'Nuria', 'Iván', 'Clara', 'Álvaro', 'Berta', 'Hugo', 'Irene', 'Mateo'];
const APELLIDOS = ['García', 'Fernández', 'Ruiz', 'Montero', 'Iglesias', 'Serrano', 'Vidal', 'Ortega', 'Castro', 'Reyes', 'Blanco', 'Prieto', 'Nieto', 'Cabrera', 'Lorenzo', 'Otero'];

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function generarDiputados() {
  const r = rng(42);
  const out = [];
  let id = 0;
  ORDEN.forEach(slug => {
    const p = PARTIDOS[slug];
    for (let i = 0; i < p.escanos; i++) {
      const dispersion = 0.11;
      out.push({
        id: id++,
        slug,
        nombre: `${NOMBRES[Math.floor(r() * NOMBRES.length)]} ${APELLIDOS[Math.floor(r() * APELLIDOS.length)]}`,
        x: Math.max(-1, Math.min(1, p.x + (r() - 0.5) * dispersion)),
        y: Math.max(-1, Math.min(1, p.y + (r() - 0.5) * dispersion)),
        disciplina: 94 + r() * 6,
        asistencia: 72 + r() * 27
      });
    }
  });
  return out;
}

function calcularEscanos(total, filas) {
  const radios = [];
  for (let i = 0; i < filas; i++) radios.push(1 + (i * 1.4) / (filas - 1));
  const suma = radios.reduce((a, b) => a + b, 0);
  const porFila = radios.map(r => Math.round((r / suma) * total));
  let diff = total - porFila.reduce((a, b) => a + b, 0);
  let idx = filas - 1;
  while (diff !== 0) {
    porFila[idx] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    idx = (idx - 1 + filas) % filas;
  }
  const puntos = [];
  porFila.forEach((n, f) => {
    const radio = radios[f];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = Math.PI - t * Math.PI;
      puntos.push({ fila: f, ang, cx: Math.cos(ang) * radio, cy: -Math.sin(ang) * radio });
    }
  });
  return puntos.sort((a, b) => b.ang - a.ang);
}

export default function EspectroPrototipo() {
  const [vista, setVista] = useState('hemiciclo');
  const [filtro, setFiltro] = useState(null);
  const [hover, setHover] = useState(null);

  const diputados = useMemo(() => generarDiputados(), []);
  const asientos = useMemo(() => calcularEscanos(350, 11), []);

  const asignados = useMemo(
    () => asientos.map((a, i) => ({ ...a, ...diputados[i] })),
    [asientos, diputados]
  );

  const visibles = filtro ? asignados.filter(d => d.slug === filtro) : asignados;
  const lista = filtro ? diputados.filter(d => d.slug === filtro) : diputados;

  const chrome = {
    papel: '#EFEFE9',
    superficie: '#FFFFFF',
    pizarra: '#1F2328',
    tinta: '#14161A',
    media: '#4A5057',
    tenue: '#7C8288',
    linea: '#DCDCD3'
  };

  return (
    <div style={{ background: chrome.papel, minHeight: '100vh', color: chrome.tinta }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Archivo+Expanded:wght@600;800&family=DM+Mono:wght@400;500&display=swap');
        .esp { font-family: 'Archivo', system-ui, sans-serif; }
        .esp-d { font-family: 'Archivo Expanded', 'Archivo', sans-serif; letter-spacing: -0.02em; }
        .esp-m { font-family: 'DM Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        .seat { transition: opacity 140ms ease, r 140ms ease; cursor: pointer; }
        .seat:focus-visible { outline: 2px solid #14161A; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .seat { transition: none; } }
      `}</style>

      <div className="esp" style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 64px' }}>

        <div style={{ borderBottom: `2px solid ${chrome.tinta}`, paddingBottom: 12, marginBottom: 20 }}>
          <div className="esp-d" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
            Escaño
          </div>
          <div style={{ fontSize: 13, color: chrome.media, marginTop: 6, lineHeight: 1.45 }}>
            Cómo vota cada diputado. Datos del Congreso, sin intermediarios.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
          {[['hemiciclo', 'Hemiciclo'], ['ejes', 'Ejes'], ['lista', 'Lista']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setVista(k)}
              className="esp"
              style={{
                flex: 1,
                padding: '9px 8px',
                fontSize: 13,
                fontWeight: vista === k ? 600 : 400,
                background: vista === k ? chrome.tinta : 'transparent',
                color: vista === k ? chrome.papel : chrome.media,
                border: `1px solid ${vista === k ? chrome.tinta : chrome.linea}`,
                borderRadius: 2,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 20 }}>
          <button
            onClick={() => setFiltro(null)}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 2, cursor: 'pointer',
              background: filtro === null ? chrome.tinta : 'transparent',
              color: filtro === null ? chrome.papel : chrome.media,
              border: `1px solid ${filtro === null ? chrome.tinta : chrome.linea}`
            }}
          >
            TODOS · 350
          </button>
          {ORDEN.map(slug => {
            const p = PARTIDOS[slug];
            const activo = filtro === slug;
            return (
              <button
                key={slug}
                onClick={() => setFiltro(activo ? null : slug)}
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 2, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: activo ? p.suave : 'transparent',
                  color: activo ? p.texto : chrome.media,
                  border: `1px solid ${activo ? p.color : chrome.linea}`
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 9, background: p.color, display: 'inline-block', flexShrink: 0 }} />
                {p.siglas}
                <span className="esp-m" style={{ fontSize: 10, opacity: 0.65 }}>{p.escanos}</span>
              </button>
            );
          })}
        </div>

        {vista === 'hemiciclo' && (
          <div style={{ background: chrome.pizarra, borderRadius: 3, padding: '22px 14px 14px' }}>
            <svg viewBox="-2.65 -2.65 5.3 1.5" style={{ width: '100%', display: 'block' }}>
              {asignados.map(d => {
                const p = PARTIDOS[d.slug];
                const on = !filtro || d.slug === filtro;
                return (
                  <circle
                    key={d.id}
                    className="seat"
                    cx={d.cx}
                    cy={d.cy}
                    r={hover === d.id ? 0.085 : 0.062}
                    fill={p.color}
                    opacity={on ? 1 : 0.13}
                    tabIndex={0}
                    onMouseEnter={() => setHover(d.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(d.id)}
                    onBlur={() => setHover(null)}
                  />
                );
              })}
            </svg>
            <div style={{ minHeight: 40, marginTop: 10, paddingTop: 10, borderTop: '1px solid #363B42' }}>
              {hover !== null ? (
                (() => {
                  const d = asignados.find(x => x.id === hover);
                  const p = PARTIDOS[d.slug];
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 11, height: 11, borderRadius: 11, background: p.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ color: '#F2F3F0', fontSize: 14, fontWeight: 600 }}>{d.nombre}</div>
                        <div className="esp-m" style={{ color: '#9AA0A6', fontSize: 11 }}>
                          {p.siglas} · disciplina {d.disciplina.toFixed(1)}% · asistencia {d.asistencia.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ color: '#7C8288', fontSize: 12 }}>Toca un escaño para ver quién lo ocupa.</div>
              )}
            </div>
          </div>
        )}

        {vista === 'ejes' && (
          <div>
            <div style={{ background: chrome.superficie, border: `1px solid ${chrome.linea}`, borderRadius: 3, padding: 14 }}>
              <svg viewBox="-1.25 -1.25 2.5 2.5" style={{ width: '100%', display: 'block' }}>
                <line x1="-1.15" y1="0" x2="1.15" y2="0" stroke={chrome.linea} strokeWidth="0.008" />
                <line x1="0" y1="-1.15" x2="0" y2="1.15" stroke={chrome.linea} strokeWidth="0.008" />
                {visibles.map(d => (
                  <circle key={d.id} cx={d.x} cy={-d.y} r="0.028" fill={PARTIDOS[d.slug].color} opacity="0.78" />
                ))}
              </svg>
              <div className="esp-m" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: chrome.tenue, marginTop: 6 }}>
                <span>← IZQUIERDA</span>
                <span>DERECHA →</span>
              </div>
              <div className="esp-m" style={{ textAlign: 'center', fontSize: 10, color: chrome.tenue, marginTop: 2 }}>
                ARRIBA: PERIFÉRICO · ABAJO: CENTRALISTA
              </div>
            </div>
            <div style={{ marginTop: 12, padding: 12, background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 3, fontSize: 12, lineHeight: 1.5, color: '#6B5518' }}>
              <strong>Coordenadas de ejemplo.</strong> En producción cada punto sale de aplicar análisis de puntos ideales a la matriz real de votaciones. Nadie decide dónde va un diputado: lo decide con quién ha votado.
            </div>
          </div>
        )}

        {vista === 'lista' && (
          <div style={{ border: `1px solid ${chrome.linea}`, borderRadius: 3, overflow: 'hidden', background: chrome.superficie }}>
            {lista.slice(0, 60).map((d, i) => {
              const p = PARTIDOS[d.slug];
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px',
                    borderTop: i === 0 ? 'none' : `1px solid ${chrome.linea}`
                  }}
                >
                  <span style={{ width: 3, height: 32, background: p.color, borderRadius: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{d.nombre}</div>
                    <div className="esp-m" style={{ fontSize: 11, color: p.texto, fontWeight: 500 }}>{p.siglas}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="esp-m" style={{ fontSize: 15, fontWeight: 500 }}>{d.disciplina.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: chrome.tenue }}>disciplina</div>
                  </div>
                </div>
              );
            })}
            {lista.length > 60 && (
              <div style={{ padding: '11px 13px', borderTop: `1px solid ${chrome.linea}`, fontSize: 12, color: chrome.tenue }}>
                Mostrando 60 de {lista.length}.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 11, color: chrome.tenue, lineHeight: 1.6, borderTop: `1px solid ${chrome.linea}`, paddingTop: 12 }}>
          Prototipo con datos ilustrativos. Fuente en producción: Congreso de los Diputados, datos abiertos. Aplicación independiente, sin vínculo con ninguna institución.
        </div>
      </div>
    </div>
  );
}
