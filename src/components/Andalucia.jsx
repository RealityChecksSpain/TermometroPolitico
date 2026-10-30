import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import Hemiciclo from './Hemiciclo.jsx';
import AndaluciaInicio from './AndaluciaInicio.jsx';
import { Marco, PALETAS, cssBauhaus } from './Bauhaus.jsx';
import { traerDiputadosAndalucia } from '../lib/cliente.js';
import { useTelefono } from '../lib/pantalla.js';
import { decimal, euros } from '../lib/andalucia-web.js';

const FichaAndalucia = lazy(() => import('./FichaAndalucia.jsx'));
const VotacionesAndalucia = lazy(() => import('./VotacionesAndalucia.jsx'));
const PartidosAndalucia = lazy(() => import('./PartidosAndalucia.jsx'));
const IniciativaAndalucia = lazy(() => import('./IniciativaAndalucia.jsx'));

const SECCIONES = [['inicio', 'Inicio'], ['diputados', 'Diputados'], ['leyes', 'Leyes'], ['partidos', 'Partidos']];
const P = PALETAS.andalucia;

const estilos = `
${cssBauhaus(P)}
.andalucia .navb[data-on="1"]{color:${P.a};border-top-color:${P.a};border-bottom-color:${P.a}}
.andalucia .nav{background:rgba(227,240,231,.95)}
@media(min-width:900px){.andalucia .nav{background:none}}
.andHemi .bh-chip[data-on='1']{background:${P.b};color:${P.negro}}
.andPartidos{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.andHemiGrid{display:grid;gap:4px}
.andBloques{display:none}
@media(min-width:900px){
.andHemiGrid{grid-template-columns:minmax(0,1.45fr) minmax(230px,1fr);gap:28px;align-items:center}
.andHemiDibujo{order:-1}
.andHemiPanel .andPartidos{flex-direction:column;align-items:stretch;margin:0}
.andHemiPanel .andPartidos .bh-chip{justify-content:space-between}
.andBloques{display:grid;gap:10px;margin-top:16px;color:#E3F0E7;font-size:12.5px;line-height:1.45}
.andBloques strong{display:block;font-family:'DM Mono',ui-monospace,monospace;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#B9D3C2;font-weight:700}
}
.andOrden{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.andHemi{background:${P.negro};padding:16px 14px 12px;border-bottom:3px solid ${P.negro}}
@media(min-width:900px){.andHemi{padding:24px 30px 16px}}
.andFila{cursor:pointer;display:grid;grid-template-columns:6px minmax(0,1fr) auto;gap:12px;align-items:center;
padding:11px 8px;border-top:2px solid ${P.negro};transition:background .2s}
.andFila:last-child{border-bottom:2px solid ${P.negro}}
.andFila:hover{background:${P.crema}}
.andNombre{font-size:15px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.andMeta{font-size:10.5px;color:${P.gris};margin-top:3px;overflow:hidden;text-overflow:ellipsis}
.andDatos{display:flex;gap:16px;flex-wrap:wrap;text-align:right}
.andDatos a{color:${P.c};font-size:10.5px}
.andDato{font-family:'Archivo Variable','Archivo',system-ui,sans-serif;font-weight:800;font-size:22px;line-height:1}
.andUnidad{font-family:'DM Mono',ui-monospace,monospace;font-size:9.5px;color:${P.gris};text-transform:uppercase;letter-spacing:.05em}
.andBusca{max-width:320px;padding:8px 10px;font-size:14px;box-shadow:3px 3px 0 ${P.negro}}
.andPie{font-size:12px;color:${P.gris};line-height:1.55;margin:16px 0 0}
@media(max-width:600px){.andDatos{gap:12px}.andFila{grid-template-columns:6px minmax(0,1fr)}.andDatos{grid-column:2;justify-content:flex-start;text-align:left}}
`;

