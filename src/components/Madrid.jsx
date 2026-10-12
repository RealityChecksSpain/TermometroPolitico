import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Hallazgos from './Hallazgos.jsx';
import Hemiciclo from './Hemiciclo.jsx';
import { traerDiputadosMadrid, traerHallazgosMadrid } from '../lib/cliente.js';

const FichaMadrid = lazy(() => import('./FichaMadrid.jsx'));
const LeyesMadrid = lazy(() => import('./LeyesMadrid.jsx'));
const PartidosMadrid = lazy(() => import('./PartidosMadrid.jsx'));

const SECCIONES = [['diputados', 'Diputados'], ['leyes', 'Leyes'], ['partidos', 'Partidos']];

const estilos = `
.madCab{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:6px 0 4px}
.madPartidos{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 10px}
.madOrden{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center}
.madHemi{margin:14px 0 4px}
.madFila{cursor:pointer;display:grid;grid-template-columns:4px minmax(0,1fr) auto;gap:10px;align-items:center;
padding:10px 12px;border-top:1px solid #E3DFD1}
.madFila:last-child{border-bottom:1px solid #E3DFD1}
.madFila:hover{background:#F8F6EE}
.madNombre{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.madMeta{font-size:10.5px;color:#7C8288;margin-top:2px;overflow:hidden;text-overflow:ellipsis}
.madDatos{display:flex;gap:14px;flex-wrap:wrap;text-align:right}
.madDatos a{color:#3C63A0;font-size:10.5px}
.madDudosa{font-size:9.5px;color:#8A6D1F;background:#F6E7B0;padding:1px 5px;border-radius:2px;margin-left:6px}
.madBusca{width:100%;max-width:320px;padding:8px 10px;border:1px solid #E3DFD1;border-radius:2px;font-size:13px;background:#fff}
@media(max-width:600px){.madDatos{gap:10px}.madFila{grid-template-columns:4px minmax(0,1fr)}.madDatos{grid-column:2;justify-content:flex-start;text-align:left}}
`;

const ORDENES = [
  ['inmuebles', 'Más propiedades'],
  ['viviendas', 'Más viviendas'],
  ['faltas', 'Más faltas a Pleno'],
  ['nombre', 'Nombre']
];

function numero(v) {
  if (v == null) return '—';
  return String(Math.round(Number(v) * 10) / 10).replace('.', ',');
}

