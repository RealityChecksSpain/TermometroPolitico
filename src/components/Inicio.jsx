import React, { useEffect, useState } from 'react';
import Feed from './Feed.jsx';
import GraficoBrecha from './GraficoBrecha.jsx';
import { detectarPerfil, detectarPerfilAmpliado, EJEMPLOS } from '../lib/perfil.js';
import { traerUltimas } from '../lib/cliente.js';

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3',
  si: '#2E7D5B', no: '#B23A2E'
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function corta(f) {
  if (!f) return '';
  const d = new Date(f + 'T12:00:00');
  const dias = Math.round((new Date() - d) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 8) return `hace ${dias} d`;
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

function Seccion({ titulo, texto, pie, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', background: C.superficie, border: `1px solid ${C.linea}`,
      borderRadius: 3, padding: 18, cursor: 'pointer', width: '100%',
      display: 'flex', flexDirection: 'column', gap: 7,
      transition: 'border-color 150ms ease, transform 150ms ease'
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.tinta; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.linea; e.currentTarget.style.transform = 'none'; }}>
      <span className="ed" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>{titulo}</span>
      <span style={{ fontSize: 13, color: C.media, lineHeight: 1.5 }}>{texto}</span>
      <span className="em" style={{ fontSize: 11, color: C.tinta, marginTop: 'auto', fontWeight: 500, paddingTop: 4 }}>{pie} →</span>
    </button>
  );
}

