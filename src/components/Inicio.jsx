import React, { useEffect, useMemo, useState } from 'react';
import { DestelloSuave, EntradaSuave } from './Destello.jsx';
import Feed from './Feed.jsx';
import GraficoBrecha from './GraficoBrecha.jsx';
import Hallazgos from './Hallazgos.jsx';
import Portada from './Portada.jsx';
import { detectarPerfil, detectarPerfilAmpliado, EJEMPLOS } from '../lib/perfil.js';
import { implicacionDe } from '../lib/implicaciones.js';
import {
  cargarPerfilGuardado, guardarPerfil, borrarPerfilGuardado,
  marcarVistoAhora, ultimaVista, filtrarNovedades
} from '../lib/alertas.js';
import { traerUltimas, traerLideres } from '../lib/cliente.js';
import { fraseCortaDeNorma, nombreOficialNorma } from '../lib/fraseCorta.js';

const C = {
  papel: '#F3F1E8', superficie: '#FFFFFF', pizarra: '#18211E',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1',
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

function limpiarTitular(t) {
  if (!t) return t;
  return String(t)
    .replace(/^\s*proposición\s+de\s+ley\s+presentada\s+por\s+el\s+grupo\s+parlamentario\s+de\s+\S+\s*[:.\-–—]?\s*/i, '')
    .replace(/^\s*presentada\s+por\s+el\s+grupo\s+parlamentario\s+(de\s+)?[^.:\-–—]+[:.\-–—]\s*/i, '')
    .trim() || t;
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
  const [ausentes, setAusentes] = useState([]);
  const [guardado, setGuardado] = useState(() => cargarPerfilGuardado());
  const [novedades, setNovedades] = useState([]);

  useEffect(() => {
    traerUltimas(12).then(rows => {
      setUltimas(rows);
      const g = cargarPerfilGuardado();
      if (g) {
        const desde = ultimaVista();
        setNovedades(filtrarNovedades(rows, g, desde));
      }
      marcarVistoAhora();
    }).catch(() => setUltimas([]));
    traerLideres('ausencias').then(setAusentes).catch(() => setAusentes([]));

    const g = cargarPerfilGuardado();
    if (g?.texto) {
      setPerfil(g.texto);
      const d = { colectivos: g.colectivos ?? [], materias: g.materias ?? [] };
      setDeteccion(d);
      if (d.colectivos[0] || d.materias[0]) {
        const col = d.colectivos[0] ?? null;
        const mat = !col ? (d.materias[0] ?? null) : null;
        setFiltro({ colectivo: col, materia: mat });
        setEtiqueta(col
          ? ((colectivos ?? []).find(c => c.slug === col)?.nombre ?? col)
          : ((facetas?.materias ?? []).find(m => m.slug === mat)?.nombre ?? mat));
      }
    }
  }, []);

  const nombreColectivo = s => {
    const tip = implicacionDe(s);
    return tip?.etiqueta ?? (colectivos ?? []).find(c => c.slug === s)?.nombre ?? s;
  };

  const tips = useMemo(
    () => (deteccion.colectivos ?? []).map(s => ({ slug: s, ...implicacionDe(s) })).filter(t => t.implica),
    [deteccion]
  );

  function aplicar(d, slugForzado) {
    const col = slugForzado ?? d.colectivos[0] ?? null;
    const mat = !col ? (d.materias[0] ?? null) : null;
    if (!col && !mat) return;
    setFiltro({ colectivo: col, materia: mat });
    setEtiqueta(col ? nombreColectivo(col) : (facetas?.materias ?? []).find(m => m.slug === mat)?.nombre ?? null);
    setTimeout(() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  async function buscar() {
    if (deteccion.colectivos.length || deteccion.materias.length) { aplicar(deteccion); return; }
    if (perfil.trim().length < 3) return;
    setPensando(true);
    try {
      const d = await detectarPerfilAmpliado(perfil);
      setDeteccion(d);
      aplicar(d);
    } finally { setPensando(false); }
  }

  function limpiar() {
    setPerfil(''); setDeteccion({ colectivos: [], materias: [] });
    setFiltro(null); setEtiqueta(null);
  }

  function guardarAlerta() {
    if (!deteccion.colectivos.length && !deteccion.materias.length) return;
    const p = {
      texto: perfil,
      colectivos: deteccion.colectivos,
      materias: deteccion.materias
    };
    guardarPerfil(p);
    setGuardado(p);
    marcarVistoAhora();
    setNovedades([]);
  }

  function olvidarAlerta() {
    borrarPerfilGuardado();
    setGuardado(null);
    setNovedades([]);
  }

  return (
    <div>
      <Portada onIr={onIr} escanos={cobertura?.escanos ?? 350} leyes={cobertura?.normas} />
      <Hallazgos onIr={onIr} />
      <section style={{
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${C.pizarra} 0%, #2A3038 55%, #1A3A32 100%)`,
        padding: 'clamp(22px, 4vw, 40px)',
        marginBottom: 22
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35,
          background: 'radial-gradient(ellipse at 85% 20%, rgba(94,191,146,0.35), transparent 45%), radial-gradient(ellipse at 10% 90%, rgba(176,140,60,0.2), transparent 40%)'
        }} />
        <DestelloSuave color="rgba(242,243,240,0.45)" n={10} />

        <EntradaSuave>
        <div style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 22,
          alignItems: 'start'
        }} className="inicioHero">
          <style>{`
            @media(min-width:900px){
              .inicioHero{grid-template-columns:1.25fr minmax(280px,.85fr)!important;gap:32px!important}
            }
          `}</style>

          <div>
            <div className="em" style={{
              fontSize: 10.5, color: '#9AA0A6', letterSpacing: '.08em', textTransform: 'uppercase',
              fontWeight: 600, marginBottom: 14
            }}>
              Congreso · lo que acaba de votarse
              {cobertura?.ultima_sesion ? ` · ${cobertura.ultima_sesion}` : ''}
            </div>

            <h1 className="ed" style={{
              fontSize: 'clamp(32px, 5.6vw, 54px)', fontWeight: 600, lineHeight: 1.02,
              letterSpacing: '-0.028em', margin: 0, color: '#F2F3F0'
            }}>
              ¿Qué acaba de<br />aprobar el Congreso?
            </h1>
            <p style={{
              fontSize: 'clamp(15px, 2vw, 18px)', color: '#B4BAC0', lineHeight: 1.5,
              margin: '16px 0 0', maxWidth: 480
            }}>
              Cada ley votada, quién la apoyó y a quién afecta. Escribe tu situación
              y te enseño solo las que te tocan a ti.
            </p>

            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 3, padding: 8
            }}>
              <input
                value={perfil}
                onChange={e => { setPerfil(e.target.value); setDeteccion(detectarPerfil(e.target.value)); }}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                placeholder="Soy autónoma y vivo de alquiler…"
                style={{
                  flex: '1 1 220px', padding: '13px 14px', fontSize: 15,
                  border: 'none', borderRadius: 2, background: '#F8F6EE', color: C.tinta, outline: 'none'
                }} />
              <button onClick={buscar} disabled={pensando} style={{
                padding: '13px 20px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
                background: '#F2F3F0', color: C.tinta, border: 'none', borderRadius: 2,
                opacity: pensando ? 0.6 : 1
              }}>{pensando ? 'pensando…' : 'Ver mis leyes'}</button>
            </div>

            {(deteccion.colectivos.length > 0 || deteccion.materias.length > 0) && (
              <div style={{ marginTop: 12 }}>
                <div className="em" style={{ fontSize: 10, color: '#9AA0A6', marginBottom: 6, letterSpacing: '.04em' }}>
                  Detectado en tu texto · elige uno para filtrar
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {deteccion.colectivos.map(s => {
                    const activo = filtro?.colectivo === s;
                    return (
                      <button key={s} onClick={() => aplicar(deteccion, s)} style={{
                        padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 2,
                        border: `1px solid ${activo ? '#F2F3F0' : 'rgba(255,255,255,0.22)'}`,
                        background: activo ? '#F2F3F0' : 'transparent',
                        color: activo ? C.tinta : '#DDE1E5', fontWeight: activo ? 600 : 400
                      }}>{nombreColectivo(s)}</button>
                    );
                  })}
                  {deteccion.materias.map(s => {
                    const activo = filtro?.materia === s;
                    const nom = (facetas?.materias ?? []).find(m => m.slug === s)?.nombre ?? s;
                    return (
                      <button key={`m-${s}`} onClick={() => {
                        setFiltro({ colectivo: null, materia: s });
                        setEtiqueta(nom);
                      }} style={{
                        padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 2,
                        border: `1px solid ${activo ? '#F2F3F0' : 'rgba(255,255,255,0.22)'}`,
                        background: activo ? '#F2F3F0' : 'transparent',
                        color: activo ? C.tinta : '#C9CDD2'
                      }}>{nom}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {!etiqueta && deteccion.colectivos.length === 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {EJEMPLOS.slice(0, 4).map(e => (
                  <button key={e} onClick={() => { setPerfil(e); const d = detectarPerfil(e); setDeteccion(d); aplicar(d); }}
                    style={{
                      padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
                      borderRadius: 20, color: '#C9CDD2'
                    }}>{e}</button>
                ))}
              </div>
            )}

            {etiqueta && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: '#F2F3F0', fontSize: 14 }}>Filtro: <strong>{etiqueta}</strong></span>
                <button onClick={limpiar} style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20,
                  color: '#C9CDD2', fontSize: 12, padding: '4px 10px', cursor: 'pointer'
                }}>× quitar</button>
                <button onClick={guardarAlerta} style={{
                  background: 'rgba(95,191,146,0.18)', border: '1px solid rgba(95,191,146,0.45)',
                  borderRadius: 20, color: '#A8E0C4', fontSize: 12, padding: '4px 12px', cursor: 'pointer'
                }}>
                  {guardado ? 'Actualizar alerta' : 'Guardar para avisarme'}
                </button>
                {guardado && (
                  <button onClick={olvidarAlerta} className="em" style={{
                    background: 'none', border: 'none', color: '#8E959C', fontSize: 11, cursor: 'pointer', padding: 0
                  }}>olvidar perfil</button>
                )}
              </div>
            )}
          </div>

          <aside style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 3,
            padding: '14px 14px 10px',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10
            }}>
              <div className="em" style={{
                fontSize: 10, color: '#9AA0A6', letterSpacing: '.07em', textTransform: 'uppercase', fontWeight: 600
              }}>Lo último votado</div>
              <button onClick={() => onIr('leyes')} className="em" style={{
                background: 'none', border: 'none', color: '#C9CDD2', fontSize: 11, cursor: 'pointer', padding: 0
              }}>Ver todas →</button>
            </div>

            {ultimas.slice(0, 5).map((n, i) => {
              const ok = (n.resultado_final ?? n.resultado_ultima) === 'aprobada';
              const frase = fraseCortaDeNorma(n, 42) || String(nombreOficialNorma(n)).slice(0, 42);
              const oficial = nombreOficialNorma(n);
              const efectos = Array.isArray(n.efectos) ? n.efectos
                : (Array.isArray(n.colectivos) ? n.colectivos.map(s => ({ slug: s, nombre: s })) : []);
              return (
                <button key={n.clave_norma} onClick={() => onVotacion(n)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: i === 0 ? 'rgba(0,0,0,0.22)' : 'transparent',
                  border: 'none',
                  borderTop: i ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  borderRadius: i === 0 ? 2 : 0,
                  cursor: 'pointer',
                  padding: i === 0 ? '12px' : '11px 4px'
                }}>
                  <div className="em" style={{
                    fontSize: 9.5, marginBottom: 5, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap'
                  }}>
                    {n.materia_nombre && (
                      <span style={{
                        color: '#fff', background: n.materia_color || '#5A6067',
                        padding: '2px 7px', borderRadius: 2, fontWeight: 700, letterSpacing: '.04em',
                        textTransform: 'uppercase'
                      }}>{n.materia_nombre}</span>
                    )}
                    <span style={{ color: '#8E959C' }}>{corta(n.fecha)}</span>
                    <span style={{
                      marginLeft: 'auto', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
                      color: ok ? '#5FBF92' : '#E08278'
                    }}>{ok ? 'Aprobada' : 'Rechazada'}</span>
                  </div>
                  <div className="ed" style={{
                    fontSize: i === 0 ? 15 : 13.5, fontWeight: 600, color: '#F2F3F0', lineHeight: 1.3
                  }}>{frase}</div>
                  <div className="em" style={{
                    fontSize: 10, color: '#8E959C', lineHeight: 1.4, marginTop: 5
                  }} title={oficial}>
                    {oficial.length > 110 ? oficial.slice(0, 107) + '…' : oficial}
                  </div>
                  {efectos.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                      {efectos.slice(0, 3).map(e => (
                        <span key={e.slug || e.nombre} className="em" style={{
                          fontSize: 9.5, padding: '2px 7px', borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.18)', color: '#C9CDD2'
                        }}>{e.nombre || e.slug}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}

            {ultimas.length === 0 && (
              <div className="em" style={{ fontSize: 11.5, color: '#8E959C', padding: '12px 0' }}>cargando…</div>
            )}
          </aside>
        </div>
        </EntradaSuave>
      </section>

      {novedades.length > 0 && (
        <div style={{
          marginBottom: 18, padding: 14, borderRadius: 3,
          background: '#E8F4EE', border: '1px solid #B7D9C6'
        }}>
          <div className="ed" style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
            {novedades.length} norma{novedades.length === 1 ? '' : 's'} nueva{novedades.length === 1 ? '' : 's'} para tu perfil
          </div>
          <div style={{ fontSize: 12.5, color: C.media, marginBottom: 10, lineHeight: 1.45 }}>
            Desde tu última visita, con los colectivos que guardaste.
          </div>
          {novedades.slice(0, 4).map(n => (
            <button key={n.clave_norma} onClick={() => onVotacion(n)} style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none',
              border: 'none', borderTop: `1px solid #C5DFD0`, cursor: 'pointer', padding: '8px 0'
            }}>
              <span style={{ fontSize: 13, color: C.tinta }}>{fraseCortaDeNorma(n, 60) || limpiarTitular(n.titular)}</span>
              <span className="em" style={{ fontSize: 10, color: C.tenue, marginLeft: 8 }}>{corta(n.fecha)}</span>
            </button>
          ))}
        </div>
      )}

      {tips.length > 0 && (
        <div style={{
          marginBottom: 20, display: 'grid', gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
        }}>
          {tips.slice(0, 3).map(t => (
            <div key={t.slug} style={{
              background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 14
            }}>
              <div className="em" style={{
                fontSize: 10, color: C.tenue, letterSpacing: '.05em', textTransform: 'uppercase',
                fontWeight: 600, marginBottom: 6
              }}>Qué te implica · {t.etiqueta}</div>
              <div style={{ fontSize: 13.5, color: C.tinta, lineHeight: 1.45, marginBottom: 8 }}>{t.implica}</div>
              <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.45 }}>
                <strong style={{ color: C.tinta }}>Qué hacer:</strong> {t.hacer}
              </div>
            </div>
          ))}
        </div>
      )}

      <div id="resultados" style={{ marginTop: 8, scrollMarginTop: 20 }}>
        {etiqueta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="ed" style={{ fontSize: 21, fontWeight: 600 }}>Leyes que afectan a: {etiqueta}</div>
            <button onClick={limpiar} className="em" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.media, fontSize: 11.5, padding: 0
            }}>quitar filtro</button>
          </div>
        )}
        {!etiqueta && <div className="rot" style={{ marginBottom: 12 }}>Todas las leyes votadas</div>}
        <Feed filtros={filtro ?? {}} onAbrir={onVotacion} limpiarTitular={limpiarTitular} />
      </div>

      {ausentes.length > 0 && (
        <div className="tarjeta" style={{ padding: 16, marginTop: 28 }}>
          <div className="ed" style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
            Diputado más ausente de cada partido
          </div>
          <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.5, marginBottom: 12 }}>
            Número de votaciones sin voto emitido. Cargos institucionales acumulan ausencias por agenda; no implica dejadez por sí solo.
          </div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {ausentes.slice(0, 12).map(l => (
              <div key={l.partido} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 3, height: 28, background: l.color || '#8E9299', borderRadius: 3, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.nombre_completo}
                  </span>
                  <span className="em" style={{ display: 'block', fontSize: 10, color: C.tenue }}>{l.partido_siglas}</span>
                </span>
                <span className="em" style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{l.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 28 }}>
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