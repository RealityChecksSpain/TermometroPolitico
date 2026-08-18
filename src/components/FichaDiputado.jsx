import React, { useEffect, useState } from 'react';
import { traerVotosDeDiputado, traerResumenDiputado } from '../lib/cliente.js';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288',
  linea: '#DCDCD3', si: '#2E7D5B', no: '#B23A2E', abs: '#B8912E'
};

const ETIQUETA = { si: 'Sí', no: 'No', abstencion: 'Abst.', no_vota: 'No votó' };
const COLOR = { si: C.si, no: C.no, abstencion: C.abs, no_vota: C.tenue };

function Dato({ etiqueta, valor }) {
  return (
    <div>
      <div className="ed" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: 11, color: C.tenue, marginTop: 3 }}>{etiqueta}</div>
    </div>
  );
}

export default function FichaDiputado({ d, onCerrar, onVotacion }) {
  const [votos, setVotos] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [fallo, setFallo] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [soloDisidencias, setSoloDisidencias] = useState(false);

  useEffect(() => {
    if (!d) return;
    setVotos(null); setResumen(null); setFallo(null); setPagina(0); setSoloDisidencias(false);
    let vivo = true;
    Promise.all([traerVotosDeDiputado(d.mandato_id, 60, 0), traerResumenDiputado(d.mandato_id)])
      .then(([v, r]) => { if (vivo) { setVotos(v); setResumen(r); } })
      .catch(e => { if (vivo) { setFallo(String(e.message ?? e)); setVotos([]); } });
    return () => { vivo = false; };
  }, [d]);

  async function masVotos() {
    const siguiente = pagina + 1;
    const nuevos = await traerVotosDeDiputado(d.mandato_id, 60, siguiente * 60);
    setVotos(v => [...(v ?? []), ...nuevos]);
    setPagina(siguiente);
  }

  if (!d) return null;

  const lista = (votos ?? []).filter(v => !soloDisidencias || v.disidente);
  const nDisidencias = Number(resumen?.disidencias ?? 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onCerrar}>
      <div className="e" onClick={e => e.stopPropagation()} style={{
        background: C.superficie, width: '100%', maxWidth: 620, borderRadius: '4px 4px 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.linea}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
              <span style={{ width: 4, background: d.color || '#8E9299', borderRadius: 4, flexShrink: 0 }} />
              <div>
                <div className="ed" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>{d.nombre_completo}</div>
                <div className="em" style={{ fontSize: 11, color: C.tenue, marginTop: 3 }}>
                  {d.partido_siglas || d.grupo} · {d.circunscripcion ?? '—'}
                  {!d.activo && ` · baja ${d.fecha_baja ?? ''}`}
                </div>
              </div>
            </div>
            <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.tenue, fontSize: 24, lineHeight: 1 }}>×</button>
          </div>

          {resumen && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                Ha participado en <strong>{Number(resumen.total_votos).toLocaleString('es')}</strong> votaciones.
                Votó con la mayoría de su partido el <strong>{d.disciplina}%</strong> de las veces
                {nDisidencias > 0
                  ? <> y se separó de él <strong>{nDisidencias}</strong> {nDisidencias === 1 ? 'vez' : 'veces'}.</>
                  : <>. Nunca se separó de él.</>}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#E4E4DC' }}>
                  {[[resumen.si, C.si], [resumen.abstencion, C.abs], [resumen.no, C.no], [resumen.no_vota, '#C4C8CC']]
                    .map(([v, col], i) => Number(v) > 0 && (
                      <div key={i} style={{ width: `${(Number(v) / Number(resumen.total_votos || 1)) * 100}%`, background: col }} />
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  <span><strong style={{ color: C.si }}>{resumen.si}</strong> a favor</span>
                  <span><strong style={{ color: C.no }}>{resumen.no}</strong> en contra</span>
                  <span><strong style={{ color: C.abs }}>{resumen.abstencion}</strong> abstenciones</span>
                  <span style={{ color: C.tenue }}><strong>{resumen.no_vota}</strong> ausencias</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 22, marginTop: 16, flexWrap: 'wrap' }}>
                <Dato etiqueta="Asistencia" valor={`${d.asistencia}%`} />
                <Dato etiqueta="Intervenciones" valor={d.intervenciones} />
                <Dato etiqueta="Minutos hablando" valor={d.minutos_tribuna} />
                <Dato etiqueta="Votos a distancia" valor={resumen.telematicos} />
              </div>
            </div>
          )}

          {nDisidencias > 0 && (
            <button onClick={() => setSoloDisidencias(!soloDisidencias)} style={{
              marginTop: 12, padding: '5px 10px', fontSize: 11.5, cursor: 'pointer', borderRadius: 2,
              background: soloDisidencias ? '#6B5518' : '#FFF8E6',
              color: soloDisidencias ? '#FFF8E6' : '#6B5518',
              border: '1px solid #E8D9A8', fontWeight: 600
            }}>
              {soloDisidencias ? 'Ver todas las votaciones' : `Ver solo las ${nDisidencias} en que rompió con su partido`}
            </button>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 18px 18px' }}>
          {votos === null && !fallo && <div style={{ padding: 30, textAlign: 'center', color: C.tenue, fontSize: 12 }}>Cargando su historial de votos…</div>}

          {fallo && (
            <div style={{ margin: '16px 0', padding: 13, background: '#FBE9EC', border: '1px solid #E8C0C6', borderRadius: 3 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8E0B20' }}>No se pudo cargar el historial</div>
              <pre className="em" style={{ fontSize: 10.5, color: '#8E0B20', whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{fallo}</pre>
            </div>
          )}

          {votos && !fallo && lista.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: C.tenue, fontSize: 12 }}>
              {soloDisidencias ? 'Ninguna disidencia entre los votos cargados.' : 'Sin votos registrados para este diputado.'}
            </div>
          )}

          {lista.map(v => (
            <button key={v.votacion_id} onClick={() => onVotacion?.(v.votacion_id)} style={{
              display: 'block', width: '100%', textAlign: 'left', background: v.disidente ? '#FFF8E6' : 'transparent',
              border: 'none', borderBottom: `1px solid ${C.linea}`, cursor: 'pointer', padding: '10px 4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="em" style={{ fontSize: 11, fontWeight: 500, color: COLOR[v.voto], width: 52, flexShrink: 0 }}>
                  {ETIQUETA[v.voto] ?? v.voto}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                  {v.subtitulo || v.titulo}
                </span>
              </div>
              <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 4, marginLeft: 60, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {v.materia && (
                  <span style={{ background: (v.materia_color || '#8E9299') + '22', color: v.materia_color || C.media, padding: '1px 5px', borderRadius: 2 }}>
                    {v.materia}
                  </span>
                )}
                <span>{v.fecha}</span>
                <span style={{ color: v.resultado === 'aprobada' ? C.si : C.no }}>{v.resultado}</span>
                {v.telematico && <span>telemático</span>}
                {v.disidente && <span style={{ color: '#6B5518', fontWeight: 600 }}>
                  su grupo votó {ETIQUETA[v.voto_grupo] ?? v.voto_grupo}
                </span>}
              </div>
            </button>
          ))}

          {votos && votos.length >= (pagina + 1) * 60 && !soloDisidencias && (
            <button onClick={masVotos} className="em" style={{
              width: '100%', marginTop: 12, padding: '9px', fontSize: 12, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${C.linea}`, borderRadius: 2, color: C.media
            }}>Cargar 60 votos más</button>
          )}
        </div>
      </div>
    </div>
  );
}