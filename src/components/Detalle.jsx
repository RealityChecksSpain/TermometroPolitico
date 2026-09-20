import React, { useMemo, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Cifra, Entrada, SALIDA } from './Movimiento.jsx';
import { traerVotacionesDeNorma, traerRelacionadas, traerIniciativaDeVotacion } from '../lib/cliente.js';
import { estaSeguido } from '../lib/seguimientos.js';
import BotonSeguir from './BotonSeguir.jsx';
import HistorialNorma from './HistorialNorma.jsx';
import Posturas from './Posturas.jsx';
import {
  nombreCompletoNorma, procedenciaResumen, resumenBreve, restoResumen, titularDeNorma, vehiculoNorma
} from '../lib/fraseCorta.js';
import { implicacionDe } from '../lib/implicaciones.js';
import { VOTO } from '../lib/paleta.js';
import { mayoriaRequerida, umbralDe, nombreMayoria, faltaronPara } from '../lib/mayorias.js';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288',
  linea: '#DCDCD3', ...VOTO
};

const ETIQUETA = { si: 'Sí', no: 'No', abstencion: 'Abstención', no_vota: 'No vota' };

const SIN_TEXTO_PROPIO = /proposici[óo]n no de ley|moci[óo]n|interpelaci[óo]n/i;

function registradosEnActa(v) {
  return (v.total_si ?? 0) + (v.total_no ?? 0) + (v.total_abstencion ?? 0) + (v.total_no_vota ?? 0);
}

export function analizarVotacion(diputados, votos) {
  if (!votos?.length) return null;

  const mapa = new Map(votos.map(v => [v.mandato_id, v.voto]));
  const grupos = new Map();

  diputados.forEach(d => {
    const voto = mapa.get(d.mandato_id);
    if (!voto) return;
    const clave = d.partido_siglas || d.grupo;
    if (!clave) return;
    const g = grupos.get(clave) ?? {
      grupo: clave, color: d.color, si: 0, no: 0, abstencion: 0, no_vota: 0, miembros: []
    };
    g[voto] = (g[voto] ?? 0) + 1;
    g.miembros.push({ d, voto });
    grupos.set(clave, g);
  });

  const lista = Array.from(grupos.values()).map(g => {
    const orden = [['si', g.si], ['no', g.no], ['abstencion', g.abstencion]].sort((a, b) => b[1] - a[1]);
    const mayoritario = orden[0][1] > 0 ? orden[0][0] : 'no_vota';
    const rebeldes = g.miembros.filter(m => m.voto !== mayoritario && m.voto !== 'no_vota');
    return {
      ...g,
      mayoritario,
      rebeldes,
      total: g.si + g.no + g.abstencion + g.no_vota,
      cohesion: g.total === 0 ? 100 : Math.round((orden[0][1] / (g.si + g.no + g.abstencion || 1)) * 100)
    };
  }).sort((a, b) => b.total - a.total);

  const totSi = lista.reduce((a, g) => a + g.si, 0);
  const totNo = lista.reduce((a, g) => a + g.no, 0);
  const abstenciones = lista.reduce((a, g) => a + g.abstencion, 0);
  const ausencias = lista.reduce((a, g) => a + g.no_vota, 0);
  const contados = totSi + totNo + abstenciones + ausencias;

  return { grupos: lista, totSi, totNo, abstenciones, ausencias, contados };
}

function Sello({ aprobada }) {
  return (
    <span className="em" style={{
      fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 2,
      background: aprobada ? '#E6F2EC' : '#FBE9EC',
      color: aprobada ? C.si : C.no, textTransform: 'uppercase', whiteSpace: 'nowrap'
    }}>
      {aprobada ? 'Aprobada' : 'Rechazada'}
    </span>
  );
}