const ORDENES = [
  ['inmuebles', 'Más propiedades'],
  ['viviendas', 'Más viviendas'],
  ['catastral', 'Más valor catastral'],
  ['faltas', 'Más faltas a Pleno'],
  ['nombre', 'Nombre']
];

const CLAVE = { inmuebles: 'n_inmuebles_equivalentes', viviendas: 'n_viviendas_equivalentes', catastral: 'valor_catastral_propio', faltas: 'faltas' };

export default function Andalucia() {
  const quieto = useReducedMotion();
  const estrecho = useTelefono();
  const [todos, setTodos] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [partido, setPartido] = useState(null);
  const [orden, setOrden] = useState('inmuebles');
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState(null);
  const [seccion, setSeccion] = useState('inicio');
  const [ley, setLey] = useState(null);
  const [scrollLista, setScrollLista] = useState(0);

  useEffect(() => {
    const raiz = document.documentElement;
    const previo = [raiz.style.background, document.body.style.background];
    raiz.style.background = P.crema;
    document.body.style.background = P.crema;
    return () => { raiz.style.background = previo[0]; document.body.style.background = previo[1]; };
  }, []);

  useEffect(() => {
    traerDiputadosAndalucia()
      .then(d => { setTodos(d); setEstado(d.length ? 'listo' : 'vacio'); })
      .catch(() => setEstado('error'));
  }, []);

  const ir = s => { setLey(null); setSeccion(s); window.scrollTo?.({ top: 0, behavior: quieto ? 'auto' : 'smooth' }); };

  const abrirLey = v => {
    setScrollLista(seccion === 'leyes' ? window.scrollY ?? 0 : 0);
    setSeccion('leyes');
    setLey(v);
    window.scrollTo?.({ top: 0, behavior: 'auto' });
  };

  const cerrarLey = () => {
    setLey(null);
    requestAnimationFrame(() => window.scrollTo?.({ top: scrollLista, behavior: 'auto' }));
  };

  const diputados = useMemo(() => todos.filter(d => d.activo), [todos]);

  const partidos = useMemo(() => {
    const m = new Map();
    for (const d of diputados) {
      const k = d.partido_siglas ?? 'SIN GRUPO';
      const v = m.get(k) ?? { siglas: k, color: d.color, n: 0 };
      v.n++;
      m.set(k, v);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [diputados]);

  const colores = useMemo(() => new Map(partidos.map(p => [p.siglas, p.color])), [partidos]);

  const bloques = useMemo(() => {
    const conGobierno = new Set(diputados.filter(d => d.cargo).map(d => d.partido_siglas));
    if (!conGobierno.size) return null;
    const gob = partidos.filter(p => conGobierno.has(p.siglas));
    const opo = partidos.filter(p => !conGobierno.has(p.siglas));
    const suma = l => l.reduce((t, p) => t + p.n, 0);
    const nombres = l => l.map(p => p.siglas).join(', ').replace(/, ([^,]*)$/, ' y $1');
    return { gob: nombres(gob), nGob: suma(gob), opo: nombres(opo), nOpo: suma(opo) };
  }, [diputados, partidos]);

  const escanos = useMemo(() => {
    const puesto = new Map(partidos.map((p, i) => [p.siglas, i]));
    return [...diputados].sort((a, b) =>
      (puesto.get(a.partido_siglas ?? 'SIN GRUPO') - puesto.get(b.partido_siglas ?? 'SIN GRUPO')) ||
      a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
  }, [diputados, partidos]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = diputados.filter(d =>
      (orden !== 'faltas' || !d.cargo) &&
      (!partido || (d.partido_siglas ?? 'SIN GRUPO') === partido) &&
      (!q || d.nombre_completo.toLowerCase().includes(q) || String(d.circunscripcion ?? '').toLowerCase().includes(q)));
    const clave = CLAVE[orden];
    return [...filtrados].sort((a, b) => orden === 'nombre' || !clave
      ? a.nombre_completo.localeCompare(b.nombre_completo, 'es')
      : (Number(b[clave] ?? -1) - Number(a[clave] ?? -1)) || a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
  }, [diputados, partido, orden, busqueda]);

  return (
    <div className="solo1 andalucia" data-seccion={seccion}>
      <style>{estilos}</style>

      <nav className="nav" aria-label="Secciones del Parlamento de Andalucía">
        {SECCIONES.map(([k, t]) => (
          <button key={k} className="navb" data-on={seccion === k ? '1' : '0'} onClick={() => ir(k)}>{t}</button>
        ))}
      </nav>

      {seccion === 'inicio' && <AndaluciaInicio diputados={diputados} partidos={partidos} onFicha={setSel} onIr={ir} onLey={abrirLey} />}

      {seccion === 'leyes' && (
        <Marco p={P} quieto={quieto} estrecho={estrecho} antetitulo="Parlamento de Andalucía · votaciones del Pleno" titulo="Lo que se vota y quién lo vota">
          <div className="bh-cuerpo">
            <Suspense fallback={<p className="andPie">Cargando votaciones…</p>}>
              <div style={{ display: ley ? 'none' : 'block' }}>
                <VotacionesAndalucia colores={colores} onAbrir={abrirLey} />
              </div>
              {ley && <IniciativaAndalucia key={ley.id} votacion={ley} colores={colores} diputados={escanos} onVolver={cerrarLey} />}
            </Suspense>
          </div>
        </Marco>
      )}

      {seccion === 'partidos' && estado === 'listo' && (
        <Marco p={P} quieto={quieto} estrecho={estrecho} antetitulo="Parlamento de Andalucía · XIII legislatura" titulo="Los cinco grupos, cara a cara">
          <div className="bh-cuerpo">
            <Suspense fallback={<p className="andPie">Cargando partidos…</p>}>
              <PartidosAndalucia diputados={diputados} partidos={partidos} />
            </Suspense>
          </div>
        </Marco>
      )}

      {seccion !== 'leyes' && estado === 'cargando' && <p className="andPie">Cargando diputados…</p>}
      {seccion !== 'leyes' && estado === 'error' && <p className="andPie">No se pueden leer los datos del Parlamento de Andalucía ahora mismo.</p>}
      {seccion !== 'leyes' && estado === 'vacio' && <p className="andPie">Todavía no hay datos del Parlamento de Andalucía cargados.</p>}

      {seccion === 'diputados' && estado === 'listo' && (
        <Marco p={P} quieto={quieto} estrecho={estrecho} antetitulo={`Parlamento de Andalucía · ${diputados.length} escaños`} titulo="Quién se sienta en el Parlamento">
          <div className="andHemi">
            <div className="andHemiGrid">
              <div className="andHemiPanel">
                <div className="andPartidos" style={{ marginTop: 0 }}>
                  <button className="bh-chip" data-on={partido ? '0' : '1'} onClick={() => setPartido(null)}><span>Todos</span><span>{diputados.length}</span></button>
                  {partidos.map(p => (
                    <button key={p.siglas} className="bh-chip" data-on={partido === p.siglas ? '1' : '0'}
                      onClick={() => setPartido(partido === p.siglas ? null : p.siglas)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 8, background: p.color, display: 'inline-block' }} />
                        {p.siglas}
                      </span>
                      <span>{p.n}</span>
                    </button>
                  ))}
                </div>
                {bloques && (
                  <div className="andBloques">
                    <div><strong>Gobiernan · {bloques.nGob} escaños</strong>{bloques.gob}</div>
                    <div><strong>Oposición · {bloques.nOpo} escaños</strong>{bloques.opo}</div>
                    <div><strong>Mayoría absoluta</strong>55 escaños</div>
                  </div>
                )}
              </div>
              <div className="andHemiDibujo">
                <Hemiciclo
                  diputados={escanos}
                  resaltado={partido ? d => (d.partido_siglas ?? 'SIN GRUPO') === partido : null}
                  seleccionado={sel?.mandato_id}
                  onSeleccionar={setSel}
                />
              </div>
            </div>
            <div className="em" style={{ fontSize: 10, color: '#B9D3C2', marginTop: 6 }}>
              Escaños agrupados por número de diputados de cada grupo, no por ideología.
            </div>
          </div>

          <div className="bh-cuerpo">
            <div className="andOrden">
              {ORDENES.map(([k, t]) => (
                <button key={k} className="bh-chip" data-on={orden === k ? '1' : '0'} onClick={() => setOrden(k)}>{t}</button>
              ))}
              <input className="bh-input andBusca" placeholder="Buscar diputado o provincia" value={busqueda}
                onChange={e => setBusqueda(e.target.value)} aria-label="Buscar diputado del Parlamento de Andalucía" />
            </div>

            <div>
              {lista.map(d => (
                <div key={d.id_externo} className="andFila" role="button" tabIndex={0}
                  onClick={() => setSel(d)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(d); } }}>
                  <span style={{ width: 4, height: 30, background: d.color, borderRadius: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="andNombre">{d.nombre_completo}</div>
                    <div className="andMeta em">
                      {d.partido_siglas ?? d.grupo ?? 'Sin grupo'}{d.circunscripcion ? ` · ${d.circunscripcion}` : ''}{d.cargo ? ` · ${d.cargo}` : ''}
                    </div>
                  </div>
                  <div className="andDatos">
                    <div>
                      <div className="andDato">{decimal(d.n_inmuebles_equivalentes)}</div>
                      <span className="andUnidad">propiedades</span>
                    </div>
                    <div>
                      <div className="andDato">{decimal(d.n_viviendas_equivalentes)}</div>
                      <span className="andUnidad">viviendas</span>
                    </div>
                    {orden === 'catastral' && (
                      <div>
                        <div className="andDato">{euros(d.valor_catastral_propio) ?? '—'}</div>
                        <span className="andUnidad">valor catastral</span>
                      </div>
                    )}
                    {d.votaciones > 0 && (
                      <div title={`No votó en ${d.faltas} de las ${d.votaciones} votaciones del Pleno desde su alta`}>
                        <div className="andDato">{d.faltas}</div>
                        <span className="andUnidad">faltas a votar</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <details className="bh-mas">
              <summary>Cómo se calcula y de dónde sale</summary>
              <div>
                <span>Fuente: fichas de los diputados y registro de votaciones del Pleno del Parlamento de Andalucía; declaraciones de bienes publicadas en el Boletín Oficial del Parlamento y en el BOJA.</span>
                <span>Las declaraciones se leen tal y como las publica el Parlamento, sin modelos de lenguaje: cada inmueble trae su tipo, su provincia, el porcentaje que posee y su valor catastral. Cada propiedad cuenta por la parte que declara poseer: media casa es 0,5. Un inmueble sin porcentaje cuenta entero.</span>
                <span>El valor catastral es el que fija Hacienda para los impuestos y suele estar muy por debajo del precio de mercado. Se suma solo la parte que posee cada diputado.</span>
                <span>Quien está en el Consejo de Gobierno de la Junta sale de la lista ordenada por faltas: falta al Pleno por la agenda del Gobierno. Su cargo aparece junto al nombre.</span>
                <span>Las faltas son votaciones del Pleno en las que no consta voto. Quien delega su voto por baja o enfermedad aparece como ausente en el listado oficial, pero su voto sí cuenta y no se le suma como falta.</span>
              </div>
            </details>
          </div>
        </Marco>
      )}

      {sel && (
        <Suspense fallback={null}>
          <FichaAndalucia d={sel} onCerrar={() => setSel(null)} />
        </Suspense>
      )}
    </div>
  );
}
