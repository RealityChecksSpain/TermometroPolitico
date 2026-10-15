import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Hallazgos from './Hallazgos.jsx';
import { Marco, Cifra, PALETAS, borde } from './Bauhaus.jsx';
import { traerHallazgosMadrid, traerLeyesMadrid, traerIniciativasResumenMadrid } from '../lib/cliente.js';
import { useTelefono } from '../lib/pantalla.js';

const P = PALETAS.madrid;

function normal(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const ESTADO = { APROBADA: 'aprobada', RECHAZADA: 'rechazada', PENDIENTE: 'pendiente', DECAIDA: 'decaída', RETIRADA: 'retirada', 'NO ADMITIDA': 'no admitida', CALIFICADA: 'calificada', TRAMITADA: 'tramitada' };
const NOMBRE_TIPO = { PL: 'Proyecto de ley', PROPL: 'Proposición de ley', PNL: 'PNL' };

export default function MadridInicio({ diputados, onFicha, onIr }) {
  const quieto = useReducedMotion();
  const estrecho = useTelefono();
  const [q, setQ] = useState('');
  const [leyes, setLeyes] = useState([]);
  const [resumen, setResumen] = useState([]);

  const [pedirLeyes, setPedirLeyes] = useState(false);

  useEffect(() => {
    traerIniciativasResumenMadrid().then(setResumen).catch(() => setResumen([]));
  }, []);

  useEffect(() => {
    if (!pedirLeyes) return;
    traerLeyesMadrid().then(setLeyes).catch(() => setLeyes([]));
  }, [pedirLeyes]);

  useEffect(() => {
    if (q.trim().length >= 3) setPedirLeyes(true);
  }, [q]);

  const cifras = useMemo(() => {
    const pp = diputados.filter(d => d.partido_siglas === 'PP').length;
    const leidas = diputados.filter(d => d.url_declaracion).length;
    const cuatro = diputados.filter(d => d.url_declaracion && d.fiable && Number(d.n_viviendas_equivalentes) >= 4).length;
    const pnl = resumen.filter(r => r.tipo_siglas === 'PNL');
    const opo = pnl.filter(r => r.siglas !== 'PP');
    const votadasOpo = opo.reduce((s, r) => s + r.votadas, 0);
    const aprobadasOpo = opo.reduce((s, r) => s + r.aprobadas, 0);
    const ppPnl = pnl.find(r => r.siglas === 'PP');
    return { pp, total: diputados.length, leidas, cuatro, votadasOpo, aprobadasOpo, ppPnl };
  }, [diputados, resumen]);

  const resultados = useMemo(() => {
    const t = normal(q.trim());
    if (t.length < 3) return null;
    const dips = diputados.filter(d => normal(`${d.nombre_completo} ${d.partido_siglas ?? ''} ${d.cargos ?? ''}`).includes(t)).slice(0, 8);
    const inis = leyes.filter(l => normal(`${l.asunto} ${l.tipo_siglas} ${l.exp_reg}/${l.exp_ano}`).includes(t));
    return { dips, inis: inis.slice(0, 12), totalInis: inis.length };
  }, [q, diputados, leyes]);

  return (
    <div>
      <Marco p={P} quieto={quieto} estrecho={estrecho} formas
        antetitulo="Asamblea de Madrid · XIII legislatura"
        titulo="Lo que tienen, lo que presentan y lo que aprueban"
        accion={<button className="bh-chip" onClick={() => onIr('diputados')}>Los 135 diputados →</button>}>
        <div className="bh-cuerpo">
          <label htmlFor="busca-madrid" className="bh-mono" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8 }}>
            Busca un diputado o una iniciativa
          </label>
          <input id="busca-madrid" className="bh-input" value={q} onChange={e => setQ(e.target.value)} onFocus={() => setPedirLeyes(true)}
            placeholder="Un nombre, o un tema: vivienda, sanidad, Metro, impuestos…" autoComplete="off" />

          {resultados && (
            <div style={{ display: 'grid', gridTemplateColumns: estrecho ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: 20, marginTop: 18 }}>
              <div>
                <div className="bh-mono" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Diputados · {resultados.dips.length}</div>
                <div className="bh-lista">
                  {resultados.dips.map(d => (
                    <button key={d.id_asamblea} onClick={() => onFicha(d)}
                      style={{ display: 'grid', gridTemplateColumns: '6px 1fr auto', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none', padding: '9px 2px', cursor: 'pointer', color: P.negro }}>
                      <span style={{ height: 26, background: d.color }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{d.nombre_completo}</span>
                        <span className="bh-mono" style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0, color: P.gris }}>{d.partido_siglas ?? d.grupo}</span>
                      </span>
                      <span className="bh-mono" style={{ fontSize: 10.5, textTransform: 'none', letterSpacing: 0 }}>
                        {d.n_inmuebles_equivalentes != null ? `${String(Math.round(d.n_inmuebles_equivalentes * 10) / 10).replace('.', ',')} prop.` : ''}
                      </span>
                    </button>
                  ))}
                  {!resultados.dips.length && <div style={{ padding: '9px 2px', fontSize: 13, color: P.gris }}>Ningún diputado con ese nombre.</div>}
                </div>
              </div>
              <div>
                <div className="bh-mono" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                  Leyes y proposiciones no de ley · {resultados.totalInis}
                </div>
                <div className="bh-lista">
                  {resultados.inis.map(l => {
                    const estado = ESTADO[l.resultado] ?? ESTADO[l.estado] ?? String(l.estado ?? '').toLowerCase();
                    return (
                      <div key={l.clave} style={{ padding: '9px 2px' }}>
                        <div style={{ fontSize: 13.5, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.asunto}</div>
                        <div className="bh-mono" style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0, color: P.gris, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: l.resultado === 'APROBADA' ? '#1F6B45' : l.resultado === 'RECHAZADA' ? '#9A2F22' : P.gris }}>{estado}</span>
                          <span>{NOMBRE_TIPO[l.tipo_siglas] ?? l.tipo_siglas} {l.exp_reg}/{l.exp_ano}</span>
                          <span>{l.autor === 'GOBIERNO' ? 'Gobierno regional' : l.autor ?? ''}</span>
                          {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: P.c }}>expediente ↗</a>}
                        </div>
                      </div>
                    );
                  })}
                  {!resultados.inis.length && <div style={{ padding: '9px 2px', fontSize: 13, color: P.gris }}>Ninguna ley ni PNL con esas palabras en el asunto.</div>}
                </div>
                {resultados.totalInis > resultados.inis.length && (
                  <button className="bh-chip" style={{ marginTop: 10 }} onClick={() => onIr('leyes')}>Ver todas en Leyes →</button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: borde(P), padding: estrecho ? 14 : '20px 24px 24px', display: 'grid', gridTemplateColumns: estrecho ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: estrecho ? 12 : 18 }}>
          <Cifra fondo={P.a} tinta="#FFFFFF" valor={`${cifras.pp} de ${cifras.total || 135}`} texto="escaños son del PP: mayoría absoluta" pie="Gobierna sin necesitar a ningún otro grupo" />
          <Cifra fondo={P.b} tinta={P.negro} valor={cifras.votadasOpo ? `${cifras.aprobadasOpo} de ${cifras.votadasOpo}` : '—'}
            texto="proposiciones no de ley de la oposición aprobadas"
            pie={cifras.ppPnl ? `Del PP: ${cifras.ppPnl.aprobadas} de ${cifras.ppPnl.votadas}` : ''} />
          <Cifra fondo={P.c} tinta="#FFFFFF" valor={String(cifras.cuatro)} texto="diputados declaran el equivalente a cuatro o más viviendas" pie="A su nombre, contando la parte que poseen" />
          <Cifra fondo={P.papel} tinta={P.negro} valor={`${cifras.leidas} de ${cifras.total || 135}`} texto="declaraciones de bienes leídas" pie="Cada cifra enlaza a su PDF oficial" />
        </div>
      </Marco>

      <motion.div initial={quieto ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <Hallazgos paleta="madrid" traer={traerHallazgosMadrid} onIr={s => onIr(s === 'leyes' ? 'leyes' : 'diputados')} />
      </motion.div>
    </div>
  );
}
