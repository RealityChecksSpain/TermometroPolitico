import React, { useEffect, useMemo, useState } from 'react';
import Hemiciclo, { LeyendaVoto } from './Hemiciclo.jsx';
import Edad from './EdadAndalucia.jsx';
import { PALETAS } from './Bauhaus.jsx';
import { traerVotacionesAndalucia, traerVotosVotacionAndalucia, traerIniciativasAndalucia } from '../lib/cliente.js';
import { TIPO_INICIATIVA, SENTIDO, tituloLegible, fechaCorta, autoresDe, listaHumana } from '../lib/andalucia-web.js';

const P = PALETAS.andalucia;

const estilos = `
.vaFiltros{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;align-items:center}
.vaFila{border-top:2px solid ${P.negro};padding:12px 4px}
.vaFila:last-child{border-bottom:2px solid ${P.negro}}
.vaTitulo{background:none;border:0;padding:0;text-align:left;cursor:pointer;color:${P.negro};font-size:14.5px;font-weight:700;line-height:1.35;font-family:inherit}
.vaMeta{font-size:10.5px;color:${P.gris};margin-top:5px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.vaGrupos{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.vaGrupo{font-family:'DM Mono',ui-monospace,monospace;font-size:10px;padding:2px 7px;border:1.5px solid ${P.negro};display:inline-flex;gap:5px;align-items:center}
.vaRes{font-family:'DM Mono',ui-monospace,monospace;font-size:10px;font-weight:700;padding:2px 7px;color:#fff}
.vaDetalle{margin-top:12px;padding:12px;background:${P.crema};border:2px solid ${P.negro}}
.vaTabla{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
.vaTabla th,.vaTabla td{padding:5px 6px;border-bottom:1px solid #D5E2D9;text-align:right}
.vaTabla th:first-child,.vaTabla td:first-child{text-align:left}
.vaDetGrid{display:grid;gap:10px}
@media(min-width:900px){.vaDetGrid[data-hemi='1']{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px;align-items:start}.vaDetGrid[data-hemi='1'] .vaTabla{margin-top:0}}
.vaTitulo:hover{text-decoration:underline}
.vaBusca{max-width:280px;padding:8px 10px;font-size:14px;box-shadow:3px 3px 0 ${P.negro}}
`;

const RESULTADOS = [['todas', 'Todas'], ['aprobada', 'Ganó el sí'], ['rechazada', 'Ganó el no']];

