import React, { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Marco, Cifra, PALETAS, borde } from './Bauhaus.jsx';
import { traerVotacionesAndalucia } from '../lib/cliente.js';
import { useTelefono } from '../lib/pantalla.js';
import { TIPO_INICIATIVA, tituloLegible, fechaCorta, decimal } from '../lib/andalucia-web.js';

const P = PALETAS.andalucia;
const MAYORIA = 55;
const MUNICIPAL = /alcald|concejal|teniente|ayunt|ayto/i;
const INICIO_MANDATO_MUNICIPAL = 2023;

function anyoCargo(t) {
  const m = String(t).match(/(\d{4})(?!.*\d{4})/);
  return m ? Number(m[1]) : null;
}

function normal(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function AndaluciaInicio({ diputados, partidos, onFicha, onIr }) {
  const quieto = useReducedMotion();
  const estrecho = useTelefono();
  const [q, setQ] = useState('');
  const [votaciones, setVotaciones] = useState([]);

  useEffect(() => {
    traerVotacionesAndalucia(13).then(setVotaciones).catch(() => setVotaciones([]));
  }, []);

  const cifras = useMemo(() => {
    const total = diputados.length;
    const primero = partidos[0];
    const gobierno = diputados.filter(d => d.cargo);
    const enGobierno = new Map();
    for (const d of gobierno) enGobierno.set(d.partido_siglas, (enGobierno.get(d.partido_siglas) ?? 0) + 1);
    const cuatro = diputados.filter(d => Number(d.n_viviendas_equivalentes) >= 4).length;
    const municipales = diputados.filter(d => (Array.isArray(d.cargos_publicos) ? d.cargos_publicos : [])
      .some(c => MUNICIPAL.test(c) && anyoCargo(c) >= INICIO_MANDATO_MUNICIPAL));
    const porPartido = new Map();
    for (const d of municipales) porPartido.set(d.partido_siglas, (porPartido.get(d.partido_siglas) ?? 0) + 1);
    const municipalesPartidos = [...porPartido.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · ');
    const socios = partidos.filter(p => enGobierno.has(p.siglas) && p.siglas !== primero?.siglas);
    const sumaGobierno = partidos.filter(p => enGobierno.has(p.siglas)).reduce((s, p) => s + p.n, 0);
    return { total, primero, gobierno: gobierno.length, enGobierno: [...enGobierno.entries()].sort((a, b) => b[1] - a[1]), socios, sumaGobierno, cuatro, municipales: municipales.length, municipalesPartidos };
  }, [diputados, partidos, votaciones]);

  const resultados = useMemo(() => {
    const t = normal(q.trim());
    if (t.length < 3) return null;
    const dips = diputados.filter(d => normal(`${d.nombre_completo} ${d.partido_siglas ?? ''} ${d.circunscripcion ?? ''}`).includes(t)).slice(0, 8);
    const vots = votaciones.filter(v => normal(`${v.titulo_general} ${v.titulo_particular ?? ''}`).includes(t));
    return { dips, vots: vots.slice(0, 10), totalVots: vots.length };
  }, [q, diputados, votaciones]);

  const primero = cifras.primero;
  const faltan = primero ? MAYORIA - primero.n : null;

  return (
    <div>
      <Marco p={P} quieto={quieto} estrecho={estrecho} formas
        antetitulo="Parlamento de Andalucía · XIII legislatura"
        titulo="Lo que tienen, lo que votan y quién gobierna"
        accion={<button className="bh-chip" onClick={() => onIr('diputados')}>Los {cifras.total || 109} diputados →</button>}>
        <div className="bh-cuerpo">
          <label htmlFor="busca-andalucia" className="bh-mono" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 8 }}>
            Busca un diputado o una votación
          </label>
          <input id="busca-andalucia" className="bh-input" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Un nombre, una provincia o un tema: vivienda, sanidad, agua…" autoComplete="off" />

          {resultados && (
            <div style={{ display: 'grid', gridTemplateColumns: estrecho ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: 20, marginTop: 18 }}>
              <div>
                <div className="bh-mono" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Diputados · {resultados.dips.length}</div>
                <div className="bh-lista">
                  {resultados.dips.map(d => (
                    <button key={d.id_externo} onClick={() => onFicha(d)}
                      style={{ display: 'grid', gridTemplateColumns: '6px 1fr auto', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left',
                        background: 'transparent', border: 'none', padding: '9px 2px', cursor: 'pointer', color: P.negro }}>
                      <span style={{ height: 26, background: d.color }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{d.nombre_completo}</span>
                        <span className="bh-mono" style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0, color: P.gris }}>{d.partido_siglas} · {d.circunscripcion}</span>
                      </span>
                      <span className="bh-mono" style={{ fontSize: 10.5, textTransform: 'none', letterSpacing: 0 }}>
                        {d.n_inmuebles_equivalentes != null ? `${decimal(d.n_inmuebles_equivalentes)} prop.` : ''}
                      </span>
                    </button>
                  ))}
                  {!resultados.dips.length && <div style={{ padding: '9px 2px', fontSize: 13, color: P.gris }}>Ningún diputado con ese nombre.</div>}
                </div>
              </div>
              <div>
                <div className="bh-mono" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Votaciones de la XIII · {resultados.totalVots}</div>
                <div className="bh-lista">
                  {resultados.vots.map(v => (
                    <div key={v.id} style={{ padding: '9px 2px' }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tituloLegible(v)}</div>
                      <div className="bh-mono" style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0, color: P.gris, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: v.resultado === 'aprobada' ? '#1F6B45' : v.resultado === 'rechazada' ? '#9A2F22' : P.gris }}>{v.resultado}</span>
                        <span>{TIPO_INICIATIVA[v.tipo_iniciativa] ?? v.tipo_iniciativa ?? ''}</span>
                        <span>{fechaCorta(v.fecha)}</span>
                        <span>{v.si} sí · {v.no} no · {v.abstencion ?? 0} abst.</span>
                      </div>
                    </div>
                  ))}
                  {!resultados.vots.length && <div style={{ padding: '9px 2px', fontSize: 13, color: P.gris }}>Ninguna votación con esas palabras.</div>}
                </div>
                {resultados.totalVots > resultados.vots.length && (
                  <button className="bh-chip" style={{ marginTop: 10 }} onClick={() => onIr('leyes')}>Ver todas en Leyes →</button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: borde(P), padding: estrecho ? 14 : '20px 24px 24px', display: 'grid', gridTemplateColumns: estrecho ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: estrecho ? 12 : 18 }}>
          <Cifra fondo={P.a} tinta="#FFFFFF" valor={primero ? `${primero.n} de ${cifras.total || 109}` : '—'}
            texto={primero ? `escaños son del ${primero.siglas}${faltan > 0 ? ': sin mayoría absoluta' : ': mayoría absoluta'}` : 'escaños'}
            pie={faltan > 0
              ? (cifras.socios.length
                ? `Gobierna en coalición con ${cifras.socios.map(p => p.siglas).join(' y ')}: juntos suman ${cifras.sumaGobierno} de ${cifras.total}`
                : `Le faltan ${faltan} para los ${MAYORIA} de la mayoría absoluta`)
              : 'Gobierna sin necesitar a ningún otro grupo'} />
          <Cifra fondo={P.b} tinta={P.negro} valor={String(cifras.gobierno)}
            texto={cifras.gobierno === 1 ? 'diputado forma parte también del Gobierno andaluz' : 'diputados forman parte también del Gobierno andaluz'}
            pie={`Son miembros del Consejo de Gobierno de la Junta y a la vez votan en este Parlamento · ${cifras.enGobierno.map(([s, n]) => `${s} ${n}`).join(' · ')}`} />
          <Cifra fondo={P.c} tinta="#FFFFFF" valor={String(cifras.cuatro)}
            texto={cifras.cuatro === 1 ? 'diputado declara el equivalente a cuatro o más viviendas' : 'diputados declaran el equivalente a cuatro o más viviendas'}
            pie="Contando solo la parte que poseen" />
          <Cifra fondo={P.papel} tinta={P.negro} valor={String(cifras.municipales)}
            texto={cifras.municipales === 1 ? 'diputado era alcalde o concejal cuando se presentó' : 'diputados eran alcaldes o concejales cuando se presentaron'}
            pie={`Cargo del mandato municipal que empezó en ${INICIO_MANDATO_MUNICIPAL}, según su declaración de bienes${cifras.municipalesPartidos ? ` · ${cifras.municipalesPartidos}` : ''}`} />
        </div>
      </Marco>
    </div>
  );
}
