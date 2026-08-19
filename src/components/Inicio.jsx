import React, { useState } from 'react';
import Feed from './Feed.jsx';
import { detectarPerfil, detectarPerfilAmpliado, EJEMPLOS } from '../lib/perfil.js';

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3'
};

export default function Inicio({ cobertura, colectivos, facetas, onVotacion, onPerfil }) {
  const [perfil, setPerfil] = useState('');
  const [deteccion, setDeteccion] = useState({ colectivos: [], materias: [] });
  const [pensando, setPensando] = useState(false);
  const [filtro, setFiltro] = useState({});
  const [etiqueta, setEtiqueta] = useState(null);

  const nombreColectivo = slug => (colectivos ?? []).find(c => c.slug === slug)?.nombre ?? slug;

  function aplicar(d) {
    const col = d.colectivos[0] ?? null;
    const mat = !col ? (d.materias[0] ?? null) : null;
    setFiltro({ colectivo: col, materia: mat });
    setEtiqueta(col ? nombreColectivo(col) : (facetas?.materias ?? []).find(m => m.slug === mat)?.nombre ?? null);
    window.scrollTo({ top: 240, behavior: 'smooth' });
  }

  async function buscar() {
    if (deteccion.colectivos.length) { aplicar(deteccion); return; }
    if (perfil.trim().length < 3) return;
    setPensando(true);
    try {
      const d = await detectarPerfilAmpliado(perfil);
      setDeteccion(d);
      if (d.colectivos.length) aplicar(d);
    } finally { setPensando(false); }
  }

  function limpiar() {
    setPerfil(''); setDeteccion({ colectivos: [], materias: [] });
    setFiltro({}); setEtiqueta(null);
  }

  const cabecera = (
    <>
      <div style={{ padding: '4px 0 18px' }}>
        <h1 className="ed" style={{
          fontSize: 'clamp(26px, 4.6vw, 40px)', fontWeight: 700, lineHeight: 1.04,
          letterSpacing: '-0.03em', margin: 0, maxWidth: 640
        }}>
          Lo que aprueba el Congreso,<br />contado en una frase
        </h1>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', color: C.media, lineHeight: 1.5, margin: '12px 0 0', maxWidth: 520 }}>
          Cada ley votada, quién la apoyó y a quién afecta. Datos oficiales, sin opinión.
          {cobertura && <> Última sesión: {cobertura.ultima_sesion}.</>}
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 0 16px',
        borderTop: `1px solid ${C.linea}`, borderBottom: `1px solid ${C.linea}`, marginBottom: 18
      }}>
        <input
          value={perfil}
          onChange={e => { setPerfil(e.target.value); setDeteccion(detectarPerfil(e.target.value)); }}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Dime quién eres y filtro tus leyes: soy autónoma, vivo de alquiler…"
          style={{
            flex: '1 1 280px', padding: '12px 14px', fontSize: 14.5,
            border: `1px solid ${deteccion.colectivos.length ? C.tinta : C.linea}`,
            borderRadius: 3, background: C.superficie
          }} />
        <button onClick={buscar} disabled={pensando} style={{
          padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          background: C.tinta, color: C.papel, border: 'none', borderRadius: 3,
          opacity: pensando ? 0.6 : 1
        }}>{pensando ? 'pensando…' : 'Filtrar'}</button>
        {(etiqueta || perfil) && (
          <button onClick={limpiar} style={{
            padding: '12px 14px', fontSize: 14, cursor: 'pointer', background: 'transparent',
            border: `1px solid ${C.linea}`, borderRadius: 3, color: C.media
          }}>×</button>
        )}
      </div>

      {!etiqueta && !perfil && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 18 }}>
          {EJEMPLOS.slice(0, 4).map(e => (
            <button key={e} onClick={() => { setPerfil(e); const d = detectarPerfil(e); setDeteccion(d); aplicar(d); }}
              style={{
                padding: '5px 11px', fontSize: 12, cursor: 'pointer', background: 'transparent',
                border: `1px solid ${C.linea}`, borderRadius: 20, color: C.media
              }}>{e}</button>
          ))}
        </div>
      )}

      {etiqueta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="ed" style={{ fontSize: 18, fontWeight: 700 }}>
            Leyes que afectan a: {etiqueta}
          </div>
          <button onClick={limpiar} className="em" style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.media, fontSize: 11.5, padding: 0
          }}>ver todas</button>
        </div>
      )}

      {!etiqueta && (
        <div className="rot" style={{ marginBottom: 12 }}>Lo último votado</div>
      )}
    </>
  );

  return (
    <div>
      <Feed filtros={filtro} onAbrir={onVotacion} cabecera={cabecera} />

      <div style={{ marginTop: 26, padding: 16, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
        <div className="ed" style={{ fontSize: 15, fontWeight: 700 }}>De dónde salen estos datos</div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 7 }}>
          Del portal de datos abiertos del Congreso, actualizado cada noche. Los recuentos se calculan
          sobre los votos individuales que publica la Cámara. Los resúmenes se generan del texto oficial
          del Boletín de las Cortes y siempre puedes abrirlo para comprobarlo. Esta herramienta no valora
          ni puntúa a nadie: enseña lo que se hizo y te deja juzgar a ti.
        </div>
      </div>
    </div>
  );
}