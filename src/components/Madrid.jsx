import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import Hemiciclo from './Hemiciclo.jsx';
import MadridInicio from './MadridInicio.jsx';
import { Marco, PALETAS, cssBauhaus } from './Bauhaus.jsx';
import { traerDiputadosMadrid } from '../lib/cliente.js';
import { useTelefono } from '../lib/pantalla.js';

const FichaMadrid = lazy(() => import('./FichaMadrid.jsx'));
const LeyesMadrid = lazy(() => import('./LeyesMadrid.jsx'));
const PartidosMadrid = lazy(() => import('./PartidosMadrid.jsx'));

const SECCIONES = [['inicio', 'Inicio'], ['diputados', 'Diputados'], ['leyes', 'Leyes'], ['partidos', 'Partidos']];
const P = PALETAS.madrid;

const estilos = `
${cssBauhaus(P)}
.madrid .navb[data-on="1"]{color:${P.a};border-top-color:${P.a};border-bottom-color:${P.a}}
.madrid .nav{background:rgba(227,234,242,.95)}
@media(min-width:900px){.madrid .nav{background:none}}
.madHemi .bh-chip[data-on='1']{background:${P.b};color:${P.negro}}
.madPartidos{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.madOrden{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.madHemi{background:${P.a};padding:16px 14px 12px;border-bottom:3px solid ${P.negro}}
@media(min-width:900px){.madHemi{padding:24px 30px 16px}}
.madFila{cursor:pointer;display:grid;grid-template-columns:6px minmax(0,1fr) auto;gap:12px;align-items:center;
padding:11px 8px;border-top:2px solid ${P.negro};transition:background .2s}
.madFila:last-child{border-bottom:2px solid ${P.negro}}
.madFila:hover{background:${P.crema}}
.madNombre{font-size:15px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.madMeta{font-size:10.5px;color:${P.gris};margin-top:3px;overflow:hidden;text-overflow:ellipsis}
.madDatos{display:flex;gap:16px;flex-wrap:wrap;text-align:right}
.madDatos a{color:${P.c};font-size:10.5px}
.madDato{font-family:'Archivo Variable','Archivo',system-ui,sans-serif;font-weight:800;font-size:22px;line-height:1}
.madUnidad{font-family:'DM Mono',ui-monospace,monospace;font-size:9.5px;color:${P.gris};text-transform:uppercase;letter-spacing:.05em}
.madDudosa{font-size:9.5px;color:${P.negro};background:${P.b};padding:1px 5px;margin-left:6px;border:1.5px solid ${P.negro}}
.madBusca{max-width:320px;padding:8px 10px;font-size:14px;box-shadow:3px 3px 0 ${P.negro}}
.madPie{font-size:12px;color:${P.gris};line-height:1.55;margin:16px 0 0}
@media(max-width:600px){.madDatos{gap:12px}.madFila{grid-template-columns:6px minmax(0,1fr)}.madDatos{grid-column:2;justify-content:flex-start;text-align:left}}
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
  const quieto = useReducedMotion();
  const estrecho = useTelefono();
  const [diputados, setDiputados] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [partido, setPartido] = useState(null);
  const [orden, setOrden] = useState('inmuebles');
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState(null);
  const [seccion, setSeccion] = useState('inicio');

  useEffect(() => {
    const raiz = document.documentElement;
    const previo = [raiz.style.background, document.body.style.background];
    raiz.style.background = P.crema;
    document.body.style.background = P.crema;
    return () => { raiz.style.background = previo[0]; document.body.style.background = previo[1]; };
  }, []);

  const ir = s => { setSeccion(s); window.scrollTo?.({ top: 0, behavior: quieto ? 'auto' : 'smooth' }); };

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
    <div className="solo1 madrid" data-seccion={seccion}>
      <style>{estilos}</style>

      <nav className="nav" aria-label="Secciones de la Asamblea de Madrid">
        {SECCIONES.map(([k, t]) => (
          <button key={k} className="navb" data-on={seccion === k ? '1' : '0'} onClick={() => ir(k)}>{t}</button>
        ))}
      </nav>

      {seccion === 'inicio' && <MadridInicio diputados={diputados} onFicha={setSel} onIr={ir} />}

      {seccion === 'leyes' && (
        <Marco p={P} quieto={quieto} estrecho={estrecho} antetitulo="Asamblea de Madrid · XIII legislatura" titulo="Leyes y proposiciones no de ley">
          <div className="bh-cuerpo">
            <Suspense fallback={<p className="madPie">Cargando iniciativas…</p>}>
              <LeyesMadrid colores={colores} />
            </Suspense>
          </div>
        </Marco>
      )}

      {seccion === 'partidos' && estado === 'listo' && (
        <Marco p={P} quieto={quieto} estrecho={estrecho} antetitulo="Asamblea de Madrid · XIII legislatura" titulo="Los cuatro grupos, cara a cara">
          <div className="bh-cuerpo">
            <Suspense fallback={<p className="madPie">Cargando partidos…</p>}>
              <PartidosMadrid diputados={diputados} partidos={partidos} />
            </Suspense>
          </div>
        </Marco>
      )}

      {seccion !== 'leyes' && estado === 'cargando' && <p className="madPie">Cargando diputados…</p>}
      {seccion !== 'leyes' && estado === 'error' && <p className="madPie">No se pueden leer los datos de la Asamblea ahora mismo.</p>}
      {seccion !== 'leyes' && estado === 'vacio' && <p className="madPie">Todavía no hay datos de la Asamblea de Madrid cargados.</p>}

      {seccion === 'diputados' && estado === 'listo' && (
        <Marco p={P} quieto={quieto} estrecho={estrecho} antetitulo={`Asamblea de Madrid · ${diputados.length} escaños`} titulo="Quién se sienta en la Asamblea">
          <div className="madHemi">
            <div className="madPartidos" style={{ marginTop: 0 }}>
              <button className="bh-chip" data-on={partido ? '0' : '1'} onClick={() => setPartido(null)}>Todos {diputados.length}</button>
              {partidos.map(p => (
                <button key={p.siglas} className="bh-chip" data-on={partido === p.siglas ? '1' : '0'}
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
            <div className="em" style={{ fontSize: 10, color: '#C9D6E6', marginTop: 6 }}>
              Escaños agrupados por número de diputados de cada grupo, no por ideología: la Asamblea no publica cómo vota cada diputado.
            </div>
          </div>

          <div className="bh-cuerpo">
          <div className="madOrden">
            {ORDENES.map(([k, t]) => (
              <button key={k} className="bh-chip" data-on={orden === k ? '1' : '0'} onClick={() => setOrden(k)}>{t}</button>
            ))}
            <input className="bh-input madBusca" placeholder="Buscar diputado" value={busqueda}
              onChange={e => setBusqueda(e.target.value)} aria-label="Buscar diputado de la Asamblea" />
          </div>

          <div>
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
                    <div className="madDato">{numero(d.n_inmuebles_equivalentes)}</div>
                    <span className="madUnidad">propiedades</span>
                  </div>
                  <div>
                    <div className="madDato">{numero(d.n_viviendas_equivalentes)}</div>
                    <span className="madUnidad">viviendas</span>
                  </div>
                  {d.plenos_convocado > 0 && d.plenos_faltados != null && (
                    <div title={`Faltó a ${d.plenos_faltados} de los ${d.plenos_convocado} Plenos celebrados desde su alta`}>
                      <div className="madDato">{d.plenos_faltados}</div>
                      <span className="madUnidad">faltas a Pleno</span>
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

          <p className="madPie">
            Fuente: fichas y declaraciones de bienes publicadas por la Asamblea de Madrid. {leidas} de {diputados.length} declaraciones leídas.
            Las declaraciones son escaneos y las lee un modelo de lenguaje; cada cifra enlaza a su PDF original para comprobarla.
            Cada propiedad cuenta por la parte que declara poseer: media casa es 0,5. Las de lectura dudosa no entran en los hallazgos.
            Las faltas salen de la lista oficial de asistentes a cada Pleno que publica la Asamblea en datos abiertos y cuentan solo los Plenos posteriores al alta de cada diputado. A la presidenta y a los consejeros no se les cuentan faltas: la lista oficial no los recoge en las sesiones ordinarias y daría ausencias que no son. Los senadores pueden faltar por la agenda del Senado: su cargo aparece junto al nombre.
            La Asamblea no publica en su web ni en datos abiertos cómo vota cada diputado: su página de votaciones está vacía.
          </p>
          </div>
        </Marco>
      )}

      {sel && (
        <Suspense fallback={null}>
          <FichaMadrid d={sel} onCerrar={() => setSel(null)} />
        </Suspense>
      )}
    </div>
  );
}
