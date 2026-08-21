import React, { useMemo, useEffect, useState } from 'react';
import { traerVotacionesDeNorma, traerRelacionadas } from '../lib/cliente.js';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288',
  linea: '#DCDCD3', si: '#2E7D5B', no: '#B23A2E', abs: '#B8912E'
};

const ETIQUETA = { si: 'Sí', no: 'No', abstencion: 'Abstención', no_vota: 'No vota' };

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
  const aprobada = totSi > totNo;
  const margen = Math.abs(totSi - totNo);

  const faltaron = aprobada ? 0 : Math.floor((totNo - totSi) / 2) + 1;
  const abstenciones = lista.reduce((a, g) => a + g.abstencion, 0);
  const ausencias = lista.reduce((a, g) => a + g.no_vota, 0);

  return { grupos: lista, totSi, totNo, aprobada, margen, faltaron, abstenciones, ausencias };
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
    <div style={{
      background: aviso ? '#FFF8E6' : C.superficie,
      border: `1px solid ${aviso ? '#E8D9A8' : C.linea}`,
      borderRadius: 3, padding: 14, marginTop: 12
    }}>
      <div style={{
        fontSize: 10, color: aviso ? '#6B5518' : C.tenue, textTransform: 'uppercase',
        letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10
      }}>{titulo}</div>
      {children}
    </div>
  );
}

export function DetalleLey({ votacion, onVolver }) {
  const aprobada = votacion.resultado === 'aprobada';
  const enlaces = String(votacion.enlaces_bocg ?? '').split(/[\s·]+/).filter(u => u.startsWith('http')).slice(0, 3);

  return (
    <div className="e">
      <button onClick={onVolver} className="em" style={{
        background: 'none', border: 'none', cursor: 'pointer', color: C.media, fontSize: 12, padding: '0 0 12px'
      }}>← Volver a la lista</button>

      <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 16 }}>
        <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {votacion.materia_nombre && (
            <span style={{ background: (votacion.materia_color || '#8E9299') + '22', color: votacion.materia_color || C.media, padding: '2px 7px', borderRadius: 2, fontWeight: 500 }}>
              {votacion.materia_nombre}
            </span>
          )}
          <span>{votacion.fecha} · Sesión {votacion.sesion} · {votacion.titulo}</span>
        </div>
        <div className="ed" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>
          {String(votacion.subtitulo || votacion.titulo || '')
            .replace(/^\s*proposición\s+de\s+ley\s+presentada\s+por\s+el\s+grupo\s+parlamentario\s+de\s+\S+\s*[:.\-–—]?\s*/i, '')
            .replace(/^\s*presentada\s+por\s+el\s+grupo\s+parlamentario\s+(de\s+)?[^.:\-–—]+[:.\-–—]\s*/i, '')
            .trim() || (votacion.subtitulo || votacion.titulo)}
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Sello aprobada={aprobada} />
          {votacion.votaciones_norma > 1 && (
            <span className="em" style={{ fontSize: 11, color: C.media }}>
              Esta norma se votó {votacion.votaciones_norma} veces (enmiendas incluidas).
              Aquí se muestra la votación principal.
            </span>
          )}
        </div>
      </div>

      {Array.isArray(votacion.efectos) && votacion.efectos.length > 0 && (
        <Bloque titulo="Si esto te afecta">
          {votacion.efectos.map(e => (
            <div key={e.slug} style={{ display: 'flex', gap: 11, padding: '11px 0', borderBottom: `1px solid ${C.linea}` }}>
              <span style={{
                flexShrink: 0, width: 7, height: 7, borderRadius: 7, marginTop: 6,
                background: votacion.materia_color || C.tinta
              }} />
              <div>
                <div className="ed" style={{ fontSize: 14, fontWeight: 600 }}>{e.nombre}</div>
                <div style={{ fontSize: 13.5, color: C.tinta, lineHeight: 1.5, marginTop: 3 }}>{e.efecto}</div>
              </div>
            </div>
          ))}
          <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 10, lineHeight: 1.5 }}>
            Colectivos identificados automáticamente sobre una lista cerrada. El efecto describe
            lo que cambia, no si es bueno o malo.
          </div>
        </Bloque>
      )}

      {votacion.resumen && (
        <Bloque titulo="Qué dice esta norma">
          <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
            {String(votacion.resumen).split(/(?<=\.)\s+/).slice(0, 2).join(' ')}
          </div>
          {(String(votacion.resumen).split(/(?<=\.)\s+/).length > 2 ||
            (Array.isArray(votacion.puntos_clave) && votacion.puntos_clave.length > 0)) && (
            <details style={{ marginTop: 12 }}>
              <summary className="em" style={{ fontSize: 11.5, color: C.media, cursor: 'pointer' }}>
                Leer el detalle completo
              </summary>
              <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10, color: C.media }}>
                {String(votacion.resumen).split(/(?<=\.)\s+/).slice(2).join(' ')}
              </div>
              {Array.isArray(votacion.puntos_clave) && votacion.puntos_clave.length > 0 && (
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55, color: C.media }}>
                  {votacion.puntos_clave.map((p, i) => <li key={i} style={{ marginBottom: 5 }}>{p}</li>)}
                </ul>
              )}
            </details>
          )}
          <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 12, lineHeight: 1.5 }}>
            {votacion.resumen_basado_en === 'texto_bocg'
              ? 'Resumen sintetizado automáticamente del texto oficial publicado en el BOCG.'
              : 'Resumen sintetizado automáticamente a partir del título oficial.'}
            {' '}No sustituye al texto legal.
          </div>
        </Bloque>
      )}

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
        <Bloque titulo="Sin resumen disponible" aviso>
          <div style={{ fontSize: 12.5, color: '#6B5518', lineHeight: 1.55 }}>
            Esta votación es una proposición no de ley, moción o interpelación. El Congreso no
            publica su texto en el portal de datos abiertos, así que solo disponemos del título
            oficial y del acta de la votación.
          </div>
          <a href={votacion.fuente_url} target="_blank" rel="noreferrer" className="em"
            style={{ fontSize: 11, color: '#6B5518', display: 'block', marginTop: 10 }}>
            Acta oficial de la votación →
          </a>
        </Bloque>
      )}
    </div>
  );
}

