import React, { useEffect, useMemo, useState } from 'react';
import Feed from './Feed.jsx';
import GraficoBrecha from './GraficoBrecha.jsx';
import Hallazgos from './Hallazgos.jsx';
import Portada from './Portada.jsx';
import { detectarPerfil, detectarPerfilAmpliado, EJEMPLOS } from '../lib/perfil.js';
import { nombreColectivo } from '../lib/etiquetas.js';
import { implicacionDe } from '../lib/implicaciones.js';
import {
  cargarPerfilGuardado, guardarPerfil, borrarPerfilGuardado,
  marcarVistoAhora, ultimaVista, filtrarNovedades
} from '../lib/alertas.js';
import { traerUltimas, traerLideres } from '../lib/cliente.js';
import { fraseCortaDeNorma } from '../lib/fraseCorta.js';

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

  function cambiarPerfil(t) {
    setPerfil(t);
    setDeteccion(detectarPerfil(t));
  }

  const tips = useMemo(
    () => (deteccion.colectivos ?? []).map(s => ({ slug: s, ...implicacionDe(s) })).filter(t => t.implica),
    [deteccion]
  );

  function aplicar(d, slugForzado) {
    const col = slugForzado ?? d.colectivos[0] ?? null;
    const mat = !col ? (d.materias[0] ?? null) : null;
    if (!col && !mat) return;
    setFiltro({ colectivo: col, materia: mat });
    setEtiqueta(col ? nombreColectivo(col, colectivos) : (facetas?.materias ?? []).find(m => m.slug === mat)?.nombre ?? null);
    setTimeout(() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  async function buscar(textoDirecto) {
    const texto = typeof textoDirecto === 'string' ? textoDirecto : perfil;
    const local = typeof textoDirecto === 'string' ? detectarPerfil(textoDirecto) : deteccion;
    if (typeof textoDirecto === 'string') setDeteccion(local);
    if (local.colectivos.length || local.materias.length) { aplicar(local); return; }
    if (texto.trim().length < 3) return;
    setPensando(true);
    try {
      const d = await detectarPerfilAmpliado(texto);
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
      <Portada onIr={onIr} onLey={onVotacion} ultimas={ultimas} colectivos={colectivos}
        escanos={cobertura?.escanos ?? 350} leyes={cobertura?.normas}
        valor={perfil} onValor={cambiarPerfil} onEnviar={buscar}
        pensando={pensando} ejemplos={EJEMPLOS} />

      {(etiqueta || deteccion.colectivos.length > 0 || deteccion.materias.length > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '12px 14px', marginBottom: 18, borderRadius: 3,
          background: C.superficie, border: `1px solid ${C.linea}`
        }}>
          <span className="em" style={{ fontSize: 10.5, color: C.tenue, letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Detectado en tu texto
          </span>
          {deteccion.colectivos.map(s2 => {
            const activo = filtro?.colectivo === s2;
            return (
              <button key={s2} onClick={() => aplicar(deteccion, s2)} style={{
                padding: '5px 11px', fontSize: 12, cursor: 'pointer', borderRadius: 20,
                border: `1px solid ${activo ? C.tinta : C.linea}`,
                background: activo ? C.tinta : 'transparent',
                color: activo ? '#F2F3F0' : C.media, fontWeight: activo ? 600 : 400
              }}>{nombreColectivo(s2, colectivos)}</button>
            );
          })}
          {deteccion.materias.map(s2 => {
            const activo = filtro?.materia === s2;
            const nom = (facetas?.materias ?? []).find(m => m.slug === s2)?.nombre ?? s2;
            return (
              <button key={`m-${s2}`} onClick={() => { setFiltro({ colectivo: null, materia: s2 }); setEtiqueta(nom); }} style={{
                padding: '5px 11px', fontSize: 12, cursor: 'pointer', borderRadius: 20,
                border: `1px solid ${activo ? C.tinta : C.linea}`,
                background: activo ? C.tinta : 'transparent',
                color: activo ? '#F2F3F0' : C.media
              }}>{nom}</button>
            );
          })}
          {etiqueta && (
            <>
              <button onClick={limpiar} className="em" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.tenue, fontSize: 11, padding: 0, marginLeft: 4
              }}>× quitar</button>
              <button onClick={guardarAlerta} style={{
                marginLeft: 'auto', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                borderRadius: 20, border: `1px solid ${C.si}`, background: 'transparent', color: C.si
              }}>{guardado ? 'Actualizar alerta' : 'Avisarme de nuevas'}</button>
              {guardado && (
                <button onClick={olvidarAlerta} className="em" style={{
                  background: 'none', border: 'none', color: C.tenue, fontSize: 11, cursor: 'pointer', padding: 0
                }}>olvidar perfil</button>
              )}
            </>
          )}
        </div>
      )}

      <Hallazgos onIr={onIr} />
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