function Bloque({ titulo, children, aviso }) {
  return (
    <Entrada desde={12} style={{
      background: aviso ? '#FFF8E6' : C.superficie,
      border: `1px solid ${aviso ? '#E8D9A8' : C.linea}`,
      borderRadius: 3, padding: 14, marginTop: 12
    }}>
      <div style={{
        fontSize: 10, color: aviso ? '#6B5518' : C.tenue, textTransform: 'uppercase',
        letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10
      }}>{titulo}</div>
      {children}
    </Entrada>
  );
}

export function DetalleLey({ votacion, onVolver }) {
  const [iniciativaId, setIniciativaId] = useState(null);
  const [seguida, setSeguida] = useState(false);

  useEffect(() => {
    let vivo = true;
    setIniciativaId(null);
    setSeguida(false);
    traerIniciativaDeVotacion(votacion.votacion_principal ?? votacion.id)
      .then(id => {
        if (!vivo) return;
        setIniciativaId(id);
        setSeguida(id ? estaSeguido('iniciativa', id) : false);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [votacion.id, votacion.votacion_principal]);

  const aprobada = votacion.resultado === 'aprobada';
  const mayoria = mayoriaRequerida(votacion);
  const umbral = umbralDe(mayoria);
  const enlaces = String(votacion.enlaces_bocg ?? '').split(/[\s·]+/).filter(u => u.startsWith('http')).slice(0, 3);
  const frase = titularDeNorma(votacion, 110);
  const oficial = nombreCompletoNorma(votacion);
  const vehiculo = vehiculoNorma(votacion);
  const cabeza = resumenBreve(votacion, 2);
  const resto = restoResumen(votacion, 2);
  const procedencia = procedenciaResumen(votacion);
  const [seccion, setSeccion] = useState('afecta');
  const refAfecta = useRef(null);
  const refResumen = useRef(null);
  const refHistorial = useRef(null);
  const refFuentes = useRef(null);
  const refs = { afecta: refAfecta, resumen: refResumen, historial: refHistorial, fuentes: refFuentes };

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.dataset?.sec) setSeccion(visible.target.dataset.sec);
    }, { rootMargin: '-20% 0px -55% 0px', threshold: [0.2, 0.5, 0.8] });
    Object.values(refs).forEach(r => r.current && obs.observe(r.current));
    return () => obs.disconnect();
  }, [votacion.id]);

  const pasos = [
    ['afecta', 'A quién afecta'],
    ['resumen', 'Qué dice'],
    ['historial', 'Historial'],
    ['fuentes', 'Fuentes']
  ];

  return (
    <div className="e">
      {iniciativaId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 10 }}>
          <BotonSeguir
            tipo="iniciativa"
            id={iniciativaId}
            seguido={seguida}
            alCambiar={(_t, _i, ahora) => setSeguida(ahora)}
          />
        </div>
      )}
      <button onClick={onVolver} className="em" style={{
        background: 'none', border: 'none', cursor: 'pointer', color: C.media, fontSize: 12, padding: '0 0 12px'
      }}>← Volver a la lista</button>

      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: 'rgba(239,239,233,.92)',
        backdropFilter: 'blur(8px)', padding: '8px 0 10px', marginBottom: 4
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {pasos.map(([id, et]) => (
            <button key={id} onClick={() => refs[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="em" style={{
                fontSize: 10.5, padding: '5px 9px', borderRadius: 2, cursor: 'pointer',
                border: `1px solid ${seccion === id ? C.tinta : C.linea}`,
                background: seccion === id ? C.tinta : 'transparent',
                color: seccion === id ? '#EFEFE9' : C.media, fontWeight: seccion === id ? 600 : 400
              }}>{et}</button>
          ))}
        </div>
      </div>

      <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 16 }}>
        <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {votacion.materia_nombre && (
            <span style={{
              background: votacion.materia_color || C.media, color: '#fff',
              padding: '3px 9px', borderRadius: 2, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase'
            }}>
              {votacion.materia_nombre}
            </span>
          )}
          <span>{votacion.fecha} · Sesión {votacion.sesion}</span>
        </div>
        {frase && (
          <div className="ed" style={{ fontSize: 'clamp(19px,4.6vw,23px)', fontWeight: 600, lineHeight: 1.25, marginBottom: 8 }}>
            {frase}
          </div>
        )}
        {vehiculo && (
          <div className="em" style={{
            fontSize: 9.5, color: C.media, fontWeight: 700, letterSpacing: '.06em',
            textTransform: 'uppercase', marginBottom: 4
          }}>{vehiculo.nombre}</div>
        )}
        <div className="em" style={{ fontSize: 11.5, color: C.media, lineHeight: 1.5 }}>
          {oficial}
        </div>
        {vehiculo && !vehiculo.fuerzaDeLey && (
          <div style={{
            fontSize: 12, color: '#6B5518', background: '#FFF8E6', border: '1px solid #E8D9A8',
            borderRadius: 2, padding: '7px 10px', marginTop: 10, lineHeight: 1.5
          }}>
            Esto no es una ley. Una {vehiculo.nombre.toLowerCase()} fija una posición política del
            Pleno y no cambia por sí sola ninguna norma en vigor.
          </div>
        )}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Sello aprobada={aprobada} />
          {umbral !== null && (
            <span className="em" style={{ fontSize: 11, color: C.media }}>
              exigía {nombreMayoria(mayoria)}: {umbral} síes
            </span>
          )}
          {votacion.votaciones_norma > 1 && (
            <span className="em" style={{ fontSize: 11, color: C.media }}>
              {votacion.votaciones_norma} votaciones (enmiendas incluidas)
            </span>
          )}
        </div>
      </div>

      <div ref={refs.afecta} data-sec="afecta" style={{ scrollMarginTop: 52 }}>
        {Array.isArray(votacion.efectos) && votacion.efectos.length > 0 ? (
          <Bloque titulo="Si esto te afecta">
            {votacion.efectos.map(e => {
              const tip = implicacionDe(e.slug);
              return (
                <div key={e.slug} style={{ display: 'flex', gap: 11, padding: '11px 0', borderBottom: `1px solid ${C.linea}` }}>
                  <span style={{
                    flexShrink: 0, width: 7, height: 7, borderRadius: 7, marginTop: 6,
                    background: votacion.materia_color || C.tinta
                  }} />
                  <div>
                    <div className="ed" style={{ fontSize: 14, fontWeight: 600 }}>{e.nombre}</div>
                    <div style={{ fontSize: 13.5, color: C.tinta, lineHeight: 1.5, marginTop: 3 }}>{e.efecto}</div>
                    {tip && (
                      <div style={{
                        marginTop: 8, padding: '8px 10px', background: '#F7F7F2', borderRadius: 2,
                        fontSize: 12, color: C.media, lineHeight: 1.5
                      }}>
                        <strong style={{ color: C.tinta }}>Qué mirar:</strong> {tip.hacer}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 10, lineHeight: 1.5 }}>
              Colectivos identificados sobre una lista cerrada. El efecto describe lo que cambia, no si es bueno o malo.
            </div>
          </Bloque>
        ) : (
          <Bloque titulo="Si esto te afecta">
            <div style={{ fontSize: 13, color: C.media, lineHeight: 1.5 }}>
              Esta norma no tiene colectivos etiquetados todavía. Usa el buscador del inicio con tu situación
              para ver leyes que sí te marcan.
            </div>
          </Bloque>
        )}
      </div>

      <div ref={refs.resumen} data-sec="resumen" style={{ scrollMarginTop: 52 }}>
        {cabeza && (
          <Bloque titulo="Qué dice esta norma">
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>{cabeza}</div>
            {(resto || (Array.isArray(votacion.puntos_clave) && votacion.puntos_clave.length > 0)) && (
              <details style={{ marginTop: 12 }}>
                <summary className="em" style={{ fontSize: 12, color: C.media, cursor: 'pointer', padding: '4px 0' }}>
                  Leer el detalle completo
                </summary>
                {resto && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 10, color: C.media }}>{resto}</div>
                )}
                {Array.isArray(votacion.puntos_clave) && votacion.puntos_clave.length > 0 && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: C.media }}>
                    {votacion.puntos_clave.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}
                  </ul>
                )}
              </details>
            )}
            {votacion.a_quien_afecta && (
              <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 12,
                paddingTop: 10, borderTop: `1px solid ${C.linea}` }}>
                <strong style={{ color: C.tinta }}>A quién nombra el texto:</strong> {votacion.a_quien_afecta}
              </div>
            )}
            <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 12, lineHeight: 1.5 }}>
              {procedencia}
            </div>
          </Bloque>
        )}
      </div>

      <div ref={refs.historial} data-sec="historial" style={{ scrollMarginTop: 52 }}>
        <HistorialNormaLazy votacion={votacion} />
      </div>

      <div ref={refs.fuentes} data-sec="fuentes" style={{ scrollMarginTop: 52 }}>
        {(votacion.expediente || enlaces.length > 0) && (
          <Bloque titulo="Acceder a la norma">
            {votacion.expediente && (
              <div className="em" style={{ fontSize: 11, color: C.tenue, marginBottom: 6 }}>
                Expediente {votacion.expediente}
                {votacion.similitud_enlace && ` · coincidencia ${Math.round(votacion.similitud_enlace * 100)}%`}
              </div>
            )}
            {votacion.autor_texto && (
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ color: C.tenue }}>Presentada por </span>{votacion.autor_texto}
              </div>
            )}
            {votacion.situacion && (
              <div style={{ fontSize: 12.5, marginBottom: 10 }}>
                <span style={{ color: C.tenue }}>Situación: </span>{votacion.situacion}
              </div>
            )}
            {enlaces.length > 0 && (
              <a href={enlaces[0]} target="_blank" rel="noreferrer" style={{
                display: 'inline-block', marginTop: 4, padding: '9px 14px', fontSize: 12.5, fontWeight: 600,
                background: C.tinta, color: '#EFEFE9', borderRadius: 2, textDecoration: 'none'
              }}>Leer el texto oficial en el BOCG →</a>
            )}
            {enlaces.slice(1).map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="em"
                style={{ fontSize: 11, color: C.media, display: 'block', marginTop: 7 }}>
                Publicación posterior en el BOCG ({i + 2}) →
              </a>
            ))}
            <a href={votacion.fuente_url} target="_blank" rel="noreferrer" className="em"
              style={{ fontSize: 11, color: C.media, display: 'block', marginTop: 12 }}>
              Acta oficial de la votación →
            </a>
          </Bloque>
        )}

        {!votacion.resumen && (
          <Bloque titulo="Qué dice esta norma" aviso>
            {vehiculo?.queEs && (
              <div style={{ fontSize: 14.5, lineHeight: 1.6, color: C.tinta, marginBottom: 12 }}>
                {vehiculo.queEs}
              </div>
            )}
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.tinta,
              paddingLeft: 11, borderLeft: `2px solid ${C.linea}` }}>
              {oficial}
            </div>
            <div style={{ fontSize: 12.5, color: '#6B5518', lineHeight: 1.55, marginTop: 12 }}>
              {SIN_TEXTO_PROPIO.test(`${votacion.titulo ?? ''} ${votacion.subtitulo ?? ''}`)
                ? <>Ese es el texto completo que el Congreso publica en datos abiertos: de las
                  proposiciones no de ley, mociones e interpelaciones no publica el articulado, así
                  que no hay más que resumir.</>
                : <>Todavía no hay resumen: o el Congreso no ha publicado el texto en datos abiertos,
                  o no se ha podido leer. Arriba queda el título oficial completo, y abajo el acta.</>}
            </div>
            <a href={votacion.fuente_url} target="_blank" rel="noreferrer" className="em"
              style={{ fontSize: 11, color: '#6B5518', display: 'block', marginTop: 10 }}>
              Acta oficial de la votación →
            </a>
          </Bloque>
        )}
      </div>
    </div>
  );
}

