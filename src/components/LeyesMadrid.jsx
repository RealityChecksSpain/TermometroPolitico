import React, { useEffect, useMemo, useState } from 'react';
import { traerLeyesMadrid } from '../lib/cliente.js';

const estilos = `
.lmTabla{width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0 16px}
.lmTabla th{font-weight:600;color:#121A24;font-size:10px;text-transform:uppercase;letter-spacing:.06em;text-align:right;padding:6px 8px;border-bottom:3px solid #121A24}
.lmTabla th:first-child,.lmTabla td:first-child{text-align:left}
.lmTabla td{padding:7px 8px;border-bottom:1px solid #EFECE2;text-align:right;font-variant-numeric:tabular-nums}
.lmFila{padding:11px 0;border-top:2px solid #121A24;display:grid;grid-template-columns:4px minmax(0,1fr);gap:10px}
.lmFila:last-child{border-bottom:2px solid #121A24}
.lmAsunto{font-size:13.5px;line-height:1.45;color:#14161A;cursor:pointer;background:none;border:0;padding:0;text-align:left;font-family:inherit}
.lmAsunto:hover{text-decoration:underline}
.lmCorto{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.lmMeta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:10.5px;color:#7C8288;margin-top:5px}
.lmEstado{font-size:10px;padding:1px 6px;border:1.5px solid #121A24;text-transform:uppercase;letter-spacing:.04em}
.lmFiltros{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center}
`;

const TIPOS = [
  ['leyes', 'Leyes', t => t === 'PL' || t === 'PROPL'],
  ['pnl', 'Proposiciones no de ley', t => t === 'PNL']
];

const RESULTADOS = [
  ['todas', 'Todas', () => true],
  ['aprobada', 'Aprobadas', l => l.resultado === 'APROBADA'],
  ['rechazada', 'Rechazadas', l => l.resultado === 'RECHAZADA'],
  ['sin', 'Sin votar', l => l.resultado !== 'APROBADA' && l.resultado !== 'RECHAZADA']
];

const ESTADO = {
  APROBADA: ['aprobada', '#DDEFE5', '#1F6B45'],
  RECHAZADA: ['rechazada', '#F7E0DC', '#9A2F22'],
  PENDIENTE: ['pendiente', '#EFEFE9', '#5A6067'],
  CALIFICADA: ['calificada', '#EFEFE9', '#5A6067'],
  DECAIDA: ['decaída', '#F3EEE2', '#6B5518'],
  RETIRADA: ['retirada', '#F3EEE2', '#6B5518'],
  'NO ADMITIDA': ['no admitida', '#F3EEE2', '#6B5518'],
  TRANSFORMADA: ['transformada', '#EFEFE9', '#5A6067'],
  ARCHIVADA: ['archivada', '#EFEFE9', '#5A6067'],
  ASUMIDA: ['asumida', '#EFEFE9', '#5A6067']
};

const NOMBRE_TIPO = { PL: 'Proyecto de ley', PROPL: 'Proposición de ley', PNL: 'PNL' };

function estadoDe(l) {
  return ESTADO[l.resultado] ?? ESTADO[l.estado] ?? [String(l.estado ?? 'sin estado').toLowerCase(), '#EFEFE9', '#5A6067'];
}

function fecha(iso) {
  return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : null;
}

function autorCorto(a) {
  if (!a) return 'Sin autor en los datos';
  if (a === 'GOBIERNO') return 'Gobierno regional';
  if (a === 'INICIATIVA POPULAR O MUNICIPAL') return 'Iniciativa popular o municipal';
  return a;
}