export default function Madrid() {
  const [diputados, setDiputados] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [partido, setPartido] = useState(null);
  const [orden, setOrden] = useState('inmuebles');
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState(null);
  const [seccion, setSeccion] = useState('diputados');

  useEffect(() => {
    traerDiputadosMadrid()
      .then(d => { setDiputados(d.map(x => ({ ...x, mandato_id: x.id_asamblea }))); setEstado(d.length ? 'listo' : 'vacio'); })
      .catch(() => setEstado('error'));
  }, []);

  const partidos = useMemo(() => {
    const m = new Map();
    for (const d of diputados) {
      const k = d.partido_siglas ?? 'SIN PARTIDO';
      const v = m.get(k) ?? { siglas: k, color: d.color, n: 0 };
      v.n++;
      m.set(k, v);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [diputados]);

  const colores = useMemo(() => new Map(partidos.map(p => [p.siglas, p.color])), [partidos]);

  const leidas = diputados.filter(d => d.url_declaracion).length;

  const escanos = useMemo(() => {
    const puesto = new Map(partidos.map((p, i) => [p.siglas, i]));
    return [...diputados].sort((a, b) =>
      (puesto.get(a.partido_siglas ?? 'SIN PARTIDO') - puesto.get(b.partido_siglas ?? 'SIN PARTIDO')) ||
      a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
  }, [diputados, partidos]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = diputados.filter(d =>
      (!partido || (d.partido_siglas ?? 'SIN PARTIDO') === partido) &&
      (!q || d.nombre_completo.toLowerCase().includes(q)));
    const clave = orden === 'viviendas' ? 'n_viviendas_equivalentes' : orden === 'faltas' ? 'plenos_faltados' : 'n_inmuebles_equivalentes';
    return [...filtrados].sort((a, b) => orden === 'nombre'
      ? a.nombre_completo.localeCompare(b.nombre_completo, 'es')
      : (Number(b[clave] ?? -1) - Number(a[clave] ?? -1)) || a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
  }, [diputados, partido, orden, busqueda]);

  return (
    <div className="solo1" data-seccion={seccion}>
      <style>{estilos}</style>
      <div className="madCab">
        <h2 className="t1">Asamblea de Madrid</h2>
        <span className="em" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7C8288' }}>
          XIII legislatura{diputados.length ? ` · ${diputados.length} escaños` : ''}
        </span>
      </div>

      <nav className="nav" aria-label="Secciones de la Asamblea de Madrid">
        {SECCIONES.map(([k, t]) => (
          <button key={k} className="navb" data-on={seccion === k ? '1' : '0'} onClick={() => setSeccion(k)}>{t}</button>
        ))}
      </nav>

      <Hallazgos traer={traerHallazgosMadrid} onIr={s => setSeccion(s === 'leyes' ? 'leyes' : 'diputados')} />

      {seccion === 'leyes' && (
        <Suspense fallback={<p className="pie">Cargando iniciativas…</p>}>
          <LeyesMadrid colores={colores} />
        </Suspense>
      )}

      {seccion === 'partidos' && estado === 'listo' && (
        <Suspense fallback={<p className="pie">Cargando partidos…</p>}>
          <PartidosMadrid diputados={diputados} partidos={partidos} />
        </Suspense>
      )}

      {seccion !== 'leyes' && estado === 'cargando' && <p className="pie">Cargando diputados…</p>}
      {seccion !== 'leyes' && estado === 'error' && <p className="pie">No se pueden leer los datos de la Asamblea ahora mismo.</p>}
      {seccion !== 'leyes' && estado === 'vacio' && <p className="pie">Todavía no hay datos de la Asamblea de Madrid cargados.</p>}

      {seccion === 'diputados' && estado === 'listo' && (
        <>
          <div className="hero madHemi">
            <div className="madPartidos" style={{ marginTop: 0 }}>
              <button className="chip" data-on={partido ? '0' : '1'} onClick={() => setPartido(null)}>Todos {diputados.length}</button>
              {partidos.map(p => (
                <button key={p.siglas} className="chip" data-on={partido === p.siglas ? '1' : '0'}
                  onClick={() => setPartido(partido === p.siglas ? null : p.siglas)}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: p.color, display: 'inline-block' }} />
                  {p.siglas} {p.n}
                </button>
              ))}
            </div>
            <Hemiciclo
              diputados={escanos}
              resaltado={partido ? d => (d.partido_siglas ?? 'SIN PARTIDO') === partido : null}
              seleccionado={sel?.id_asamblea}
              onSeleccionar={setSel}
            />
            <div className="em" style={{ fontSize: 10, color: '#8E959C', marginTop: 6 }}>
              Escaños agrupados por número de diputados de cada grupo, no por ideología: la Asamblea no publica cómo vota cada diputado.
            </div>
          </div>

          <div className="madOrden">
            {ORDENES.map(([k, t]) => (
              <button key={k} className="chip" data-on={orden === k ? '1' : '0'} onClick={() => setOrden(k)}>{t}</button>
            ))}
            <input className="madBusca" placeholder="Buscar diputado" value={busqueda}
              onChange={e => setBusqueda(e.target.value)} aria-label="Buscar diputado de la Asamblea" />
          </div>

          <div className="tarjeta" style={{ border: 0, background: 'transparent', boxShadow: 'none' }}>
            {lista.map(d => (
              <div key={d.id_asamblea} className="madFila" role="button" tabIndex={0}
                onClick={() => setSel(d)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(d); } }}>
                <span style={{ width: 4, height: 30, background: d.color, borderRadius: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="madNombre">
                    {d.nombre_completo}
                    {d.url_declaracion && !d.fiable && <span className="madDudosa em">lectura dudosa</span>}
                  </div>
                  <div className="madMeta em">
                    {d.partido_siglas ?? d.grupo ?? 'Sin grupo'}{d.cargos ? ` · ${d.cargos}` : ''}
                  </div>
                </div>
                <div className="madDatos">
                  <div>
                    <div className="dato" style={{ fontSize: 20 }}>{numero(d.n_inmuebles_equivalentes)}</div>
                    <span className="datoUnidad">propiedades</span>
                  </div>
                  <div>
                    <div className="dato" style={{ fontSize: 20 }}>{numero(d.n_viviendas_equivalentes)}</div>
                    <span className="datoUnidad">viviendas</span>
                  </div>
                  {d.plenos_convocado > 0 && d.plenos_faltados != null && (
                    <div title={`Faltó a ${d.plenos_faltados} de los ${d.plenos_convocado} Plenos celebrados desde su alta`}>
                      <div className="dato" style={{ fontSize: 20 }}>{d.plenos_faltados}</div>
                      <span className="datoUnidad">faltas a Pleno</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                    <a className="em" href={d.url_ficha} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>ficha ↗</a>
                    {d.url_declaracion && (
                      <a className="em" href={d.url_declaracion} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        declaración{d.fecha_declaracion ? ` ${d.fecha_declaracion.split('-').reverse().join('/')}` : ''} ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="pie" style={{ color: '#7C8288', marginTop: 14 }}>
            Fuente: fichas y declaraciones de bienes publicadas por la Asamblea de Madrid. {leidas} de {diputados.length} declaraciones leídas.
            Las declaraciones son escaneos y las lee un modelo de lenguaje; cada cifra enlaza a su PDF original para comprobarla.
            Cada propiedad cuenta por la parte que declara poseer: media casa es 0,5. Las de lectura dudosa no entran en los hallazgos.
            Las faltas salen de la lista oficial de asistentes a cada Pleno que publica la Asamblea en datos abiertos y cuentan solo los Plenos posteriores al alta de cada diputado. A la presidenta y a los consejeros no se les cuentan faltas: la lista oficial no los recoge en las sesiones ordinarias y daría ausencias que no son. Los senadores pueden faltar por la agenda del Senado: su cargo aparece junto al nombre.
            La Asamblea no publica en su web ni en datos abiertos cómo vota cada diputado: su página de votaciones está vacía.
          </p>
        </>
      )}

      {sel && (
        <Suspense fallback={null}>
          <FichaMadrid d={sel} onCerrar={() => setSel(null)} />
        </Suspense>
      )}
    </div>
  );
}
