import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DestelloSuave } from './Destello.jsx';
import { VOTO } from '../lib/paleta.js';
import { traerMapaPartidos, traerSesgo, traerAuditoriaEjeVotos, traerSubejes, traerBaseComun, traerVotosPorClase, traerIniciativasPartido } from '../lib/cliente.js';
import { puntoSvg, indiceMasCercano } from '../lib/svgPuntero.js';

const esTactil = typeof window !== 'undefined' &&
  (window.matchMedia?.('(hover: none)').matches || 'ontouchstart' in window);

const VIAJE = { type: 'spring', stiffness: 90, damping: 20, mass: 1 };

const C = {
  papel: '#F3F1E8', superficie: '#FFFFFF', pizarra: '#18211E',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1'
};

const NOMBRE_DIM = {
  gasto: 'gasto público',
  impuestos: 'impuestos',
  regulacion: 'regulación empresarial',
  derechos: 'derechos individuales',
  migracion: 'reglas de migración'
};

function listarDims(dims) {
  if (!dims) return null;
  const partes = String(dims).split('+').map(d => NOMBRE_DIM[d] || d);
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
}

const ESCALA_VOTOS = 1.24;

const NOMBRE_CLASE = {
  ley_final: 'Votaciones finales de norma',
  decisoria: 'Tomas en consideración y totalidad',
  enmienda: 'Enmiendas a leyes en trámite',
  tramite: 'Trámite parlamentario',
  no_vinculante: 'Declaraciones sin valor de ley'
};

const NOMBRE_SUBEJE = {
  gasto_publico: 'Gasto público',
  impuestos: 'Impuestos',
  regulacion_mercado: 'Regulación de empresas',
  derechos_individuales: 'Derechos individuales',
  apertura_migratoria: 'Migración',
  moral_tradicional: 'Moral y familia',
  religion_estado: 'Religión y Estado',
  orden_publico: 'Orden público',
  diversidad_cultural: 'Diversidad cultural'
};

const ETIQUETA_DIM = {
  gasto_publico: ['recortar gasto', 'ampliar gasto'],
  impuestos: ['bajar impuestos', 'subir impuestos'],
  regulacion_mercado: ['desregular', 'regular más'],
  derechos_individuales: ['restringir derechos', 'ampliar derechos'],
  apertura_migratoria: ['cerrar la migración', 'abrir la migración'],
  moral_tradicional: ['la moral tradicional', 'la autonomía personal'],
  religion_estado: ['privilegios confesionales', 'la laicidad'],
  orden_publico: ['más poder policial', 'más garantías'],
  diversidad_cultural: ['la asimilación', 'la pluralidad']
};

function GuiaEje({ titulo, intro, a, b, miramos, colorA, colorB }) {
  return (
    <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 15, height: '100%' }}>
      <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 8 }}>{intro}</div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{
          fontSize: 11, color: colorA || C.tinta, textTransform: 'uppercase',
          letterSpacing: '.06em', fontWeight: 700
        }}>
          {a.titulo}
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{a.texto}</div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{
          fontSize: 11, color: colorB || C.tinta, textTransform: 'uppercase',
          letterSpacing: '.06em', fontWeight: 700
        }}>
          {b.titulo}
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{b.texto}</div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{ fontSize: 10, color: C.tenue, letterSpacing: '.05em', fontWeight: 600 }}>
          LO QUE MIRAMOS
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{miramos}</div>
      </div>
    </div>
  );
}