export default function LeyesMadrid({ colores, onAbrir }) {
  const [leyes, setLeyes] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [tipo, setTipo] = useState('leyes');
  const [autor, setAutor] = useState(null);
  const [resultado, setResultado] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [cuantas, setCuantas] = useState(40);

  useEffect(() => {
    traerLeyesMadrid()
      .then(l => { setLeyes(l); setEstado(l.length ? 'listo' : 'vacio'); })
      .catch(() => setEstado('error'));
  }, []);

  useEffect(() => { setCuantas(40); }, [tipo, autor, resultado, busqueda]);

  const delTipo = useMemo(() => {
    const f = TIPOS.find(t => t[0] === tipo)[2];
    return leyes.filter(l => f(l.tipo_siglas));
  }, [leyes, tipo]);

  const resumen = useMemo(() => {
    const m = new Map();
    for (const l of delTipo) {
      const k = l.autor ?? 'SIN AUTOR';
      const v = m.get(k) ?? { autor: k, presentadas: 0, votadas: 0, aprobadas: 0 };
      v.presentadas++;
      if (l.resultado === 'APROBADA' || l.resultado === 'RECHAZADA') v.votadas++;
      if (l.resultado === 'APROBADA') v.aprobadas++;
      m.set(k, v);
    }
    return [...m.values()].sort((a, b) => b.presentadas - a.presentadas);
  }, [delTipo]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const r = RESULTADOS.find(x => x[0] === resultado)[2];
    return delTipo.filter(l =>
      (!autor || (l.autor ?? 'SIN AUTOR') === autor) && r(l) &&
      (!q || String(l.asunto ?? '').toLowerCase().includes(q) || `${l.tipo_siglas} ${l.exp_reg}/${l.exp_ano}`.toLowerCase().includes(q)));
  }, [delTipo, autor, resultado, busqueda]);

  const color = a => colores?.get(a) ?? (a === 'GOBIERNO' ? '#14161A' : '#8E9299');

  if (estado === 'cargando') return <p className="pie">Cargando iniciativas…</p>;
  if (estado === 'error') return <p className="pie">No se pueden leer las iniciativas de la Asamblea ahora mismo.</p>;
  if (estado === 'vacio') return <p className="pie">Todavía no hay iniciativas de la Asamblea de Madrid cargadas.</p>;

  return (
    <div>
      <style>{estilos}</style>
      <div className="lmFiltros">
        {TIPOS.map(([k, t]) => (
          <button key={k} className="bh-chip" data-on={tipo === k ? '1' : '0'} onClick={() => { setTipo(k); setAutor(null); }}>{t}</button>
        ))}
      </div>

      <table className="lmTabla">
        <thead>
          <tr><th>Quién la presentó</th><th>Presentadas</th><th>Votadas</th><th>Aprobadas</th></tr>
        </thead>
        <tbody>
          {resumen.map(r => (
            <tr key={r.autor} style={{ cursor: 'pointer', background: autor === r.autor ? '#E3EAF2' : 'transparent' }}
              onClick={() => setAutor(autor === r.autor ? null : r.autor)}>
              <td>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: color(r.autor), marginRight: 7 }} />
                {autorCorto(r.autor === 'SIN AUTOR' ? null : r.autor)}
              </td>
              <td>{r.presentadas}</td>
              <td>{r.votadas}</td>
              <td><strong>{r.aprobadas}</strong>{r.votadas ? <span style={{ color: '#7C8288' }}> de {r.votadas}</span> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="lmFiltros">
        {RESULTADOS.map(([k, t]) => (
          <button key={k} className="bh-chip" data-on={resultado === k ? '1' : '0'} onClick={() => setResultado(k)}>{t}</button>
        ))}
        {autor && <button className="bh-chip" data-on="1" onClick={() => setAutor(null)}>{autorCorto(autor === 'SIN AUTOR' ? null : autor)} ×</button>}
        <input className="bh-input madBusca" placeholder="Buscar en el asunto" value={busqueda}
          onChange={e => setBusqueda(e.target.value)} aria-label="Buscar iniciativa de la Asamblea" />
      </div>

      <div className="em" style={{ fontSize: 10.5, color: '#7C8288', marginBottom: 6 }}>{lista.length} iniciativas</div>

      <div>
        {lista.slice(0, cuantas).map(l => {
          const [txt, fondo, tinta] = estadoDe(l);
          return (
            <div key={l.clave} className="lmFila">
              <span style={{ width: 4, background: color(l.autor), borderRadius: 2 }} />
              <div style={{ minWidth: 0 }}>
                <button className="lmAsunto lmCorto" onClick={() => onAbrir(l)}>
                  {l.asunto ?? 'Sin asunto en los datos'}
                </button>
                <div className="lmMeta em">
                  <span className="lmEstado" style={{ background: fondo, color: tinta }}>{txt}</span>
                  <span>{NOMBRE_TIPO[l.tipo_siglas] ?? l.tipo_siglas} {l.exp_reg}/{l.exp_ano}</span>
                  <span>{autorCorto(l.autor)}</span>
                  {l.tipo_siglas !== 'PNL' && l.num_ley && l.num_ley !== '-' && <span>Ley {l.num_ley}</span>}
                  {l.tipo_siglas === 'PNL' && l.organo && l.organo !== '-' && <span>{l.organo}</span>}
                  {l.fecha && <span>{fecha(l.fecha)}</span>}
                  {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3C63A0' }}>expediente ↗</a>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {lista.length > cuantas && (
        <button className="bh-chip" style={{ marginTop: 12 }} onClick={() => setCuantas(c => c + 60)}>
          Ver más ({lista.length - cuantas} restantes)
        </button>
      )}

      <details className="bh-mas">

        <summary>Cómo se calcula y de dónde sale</summary>

        <div>
        Fuente: catálogo de expedientes y autoría por grupo de los datos abiertos de la Asamblea de Madrid, XIII legislatura. El asunto es el texto literal del expediente.
        «Votadas» son las que tienen resultado de tramitación aprobada o rechazada; el resto siguen pendientes, decayeron, se retiraron o no se admitieron.
        Los proyectos de ley los presenta el Gobierno regional; las proposiciones de ley y las proposiciones no de ley, los grupos.
        Las iniciativas legislativas populares y de ayuntamientos no se atribuyen a ningún grupo aunque el fichero las asigne a uno.
        La fecha es la que da el expediente en los datos abiertos.
        La Asamblea no publica cómo vota cada diputado ni cada grupo: el resultado es el de la cámara, donde el PP tiene mayoría absoluta desde 2023.
        Al abrir una iniciativa, «Qué dice» y «Si esto te afecta» son un resumen automático de su texto oficial (la ley publicada en el Boletín de la Asamblea si se aprobó; si no, el texto presentado), hecho con un modelo de lenguaje con reglas fijas: solo lo que dice el texto, sin valorar. Los colectivos se eligen de una lista cerrada, la misma que en el Congreso.

        </div>

      </details>
    </div>
  );
}