export default function Detalle({ votacion, diputados, votos, onDiputado, onNorma }) {
  const [enmiendas, setEnmiendas] = useState(null);
  const [verEnmiendas, setVerEnmiendas] = useState(false);
  const [relacionadas, setRelacionadas] = useState([]);

  useEffect(() => {
    setEnmiendas(null); setVerEnmiendas(false); setRelacionadas([]);
    if (votacion.clave_norma && votacion.votaciones_norma > 1) {
      traerVotacionesDeNorma(votacion.clave_norma).then(setEnmiendas).catch(() => setEnmiendas([]));
    }
    traerRelacionadas(votacion).then(setRelacionadas).catch(() => setRelacionadas([]));
  }, [votacion.clave_norma, votacion.id]);

  const analisis = useMemo(() => analizarVotacion(diputados, votos), [diputados, votos]);

  const total = votacion.total_si + votacion.total_no + votacion.total_abstencion || 1;
  const seg = [[votacion.total_si, C.si], [votacion.total_abstencion, C.abs], [votacion.total_no, C.no]];
  const aprobada = votacion.resultado === 'aprobada';

  return (
    <div className="e">
      <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 16 }}>
        <div className="em" style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 10 }}>
          Resultado de la votación
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sello aprobada={aprobada} />
          {analisis && (
            <span className="em" style={{ fontSize: 11, color: C.media }}>
              por {analisis.margen} voto{analisis.margen === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', background: '#E4E4DC', marginTop: 12 }}>
          {seg.map(([v, col], i) => v > 0 && <div key={i} style={{ width: `${(v / total) * 100}%`, background: col }} />)}
        </div>
        <div className="em" style={{ fontSize: 12, marginTop: 7, display: 'flex', gap: 14 }}>
          <span style={{ color: C.si }}>Sí {votacion.total_si}</span>
          <span style={{ color: C.no }}>No {votacion.total_no}</span>
          <span style={{ color: C.abs }}>Abs {votacion.total_abstencion}</span>
          <span style={{ color: C.tenue, marginLeft: 'auto' }}>{votacion.total_presentes} presentes</span>
        </div>
      </div>

      {!votos && <div style={{ padding: 20, textAlign: 'center', color: C.tenue, fontSize: 12 }}>Cargando votos…</div>}

      {analisis && (
        <>
          {!aprobada && analisis.faltaron > 0 && (
            <Bloque titulo="Cuánto faltó">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="ed" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                  {analisis.faltaron}
                </span>
                <span style={{ fontSize: 12.5, color: C.media, lineHeight: 1.4 }}>
                  voto{analisis.faltaron === 1 ? '' : 's'} tendrían que haber cambiado de No a Sí
                  para que saliera adelante.
                </span>
              </div>
              {(analisis.abstenciones > 0 || analisis.ausencias > 0) && (
                <div className="em" style={{ fontSize: 11, color: C.tenue, marginTop: 10 }}>
                  Hubo {analisis.abstenciones} abstenciones y {analisis.ausencias} sin votar.
                </div>
              )}
            </Bloque>
          )}

          {(() => {
            const disidentes = analisis.grupos.flatMap(g => g.rebeldes.map(r => ({ ...r, partido: g.grupo })));
            const hay = disidentes.length > 0;
            return (
              <Bloque titulo="Votaron distinto que su partido" aviso={hay}>
                {hay ? disidentes.map(r => (
                  <button key={r.d.mandato_id} onClick={() => onDiputado?.(r.d)} style={{
                    display: 'block', width: '100%', textAlign: 'left', background: 'none',
                    border: 'none', cursor: 'pointer', padding: '5px 0', fontSize: 12.5, color: '#6B5518'
                  }}>
                    {r.d.nombre_completo}
                    <span className="em" style={{ opacity: 0.75, fontSize: 11 }}> ({r.partido}) → {ETIQUETA[r.voto]}</span>
                  </button>
                )) : (
                  <div style={{ fontSize: 12.5, color: C.tenue }}>
                    Ninguno. Todos los diputados votaron con la mayoría de su partido.
                  </div>
                )}
              </Bloque>
            );
          })()}

      {enmiendas && enmiendas.length > 1 && (
        <Bloque titulo={`Historial de esta norma · ${enmiendas.length} votaciones`}>
          <button onClick={() => setVerEnmiendas(!verEnmiendas)} className="em" style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: C.media, fontSize: 11.5, marginBottom: verEnmiendas ? 10 : 0
          }}>
            {verEnmiendas ? 'ocultar el desglose' : 'ver todas las votaciones y enmiendas'}
          </button>

          {verEnmiendas && enmiendas.map(e => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
              borderTop: `1px solid ${C.linea}`,
              opacity: e.es_tramite ? 0.72 : 1
            }}>
              <span className="em" style={{ fontSize: 10, color: C.tenue, width: 74, flexShrink: 0 }}>{e.fecha}</span>
              <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
                {e.titulo}
                {e.es_tramite && <span className="em" style={{ fontSize: 9.5, color: C.tenue }}> · trámite</span>}
              </span>
              <span className="em" style={{ fontSize: 10.5, color: C.tenue, flexShrink: 0 }}>
                {e.total_si}–{e.total_no}
              </span>
              <span className="em" style={{
                fontSize: 10.5, width: 62, textAlign: 'right', flexShrink: 0, fontWeight: 500,
                color: e.resultado === 'aprobada' ? C.si : C.no
              }}>{e.resultado}</span>
            </div>
          ))}

          {!verEnmiendas && (
            <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.5, marginTop: 8 }}>
              Esta norma pasó por {enmiendas.length} votaciones, de las cuales{' '}
              {enmiendas.filter(e => e.es_tramite).length} fueron enmiendas o trámites.
              Lo que ves arriba es la votación principal.
            </div>
          )}
        </Bloque>
      )}

      {relacionadas.length > 0 && (
        <Bloque titulo="Otras normas aprobadas sobre lo mismo">
          {relacionadas.map(rn => (
            <button key={rn.clave_norma} onClick={() => onNorma?.(rn)} style={{
              display: 'block', width: '100%', textAlign: 'left', background: 'none',
              border: 'none', borderTop: `1px solid ${C.linea}`, cursor: 'pointer', padding: '9px 0'
            }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{String(rn.titular).slice(0, 130)}</div>
              <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 3 }}>
                {rn.fecha} · <span style={{ color: C.si }}>aprobada</span> · {rn.total_si}–{rn.total_no}
              </div>
            </button>
          ))}
        </Bloque>
      )}


          <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 14, lineHeight: 1.5 }}>
            Recuentos calculados sobre los {votos.length} votos individuales publicados por el
            Congreso. Ninguno es una estimación.
          </div>
        </>
      )}
    </div>
  );
}