export default function Mapa({ onDiputados }) {
  const [datos, setDatos] = useState(null);
  const [subejes, setSubejes] = useState(null);
  const [baseComun, setBaseComun] = useState(null);
  const [votosClase, setVotosClase] = useState(null);
  const [iniciativas, setIniciativas] = useState(null);
  const [fuente, setFuente] = useState('programa');
  const [encima, setEncima] = useState(null);
  const [sesgo, setSesgo] = useState(null);
  const [auditoria, setAuditoria] = useState(null);
  const [vista, setVista] = useState({ z: 1, px: 0, py: 0 });
  const arrastre = useRef(null);
  const svgRef = useRef(null);

  const VB = { x: -1.45, y: -1.5, w: 2.9, h: 3.05 };
  const viewBox = useMemo(() => {
    const w = VB.w / vista.z;
    const h = VB.h / vista.z;
    const cx = VB.x + VB.w / 2 + vista.px;
    const cy = VB.y + VB.h / 2 + vista.py;
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  }, [vista]);

  const acercar = useCallback((factor, foco) => {
    setVista(v => {
      const z = Math.min(6, Math.max(1, v.z * factor));
      if (z === v.z) return v;
      if (!foco) return { z, px: v.px, py: v.py };
      const k = 1 / v.z - 1 / z;
      return {
        z,
        px: v.px + (foco.x - (VB.x + VB.w / 2 + v.px)) * k * v.z,
        py: v.py + (foco.y - (VB.y + VB.h / 2 + v.py)) * k * v.z
      };
    });
  }, []);

  const reencuadrar = useCallback(() => setVista({ z: 1, px: 0, py: 0 }), []);

  useEffect(() => {
    traerMapaPartidos().then(setDatos).catch(() => setDatos([]));
    traerSesgo().then(setSesgo).catch(() => setSesgo(null));
    traerAuditoriaEjeVotos().then(setAuditoria).catch(() => setAuditoria(null));
    traerSubejes().then(setSubejes).catch(() => setSubejes(null));
    traerBaseComun().then(setBaseComun).catch(() => setBaseComun(null));
    traerVotosPorClase().then(setVotosClase).catch(() => setVotosClase(null));
    traerIniciativasPartido().then(setIniciativas).catch(() => setIniciativas(null));
  }, []);

  const ejeEcoValido = !auditoria || auditoria.etiqueta_permitida === 'izquierda-derecha';
  const sustituido = fuente === 'votos' && !ejeEcoValido;

  const puntos = useMemo(() => {
    if (!datos) return [];
    let list = datos
      .map(d => ({
        ...d,
        x: fuente === 'programa' ? d.prog_economico
          : fuente === 'territorio' ? d.voto_territorial : d.voto_economico,
        y: fuente === 'programa' ? d.prog_social
          : fuente === 'territorio' ? d.voto_social : d.voto_social,
        n: fuente === 'programa' ? d.promesas_codificadas
          : fuente === 'territorio' ? d.voto_n_territorial : d.voto_n_economico,
        ex: fuente === 'programa' ? null
          : fuente === 'territorio' ? d.voto_err_territorial : d.voto_err_economico,
        ey: fuente === 'programa' ? null : d.voto_err_social,
        nulo: fuente === 'programa' ? false
          : fuente === 'territorio' ? false : Boolean(d.voto_eco_nulo && d.voto_soc_nulo)
      }))
      .map(d => (fuente === 'votos' && !ejeEcoValido)
        ? { ...d, x: d.voto_alineamiento, ex: 0, n: d.voto_n_social }
        : d)
      .filter(d => d.x !== null && d.x !== undefined && d.y !== null && d.y !== undefined)
      .map(d => ({ ...d, x: Number(d.x), y: Number(d.y) }));

    if (fuente !== 'programa') {
      list = list.map(p => ({
        ...p,
        x: Number(p.x) * ESCALA_VOTOS,
        y: Number(p.y) * ESCALA_VOTOS,
        ex: Number(p.ex ?? 0) * 1.96 * ESCALA_VOTOS,
        ey: Number(p.ey ?? 0) * 1.96 * ESCALA_VOTOS
      }));
    }

    return list.map(d => ({ ...d, cx: d.x, cy: -d.y }));
  }, [datos, fuente, ejeEcoValido]);

  const r = escanos => 0.035 + Math.sqrt(Number(escanos ?? 1)) * 0.011;

  const conEtiqueta = useMemo(() => {
    const orden = [...puntos].sort((a, b) => a.cx - b.cx || b.cy - a.cy);
    const puestas = [];
    return orden.map(p => {
      const radio = r(p.escanos);
      const base = p.cy + radio + 0.095;
      let ly = base;
      let intentos = 0;
      while (puestas.some(q => Math.abs(q.x - p.cx) < 0.30 && Math.abs(q.y - ly) < 0.085) && intentos < 8) {
        ly += 0.088;
        intentos++;
      }
      puestas.push({ x: p.cx, y: ly });
      return { ...p, labelY: ly, radio };
    });
  }, [puntos]);

  const resolver = useCallback((clientX, clientY) => {
    const p = puntoSvg(svgRef.current, clientX, clientY);
    if (!p) return null;
    const coords = conEtiqueta.map(q => ({ cx: q.cx, cy: q.cy }));
    const maxR = Math.max(0.12, ...conEtiqueta.map(q => q.radio * 2.4));
    const idx = indiceMasCercano(coords, p.x, p.y, maxR);
    if (idx < 0) return null;
    return conEtiqueta[idx];
  }, [conEtiqueta]);

  const onPointerMove = useCallback(e => {
    const a = arrastre.current;
    if (a) {
      if (Math.abs(e.clientX - a.sx) > 3 || Math.abs(e.clientY - a.sy) > 3) a.movido = true;
      if (!a.movido) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      const unidadesPorPx = (VB.w / a.z) / rect.width;
      setVista(v => ({
        ...v,
        px: a.px - (e.clientX - a.sx) * unidadesPorPx,
        py: a.py - (e.clientY - a.sy) * unidadesPorPx
      }));
      return;
    }
    const hit = resolver(e.clientX, e.clientY);
    setEncima(hit ? hit.partido : null);
  }, [resolver]);

  const onPointerLeave = useCallback(() => {
    arrastre.current = null;
    setEncima(null);
  }, []);

  const onPointerDown = useCallback(e => {
    if (e.button != null && e.button !== 0) return;
    arrastre.current = {
      sx: e.clientX, sy: e.clientY,
      px: vista.px, py: vista.py, z: vista.z,
      movido: false
    };
    try { svgRef.current?.setPointerCapture?.(e.pointerId); } catch { /* sin captura */ }
  }, [resolver, vista]);

  const onPointerUp = useCallback(e => {
    const a = arrastre.current;
    arrastre.current = null;
    try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* sin captura */ }
    if (a?.movido) return;
    const hit = resolver(e.clientX, e.clientY);
    if (!hit) return;
    setEncima(prev => (prev === hit.partido ? null : hit.partido));
  }, [resolver]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const alRodar = e => {
      e.preventDefault();
      e.stopPropagation();
      const p = puntoSvg(svg, e.clientX, e.clientY);
      acercar(e.deltaY < 0 ? 1.18 : 1 / 1.18, p);
    };
    svg.addEventListener('wheel', alRodar, { passive: false });
    return () => svg.removeEventListener('wheel', alRodar);
  }, [acercar, datos, fuente]);

  if (datos === null) return <div style={{ padding: 40, textAlign: 'center', color: C.tenue, fontSize: 13 }}>Cargando…</div>;

  const activo = encima ? conEtiqueta.find(p => p.partido === encima) : null;
  const faltan = 13 - (datos?.length ?? 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['programa', 'Lo que prometieron'], ['votos', 'Lo que han votado'], ['territorio', 'Territorialidad']].map(([k, t]) => (
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
          {datos.length > 0
            ? `Hay ${datos.length} partidos en la base, pero ninguno tiene aún los dos ejes (${fuente === 'programa' ? 'programa' : 'votos'}) completos.`
            : (fuente === 'programa'
              ? 'Todavía no hay suficientes compromisos codificados. Ejecuta npm run codificar y luego el SQL sql/create_v_mapa_partidos.sql.'
              : 'Todavía no hay suficientes leyes codificadas. Ejecuta npm run codificar:leyes y el SQL sql/create_v_mapa_partidos.sql.')}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
          alignItems: 'stretch'
        }}
          className="mapaLayout">
          <style>{`
            @media(min-width:960px){
              .mapaLayout{grid-template-columns:minmax(200px,.85fr) minmax(320px,1.3fr) minmax(200px,.85fr)!important}
            }
          `}</style>

          <div className="mapaLado">
            {fuente === 'votos' && auditoria?.economico_margen_escaso && (
              <div style={{
                background: '#2A2E35', border: '1px solid #3A4048', borderRadius: 2,
                padding: '9px 11px', marginBottom: 10, fontSize: 11.5,
                color: '#C9CDD2', lineHeight: 1.5
              }}>
                <strong style={{ color: '#E8C56A' }}>Margen escaso.</strong> Este eje supera la
                comprobación contra el azar por poco (p = {Number(auditoria.p_economico).toFixed(3)},
                el límite es 0,05) y solo {auditoria.economico_significativos ?? 0} de{' '}
                {auditoria.partidos_economico ?? 13} partidos tienen posición distinguible del centro.
                En esta legislatura el Congreso apenas ha votado normas que recorten gasto o
                desregulen, así que hay poco contraste que medir.
              </div>
            )}
            <GuiaEje
              titulo={fuente === 'territorio' ? 'Eje territorial' : sustituido ? 'Eje de bloque' : 'Eje económico'}
              intro={fuente === 'territorio'
                ? 'Mide dónde debe residir el poder: en el Estado central o en las comunidades autónomas. Es independiente de los otros dos ejes y en España es el que más separa a los partidos.'
                : sustituido
                  ? 'No hay suficientes normas económicas contestadas en ambos sentidos para situar a los partidos en izquierda-derecha por sus votos. Mientras tanto, este eje mide lo que sí se puede medir: cuánto apoya cada partido las normas que trae el Gobierno.'
                  : 'Mide una sola cosa: qué papel debe tener el Estado en la economía. No mide simpatías ni identidades.'}
              colorA="#C45C52"
              colorB="#3D7AB8"
              a={fuente === 'territorio' ? {
                titulo: 'Descentralizador',
                texto: 'Las competencias y los recursos deben acercarse a quien conoce el territorio. Incluye transferencias, financiación autonómica y reconocimiento de lenguas y culturas propias.'
              } : sustituido ? {
                titulo: 'Oposición',
                texto: 'El partido vota en contra de la mayor parte de lo que el Gobierno lleva al pleno. No dice nada sobre su ideología: un partido puede oponerse desde la izquierda o desde la derecha.'
              } : {
                titulo: 'Izquierda económica',
                texto: 'El mercado por sí solo genera desigualdad, así que el Estado debe corregirla: más gasto público, impuestos progresivos y reglas que limiten el poder de las empresas. Es la línea que va de Marx a la socialdemocracia de posguerra.'
              }}
              b={fuente === 'territorio' ? {
                titulo: 'Centralista',
                texto: 'La igualdad entre ciudadanos exige reglas comunes y un Estado que las garantice. Incluye recentralizar competencias, unidad de mercado y una lengua común en la Administración.'
              } : sustituido ? {
                titulo: 'Gobierno',
                texto: 'El partido apoya la mayor parte de lo que el Gobierno lleva al pleno. Tampoco dice nada sobre ideología: puede ser socio de investidura, puede negociar apoyos puntuales, o puede coincidir en el fondo.'
              } : {
                titulo: 'Derecha económica',
                texto: 'El mercado asigna mejor que cualquier planificador porque nadie reúne toda la información necesaria para decidir por los demás: menos gasto, impuestos bajos y menos regulación. Es el argumento de Hayek y Friedman.'
              }}
              miramos={fuente === 'territorio'
                ? <>Descentralización y competencias europeas, sobre {auditoria?.n_territorial ?? '—'} normas.</>
                : sustituido
                  ? <>Propensión de cada partido a votar que sí, sobre {auditoria?.n_economico ?? '—'} normas.</>
                  : <>Gasto público, impuestos, regulación, propiedad pública, protección laboral y proteccionismo, sobre {auditoria?.n_economico ?? '—'} normas.</>}
            />
          </div>

          <div style={{
            position: 'relative',
            background: C.pizarra, borderRadius: 3, padding: 'clamp(14px, 2.5vw, 22px)', minWidth: 0
          }}>
            <DestelloSuave color="rgba(232,197,106,0.35)" n={6} />
            <div style={{
              position: 'absolute', right: 14, top: 14, zIndex: 2,
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              {[['+', () => acercar(1.4, null)], ['−', () => acercar(1 / 1.4, null)]].map(([t, fn]) => (
                <button key={t} onClick={fn} aria-label={t === '+' ? 'Acercar' : 'Alejar'} style={{
                  width: 26, height: 26, borderRadius: 3, cursor: 'pointer', lineHeight: 1,
                  background: 'rgba(255,255,255,0.09)', color: '#D8DCE0',
                  border: '1px solid rgba(255,255,255,0.16)', fontSize: 15, fontWeight: 600
                }}>{t}</button>
              ))}
              {vista.z > 1 && (
                <button onClick={reencuadrar} aria-label="Reencuadrar" style={{
                  width: 26, height: 26, borderRadius: 3, cursor: 'pointer', lineHeight: 1,
                  background: 'rgba(255,255,255,0.09)', color: '#D8DCE0',
                  border: '1px solid rgba(255,255,255,0.16)', fontSize: 11
                }}>⤢</button>
              )}
            </div>
            <svg ref={svgRef}
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: 'auto', maxHeight: '58vh', display: 'block', margin: '0 auto', touchAction: 'none', cursor: vista.z > 1 ? 'grab' : 'crosshair', userSelect: 'none' }}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              role="img"
              aria-label="Mapa de partidos en dos ejes">
              <rect x="-1.45" y="-1.5" width="2.9" height="3.05" fill="transparent" />
              <rect x="-1.24" y="-1.24" width="1.24" height="1.24" fill="#EE7B3A14" />
              <rect x="0" y="-1.24" width="1.24" height="1.24" fill="#1A6B8A18" />
              <rect x="-1.24" y="0" width="1.24" height="1.24" fill="#17836F14" />
              <rect x="0" y="0" width="1.24" height="1.24" fill="#F2A93E12" />
              <line x1="-1.24" y1="0" x2="1.24" y2="0" stroke="#EDE7D4" strokeOpacity="0.5" strokeWidth="0.013" />
              <line x1="0" y1="-1.24" x2="0" y2="1.24" stroke="#EDE7D4" strokeOpacity="0.5" strokeWidth="0.013" />
              <path d="M0 -0.13L0.0221 -0.0221L0.13 0L0.0221 0.0221L0 0.13L-0.0221 0.0221L-0.13 0L-0.0221 -0.0221Z"
                fill="#EDE7D4" fillOpacity="0.62" />

                            <text x="-1.32" y="-1.28" fill="#EE7B3A" fontSize="0.092" fontWeight="700"
                fontFamily="DM Mono, monospace" letterSpacing="0.02">{fuente === 'territorio' ? 'DESCENTRALIZADOR' : sustituido ? 'OPOSICIÓN' : 'IZQUIERDA'}</text>
              <text x="1.32" y="-1.28" fill="#4E9BBE" fontSize="0.092" fontWeight="700"
                textAnchor="end" fontFamily="DM Mono, monospace" letterSpacing="0.02">{fuente === 'territorio' ? 'CENTRALISTA' : sustituido ? 'GOBIERNO' : 'DERECHA'}</text>
              <text x="0" y="-1.40" fill="#F2A93E" fontSize="0.092" fontWeight="700"
                textAnchor="middle" fontFamily="DM Mono, monospace" letterSpacing="0.02">CONSERVADOR</text>
              <text x="0" y="1.48" fill="#2FA98F" fontSize="0.092" fontWeight="700"
                textAnchor="middle" fontFamily="DM Mono, monospace" letterSpacing="0.02">PROGRESISTA</text>

              {conEtiqueta.map(p => {
                const on = !encima || encima === p.partido;
                const desviada = p.labelY > p.cy + p.radio + 0.12;
                return (
                  <g key={p.partido}
                    style={{ transition: 'opacity 160ms ease' }}
                    opacity={on ? 1 : 0.16}
                    pointerEvents="none">
                    {desviada && (
                      <motion.line
                        initial={false}
                        animate={{ x1: p.cx, y1: p.cy + p.radio, x2: p.cx, y2: p.labelY - 0.045 }}
                        transition={VIAJE}
                        stroke="#5A6067" strokeWidth="0.005" />
                    )}
                    {fuente === 'votos' && encima === p.partido && (p.ex > 0 || p.ey > 0) && (
                      <motion.ellipse
                        initial={false}
                        animate={{
                          cx: p.cx, cy: p.cy,
                          rx: Math.max(p.ex, p.radio * 1.3), ry: Math.max(p.ey, p.radio * 1.3)
                        }}
                        transition={VIAJE}
                        fill={p.color || '#8E9299'} opacity="0.16"
                        stroke={p.color || '#8E9299'} strokeOpacity="0.35" strokeWidth="0.006" />
                    )}
                    <motion.circle
                      initial={false}
                      animate={{
                        cx: p.cx, cy: p.cy,
                        r: encima === p.partido ? p.radio * 1.22 : p.radio
                      }}
                      transition={VIAJE}
                      fill={p.nulo ? 'none' : (p.color || '#8E9299')}
                      stroke={p.nulo ? (p.color || '#8E9299') : C.pizarra}
                      strokeWidth={p.nulo ? 0.018 : 0.014}
                      strokeDasharray={p.nulo ? '0.035 0.028' : undefined} />
                    <motion.text
                      initial={false}
                      animate={{ x: p.cx, y: p.labelY }}
                      transition={VIAJE}
                      fill={encima === p.partido ? '#FFFFFF' : '#C9CDD2'}
                      stroke={C.pizarra} strokeWidth="0.014" strokeOpacity="0.75"
                      paintOrder="stroke" strokeLinejoin="round"
                      fontSize="0.058" textAnchor="middle" fontFamily="DM Mono, monospace"
                      fontWeight={encima === p.partido ? 500 : 400}>
                      {p.siglas}
                    </motion.text>
                  </g>
                );
              })}
            </svg>

            {fuente === 'votos' && auditoria && (
              (auditoria.etiqueta_permitida !== 'izquierda-derecha' ||
               auditoria.etiqueta_permitida_social !== 'conservador-progresista') && (
              <div style={{
                marginTop: 10, padding: 11, background: '#3A3226', border: '1px solid #6B5518',
                borderRadius: 3, fontSize: 12, color: '#E8C56A', lineHeight: 1.55
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Auditoría automática</div>
                {auditoria.etiqueta_permitida !== 'izquierda-derecha' && (
                  <div>
                    El eje horizontal no puede ser izquierda-derecha: {auditoria.etiqueta_permitida === 'datos insuficientes'
                      ? `solo hay ${auditoria.n_economico ?? '—'} normas económicas votadas con división real, y hacen falta 8.`
                      : auditoria.etiqueta_permitida === 'sin poder discriminante'
                        ? `solo ${auditoria.economico_significativos ?? 0} partidos tienen posición distinguible del centro.`
                        : auditoria.etiqueta_permitida === 'placebo caducado'
                          ? 'han entrado datos nuevos desde la última comprobación contra el azar, así que la anterior ya no vale para estas posiciones.'
                          : auditoria.etiqueta_permitida === 'placebo sin calcular'
                            ? 'todavía no se ha comprobado que estas posiciones no salgan por azar.'
                            : `barajando al azar las etiquetas de las normas se obtiene un rango parecido (p = ${Number(auditoria.p_economico ?? 1).toFixed(3)}), así que el orden no viene del contenido.`}
                    {' '}En su lugar se muestra el alineamiento con el Gobierno, que sí está medido.
                  </div>
                )}
                {auditoria.etiqueta_permitida_social !== 'conservador-progresista' && (
                  <div style={{ marginTop: 4 }}>
                    Eje vertical: {auditoria.etiqueta_permitida_social === 'datos insuficientes'
                      ? `solo ${auditoria.n_social ?? '—'} normas con división real, hacen falta 8.`
                      : auditoria.etiqueta_permitida_social === 'sin poder discriminante'
                        ? `solo ${auditoria.social_significativos ?? 0} partidos tienen posición distinguible del centro.`
                        : auditoria.etiqueta_permitida_social === 'placebo caducado'
                          ? 'han entrado datos nuevos desde la última comprobación contra el azar.'
                          : auditoria.etiqueta_permitida_social === 'placebo sin calcular'
                            ? 'todavía no se ha comprobado contra el azar.'
                            : `el test de permutación no lo distingue del azar (p = ${Number(auditoria.p_social ?? 1).toFixed(3)}).`}
                  </div>
                )}
              </div>
            ))}

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
                    económico {Number(activo.x / (fuente === 'votos' ? ESCALA_VOTOS : 1)).toFixed(2)}
                    {fuente === 'votos' && activo.ex > 0 && ` ±${(activo.ex / ESCALA_VOTOS).toFixed(2)}`}
                    {' · '}social {Number(activo.y / (fuente === 'votos' ? ESCALA_VOTOS : 1)).toFixed(2)}
                    {fuente === 'votos' && activo.ey > 0 && ` ±${(activo.ey / ESCALA_VOTOS).toFixed(2)}`}
                    {' · '}calculado sobre {activo.n} {fuente === 'programa' ? 'compromisos' : 'votos codificados'}
                  </div>
                  {(() => {
                    const f = iniciativas?.[String(activo.siglas ?? '').trim().toUpperCase()];
                    if (!f || !f.presentadas) return null;
                    return (
                      <div className="em" style={{ fontSize: 10.5, color: '#A8AEB4', marginTop: 8, lineHeight: 1.6 }}>
                        su grupo presenta {f.presentadas} iniciativas
                        {f.grupo_compartido && (
                          <span style={{ display: 'block', color: '#7C8288', fontSize: 9.5 }}>
                            comparte el Grupo Mixto con otros {f.partidos_en_grupo - 1} partidos: la autoría es del grupo, no del partido
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {(() => {
                    const clases = votosClase?.[String(activo.siglas ?? '').trim().toUpperCase()] ?? [];
                    const orden = { ley_final: 0, decisoria: 1, enmienda: 2, tramite: 3, no_vinculante: 4 };
                    const lista = [...clases]
                      .filter(c => c.clase !== 'sin_clasificar')
                      .sort((a2, b2) => (orden[a2.clase] ?? 9) - (orden[b2.clase] ?? 9));
                    if (!lista.length) return null;
                    return (
                      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #3A4048' }}>
                        <div className="em" style={{ fontSize: 9.5, color: '#7C8288', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 6 }}>
                          cómo vota
                        </div>
                        {lista.map(c => {
                          const total = Number(c.si) + Number(c.no) + Number(c.abstencion) || 1;
                          const trozos = [
                            [Number(c.si), VOTO.si],
                            [Number(c.no), VOTO.no],
                            [Number(c.abstencion), VOTO.abs]
                          ];
                          return (
                            <div key={c.clase} style={{ marginBottom: 7 }}>
                              <div className="em" style={{ fontSize: 10.5, color: '#C9CDD2', marginBottom: 3 }}>
                                {NOMBRE_CLASE[c.clase] ?? c.clase}
                                <span style={{ color: '#7C8288' }}> · {c.votaciones} votaciones</span>
                              </div>
                              <div style={{ display: 'flex', height: 9, overflow: 'hidden' }}>
                                {trozos.map(([v, col], i) => v > 0 && (
                                  <div key={i} style={{ background: col, width: `${(v / total) * 100}%` }} />
                                ))}
                              </div>
                              <div className="em" style={{ fontSize: 9.5, color: '#8E959C', marginTop: 3 }}>
                                {c.si} sí · {c.no} no · {c.abstencion} abstenciones
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {fuente === 'votos' && (() => {
                    const filas = subejes?.[String(activo.siglas ?? '').trim().toUpperCase()] ?? [];
                    const dentro = filas.filter(f => !baseComun || baseComun.has(`${f.eje}|${f.dim}`));
                    if (!dentro.length) return null;
                    const orden = { economico: 0, social: 1 };
                    const lista = [...dentro].sort((a2, b2) =>
                      (orden[a2.eje] ?? 9) - (orden[b2.eje] ?? 9) || Math.abs(b2.bruto) - Math.abs(a2.bruto));
                    return (
                      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #3A4048' }}>
                        <div className="em" style={{ fontSize: 9.5, color: '#7C8288', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 6 }}>
                          por qué está ahí
                        </div>
                        {lista.map(f => {
                          const pct = Math.round(Math.abs(Number(f.bruto)) * 100);
                          const hacia = Number(f.bruto) >= 0 ? ETIQUETA_DIM[f.dim]?.[0] : ETIQUETA_DIM[f.dim]?.[1];
                          return (
                            <div key={`${f.eje}-${f.dim}`} style={{ marginBottom: 5 }}>
                              <div className="em" style={{ fontSize: 10.5, color: '#C9CDD2' }}>
                                {NOMBRE_SUBEJE[f.dim] ?? f.dim}
                              </div>
                              <div className="em" style={{ fontSize: 10, color: '#8E959C', lineHeight: 1.5 }}>
                                {pct === 0
                                  ? `sin diferencia sobre ${f.n_reduce + f.n_aumenta} normas`
                                  : `${pct} % más de apoyo a ${hacia}`}
                                {' · '}{f.n_reduce} y {f.n_aumenta} normas
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {fuente === 'votos' && activo.voto_apoyo_gobierno != null && (
                    <div className="em" style={{ color: '#7C8288', fontSize: 10.5, marginTop: 3 }}>
                      apoya el {Math.round(Number(activo.voto_apoyo_gobierno) * 100)} % de las normas del Gobierno
                      {activo.nulo && ' · su posición no se distingue de cero'}
                    </div>
                  )}
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
            {fuente === 'votos' && (
              <span> La posición por votos no mide cuánto apoya un partido, sino cuánto más
                apoya lo que <em>baja</em> gasto, impuestos o regulación que lo que los sube.
                El centro exacto significa que vota igual en ambos casos. Las cruces son el
                margen de error; un círculo hueco es un partido cuya posición no se distingue
                del centro.</span>
            )}
          </div>
              )}
            </div>
          </div>

          <div className="mapaLado">
            <GuiaEje
              titulo="Eje social"
              intro="Es un eje independiente del económico. Se puede situar a un lado en economía y al otro en este. En España se confunden a menudo; por eso el mapa los separa."
              colorA="#B8912E"
              colorB="#2A9A86"
              a={{
                titulo: 'Conservador',
                texto: 'Las instituciones y costumbres heredadas acumulan una sabiduría que nadie diseñó y que conviene no desmontar a la ligera. Es la tesis de Burke: prudencia frente al cambio rápido, y prioridad de la comunidad, la familia y la nación sobre la elección individual.'
              }}
              b={{
                titulo: 'Progresista',
                texto: 'Cada persona debe poder decidir sobre su vida mientras no dañe a otros, y las costumbres heredadas no bastan para justificar una restricción. Viene de Mill y del liberalismo de los derechos: ampliar la autonomía personal y quitar límites que no protegen a nadie.'
              }}
              miramos={fuente === 'votos'
                ? <>Derechos individuales y reglas de migración. El grupo más pequeño tiene {auditoria?.n_social ?? '—'} normas votadas con división real.</>
                : <>Derechos individuales y reglas de entrada/regularización de migrantes. Nada más.</>}
            />
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
          <strong>Lo que prometieron</strong> sale de los programas de 2023 y es una posición
          <em> relativa</em> al resto de partidos españoles. <strong>Lo que han votado</strong> se
          calcula distinto y tiene cero absoluto: para cada partido se compara qué porcentaje de las
          normas que <em>reducen</em> gasto, impuestos o regulación apoyó, frente al porcentaje de
          las que los <em>aumentan</em>. La diferencia entre esos dos porcentajes es su posición.
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          Esa resta existe por un motivo concreto: en un parlamento con disciplina de voto, la
          oposición vota que no a casi todo y el Gobierno que sí a casi todo, independientemente del
          contenido. Contar votos a favor mide bloque parlamentario, no ideología. Al restar, esa
          propensión se cancela y queda solo la sensibilidad al contenido. La comparación se hace
          además por separado dentro de las normas del Gobierno y dentro de las del resto, para que
          quién propone la norma no contamine el resultado.
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          Un partido que vota igual suba o baje el gasto sale en el centro exacto, sea cual sea su
          tasa de votos a favor. Por eso la oposición sistemática no empuja a nadie hacia un extremo.
          Ningún eje se invierte ni se reescala a mano.
        </div>
        {fuente === 'votos' && auditoria?.p_economico != null && (
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.linea}`,
            fontSize: 13, color: C.media, lineHeight: 1.6
          }}>
            <strong>Cómo sabemos que esto no es solo gobierno contra oposición.</strong> Se barajan
            al azar las etiquetas de las normas {auditoria.placebo_reps} veces y se recalcula el mapa.
            Si los partidos votaran solo según su bloque, barajar no cambiaría nada. El eje económico
            real separa a los partidos {Number(auditoria.rango_economico).toFixed(2)} puntos; barajando,
            la media baja a {Number(auditoria.placebo_medio_economico).toFixed(2)} y el máximo de las
            {' '}{auditoria.placebo_reps} tiradas fue {Number(auditoria.placebo_max_economico).toFixed(2)}.
            {' '}El eje social real separa {Number(auditoria.rango_social).toFixed(2)} frente a un máximo
            barajado de {Number(auditoria.placebo_max_social).toFixed(2)}.
            {' '}Es la prueba de que lo que ordena a los partidos es el contenido de las leyes.
          </div>
        )}
      </div>
    </div>
  );
}