function Disidentes({ analisis, onDiputado }) {
  const [todos, setTodos] = useState(false);
  const lista = analisis.grupos.flatMap(g => g.rebeldes.map(r => ({ ...r, partido: g.grupo })));
  if (lista.length === 0) {
    return (
      <Bloque titulo="Votaron distinto que su partido">
        <div style={{ fontSize: 12.5, color: C.tenue }}>
          Ninguno. Todos los diputados votaron con la mayoría de su partido.
        </div>
      </Bloque>
    );
  }
  const TOPE = 12;
  const visibles = todos ? lista : lista.slice(0, TOPE);
  return (
    <Bloque titulo={`Votaron distinto que su partido · ${lista.length}`} aviso>
      {visibles.map(r => (
        <button key={r.d.mandato_id} onClick={() => onDiputado?.(r.d)} style={{
          display: 'block', width: '100%', textAlign: 'left', background: 'none',
          border: 'none', cursor: 'pointer', padding: '6px 0', fontSize: 13, color: '#6B5518'
        }}>
          {r.d.nombre_completo}
          <span className="em" style={{ opacity: 0.75, fontSize: 11 }}> ({r.partido}) → {ETIQUETA[r.voto]}</span>
        </button>
      ))}
      {lista.length > TOPE && (
        <button onClick={() => setTodos(!todos)} className="em" style={{
          marginTop: 8, padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', borderRadius: 2,
          background: 'transparent', border: '1px solid #E8D9A8', color: '#6B5518'
        }}>
          {todos ? 'Ver solo los primeros 12' : `Ver los ${lista.length - TOPE} restantes`}
        </button>
      )}
    </Bloque>
  );
}