export default function Inicio({ cobertura, colectivos, facetas, onVotacion, onIr }) {
  const [perfil, setPerfil] = useState('');
  const [deteccion, setDeteccion] = useState({ colectivos: [], materias: [] });
  const [pensando, setPensando] = useState(false);
  const [filtro, setFiltro] = useState(null);
  const [etiqueta, setEtiqueta] = useState(null);
  const [ultimas, setUltimas] = useState([]);

  useEffect(() => { traerUltimas(6).then(setUltimas).catch(() => setUltimas([])); }, []);

  const nombreColectivo = s => (colectivos ?? []).find(c => c.slug === s)?.nombre ?? s;

  function aplicar(d) {
    const col = d.colectivos[0] ?? null;
    const mat = !col ? (d.materias[0] ?? null) : null;
    if (!col && !mat) return;
    setFiltro({ colectivo: col, materia: mat });
    setEtiqueta(col ? nombreColectivo(col) : (facetas?.materias ?? []).find(m => m.slug === mat)?.nombre ?? null);
    setTimeout(() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  async function buscar() {
    if (deteccion.colectivos.length) { aplicar(deteccion); return; }
    if (perfil.trim().length < 3) return;
    setPensando(true);
    try { const d = await detectarPerfilAmpliado(perfil); setDeteccion(d); aplicar(d); }
    finally { setPensando(false); }
  }

  function limpiar() {
    setPerfil(''); setDeteccion({ colectivos: [], materias: [] });
    setFiltro(null); setEtiqueta(null);
  }

  return (
    <div>
      <div className="portada">
        <div>
          <h1 className="ed" style={{
            fontSize: 'clamp(30px, 5.4vw, 52px)', fontWeight: 600, lineHeight: 1.03,
            letterSpacing: '-0.025em', margin: 0
          }}>
            ¿Qué acaba de<br />aprobar el Congreso?
          </h1>
          <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: C.media, lineHeight: 1.5, margin: '16px 0 0', maxWidth: 460 }}>
            Cada ley votada, quién la apoyó y a quién afecta. Escribe tu situación
            y te enseño solo las que te tocan a ti.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
            <input
              value={perfil}
              onChange={e => { setPerfil(e.target.value); setDeteccion(detectarPerfil(e.target.value)); }}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              placeholder="Soy autónoma y vivo de alquiler…"
              style={{
                flex: '1 1 240px', padding: '14px 16px', fontSize: 15,
                border: `1px solid ${deteccion.colectivos.length ? C.tinta : C.linea}`,
                borderRadius: 3, background: C.superficie
              }} />
            <button onClick={buscar} disabled={pensando} style={{
              padding: '14px 22px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
              background: C.tinta, color: C.papel, border: 'none', borderRadius: 3,
              opacity: pensando ? 0.6 : 1
            }}>{pensando ? 'pensando…' : 'Ver mis leyes'}</button>
          </div>

          {!etiqueta && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 11 }}>
              {EJEMPLOS.slice(0, 4).map(e => (
                <button key={e} onClick={() => { setPerfil(e); const d = detectarPerfil(e); setDeteccion(d); aplicar(d); }}
                  style={{
                    padding: '5px 11px', fontSize: 12, cursor: 'pointer', background: 'transparent',
                    border: `1px solid ${C.linea}`, borderRadius: 20, color: C.media
                  }}>{e}</button>
              ))}
            </div>
          )}

          {cobertura && (
            <div className="em" style={{ fontSize: 10.5, color: C.tenue, marginTop: 18 }}>
              {Number(cobertura.votaciones).toLocaleString('es')} votaciones ·
              {' '}{Number(cobertura.votos_individuales).toLocaleString('es')} votos individuales ·
              {' '}última sesión {cobertura.ultima_sesion}
            </div>
          )}
        </div>

        <aside style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 16 }}>
          <div className="rot" style={{ marginBottom: 12 }}>Lo último votado</div>
          {ultimas.length === 0 && (
            <div className="em" style={{ fontSize: 11.5, color: C.tenue }}>cargando…</div>
          )}
          {ultimas.map((n, i) => {
            const ok = (n.resultado_final ?? n.resultado_ultima) === 'aprobada';
            return (
              <button key={n.clave_norma} onClick={() => onVotacion(n)} style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'none',
                border: 'none', borderTop: i ? `1px solid ${C.linea}` : 'none',
                cursor: 'pointer', padding: '10px 0'
              }}>
                <div className="em" style={{ fontSize: 9.5, marginBottom: 4, display: 'flex', gap: 7, alignItems: 'center' }}>
                  {n.materia_nombre && (
                    <span style={{ color: n.materia_color || C.media, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      {n.materia_nombre}
                    </span>
                  )}
                  <span style={{ color: C.tenue }}>{corta(n.fecha)}</span>
                  <span style={{ marginLeft: 'auto', color: ok ? C.si : C.no, fontWeight: 600 }}>
                    {ok ? '✓' : '✕'}
                  </span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.35 }}>
                  {String(n.titular).slice(0, 92)}{String(n.titular).length > 92 ? '…' : ''}
                </div>
              </button>
            );
          })}
        </aside>
      </div>

      <div id="resultados" style={{ marginTop: 30, scrollMarginTop: 20 }}>
        {etiqueta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="ed" style={{ fontSize: 21, fontWeight: 600 }}>Leyes que afectan a: {etiqueta}</div>
            <button onClick={limpiar} className="em" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.media, fontSize: 11.5, padding: 0
            }}>quitar filtro</button>
          </div>
        )}
        {!etiqueta && <div className="rot" style={{ marginBottom: 12 }}>Todas las leyes votadas</div>}
        <Feed filtros={filtro ?? {}} onAbrir={onVotacion} />
      </div>

      <div style={{ marginTop: 34 }}>
        <GraficoBrecha />
      </div>

      <div style={{ marginTop: 20, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        <Seccion titulo="Tu diputado"
          texto="Busca por provincia o nombre. Su historial completo de votos, ausencias y si rompió con su partido."
          pie="Buscar diputado" onClick={() => onIr('diputados')} />
        <Seccion titulo="Los partidos"
          texto="Qué prometió cada uno en 2023 y cuántos de esos compromisos han llegado a votarse."
          pie="Ver programas" onClick={() => onIr('partidos')} />
        <Seccion titulo="El mapa"
          texto="Dónde se sitúa cada partido según su programa y según cómo vota en realidad."
          pie="Ver el mapa" onClick={() => onIr('ejes')} />
      </div>

      <div style={{ marginTop: 20, padding: 16, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
        <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>De dónde salen estos datos</div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 7 }}>
          Del portal de datos abiertos del Congreso, actualizado cada noche. Los recuentos salen de los
          votos individuales que publica la Cámara. Los resúmenes se generan del texto oficial del
          Boletín de las Cortes y siempre puedes abrirlo para comprobarlo. Esta herramienta no valora
          ni puntúa a nadie: enseña lo que se hizo y te deja juzgar a ti.
        </div>
      </div>
    </div>
  );
}