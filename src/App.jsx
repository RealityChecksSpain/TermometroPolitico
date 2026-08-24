import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Hemiciclo, { LeyendaVoto } from './components/Hemiciclo.jsx';
import Marca from './components/Marca.jsx';
import { desgloseBienes } from './lib/inmuebles.js';
import Detalle, { DetalleLey } from './components/Detalle.jsx';
import FichaDiputado from './components/FichaDiputado.jsx';
import Mapa from './components/Mapa.jsx';
import Metodologia from './components/Metodologia.jsx';
import Descargas from './components/Descargas.jsx';
import Partidos from './components/Partidos.jsx';
import Inicio from './components/Inicio.jsx';
import AvatarPartido from './components/AvatarPartido.jsx';
import { fraseCortaDeNorma } from './lib/fraseCorta.js';
import {
  faltaConfig, problemasConfig, traerDiputados, traerVotaciones, traerVotos,
  traerEjes, traerCobertura, traerFacetas, traerCcaa, traerCoherencia, traerDestacadas, traerLideres
} from './lib/cliente.js';

const C = {
  papel: '#F3F1E8', superficie: '#FFFFFF', pizarra: '#18211E',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1',
  si: '#2E7D5B', no: '#B23A2E', abs: '#B8912E'
};

const estilos = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Archivo:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box}
html,body{margin:0;background:${C.papel};-webkit-font-smoothing:antialiased}
.e{font-family:'Archivo',system-ui,sans-serif}
.ed{font-family:'Newsreader',Georgia,serif;letter-spacing:-0.012em;font-optical-sizing:auto}
.em{font-family:'DM Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
button,input{font-family:inherit}
.app{max-width:1120px;margin:0 auto;padding:0 16px 96px}
@media(min-width:900px){.app{padding:0 28px 40px}}
.hero{background:${C.pizarra};border-radius:4px;padding:20px 18px 14px}
@media(min-width:900px){.hero{padding:26px 32px 18px}}
.cols{display:grid;grid-template-columns:1fr;gap:20px;margin-top:20px}
@media(min-width:900px){.cols{grid-template-columns:1fr 1fr;gap:28px;align-items:start}}
.solo1{grid-column:1/-1}
.nav{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(239,239,233,.94);
backdrop-filter:blur(10px);border-top:1px solid ${C.linea};display:flex}
@media(min-width:900px){.nav{position:static;background:none;backdrop-filter:none;border-top:none;
border-bottom:none;margin-bottom:0;gap:2px}}
.navb{flex:1;padding:9px 4px 8px;background:none;border:none;cursor:pointer;
display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;color:${C.tenue};
border-top:2px solid transparent}
@media(min-width:900px){.navb{flex:none;flex-direction:row;gap:7px;font-size:13px;padding:9px 16px;
border-top:none;border-bottom:2px solid transparent;margin-bottom:-2px}}
.navb[data-on="1"]{color:${C.tinta};font-weight:600;border-top-color:${C.tinta}}
@media(min-width:900px){.navb[data-on="1"]{border-top-color:transparent;border-bottom-color:${C.tinta}}}
.tarjeta{background:${C.superficie};border:1px solid ${C.linea};border-radius:3px;
box-shadow:0 1px 0 rgba(20,22,26,0.03)}
.fila{transition:background 140ms ease, transform 140ms ease}
.fila:hover{background:#EDEBE0}
.chip{padding:6px 12px;font-size:11px;font-weight:600;border-radius:0;cursor:pointer;
display:inline-flex;align-items:center;gap:5px;white-space:nowrap;background:transparent;
color:${C.media};border:1px solid ${C.linea};transition:background 140ms ease,color 140ms ease,border-color 140ms ease,transform 140ms ease}
.chip:hover{border-color:${C.tinta}}
.chip[data-on="1"]{background:${C.tinta};color:${C.papel};border-color:${C.tinta}}
.navb{transition:color 140ms ease,border-color 140ms ease}
.hero .chip{color:#C9CDD2;border-color:#4A5057;background:transparent}
.hero .chip:hover{color:#FFFFFF;border-color:#8E959C}
.hero .chip[data-on="1"]{background:#F2F3F0;color:#14161A;border-color:#F2F3F0}
.trabajo{display:grid;grid-template-columns:1fr;gap:18px;align-items:start}
@media(min-width:980px){.trabajo{grid-template-columns:minmax(360px,44%) 1fr;gap:22px}
.trabajo>.izq{position:sticky;top:14px}
.trabajo>.der{max-height:calc(100vh - 28px);overflow-y:auto;padding-right:4px}
.trabajo>.der::-webkit-scrollbar{width:6px}
.trabajo>.der::-webkit-scrollbar-thumb{background:#C9C9BE;border-radius:6px}}
.contents{display:contents}
.ejesGuia{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:820px){.ejesGuia{grid-template-columns:1fr 1fr}}
.split{display:grid;grid-template-columns:1fr;gap:16px;margin-top:16px}
@media(min-width:960px){.split{grid-template-columns:minmax(380px,1.15fr) minmax(300px,.9fr);gap:18px;align-items:start}
.split>.izq{position:sticky;top:14px}}
@media(min-width:960px){.split.splitDiputados{grid-template-columns:minmax(420px,1.35fr) minmax(260px,.72fr);gap:18px}}
:root{
--s1:4px;--s2:8px;--s3:12px;--s4:20px;--s5:32px;--s6:52px;
--radio:3px;--radioG:5px;
--sombra:0 1px 2px rgba(20,22,26,.04);
--sombraAlta:0 2px 4px rgba(20,22,26,.06),0 8px 24px rgba(20,22,26,.05);
}
body{font-size:15px;line-height:1.55}
h1,h2,h3{margin:0;font-family:'Newsreader',Georgia,serif;letter-spacing:-0.018em;line-height:1.15}
.display{font-size:clamp(28px,4.6vw,44px);font-weight:600;letter-spacing:-0.028em;line-height:1.08}
.t1{font-size:clamp(21px,2.6vw,27px);font-weight:600;line-height:1.2}
.t2{font-size:clamp(17px,1.9vw,20px);font-weight:600;line-height:1.28}
.cifra{font-family:'DM Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;
font-size:clamp(24px,3.4vw,34px);font-weight:500;letter-spacing:-0.02em;line-height:1}
.pie{font-size:12px;line-height:1.5}
.tarjetaAncla{background:#FFFFFF;border:1px solid #CFCFC4;border-radius:var(--radioG);
box-shadow:var(--sombraAlta)}
.sep{border:0;border-top:1px solid #E3DFD1;margin:var(--s4) 0}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #3D7AB8;outline-offset:2px;border-radius:2px}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}

[data-seccion]{--acento:#1E4A3C;--acentoClaro:#2F7F63;--acentoTenue:#EAF0EC}
[data-seccion="inicio"]{--acento:#1E4A3C;--acentoClaro:#2F7F63;--acentoTenue:#E9F0EC}
[data-seccion="leyes"]{--acento:#7A5A12;--acentoClaro:#B58A22;--acentoTenue:#F4EFE0}
[data-seccion="diputados"]{--acento:#243F6B;--acentoClaro:#3C63A0;--acentoTenue:#E8ECF4}
[data-seccion="partidos"]{--acento:#6E2C3C;--acentoClaro:#A24A5F;--acentoTenue:#F4E9EC}
[data-seccion="ejes"]{--acento:#14524F;--acentoClaro:#1F8480;--acentoTenue:#E6F0EF}

.listaFilete{background:transparent;border:0;box-shadow:none}
.listaFilete .fila{border-top:1px solid var(--acentoTenue,#E3DFD1)}
.listaFilete .fila:first-child{border-top:2px solid var(--acento,#16181B)}
.listaFilete .fila:last-child{border-bottom:2px solid var(--acento,#16181B)}
.dato{font-family:'DM Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;
font-size:clamp(19px,2.1vw,26px);font-weight:500;letter-spacing:-0.03em;line-height:1;
color:var(--acento,#16181B)}
.datoUnidad{display:block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;
color:#8E9299;margin-top:3px;font-weight:600}
.puesto{font-family:'DM Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;
font-size:10.5px;color:#A9AEB2;width:22px;flex-shrink:0;text-align:right}
.fila[data-top="1"] .dato{font-size:clamp(23px,2.6vw,32px)}
.nota{background:var(--acentoTenue,#F5F3EA);border:0;border-left:2px solid var(--acentoClaro,#B58A22);
border-radius:0 var(--radio) var(--radio) 0;padding:10px 13px;margin-bottom:var(--s3);
font-size:11.5px;line-height:1.55;color:#4A4F55}

.hallazgos{background:linear-gradient(135deg,#16211D 0%,#1E2A26 60%,#1A2F28 100%);
border-radius:var(--radioG);padding:var(--s3) var(--s4) var(--s4);margin-bottom:var(--s4);position:relative}
.hallazgosCab{display:flex;align-items:center;justify-content:space-between;gap:var(--s2);
padding-bottom:var(--s2);border-bottom:1px solid #333941;margin-bottom:var(--s3)}
.hallazgos .rotulo{color:#E8C56A;letter-spacing:.12em}
.hallazgosNav{display:flex;align-items:center;gap:var(--s2)}
.hallazgosNav button{width:22px;height:22px;border-radius:2px;cursor:pointer;line-height:1;font-size:15px;
background:transparent;color:#8E959C;border:1px solid #3A4048;padding:0}
.hallazgosNav button:hover{color:#F2F3F0;border-color:#6C737B}
.hallazgosNav .contador{font-size:10.5px;color:#6C737B;min-width:26px;text-align:center}
.hallazgoCuerpo{display:block;width:100%;text-align:left;background:none;border:none;padding:0;
cursor:pointer;color:inherit;min-height:88px}
@media(min-width:900px){.hallazgoCuerpo{min-height:76px}}
.hallazgoTitular{display:block;color:#F7F8F5;font-size:clamp(16px,2.1vw,22px);font-weight:600;
line-height:1.28;letter-spacing:-0.016em;animation:entra 380ms cubic-bezier(.2,.7,.3,1)}
.hallazgoCuerpo:hover .hallazgoTitular{color:#FFFFFF;text-decoration:underline;text-underline-offset:3px;
text-decoration-thickness:1px;text-decoration-color:#6C737B}
.hallazgoDetalle{display:block;color:#BFC9C2;font-size:13px;line-height:1.6;margin-top:var(--s2);
max-width:none;overflow-wrap:anywhere}
@keyframes entra{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.hallazgosPuntos{display:flex;gap:5px;margin-top:var(--s3)}
.hallazgosPuntos button{width:16px;height:3px;border-radius:3px;border:none;padding:0;cursor:pointer;
background:#3A4048;transition:background 220ms ease,width 220ms ease}
.hallazgosPuntos button[data-on="1"]{background:#E8C56A;width:26px}

.heroCols{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:760px){.heroCols.conPanel{grid-template-columns:128px 1fr;gap:12px;align-items:start}}
.panelGrupos{max-height:min(52vh,440px);overflow-y:auto;padding-right:4px}
.panelGrupos::-webkit-scrollbar{width:5px}
.panelGrupos::-webkit-scrollbar-thumb{background:#4A5057;border-radius:5px}
.filete{height:2px;background:${C.tinta};margin:0 0 12px}
@media(max-width:899px){.filete{display:none}}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.rot{font-size:10px;color:${C.tenue};text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:8px}

.chipsCcaa{margin-top:14px;padding-top:12px;border-top:1px solid #3A4048}
.chipsCcaaTitulo{font-size:9.5px;color:#8E959C;text-transform:uppercase;letter-spacing:.07em;
margin-bottom:8px}
.chipsCcaaLista{display:flex;flex-wrap:wrap;gap:5px}
.chipsCcaaLista button{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;
border-radius:2px;border:1px solid #3A4048;background:transparent;color:#C7CDD2;
font-family:'Archivo',system-ui,sans-serif;font-size:11px;cursor:pointer;
transition:background 150ms ease,border-color 150ms ease,color 150ms ease}
.chipsCcaaLista button:hover{border-color:#6C737B;color:#F2F3F0}
.chipsCcaaLista button span{font-family:'DM Mono',ui-monospace,monospace;font-size:10px;color:#8E959C}
.chipsCcaaLista button[data-on="1"]{background:#E8C56A;border-color:#E8C56A;color:#15171A;font-weight:600}
.chipsCcaaLista button[data-on="1"] span{color:#5C4A14}

.masthead{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s3);
flex-wrap:wrap;padding:var(--s4) 0 var(--s3)}

`;

const ICONOS = {
  inicio: 'M3 11l9-8 9 8 M5 10v10h14V10',
  leyes: 'M4 3h11l5 5v13H4z M15 3v5h5',
  diputados: 'M8 11a4 4 0 100-8 4 4 0 000 8z M2 21a6 6 0 0112 0 M17 11a3 3 0 100-6 M16 21a5 5 0 016-5',
  partidos: 'M3 21h18 M5 21V8l7-5 7 5v13 M10 21v-6h4v6',
  ejes: 'M3 3v18h18 M7 15l4-5 3 3 5-7'
};

function Icono({ d }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {d.split(' M').map((p, i) => <path key={i} d={(i ? 'M' : '') + p} />)}
  </svg>;
}

const ORDENES = [
  ['nombre', 'Nombre', d => d.nombre_completo, false],
  ['ausencias', 'Más ausencias', d => Number(d.ausencias ?? 0), true],
  ['disidencias', 'Más veces contra su partido', d => Number(d.disidencias ?? 0), true],
  ['tribuna', 'Más minutos hablando', d => Number(d.minutos_tribuna ?? 0), true],
  ['intervenciones', 'Más intervenciones', d => Number(d.intervenciones ?? 0), true],
  ['abstenciones', 'Más abstenciones', d => Number(d.abstenciones ?? 0), true],
  ['telematicos', 'Más votos a distancia', d => Number(d.telematicos ?? 0), true],
  ['patrimonio', 'Mayor patrimonio (€)', d => {
    if (d.bienes_outlier) return -1;
    return Number(d.patrimonio_euros ?? d.bienes_total ?? -1);
  }, true],
  ['inmuebles', 'Más bienes propios', d => {
    const n = d.n_inmuebles_propios ?? d.n_casas ?? d.n_inmuebles;
    return n == null ? -1 : Number(n);
  }, true],
  ['inmuebles_todos', 'Más bienes vinculados', d => {
    const n = d.n_casas ?? d.n_inmuebles;
    return n == null ? -1 : Number(n);
  }, true],
  ['vehiculos', 'Más vehículos', d => {
    const n = d.n_vehiculos ?? ((d.n_coches ?? 0) + (d.n_motos ?? 0) + (d.n_embarcaciones ?? 0) + (d.n_aeronaves ?? 0));
    return (d.vehiculos_detalle || n > 0) ? Number(n) : -1;
  }, true],
  ['donaciones', 'Más donaciones recibidas', d => Number(d.donaciones ?? 0), true],
  ['privadas', 'Más cargos en el sector privado', d => Number(d.actividades_privadas ?? 0), true]
];

function Chip({ on, onClick, color, children, titulo }) {
  return (
    <button className="chip" data-on={on ? '1' : '0'} onClick={onClick} title={titulo}>
      {color && <span style={{ width: 8, height: 8, borderRadius: 8, background: color, flexShrink: 0 }} />}
      {children}
    </button>
  );
}

function limpiarTitular(t) {
  if (!t) return t;
  return String(t)
    .replace(/^\s*proposición\s+de\s+ley\s+presentada\s+por\s+el\s+grupo\s+parlamentario\s+de\s+\S+\s*[:.\-–—]?\s*/i, '')
    .replace(/^\s*presentada\s+por\s+el\s+grupo\s+parlamentario\s+(de\s+)?[^.:\-–—]+[:.\-–—]\s*/i, '')
    .trim() || t;
}

function Barra({ si, no, abs, alto = 5 }) {
  const t = si + no + abs || 1;
  return (
    <div style={{ display: 'flex', height: alto, borderRadius: alto, overflow: 'hidden', background: '#E4E4DC' }}>
      {[[si, C.si], [abs, C.abs], [no, C.no]].map(([v, col], i) =>
        v > 0 && <div key={i} style={{ width: `${(v / t) * 100}%`, background: col }} />)}
    </div>
  );
}

export default function App() {
  const [seccion, setSeccion] = useState('inicio');
  const [coherencia, setCoherencia] = useState([]);
  const [destacadas, setDestacadas] = useState([]);
  const [diputados, setDiputados] = useState([]);
  const [votaciones, setVotaciones] = useState([]);
  const [ejes, setEjes] = useState([]);
  const [cobertura, setCobertura] = useState(null);
  const [facetas, setFacetas] = useState({ materias: [], colectivos: [] });
  const [ccaa, setCcaa] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [sel, setSel] = useState(null);
  const [votacionSel, setVotacionSel] = useState(null);
  const [votos, setVotos] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [fPartido, setFPartido] = useState(null);
  const [fCcaa, setFCcaa] = useState(null);
  const [fMateria, setFMateria] = useState(null);
  const [fColectivo, setFColectivo] = useState(null);
  const [verMas, setVerMas] = useState(false);
  const [buscaFaceta, setBuscaFaceta] = useState('');
  const [orden, setOrden] = useState('nombre');
  const [lideres, setLideres] = useState([]);
  const [encimaDip, setEncimaDip] = useState(null);
  const [encimaEscano, setEncimaEscano] = useState(null);
  const [cargandoLista, setCargandoLista] = useState(false);

  useEffect(() => {
    if (faltaConfig) {
      setError('Configuracion en .env:\n\n' + problemasConfig.map(p => '  - ' + p).join('\n'));
      setCargando(false); return;
    }
    Promise.all([traerDiputados(), traerVotaciones(200), traerEjes(), traerCobertura(), traerFacetas(), traerCcaa(), traerCoherencia(), traerDestacadas(4)])
      .then(([d, v, e, c, f, cc, co, de]) => { setDiputados(d); setVotaciones(v); setEjes(e); setCobertura(c); setFacetas(f); setCcaa(cc); setCoherencia(co); setDestacadas(de); })
      .catch(e => setError(String(e.message ?? e)))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!votacionSel) { setVotos(null); return; }
    let vivo = true;
    traerVotos(votacionSel.id).then(v => vivo && setVotos(v)).catch(() => vivo && setVotos(null));
    return () => { vivo = false; };
  }, [votacionSel]);

  const activos = useMemo(() => diputados.filter(d => d.activo), [diputados]);

  const partidos = useMemo(() => {
    const m = new Map();
    activos.forEach(d => {
      const k = d.partido_siglas || d.grupo;
      if (!k) return;
      const a = m.get(k) ?? { n: 0, color: d.color };
      a.n++; m.set(k, a);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n);
  }, [activos]);

  const enHemiciclo = useMemo(() => {
    let l = activos;
    if (fCcaa) l = l.filter(d => d.ccaa === fCcaa);
    return l;
  }, [activos, fCcaa]);

  const posicionPartidos = useMemo(() => {
    if (!votos) return [];
    const mapa = new Map(votos.map(v => [v.mandato_id, v.voto]));
    const g = new Map();
    diputados.forEach(d => {
      const voto = mapa.get(d.mandato_id);
      const k = d.partido_siglas || d.grupo;
      if (!voto || !k) return;
      const a = g.get(k) ?? { siglas: k, color: d.color, si: 0, no: 0, abstencion: 0, no_vota: 0 };
      a[voto] = (a[voto] ?? 0) + 1;
      g.set(k, a);
    });
    return Array.from(g.values()).map(a => {
      const orden = [['si', a.si], ['no', a.no], ['abstencion', a.abstencion]].sort((x, y) => y[1] - x[1]);
      return { ...a, voto: orden[0][0], n: orden[0][1], total: a.si + a.no + a.abstencion + a.no_vota };
    }).sort((a, b) => b.total - a.total);
  }, [diputados, votos]);

  const listaDip = useMemo(() => {
    let l = enHemiciclo;
    if (fPartido) l = l.filter(d => (d.partido_siglas || d.grupo) === fPartido);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      l = l.filter(d => d.nombre_completo.toLowerCase().includes(q) || (d.circunscripcion ?? '').toLowerCase().includes(q));
    }
    const cfg = ORDENES.find(o => o[0] === orden) ?? ORDENES[0];
    const [, , clave, desc] = cfg;
    return [...l].sort((a, b) => {
      const va = clave(a), vb = clave(b);
      if (typeof va === 'string') return va.localeCompare(vb, 'es');
      return desc ? vb - va : va - vb;
    });
  }, [enHemiciclo, fPartido, busqueda, orden]);

  useEffect(() => {
    if (seccion !== 'diputados' || orden === 'nombre') { setLideres([]); return; }
    const mapa = { ausencias: 'ausencias', disidencias: 'disidencias', tribuna: 'tribuna',
      intervenciones: 'intervenciones', abstenciones: 'abstenciones', telematicos: 'telematicos',
      donaciones: 'donaciones', privadas: 'privadas' };
    if (!mapa[orden]) { setLideres([]); return; }
    traerLideres(mapa[orden]).then(setLideres).catch(() => setLideres([]));
  }, [seccion, orden]);

  async function recargar(c = {}) {
    setCargandoLista(true);
    try {
      setVotaciones(await traerVotaciones(200, {
        texto: c.texto !== undefined ? c.texto : busqueda,
        materia: c.materia !== undefined ? c.materia : fMateria,
        colectivo: c.colectivo !== undefined ? c.colectivo : fColectivo
      }));
    } finally { setCargandoLista(false); }
  }

  if (cargando) return <><style>{estilos}</style><div className="e" style={{ padding: 60, textAlign: 'center', color: C.tenue }}>Cargando…</div></>;
  if (error) return <><style>{estilos}</style><div className="e app" style={{ paddingTop: 30 }}>
    <div className="ed" style={{ fontSize: 22, fontWeight: 800 }}>No se pudo cargar</div>
    <pre className="em" style={{ fontSize: 12, background: '#FBE9EC', padding: 12, borderRadius: 3, whiteSpace: 'pre-wrap', marginTop: 12 }}>{error}</pre>
  </div></>;

  const secciones = [['inicio', 'Inicio'], ['leyes', 'Leyes'], ['diputados', 'Diputados'], ['partidos', 'Partidos'], ['ejes', 'Mapa']];
  const mostrarHemiciclo = seccion === 'leyes' || seccion === 'diputados';

  return (
    <>
      <style>{estilos}</style>
      <div className="e app">

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '18px 0 14px', flexWrap: 'wrap' }}>
          <button onClick={() => { setSeccion('inicio'); setVotacionSel(null); }}
            aria-label="Ir al inicio"
            className="ed display" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.tinta
            }}>
            <img src="/logo.svg" alt="" width="64" height="64"
              style={{ display: 'block', flexShrink: 0 }}
              onError={e => { e.currentTarget.style.display = 'none'; }} />
            Lente Negra
          </button>
          {cobertura && (
            <div className="em" style={{ fontSize: 10, color: C.tenue }}>
              última sesión {cobertura.ultima_sesion}
            </div>
          )}
        </div>

        <div className="filete" />

        <nav className="nav">
          {secciones.map(([k, t]) => (
            <button key={k} className="navb" data-on={seccion === k ? '1' : '0'}
              onClick={() => { setSeccion(k); setVotacionSel(null); setBusqueda(''); }}>
              <Icono d={ICONOS[k]} />{t}
            </button>
          ))}
        </nav>

        <Marca key={`marca-${seccion}`} quieta={seccion === 'inicio'} />

        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={seccion} data-seccion={seccion}
          className={mostrarHemiciclo ? (seccion === 'diputados' ? 'split splitDiputados' : 'split') : 'cols'}
          initial={{ y: 18 }}
          animate={{ y: 0 }}
          exit={{ y: -10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.7 }}
          style={{ position: 'relative' }}>

          {mostrarHemiciclo && (
            <div className="izq">
              <div className="hero">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div className="em" style={{ fontSize: 10.5, color: '#A0A6AC', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                {enHemiciclo.length} escaños{fCcaa ? ` · ${ccaa.find(c => c.slug === fCcaa)?.nombre}` : ''}
              </div>
              {votacionSel && votos && <LeyendaVoto totales={{
                si: votacionSel.total_si, no: votacionSel.total_no,
                abstencion: votacionSel.total_abstencion, no_vota: votacionSel.total_no_vota
              }} />}
            </div>

            <div className="heroCols conPanel">
              <div className="panelGrupos">
                <div className="em" style={{ fontSize: 9.5, color: '#8E959C', textTransform: 'uppercase',
                  letterSpacing: '.07em', marginBottom: 9 }}>
                  {votacionSel && votos ? 'Cómo votó cada partido' : 'Filtrar por partido'}
                </div>
                <button
                  onClick={() => setFPartido(null)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 6,
                    width: '100%', textAlign: 'left', padding: '5px 4px',
                    background: !fPartido ? '#2B3037' : 'transparent',
                    border: 'none', borderRadius: 2, cursor: 'pointer', marginBottom: 2
                  }}>
                  <span style={{ fontSize: 11.5, color: '#DDE1E5' }}>Todos</span>
                  <span className="em" style={{ fontSize: 11, color: '#8E959C' }}>{enHemiciclo.length}</span>
                </button>
                {(votacionSel && votos ? posicionPartidos : partidos.map(([siglas, { n, color }]) => ({
                  siglas, color, n, total: n, voto: null
                }))).map(g => (
                  <button key={g.siglas}
                    onClick={() => setFPartido(fPartido === g.siglas ? null : g.siglas)}
                    style={{
                      display: 'grid', gridTemplateColumns: '3px 1fr auto', alignItems: 'center', gap: 6,
                      width: '100%', textAlign: 'left', padding: '5px 4px',
                      background: fPartido === g.siglas ? '#2B3037' : 'transparent',
                      border: 'none', borderRadius: 2, cursor: 'pointer', transition: 'background 140ms ease'
                    }}>
                    <span style={{ width: 3, height: 16, background: g.color, borderRadius: 3 }} />
                    <span style={{ fontSize: 11.5, color: '#DDE1E5', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.siglas}</span>
                    {g.voto ? (
                      <span className="em" style={{ fontSize: 11, fontWeight: 500,
                        color: g.voto === 'si' ? '#5FBF92' : g.voto === 'no' ? '#E08278' : '#E0BB6A' }}>
                        {g.voto === 'si' ? '✓' : g.voto === 'no' ? '✕' : '−'}{g.n}
                      </span>
                    ) : (
                      <span className="em" style={{ fontSize: 11, color: '#8E959C' }}>{g.n}</span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ minWidth: 0 }}>
                <Hemiciclo
                  diputados={enHemiciclo}
                  votos={votos}
                  resaltado={fPartido ? d => (d.partido_siglas || d.grupo) === fPartido : null}
                  seleccionado={sel?.mandato_id}
                  onSeleccionar={setSel}
                  encimaExterno={encimaEscano}
                  onEncima={setEncimaEscano}
                />
                {votacionSel && (
                  <div style={{ marginTop: 10, color: '#DDE1E5', fontSize: 13, lineHeight: 1.45 }}>
                    {limpiarTitular(votacionSel.titular || votacionSel.subtitulo || votacionSel.titulo)}
                  </div>
                )}
              </div>
            </div>
            {ccaa.length > 0 && (
              <div className="chipsCcaa">
                <div className="em chipsCcaaTitulo">Filtrar por comunidad autónoma</div>
                <div className="chipsCcaaLista">
                  <button onClick={() => setFCcaa(null)} data-on={!fCcaa ? '1' : '0'}>
                    Toda España <span>{activos.length}</span>
                  </button>
                  {ccaa.map(c => (
                    <button key={c.slug} data-on={fCcaa === c.slug ? '1' : '0'}
                      onClick={() => setFCcaa(fCcaa === c.slug ? null : c.slug)}>
                      {c.nombre} <span>{c.diputados}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

              </div>
            </div>
          )}

          <div className={mostrarHemiciclo ? 'der' : 'contents'} style={mostrarHemiciclo ? { minWidth: 0 } : undefined}>
          {seccion === 'leyes' && !votacionSel && (
            <>
              <div>
                <div className="rot">Leyes que te afectan</div>
                <div className="chips">
                  {facetas.colectivos.filter(c => c.destacado).map(c => (
                    <Chip key={c.slug} on={fColectivo === c.slug} titulo={c.descripcion}
                      onClick={() => { const n = fColectivo === c.slug ? null : c.slug; setFColectivo(n); recargar({ colectivo: n }); }}>
                      {c.nombre} <span className="em" style={{ fontSize: 10, opacity: .7 }}>{c.votaciones}</span>
                    </Chip>
                  ))}
                  <Chip on={verMas} onClick={() => setVerMas(!verMas)}>{verMas ? 'cerrar' : 'más filtros'}</Chip>
                </div>

                {verMas && (
                  <div className="tarjeta" style={{ marginTop: 8, padding: 11 }}>
                    <input value={buscaFaceta} onChange={e => setBuscaFaceta(e.target.value)}
                      placeholder="Buscar colectivo o materia…" autoFocus
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: `1px solid ${C.linea}`, borderRadius: 2, marginBottom: 9 }} />
                    <div className="chips" style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {facetas.colectivos.filter(c => !c.destacado)
                        .filter(c => !buscaFaceta.trim() || (c.nombre + (c.descripcion ?? '')).toLowerCase().includes(buscaFaceta.toLowerCase()))
                        .map(c => (
                          <Chip key={c.slug} on={fColectivo === c.slug} titulo={c.descripcion}
                            onClick={() => { const n = fColectivo === c.slug ? null : c.slug; setFColectivo(n); setVerMas(false); recargar({ colectivo: n }); }}>
                            {c.nombre} <span className="em" style={{ fontSize: 10, opacity: .7 }}>{c.votaciones}</span>
                          </Chip>
                        ))}
                      {facetas.materias
                        .filter(m => !buscaFaceta.trim() || (m.nombre + (m.descripcion ?? '')).toLowerCase().includes(buscaFaceta.toLowerCase()))
                        .map(m => (
                          <Chip key={m.slug} on={fMateria === m.slug} color={m.color} titulo={m.descripcion}
                            onClick={() => { const n = fMateria === m.slug ? null : m.slug; setFMateria(n); setVerMas(false); recargar({ materia: n }); }}>
                            {m.nombre} <span className="em" style={{ fontSize: 10, opacity: .7 }}>{m.votaciones}</span>
                          </Chip>
                        ))}
                    </div>
                  </div>
                )}

                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && recargar({ texto: busqueda })}
                  placeholder="Buscar ley y pulsar Enter"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, margin: '12px 0',
                    border: `1px solid ${C.linea}`, borderRadius: 2, background: C.superficie }} />

                {(fMateria || fColectivo) && (
                  <button onClick={() => { setFMateria(null); setFColectivo(null); recargar({ materia: null, colectivo: null }); }}
                    className="em" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.media, fontSize: 11, padding: '0 0 10px' }}>
                    × quitar filtros
                  </button>
                )}
              </div>

              <div className="tarjeta" style={{ opacity: cargandoLista ? .5 : 1 }}>
                {votaciones.length === 0 && (
                  <div style={{ padding: 26, textAlign: 'center', fontSize: 12.5, color: C.tenue }}>
                    Ninguna votación con esos filtros.
                  </div>
                )}
                {votaciones.map((v, i) => {
                  const frase = fraseCortaDeNorma(v, 52);
                  const legal = limpiarTitular(v.titular || v.subtitulo || v.titulo);
                  return (
                  <button key={v.clave_norma ?? v.id} className="fila"
                    onClick={async () => {
                      const id = v.votacion_principal ?? v.id;
                      const completa = (await traerVotaciones(1, { id }))[0];
                      if (completa) setVotacionSel({ ...completa, clave_norma: v.clave_norma, votaciones_norma: v.votaciones });
                    }} style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: '11px 12px',
                    background: 'transparent', border: 'none', borderTop: i ? `1px solid ${C.linea}` : 'none'
                  }}>
                    <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {v.materia_nombre && (
                        <span style={{
                          background: v.materia_color || C.media, color: '#fff', padding: '2px 8px',
                          borderRadius: 2, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', fontSize: 10
                        }}>{v.materia_nombre}</span>
                      )}
                      <span>{v.fecha}</span>
                      {v.votaciones > 1 && (
                        <span style={{ color: C.media }}>
                          {v.votaciones} vot.{v.tramites > 0 ? ` · ${v.tramites} enm.` : ''}
                        </span>
                      )}
                    </div>
                    <div className="ed" style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>
                      {frase || (String(legal).length > 70 ? String(legal).slice(0, 67) + '…' : legal)}
                    </div>
                    {frase && (
                      <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 4, lineHeight: 1.35 }}>
                        {String(legal).length > 90 ? String(legal).slice(0, 87) + '…' : legal}
                      </div>
                    )}
                    <Barra si={v.total_si} no={v.total_no} abs={v.total_abstencion} alto={5} />
                    <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 4, display: 'flex', gap: 10 }}>
                      <span style={{ color: C.si }}>Sí {v.total_si}</span>
                      <span style={{ color: C.no }}>No {v.total_no}</span>
                      {v.resultado_fiable === false && v.votaciones > 1 ? (
                        <span style={{ marginLeft: 'auto', color: C.tenue }}>
                          última: <span style={{ color: v.resultado_ultima === 'aprobada' ? C.si : C.no }}>
                            {v.resultado_ultima}
                          </span>
                        </span>
                      ) : (
                        <span style={{ marginLeft: 'auto', fontWeight: 500,
                          color: (v.resultado_final ?? v.resultado_ultima ?? v.resultado) === 'aprobada' ? C.si : C.no }}>
                          {v.resultado_final ?? v.resultado_ultima ?? v.resultado}
                        </span>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
            </>
          )}

          {seccion === 'leyes' && votacionSel && (
            <>
              <DetalleLey votacion={votacionSel} onVolver={() => setVotacionSel(null)} />
              <Detalle votacion={votacionSel} diputados={diputados} votos={votos} onDiputado={setSel}
                onNorma={async n => {
                  const v = (await traerVotaciones(1, { id: n.votacion_principal }))[0];
                  if (v) setVotacionSel({ ...v, clave_norma: n.clave_norma, votaciones_norma: 1 });
                }} />
            </>
          )}

          {seccion === 'diputados' && (
            <div className="solo1">
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Nombre o circunscripción"
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 14.5, marginBottom: 12,
                  border: `1px solid ${C.linea}`, borderRadius: 3, background: C.superficie,
                  boxShadow: 'inset 0 1px 0 rgba(20,22,26,0.02)', outline: 'none'
                }} />

              <div className="rot">Ordenar por</div>
              <div className="chips" style={{ marginBottom: 12 }}>
                {ORDENES.map(([k, t]) => (
                  <Chip key={k} on={orden === k} onClick={() => setOrden(k)}>{t}</Chip>
                ))}
              </div>

              {(orden === 'privadas' || orden === 'donaciones') && (
                <div className="nota">
                  Esto <strong>no mide dinero ni patrimonio</strong>. Es el número de cargos o donaciones
                  que cada diputado declaró en su registro de intereses económicos. El Congreso no
                  publica los importes en formato reutilizable, así que aquí no hay ninguna cifra en euros.
                </div>
              )}

              {orden === 'patrimonio' && (
                <div className="nota">
                  Dinero declarado aproximado: depósitos + valores + planes − deuda.
                  No incluye el valor de inmuebles (el PDF no lo trae).
                  Cifras &gt;10 M o depósitos &gt;5 M se marcan para revisión (errores de coma/punto).
                  Digitaliza con <code>npm run bienes:auto</code>
                  {' '}· ahora: {diputados.filter(d => d.patrimonio_euros != null || d.bienes_total != null).length} con cifra
                  {diputados.filter(d => d.bienes_outlier).length
                    ? ` · ${diputados.filter(d => d.bienes_outlier).length} en revisión`
                    : ''}.
                </div>
              )}

              {(orden === 'inmuebles' || orden === 'inmuebles_todos') && (
                <div className="nota">
                  Bienes inmuebles declarados, contados por unidades y no por filas: «2 VIVIENDAS» = 2,
                  «13 FINCAS RÚSTICAS» = 13, «vivienda, plaza de garaje y trastero» = 3. Incluye viviendas,
                  parcelas y fincas, locales y naves, garajes y trasteros. Cada diputado lleva debajo su
                  desglose por tipo.
                  {orden === 'inmuebles'
                    ? ' Este orden cuenta solo los inmuebles en pleno dominio, nuda propiedad, usufructo, gananciales o comunidad de bienes.'
                    : ' Este orden suma los propios y los que figuran a nombre de una sociedad no cotizada del diputado, que se declaran por unidades aunque la cuota sea parcial. Abre la ficha para ver el desglose y el porcentaje.'}
                  {' '}Ahora: {diputados.filter(d => (d.n_casas ?? d.n_inmuebles) != null).length} con dato,
                  {' '}{diputados.filter(d => d.n_inmuebles_propios != null).length} con desglose.
                </div>
              )}

              {orden === 'vehiculos' && (
                <div className="nota">
                  Coches, motos, embarcaciones y aeronaves del PDF. Abre la ficha para ver el detalle
                  (p. ej. «Jeep Commander», «BMW R80RT»).
                  {' '}Ahora: {diputados.filter(d => (d.n_vehiculos ?? 0) > 0 || d.vehiculos_detalle).length} con vehículos.
                </div>
              )}

              {orden === 'ausencias' && (
                <div className="nota">
                  Ministros, presidencia del Gobierno y líderes de la oposición acumulan ausencias por
                  obligaciones institucionales. Una cifra alta no implica dejadez: es el número de
                  votaciones en las que esa persona no emitió voto.
                </div>
              )}

              {lideres.length > 0 && (
                <div className="tarjeta" style={{ padding: 14, marginBottom: 12 }}>
                  <div className="rot" style={{ marginBottom: 10 }}>
                    Quien más {ORDENES.find(o => o[0] === orden)?.[1].replace('Más ', '').toLowerCase()} en cada partido
                  </div>
                  <div style={{ display: 'grid', gap: 7, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
                    {lideres.map(l => (
                      <div key={l.partido} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ width: 3, height: 26, background: l.color || '#8E9299', borderRadius: 3, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.nombre_completo}
                          </span>
                          <span className="em" style={{ display: 'block', fontSize: 9.5, color: C.tenue }}>{l.partido_siglas}</span>
                        </span>
                        <span className="em" style={{ fontSize: 13, flexShrink: 0 }}>{l.valor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="em" style={{ fontSize: 11, color: C.tenue, marginBottom: 8 }}>
                {listaDip.length} diputados
                {encimaDip && (() => {
                  const d = listaDip.find(x => x.mandato_id === encimaDip);
                  return d ? <span style={{ color: C.media }}> · {d.nombre_completo}</span> : null;
                })()}
              </div>
              <div className="listaFilete">
                {listaDip.slice(0, 200).map((d, i) => (
                  <motion.button key={d.mandato_id} className="fila" data-top={i < 3 ? '1' : '0'} onClick={() => setSel(d)}
                    layout={i < 24 ? 'position' : false}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    onMouseEnter={() => setEncimaEscano(d.mandato_id)}
                    onMouseLeave={() => setEncimaEscano(null)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto auto minmax(0,1fr) auto',
                      alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      padding: i < 3 ? '13px 10px' : '9px 10px', cursor: 'pointer',
                      background: encimaEscano === d.mandato_id ? 'var(--acentoTenue)' : 'transparent',
                      border: 'none',
                      boxShadow: encimaEscano === d.mandato_id ? `inset 3px 0 0 ${d.color || '#8E9299'}` : 'none'
                    }}>
                    <span className="puesto">{i + 1}</span>
                    <AvatarPartido
                      foto={d.foto_url}
                      color={d.color}
                      siglas={d.partido_siglas || d.grupo}
                      nombre={d.nombre_completo}
                      w={i < 3 ? 34 : 28}
                      h={i < 3 ? 43 : 35}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{
                        display: 'block', fontSize: i < 3 ? 14.5 : 12.5, fontWeight: i < 3 ? 600 : 400,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{d.nombre_completo}</span>
                      <span className="em" style={{
                        display: 'block', fontSize: 9.5, color: C.tenue, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {d.partido_siglas || d.grupo || '—'} · {d.circunscripcion ?? '—'}
                      </span>
                      {(orden === 'inmuebles' || orden === 'inmuebles_todos') && desgloseBienes(d).length > 0 && (
                        <span className="em" style={{
                          display: 'block', fontSize: 9.5, color: '#8E959C', marginTop: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {desgloseBienes(d).map(x => x.texto).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span style={{ textAlign: 'right', flexShrink: 0, maxWidth: 120 }}>
                      {(() => {
                        const cfg = ORDENES.find(o => o[0] === orden) ?? ORDENES[0];
                        const fmtEuro = v => {
                          if (v == null || v === '—' || Number.isNaN(Number(v))) return '—';
                          const n = Number(v);
                          if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M';
                          if (Math.abs(n) >= 1000) return Math.round(n / 1000) + ' mil';
                          return String(Math.round(n));
                        };
                        const casas = d.n_casas ?? d.n_inmuebles;
                        const nVeh = d.n_vehiculos ?? ((d.n_coches ?? 0) + (d.n_motos ?? 0) + (d.n_embarcaciones ?? 0) + (d.n_aeronaves ?? 0));
                        const etiquetas = {
                          nombre: ['min', d.minutos_tribuna],
                          ausencias: ['aus.', d.ausencias],
                          disidencias: ['contra', d.disidencias],
                          tribuna: ['min', d.minutos_tribuna],
                          intervenciones: ['int.', d.intervenciones],
                          abstenciones: ['abs.', d.abstenciones],
                          telematicos: ['tel.', d.telematicos],
                          patrimonio: ['€', fmtEuro(d.patrimonio_euros ?? d.bienes_total)],
                          inmuebles: ['bienes', d.n_inmuebles_propios ?? casas ?? '—'],
                          inmuebles_todos: ['bienes', casas ?? '—'],
                          vehiculos: ['veh.', nVeh || '—'],
                          donaciones: ['don.', d.donaciones],
                          privadas: ['priv.', d.actividades_privadas]
                        };
                        const [et, val] = etiquetas[cfg[0]] ?? etiquetas.nombre;
                        let sub = et;
                        if (cfg[0] === 'inmuebles' && casas != null) sub = 'inmuebles';
                        if (cfg[0] === 'vehiculos') {
                          const partes = [];
                          if (d.n_coches) partes.push(`${d.n_coches} coche${d.n_coches === 1 ? '' : 's'}`);
                          if (d.n_motos) partes.push(`${d.n_motos} moto${d.n_motos === 1 ? '' : 's'}`);
                          if (d.n_embarcaciones) partes.push(`${d.n_embarcaciones} emb.`);
                          if (d.n_aeronaves) partes.push(`${d.n_aeronaves} aer.`);
                          sub = partes.length ? partes.join(' · ') : 'vehículos';
                        }
                        if (cfg[0] === 'patrimonio' && casas != null) sub = `${casas} inm.`;
                        return (<>
                          <span className="dato" style={{ display: 'block' }}>{val ?? 0}</span>
                          <span className="datoUnidad" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sub}
                          </span>
                        </>);
                      })()}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {seccion === 'inicio' && (
            <div className="solo1">
              <Inicio cobertura={cobertura} colectivos={facetas.colectivos} facetas={facetas}
                onIr={setSeccion}
                onVotacion={async n => {
                  const id = n?.votacion_principal ?? n?.id ?? n;
                  const v = (await traerVotaciones(1, { id }))[0];
                  if (v) {
                    setVotacionSel({ ...v, clave_norma: n?.clave_norma, votaciones_norma: n?.votaciones });
                    setSeccion('leyes');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }} />
            </div>
          )}

          {seccion === 'partidos' && <div className="solo1"><Partidos /></div>}
          {seccion === 'ejes' && <div className="solo1"><Mapa /></div>}
          {seccion === 'metodo' && <div className="solo1"><Metodologia cobertura={cobertura} /></div>}
          {seccion === 'datos' && <div className="solo1"><Descargas /></div>}
          </div>
        </motion.div>
        </AnimatePresence>

        <div style={{ marginTop: 26, paddingTop: 12, borderTop: `1px solid ${C.linea}`, fontSize: 10, color: C.tenue, lineHeight: 1.6 }}>
          Fuente: Congreso de los Diputados, datos abiertos. Ley 37/2007.
          Aplicación independiente, sin vínculo con ninguna institución.{' '}
          <button onClick={() => { setSeccion('metodo'); setVotacionSel(null); }} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: C.tinta, fontSize: 10, textDecoration: 'underline', fontFamily: 'inherit'
          }}>Cómo se hace esto</button>
          {' · '}
          <button onClick={() => { setSeccion('datos'); setVotacionSel(null); }} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: C.tinta, fontSize: 10, textDecoration: 'underline', fontFamily: 'inherit'
          }}>Descargar los datos</button>
        </div>
      </div>

      <FichaDiputado d={sel} onCerrar={() => setSel(null)}
        onVotacion={async id => {
          const v = votaciones.find(x => x.id === id) ?? (await traerVotaciones(1, { id }))[0];
          if (v) { setVotacionSel(v); setSel(null); setSeccion('leyes'); }
        }} />
    </>
  );
}