function HistorialNormaLazy({ votacion }) {
  const [enmiendas, setEnmiendas] = useState(null);
  useEffect(() => {
    setEnmiendas(null);
    if (votacion.clave_norma && votacion.votaciones_norma > 1) {
      traerVotacionesDeNorma(votacion.clave_norma).then(setEnmiendas).catch(() => setEnmiendas([]));
    } else {
      setEnmiendas([]);
    }
  }, [votacion.clave_norma, votacion.votaciones_norma]);

  if (enmiendas === null) {
    return <div className="em" style={{ padding: 14, color: C.tenue, fontSize: 11 }}>Cargando historial…</div>;
  }
  if (enmiendas.length <= 1) {
    return (
      <Bloque titulo="Historial de esta norma">
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.5 }}>
          Solo hay una votación registrada para esta norma. No hay enmiendas enlazadas en los datos abiertos.
        </div>
      </Bloque>
    );
  }
  return <HistorialNorma enmiendas={enmiendas} />;
}

export default function Detalle({ votacion, diputados, votos, onDiputado, onNorma }) {
  const [enmiendas, setEnmiendas] = useState(null);
  const [relacionadas, setRelacionadas] = useState([]);

  useEffect(() => {
    setEnmiendas(null); setRelacionadas([]);
    if (votacion.clave_norma && votacion.votaciones_norma > 1) {
      traerVotacionesDeNorma(votacion.clave_norma).then(setEnmiendas).catch(() => setEnmiendas([]));
    }
    traerRelacionadas(votacion).then(setRelacionadas).catch(() => setRelacionadas([]));
  }, [votacion.clave_norma, votacion.id]);

  const analisis = useMemo(() => analizarVotacion(diputados, votos), [diputados, votos]);

  const total = votacion.total_si + votacion.total_no + votacion.total_abstencion || 1;
  const seg = [[votacion.total_si, C.si], [votacion.total_abstencion, C.abs], [votacion.total_no, C.no]];
  const aprobada = votacion.resultado === 'aprobada';
  const mayoria = mayoriaRequerida(votacion);
  const umbral = umbralDe(mayoria);
  const margen = Math.abs((votacion.total_si ?? 0) - (votacion.total_no ?? 0));
  const faltaron = faltaronPara(votacion);
  const registrados = registradosEnActa(votacion);

  return (
    <div className="e">
      <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 16 }}>
        <div className="em" style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 10 }}>
          Resultado de la votación
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Sello aprobada={aprobada} />
          <span className="em" style={{ fontSize: 11, color: C.media }}>
            {umbral === null
              ? `por ${margen} voto${margen === 1 ? '' : 's'}`
              : `${votacion.total_si ?? 0} síes de los ${umbral} que exige la ${nombreMayoria(mayoria)}`}
          </span>
        </div>

        <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', background: '#E4E4DC', marginTop: 12 }}>
          {seg.map(([v, col], i) => v > 0 && (
            <motion.div key={i} style={{ background: col }}
              initial={{ width: 0 }} animate={{ width: `${(v / total) * 100}%` }}
              transition={{ ...SALIDA, delay: 0.1 + i * 0.07 }} />
          ))}
        </div>
        <div className="em" style={{ fontSize: 12, marginTop: 7, display: 'flex', gap: 14 }}>
          <span style={{ color: C.si }}>Sí <Cifra valor={votacion.total_si ?? 0} /></span>
          <span style={{ color: C.no }}>No <Cifra valor={votacion.total_no ?? 0} /></span>
          <span style={{ color: C.abs }}>Abs <Cifra valor={votacion.total_abstencion ?? 0} /></span>
          <span style={{ color: C.tenue, marginLeft: 'auto' }}>
            <Cifra valor={votacion.total_presentes ?? 0} /> presentes
          </span>
        </div>
      </div>

      {!votos && <div style={{ padding: 20, textAlign: 'center', color: C.tenue, fontSize: 12 }}>Cargando votos…</div>}

      {analisis && (
        <>
          {!aprobada && faltaron > 0 && (
            <Bloque titulo="Cuánto faltó">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="ed" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  {faltaron}
                </span>
                <span style={{ fontSize: 12.5, color: C.media, lineHeight: 1.4 }}>
                  {umbral === null
                    ? `voto${faltaron === 1 ? '' : 's'} tendrían que haber cambiado de No a Sí para que saliera adelante.`
                    : `voto${faltaron === 1 ? '' : 's'} a favor más para llegar a los ${umbral} que exige la ${nombreMayoria(mayoria)}.`}
                </span>
              </div>
              {((votacion.total_abstencion ?? 0) > 0 || (votacion.total_no_vota ?? 0) > 0) && (
                <div className="em" style={{ fontSize: 11, color: C.tenue, marginTop: 10 }}>
                  Hubo {votacion.total_abstencion ?? 0} abstenciones y {votacion.total_no_vota ?? 0} sin votar.
                </div>
              )}
            </Bloque>
          )}

          <Disidentes analisis={analisis} onDiputado={onDiputado} />

      <Posturas analisis={analisis} />

      {enmiendas && enmiendas.length > 1 && <HistorialNorma enmiendas={enmiendas} />}

      {relacionadas.length > 0 && (
        <Bloque titulo="Otras normas aprobadas sobre lo mismo">
          {relacionadas.map(rn => (
            <button key={rn.clave_norma} onClick={() => onNorma?.(rn)} style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none',
              border: 'none', borderTop: `1px solid ${C.linea}`, cursor: 'pointer', padding: '9px 0'
            }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{titularDeNorma(rn, 130)}</div>
              <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 3 }}>
                {rn.fecha} · <span style={{ color: C.si }}>aprobada</span> · {rn.total_si}–{rn.total_no}
              </div>
            </button>
          ))}
        </Bloque>
      )}


          <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 14, lineHeight: 1.5 }}>
            El acta del Congreso registra {registrados} votos individuales y {analisis.contados} están
            asignados a un diputado con partido: son los que suman en el desglose de arriba.
            {registrados !== analisis.contados && (
              <> Los {Math.abs(registrados - analisis.contados)} restantes están pendientes de
              identificar, así que el desglose por partido no los incluye.</>
            )}
            {' '}Ninguna cifra es una estimación.
          </div>
        </>
      )}
    </div>
  );
}