export function VotosDeVotacion({ v, diputados, colores, legislatura }) {
  const [votos, setVotos] = useState(null);
  useEffect(() => {
    let vivo = true;
    traerVotosVotacionAndalucia(v.id).then(x => { if (vivo) setVotos(x); }).catch(() => { if (vivo) setVotos([]); });
    return () => { vivo = false; };
  }, [v.id]);

  const resumen = useMemo(() => {
    if (!votos) return null;
    const grupos = new Map();
    for (const vo of votos) {
      const k = vo.partido_siglas ?? vo.grupo ?? 'Sin grupo';
      const g = grupos.get(k) ?? { siglas: k, si: 0, no: 0, abstencion: 0, blanco: 0, ausente: 0 };
      g[vo.voto] = (g[vo.voto] ?? 0) + 1;
      grupos.set(k, g);
    }
    const mayoria = new Map([...grupos.values()].map(g => {
      const orden = ['si', 'no', 'abstencion'].sort((a, b) => g[b] - g[a]);
      return [g.siglas, orden[0]];
    }));
    const distintos = votos.filter(vo => ['si', 'no', 'abstencion'].includes(vo.voto) && mayoria.get(vo.partido_siglas ?? vo.grupo) !== vo.voto);
    return { grupos: [...grupos.values()].sort((a, b) => (b.si + b.no + b.abstencion + b.ausente) - (a.si + a.no + a.abstencion + a.ausente)), distintos };
  }, [votos]);

  if (!votos) return <div className="vaDetalle" style={{ fontSize: 12 }}>Cargando votos…</div>;

  const conHemiciclo = legislatura === 13 && votos.some(vo => vo.id_externo);
  const mapaVotos = votos.filter(vo => vo.id_externo).map(vo => ({ mandato_id: vo.id_externo, voto: vo.voto, votacion_id: v.id }));

  return (
    <div className="vaDetalle">
      <div className="vaDetGrid" data-hemi={conHemiciclo ? '1' : '0'}>
        {conHemiciclo && (
          <div style={{ background: P.negro, padding: '10px 10px 6px' }}>
            <LeyendaVoto totales={{
              si: mapaVotos.filter(x => x.voto === 'si').length,
              no: mapaVotos.filter(x => x.voto === 'no').length,
              abstencion: mapaVotos.filter(x => x.voto === 'abstencion').length,
              no_vota: mapaVotos.filter(x => !['si', 'no', 'abstencion'].includes(x.voto)).length
            }} />
            <Hemiciclo diputados={diputados} votos={mapaVotos} compacto />
          </div>
        )}
        <div>
          <table className="vaTabla">
            <thead><tr><th>Grupo</th><th>Sí</th><th>No</th><th>Abst.</th><th>Ausentes</th></tr></thead>
            <tbody>
              {resumen.grupos.map(g => (
                <tr key={g.siglas}>
                  <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: colores.get(g.siglas) ?? '#8E9299', marginRight: 6 }} />{g.siglas}</td>
                  <td>{g.si}</td><td>{g.no}</td><td>{g.abstencion}</td><td>{g.ausente}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {resumen.distintos.length > 0 && (
            <div style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
              <strong>Votaron distinto a su grupo:</strong>{' '}
              {resumen.distintos.map(vo => `${vo.nombre} (${vo.partido_siglas}, ${SENTIDO[vo.voto]?.texto.toLowerCase()})`).join('; ')}
            </div>
          )}
        </div>
      </div>
      <div className="em" style={{ fontSize: 10.5, marginTop: 10, color: P.gris }}>
        {v.titulo_particular ? `${v.titulo_particular} · ` : ''}Votación {v.numero} de la sesión {v.sesion}.{' '}
        {v.fuente_url && <a href={v.fuente_url} target="_blank" rel="noopener noreferrer" style={{ color: P.c }}>registro oficial de la votación ↗</a>}
      </div>
    </div>
  );
}

export default function VotacionesAndalucia({ colores, onAbrir }) {
  const [legislatura, setLegislatura] = useState(13);
  const [iniciativas, setIniciativas] = useState(new Map());
  const [todas, setTodas] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [resultado, setResultado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [cuantas, setCuantas] = useState(40);

  useEffect(() => {
    let vivo = true;
    setTodas(null);
    setCuantas(40);
    traerVotacionesAndalucia(legislatura).then(x => { if (vivo) setTodas(x); }).catch(() => { if (vivo) setTodas([]); });
    return () => { vivo = false; };
  }, [legislatura]);

  useEffect(() => {
    traerIniciativasAndalucia().then(setIniciativas).catch(() => {});
  }, []);

  const hermanas = useMemo(() => {
    const m = new Map();
    for (const v of todas ?? []) {
      if (!v.expediente) continue;
      const k = `${v.expediente}|${v.sesion}`;
      const l = m.get(k) ?? [];
      l.push(v);
      m.set(k, l);
    }
    for (const l of m.values()) l.sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
    return m;
  }, [todas]);

  const tipos = useMemo(() => {
    const c = new Map();
    for (const v of todas ?? []) if (v.tipo_iniciativa) c.set(v.tipo_iniciativa, (c.get(v.tipo_iniciativa) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [todas]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (todas ?? []).filter(v =>
      (!tipo || v.tipo_iniciativa === tipo) &&
      (resultado === 'todas' || v.resultado === resultado) &&
      (!q || `${v.titulo_general} ${v.titulo_particular ?? ''}`.toLowerCase().includes(q)));
  }, [todas, tipo, resultado, busqueda]);

  return (
    <div>
      <style>{estilos}</style>
      <div className="vaFiltros">
        <button className="bh-chip" data-on={legislatura === 13 ? '1' : '0'} onClick={() => setLegislatura(13)}>XIII legislatura (desde 2026)</button>
        <button className="bh-chip" data-on={legislatura === 12 ? '1' : '0'} onClick={() => setLegislatura(12)}>XII legislatura (2022-2026)</button>
      </div>
      <div className="vaFiltros">
        <button className="bh-chip" data-on={tipo ? '0' : '1'} onClick={() => setTipo(null)}>Todos los tipos</button>
        {tipos.map(([t, n]) => (
          <button key={t} className="bh-chip" data-on={tipo === t ? '1' : '0'} onClick={() => setTipo(tipo === t ? null : t)}>{TIPO_INICIATIVA[t] ?? t} {n}</button>
        ))}
      </div>
      <div className="vaFiltros">
        {RESULTADOS.map(([k, t]) => (
          <button key={k} className="bh-chip" data-on={resultado === k ? '1' : '0'} onClick={() => setResultado(k)}>{t}</button>
        ))}
        <input className="bh-input vaBusca" placeholder="Buscar en el título" value={busqueda} onChange={e => setBusqueda(e.target.value)} aria-label="Buscar votación" />
      </div>

      {todas == null && <p style={{ fontSize: 12, color: P.gris }}>Cargando votaciones…</p>}
      {todas && !todas.length && <p style={{ fontSize: 12, color: P.gris }}>Todavía no hay votaciones cargadas de esta legislatura.</p>}
      {todas && todas.length > 0 && <div className="em" style={{ fontSize: 10.5, color: P.gris, marginBottom: 6 }}>{lista.length} votaciones del Pleno</div>}

      <div>
        {lista.slice(0, cuantas).map(v => (
          <div key={v.id} className="vaFila">
            <button className="vaTitulo" onClick={() => onAbrir(v)}>
              {tituloLegible(v)}
            </button>
            <div className="vaMeta em">
              <Edad legislatura={v.legislatura} />
              <span className="vaRes" style={{ background: v.resultado === 'aprobada' ? '#1F7A45' : v.resultado === 'rechazada' ? '#B23A2E' : P.gris }}>{v.resultado === 'aprobada' ? 'ganó el sí' : v.resultado === 'rechazada' ? 'ganó el no' : v.resultado}</span>
              <span>{v.si} sí · {v.no} no · {v.abstencion ?? 0} abst.</span>
              {(() => {
                const l = hermanas.get(`${v.expediente}|${v.sesion}`);
                return l && l.length > 1 && !v.titulo_particular ? <span>votación {l.indexOf(v) + 1} de {l.length} de este debate</span> : null;
              })()}
              {v.titulo_particular && <span style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titulo_particular}</span>}
            </div>
            <div className="vaMeta em" style={{ marginTop: 3 }}>
              {iniciativas.get(v.expediente)?.estado && <span>Iniciativa: <strong>{iniciativas.get(v.expediente).estado.toLowerCase()}</strong></span>}
              {iniciativas.get(v.expediente)?.proponente && <span>De {listaHumana(autoresDe(iniciativas.get(v.expediente).proponente))}</span>}
              <span>{TIPO_INICIATIVA[v.tipo_iniciativa] ?? v.tipo_iniciativa ?? ''}</span>
              <span>{fechaCorta(v.fecha)}</span>
            </div>
            {v.voto_grupos && (
              <div className="vaGrupos">
                {Object.entries(v.voto_grupos).map(([s, voto]) => (
                  <span key={s} className="vaGrupo" title={`${s}: ${SENTIDO[voto]?.texto ?? voto}`}>
                    <span style={{ width: 7, height: 7, borderRadius: 7, background: colores.get(s) ?? '#8E9299' }} />
                    {s}: <strong style={{ color: SENTIDO[voto]?.color }}>{SENTIDO[voto]?.texto ?? voto}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {lista.length > cuantas && (
        <button className="bh-chip" style={{ marginTop: 12 }} onClick={() => setCuantas(c => c + 40)}>Ver 40 más</button>
      )}

      <details className="bh-mas">
        <summary>Cómo se calcula y de dónde sale</summary>
        <div>
          <span>Fuente: registro electrónico de las votaciones del Pleno que publica el Parlamento de Andalucía en «Sentido del voto», con el voto de cada diputado. Para la versión definitiva, el propio Parlamento remite al Diario de Sesiones.</span>
          <span>Una misma iniciativa puede votarse varias veces: por puntos, enmiendas o artículos. Cada votación aparece por separado.</span>
          <span>«Ganó el sí» o «ganó el no» compara síes y noes de esa votación. En un mismo debate puede haber varias (enmiendas, puntos o el texto completo) y el registro oficial no dice cuál es cuál: lo que pasó con la iniciativa lo dice su estado oficial («Iniciativa: aprobado»). Algunas votaciones exigen una mayoría especial, como la absoluta; en ese caso, el Diario de Sesiones da el resultado oficial.</span>
          <span>La postura de cada grupo es la de la mayoría de sus diputados que votaron. Quien delega el voto cuenta con el sentido que delegó.</span>
          <span>Al abrir una votación: quién presentó la iniciativa, su estado y sus trámites salen de la ficha oficial del Parlamento. «Qué dice» y «Si esto te afecta» son un resumen automático del texto publicado en el Boletín Oficial del Parlamento de Andalucía, hecho con un modelo de lenguaje con reglas fijas: solo lo que dice el texto, sin valorar ni atribuir intenciones. Los colectivos se eligen de una lista cerrada, la misma que en el Congreso.</span>
          <span>«Nueva» marca lo votado en la legislatura que empezó en 2026; «Anterior», lo de 2022 a 2026.</span>
        </div>
      </details>
    </div>
  );
}
