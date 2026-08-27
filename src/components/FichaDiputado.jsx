import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Cifra, SALIDA } from './Movimiento.jsx';
import { desgloseBienes } from '../lib/inmuebles.js';
import { traerVotosDeDiputado, traerResumenDiputado, traerActividades } from '../lib/cliente.js';
import AvatarPartido from './AvatarPartido.jsx';
import { VOTO } from '../lib/paleta.js';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288',
  linea: '#E3DFD1', ...VOTO
};

const ETIQUETA = { si: 'Sí', no: 'No', abstencion: 'Abst.', no_vota: 'No votó' };
const COLOR = { si: C.si, no: C.no, abstencion: C.abs, no_vota: C.tenue };

function Dato({ etiqueta, valor, sufijo = '' }) {
  const numero = Number(valor);
  const animable = valor != null && valor !== '' && !Number.isNaN(numero);
  return (
    <div>
      <div className="ed" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>
        {animable ? <><Cifra valor={numero} />{sufijo}</> : (valor ?? '—')}
      </div>
      <div style={{ fontSize: 11, color: C.tenue, marginTop: 3 }}>{etiqueta}</div>
    </div>
  );
}

export default function FichaDiputado({ d, onCerrar, onVotacion }) {
  const reducido = useReducedMotion();
  const [votos, setVotos] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [fallo, setFallo] = useState(null);
  const [actividades, setActividades] = useState([]);
  const [pestana, setPestana] = useState('votos');
  const [pagina, setPagina] = useState(0);
  const [soloDisidencias, setSoloDisidencias] = useState(false);

  useEffect(() => {
    if (!d) return;
    setVotos(null); setResumen(null); setFallo(null); setPagina(0); setSoloDisidencias(false);
    setActividades([]); setPestana('votos');
    traerActividades(d.mandato_id).then(setActividades).catch(() => setActividades([]));
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
    <motion.div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCerrar}
      initial={reducido ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24 }}>
      <motion.div className="e" onClick={e => e.stopPropagation()}
        initial={reducido ? false : { y: 44, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
        style={{
          background: C.superficie, width: '100%', maxWidth: 620, borderRadius: '4px 4px 0 0',
          maxHeight: '92vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.linea}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
              <AvatarPartido
                foto={d.foto_url}
                color={d.color}
                siglas={d.partido_siglas || d.grupo}
                nombre={d.nombre_completo}
                w={58}
                h={74}
              />
              <div>
                <div className="ed" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>{d.nombre_completo}</div>
                <div className="em" style={{ fontSize: 11, color: C.tenue, marginTop: 3 }}>
                  {d.partido_siglas || d.grupo} · {d.circunscripcion ?? '—'}
                  {!d.activo && ` · baja ${d.fecha_baja ?? ''}`}
                </div>
                {d.cargo && (
                  <div style={{ fontSize: 12, color: C.media, marginTop: 4, fontWeight: 500 }}>{d.cargo}</div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  {d.url_ficha && (
                    <a href={d.url_ficha} target="_blank" rel="noreferrer" className="em"
                      style={{ fontSize: 10.5, color: C.media }}>ficha oficial →</a>
                  )}
                  {d.url_bienes && (
                    <a href={d.url_bienes} target="_blank" rel="noreferrer" className="em"
                      style={{ fontSize: 10.5, color: C.media }}>declaración de bienes →</a>
                  )}
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
                      <motion.div key={i} style={{ background: col }}
                        initial={reducido ? false : { width: 0 }}
                        animate={{ width: `${(Number(v) / Number(resumen.total_votos || 1)) * 100}%` }}
                        transition={{ ...SALIDA, delay: 0.14 + i * 0.07 }} />
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  <span><strong style={{ color: C.si }}><Cifra valor={Number(resumen.si) || 0} /></strong> a favor</span>
                  <span><strong style={{ color: C.no }}><Cifra valor={Number(resumen.no) || 0} /></strong> en contra</span>
                  <span><strong style={{ color: C.abs }}><Cifra valor={Number(resumen.abstencion) || 0} /></strong> abstenciones</span>
                  <span style={{ color: C.tenue }}><strong><Cifra valor={Number(resumen.no_vota) || 0} /></strong> ausencias</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 22, marginTop: 16, flexWrap: 'wrap' }}>
                <Dato etiqueta="Asistencia" valor={d.asistencia} sufijo="%" />
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

        <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0', borderBottom: `1px solid ${C.linea}`,
          position: 'sticky', top: 0, background: C.superficie, zIndex: 2 }}>
          {[['votos', `Votaciones${resumen ? ` (${resumen.total_votos})` : ''}`],
            ['intereses', `Intereses declarados${actividades.length ? ` (${actividades.length})` : ''}`]].map(([k, t]) => (
            <button key={k} onClick={() => setPestana(k)} style={{
              padding: '8px 12px', fontSize: 12.5, cursor: 'pointer', background: 'none',
              border: 'none', borderBottom: `2px solid ${pestana === k ? C.tinta : 'transparent'}`,
              color: pestana === k ? C.tinta : C.tenue, fontWeight: pestana === k ? 600 : 400, marginBottom: -1
            }}>{t}</button>
          ))}
        </div>

        <div style={{ padding: '12px 18px 18px', display: pestana === 'intereses' ? 'block' : 'none' }}>
          {actividades.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.tenue, fontSize: 12 }}>
              Sin declaraciones registradas.
            </div>
          )}
          {['DONACION', 'ACTIVIDAD', 'FUNDACIONES', 'OBSERVACIONES'].map(tipo => {
            const grupo = actividades.filter(a => a.tipo === tipo);
            if (grupo.length === 0) return null;
            const titulos = {
              DONACION: 'Donaciones declaradas',
              ACTIVIDAD: 'Actividades y empleos',
              FUNDACIONES: 'Fundaciones y entidades',
              OBSERVACIONES: 'Observaciones'
            };
            return (
              <div key={tipo} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase',
                  letterSpacing: '.05em', fontWeight: 600, marginBottom: 8 }}>
                  {titulos[tipo]} · {grupo.length}
                </div>
                {grupo.map((a, i) => (
                  <div key={i} style={{ padding: '9px 0', borderTop: `1px solid ${C.linea}` }}>
                    {a.empleador && <div style={{ fontSize: 13, fontWeight: 600 }}>{a.empleador}</div>}
                    {a.descripcion && (
                      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.45, marginTop: 2 }}>{a.descripcion}</div>
                    )}
                    <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {a.periodo && <span>{a.periodo}</span>}
                      {a.sector_norm && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 2,
                          background: a.sector_norm === 'privado' ? '#FBE9EC' : '#E7EEF8',
                          color: a.sector_norm === 'privado' ? '#8E0B20' : '#083A79'
                        }}>{a.sector_norm}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          <div className="em" style={{ fontSize: 10, color: C.tenue, lineHeight: 1.5, marginTop: 10 }}>
            Declaración de intereses económicos presentada por el propio diputado y publicada por el
            Congreso.
          </div>
        </div>

        {(d.patrimonio_euros != null || d.n_casas != null || d.n_inmuebles != null || d.vehiculos_detalle || (d.n_vehiculos ?? 0) > 0) && (
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.linea}`, background: '#F8F6EE' }}>
            <div className="em" style={{
              fontSize: 10, color: C.tenue, letterSpacing: '.05em', textTransform: 'uppercase',
              fontWeight: 600, marginBottom: 8
            }}>Declaración de bienes</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
              {d.patrimonio_euros != null && (
                <div>
                  <div className="ed" style={{ fontSize: 16, fontWeight: 600 }}>
                    {Number(d.patrimonio_euros).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                  </div>
                  <div style={{ fontSize: 10, color: C.tenue }}>patrimonio líquido est.</div>
                </div>
              )}
              {(d.n_casas ?? d.n_inmuebles) != null && (
                <div>
                  <div className="ed" style={{ fontSize: 16, fontWeight: 600 }}>{d.n_casas ?? d.n_inmuebles}</div>
                  <div style={{ fontSize: 10, color: C.tenue }}>
                    {desgloseBienes(d).map(x => x.texto).join(' · ') || 'unidades declaradas'}
                    {d.n_inmuebles_equivalentes != null && Number(d.n_inmuebles_equivalentes) < Number(d.n_casas ?? d.n_inmuebles) * 0.9 && (
                      <> · equivalen a {Number(d.n_inmuebles_equivalentes).toLocaleString('es-ES', { maximumFractionDigits: 1 })} en propiedad plena</>
                    )}
                  </div>
                </div>
              )}
              <div>
                <div className="ed" style={{ fontSize: 16, fontWeight: 600 }}>
                  {(d.n_coches ?? 0) + (d.n_motos ?? 0) + (d.n_embarcaciones ?? 0) + (d.n_aeronaves ?? 0) || d.n_vehiculos || 0}
                </div>
                <div style={{ fontSize: 10, color: C.tenue }}>
                  {[
                    d.n_coches ? `${d.n_coches} coche${d.n_coches === 1 ? '' : 's'}` : null,
                    d.n_motos ? `${d.n_motos} moto${d.n_motos === 1 ? '' : 's'}` : null,
                    d.n_embarcaciones ? `${d.n_embarcaciones} emb.` : null,
                    d.n_aeronaves ? `${d.n_aeronaves} aer.` : null
                  ].filter(Boolean).join(' · ') || 'vehículos'}
                </div>
              </div>
            </div>
            {(d.n_inmuebles_propios != null || d.n_inmuebles_sociedad != null) && (
              <div style={{
                border: `1px solid ${C.linea}`, borderRadius: 3, background: '#FFFFFF',
                padding: '9px 11px', marginBottom: 9
              }}>
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', marginBottom: 5 }}>
                  <span className="ed" style={{ fontSize: 13, fontWeight: 600 }}>{d.n_inmuebles_propios ?? 0}</span>
                  <span style={{ fontSize: 11.5, color: C.media }}>en pleno dominio o comunidad de bienes</span>
                </div>
                <div style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                  <span className="ed" style={{ fontSize: 13, fontWeight: 600 }}>{d.n_inmuebles_sociedad ?? 0}</span>
                  <span style={{ fontSize: 11.5, color: C.media }}>
                    a nombre de una sociedad no cotizada{' '}
                    <span
                      title="El inmueble figura a nombre de una empresa de la que el diputado tiene acciones o participaciones. El porcentaje declarado aparece en cada línea del detalle."
                      style={{
                        display: 'inline-block', width: 13, height: 13, lineHeight: '13px',
                        textAlign: 'center', borderRadius: 13, border: `1px solid ${C.linea}`,
                        fontSize: 9, color: C.tenue, cursor: 'help', verticalAlign: 'middle'
                      }}>i</span>
                  </span>
                </div>

                {Array.isArray(d.inmuebles_items) && d.inmuebles_items.length > 0 && (
                  <ul style={{ margin: '9px 0 0', paddingLeft: 15, fontSize: 11.5, color: C.media, lineHeight: 1.55 }}>
                    {d.inmuebles_items.map((it, i) => (
                      <li key={i}>
                        {it.qty > 1 ? `${it.qty} × ` : ''}{it.texto}
                        <span className="em" style={{
                          marginLeft: 6, fontSize: 9.5, padding: '1px 5px', borderRadius: 2,
                          background: it.sociedad ? '#F3EEE2' : '#E7EEF8',
                          color: it.sociedad ? '#6B5518' : '#083A79'
                        }}>
                          {it.sociedad
                            ? `vía sociedad${it.porcentaje != null ? ` · ${it.porcentaje}%` : ''}`
                            : 'propio'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="em" style={{ fontSize: 9.5, color: C.tenue, marginTop: 8, lineHeight: 1.5 }}>
                  Un pacto sucesorio es una herencia en vida, habitual en Galicia, País Vasco y
                  Navarra. Un inmueble declarado así o a través de una sociedad sí está vinculado al
                  diputado; lo que cambia es la forma jurídica de la titularidad y la cuota.
                </div>
              </div>
            )}

            {Array.isArray(d.vehiculos_lista) && d.vehiculos_lista.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.media, lineHeight: 1.5 }}>
                {d.vehiculos_lista.map((v, i) => (
                  <li key={i}><span className="em" style={{ fontSize: 10, color: C.tenue }}>{v.tipo}</span> · {v.texto}</li>
                ))}
              </ul>
            )}
            {!d.vehiculos_lista?.length && d.vehiculos_detalle && (
              <div style={{ fontSize: 12, color: C.media, lineHeight: 1.45 }}>{d.vehiculos_detalle}</div>
            )}
            <div className="em" style={{ fontSize: 9.5, color: C.tenue, marginTop: 8 }}>
              Del PDF oficial. El patrimonio no valora inmuebles. Abre la declaración para comprobar.
              {d.url_bienes && (
                <>{' '}<a href={d.url_bienes} target="_blank" rel="noreferrer" style={{ color: C.media }}>PDF →</a></>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: '0 18px 18px', display: pestana === 'votos' ? 'block' : 'none' }}>
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
      </motion.div>
    </motion.div>
  );
}