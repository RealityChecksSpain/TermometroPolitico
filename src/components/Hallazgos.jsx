import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { traerHallazgos } from '../lib/cliente.js';
import { Entrada, SALIDA } from './Movimiento.jsx';
import Explica from './Explica.jsx';
import { PALETAS } from './Bauhaus.jsx';

const TEMAS = {
  promesas: { nombre: 'Promesas', color: '#C88A1E' },
  patrimonio: { nombre: 'Patrimonio', color: '#B4552F' },
  migracion: { nombre: 'Migración', color: '#8A6BB5' },
  derechos: { nombre: 'Derechos', color: '#2E7D5B' },
  gasto: { nombre: 'Gasto público', color: '#1F7A72' },
  impuestos: { nombre: 'Impuestos', color: '#8A6D1F' },
  empresas: { nombre: 'Empresas', color: '#4A6FA5' },
  asistencia: { nombre: 'Asistencia', color: '#4A6FA5' },
  bloques: { nombre: 'Bloques', color: '#8A6BB5' },
  vivienda: { nombre: 'Vivienda', color: '#C88A1E' }
};

const MAXIMO = 10;

const estilos = `
.hallazgos.bhH{background:var(--h-fondo);border:3px solid var(--h-negro);border-radius:0;box-shadow:10px 10px 0 var(--h-negro);
padding:22px 22px 20px;margin:8px 0 34px}
@media(min-width:701px){.hallazgos.bhH{padding:28px 32px 24px}}
@media(max-width:700px){.hallazgos.bhH{box-shadow:6px 6px 0 var(--h-negro)}}
.bhH .hallazgosCab{border-bottom:2px solid var(--h-papel);padding-bottom:12px;margin-bottom:20px}
.bhH .rotulo{color:var(--h-acento);font-weight:700}
.bhH .hallazgosNav button{border:2px solid var(--h-papel);color:var(--h-papel);border-radius:0;width:30px;height:30px}
.bhH .hallazgosNav .contador{color:var(--h-papel)}
.bhH .hallazgoTitular{font-family:'Archivo Variable','Archivo',system-ui,sans-serif;font-weight:800;letter-spacing:-.02em;
color:var(--h-papel);font-size:clamp(20px,2.6vw,30px);line-height:1.12}
.bhH .hallazgoDetalle{color:var(--h-papel);opacity:.86;font-size:14.5px;line-height:1.65;margin-top:14px;max-width:62ch}
.bhH .hallazgosPuntos button{border-radius:0;height:8px;width:8px;background:var(--h-papel);opacity:.35}
.bhH .hallazgosPuntos button[data-on="1"]{background:var(--h-acento);opacity:1;width:22px}
.bhH .hallazgoVerTodos{border:2px solid var(--h-papel);color:var(--h-papel);border-radius:0;font-family:'DM Mono',ui-monospace,monospace}
.bhH .hallazgoEnlace{border:2px solid var(--h-papel);color:var(--h-papel);border-radius:0}
.bhH .hallazgoEnlace:hover{background:var(--h-negro);border-color:var(--h-acento)}
.bhH .hallazgoEnlaceFecha{color:var(--h-acento)}
.hallazgoFuente{margin-top:14px;color:var(--h-papel)}
.hallazgoFuente summary{cursor:pointer;font-family:'DM Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.06em;
text-transform:uppercase;opacity:.8;list-style:none;display:inline-flex;gap:6px;align-items:center}
.hallazgoFuente summary::-webkit-details-marker{display:none}
.hallazgoFuente summary::after{content:'+';font-weight:700}
.hallazgoFuente[open] summary::after{content:'−'}
.hallazgoFuente .hallazgoBase{color:var(--h-papel);opacity:.75;font-size:11.5px;line-height:1.6;margin-top:8px;max-width:70ch}
.hallazgoVerTodos{margin-left:auto;margin-top:12px;background:none;border:1px solid #3A4048;
border-radius:2px;color:#9AA4AC;font-size:10.5px;padding:4px 9px;cursor:pointer;
display:inline-flex;align-items:center;justify-content:center}
@media(hover:none){
.hallazgoVerTodos{min-height:44px;font-size:12px;padding:8px 14px}
}
.hallazgoEnlaces{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;max-width:100%}
.hallazgoEnlace{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid #A5603F;
color:#F3D9A4;font-size:11px;line-height:1.3;padding:5px 9px;border-radius:2px;cursor:pointer;max-width:100%;
text-align:left;font-family:inherit;text-decoration:none}
.hallazgoEnlaceTitulo{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hallazgoEnlaceFecha{flex-shrink:0;white-space:nowrap;color:#E8C56A}
.hallazgoEnlace:hover{background:#7C3A24;border-color:#E8C56A}
.hallazgoAviso{display:block;background:#E8C56A;color:#2A1E0C;font-size:11px;line-height:1.45;
padding:6px 9px;border-radius:2px;margin-bottom:10px;font-weight:500}
@media(hover:none){
.hallazgoAviso{font-size:12px}
.hallazgoEnlace{font-size:12px;min-height:40px;padding:8px 11px}
}
`;

function baseDe(h) {
  if (h.base_texto) return String(h.base_texto);
  if (h.denominador_texto) return String(h.denominador_texto);
  const n = h.base_n ?? h.denominador ?? null;
  if (n == null) return null;
  const que = h.base_unidad ?? h.unidad ?? 'registros';
  return `Calculado sobre ${Number(n).toLocaleString('es')} ${que}.`;
}

function urlSegura(valor) {
  try {
    const u = new URL(String(valor));
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function Enlaces({ h, onLey }) {
  const lista = (Array.isArray(h?.enlaces) ? h.enlaces : [])
    .map(e => ({ ...e, url: e?.url ? urlSegura(e.url) : null }))
    .filter(e => e.url || (e.votacion_principal && onLey));
  if (!lista.length) return null;
  return (
    <div className="hallazgoEnlaces">
      {lista.map((e, n) => (e.url ? (
        <a key={`url-${n}`} className="em hallazgoEnlace" href={e.url}
          target="_blank" rel="noopener noreferrer"
          title={e.titulo}
          aria-label={`Abrir la fuente en otra pestaña: ${e.titulo}${e.fecha ? `, ${e.fecha}` : ''}`}>
          <span className="hallazgoEnlaceTitulo">{e.titulo}</span>
          <span className="hallazgoEnlaceFecha">{e.fecha ? `${e.fecha} ↗` : '↗'}</span>
        </a>
      ) : (
        <button key={`votacion-${e.votacion_principal}`} className="em hallazgoEnlace"
          title={e.titulo}
          aria-label={`Abrir la votación: ${e.titulo}${e.fecha ? `, ${e.fecha}` : ''}`}
          onClick={() => onLey({ votacion_principal: e.votacion_principal, clave_norma: e.clave_norma })}>
          <span className="hallazgoEnlaceTitulo">{e.titulo}</span>
          <span className="hallazgoEnlaceFecha">{e.fecha ? `${e.fecha} →` : '→'}</span>
        </button>
      )))}
    </div>
  );
}

function utilizable(h) {
  if (!h?.titular) return false;
  if (!h.detalle || String(h.detalle).trim().length < 20) return false;
  return true;
}

function Fuente({ texto }) {
  if (!texto) return null;
  return (
    <details className="hallazgoFuente" onClick={e => e.stopPropagation()}>
      <summary>De dónde sale</summary>
      <span className="hallazgoBase">{texto}</span>
    </details>
  );
}

export default function Hallazgos({ onIr, onLey, traer = traerHallazgos, paleta = 'espana' }) {
  const P = PALETAS[paleta] ?? PALETAS.espana;
  const reducido = useReducedMotion();
  const [lista, setLista] = useState([]);
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [manual, setManual] = useState(false);
  const [sentido, setSentido] = useState(1);
  const [verTodos, setVerTodos] = useState(false);
  const [descartados, setDescartados] = useState(0);

  useEffect(() => {
    traer()
      .then(filas => {
        const buenos = (filas ?? []).filter(utilizable);
        setDescartados((filas ?? []).length - buenos.length);
        setLista(buenos.slice(0, MAXIMO));
      })
      .catch(() => setLista([]));
  }, [traer]);

  useEffect(() => {
    if (pausa || manual || reducido || lista.length < 2) return;
    const t = setInterval(() => { setSentido(1); setI(v => (v + 1) % lista.length); }, 9000);
    return () => clearInterval(t);
  }, [pausa, manual, reducido, lista.length]);

  const hayTextoElegido = () => {
    try {
      return String(window.getSelection?.() ?? '').trim().length > 2;
    } catch {
      return false;
    }
  };

  const abrir = destino => () => {
    if (hayTextoElegido()) return;
    if (destino) onIr?.(destino);
  };

  const ir = useCallback(n => {
    setManual(true);
    setSentido(n);
    setI(v => (v + n + lista.length) % lista.length);
  }, [lista.length]);

  const h = lista[i];
  const tema = useMemo(() => (h?.tema ? TEMAS[h.tema] : null), [h]);
  const base = useMemo(() => (h ? baseDe(h) : null), [h]);

  if (!lista.length) return null;

  const variantes = {
    entra: s => ({ opacity: 0, y: s > 0 ? 18 : -18 }),
    centro: { opacity: 1, y: 0 },
    sale: s => ({ opacity: 0, y: s > 0 ? -18 : 18 })
  };

  return (
    <Entrada desde={18}>
      <section className="hallazgos bhH"
        style={{ '--h-fondo': P.a, '--h-negro': P.negro, '--h-papel': P.papel, '--h-acento': P.b }}
        onMouseEnter={() => setPausa(true)}
        onMouseLeave={() => setPausa(false)}
        aria-live="polite">
        <style>{estilos}</style>
        <div className="hallazgosCab">
          <span className="em rotulo">Hallazgos<Explica termino="hallazgos" titulo="Hallazgos" tono="claro" /></span>
          {tema && (
            <motion.span key={tema.nombre} className="em"
              initial={reducido ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                color: '#F3F1E8', background: tema.color, padding: '3px 8px', border: `2px solid ${P.negro}`
              }}>{tema.nombre}</motion.span>
          )}
          <div className="hallazgosNav">
            <button onClick={() => ir(-1)} aria-label="Hallazgo anterior">‹</button>
            <span className="em contador">{i + 1}/{lista.length}</span>
            <button onClick={() => ir(1)} aria-label="Hallazgo siguiente">›</button>
          </div>
        </div>

        {verTodos ? (
          <div>
            {lista.map((x, n) => (
              <div key={x.titular} style={{ borderTop: n ? `2px solid ${P.papel}` : 'none', padding: '16px 0' }}>
              <button className="hallazgoCuerpo"
                onClick={abrir(x.seccion)}
                style={{ minHeight: 0, padding: 0 }}>
                {x.aviso && <span className="hallazgoAviso">{x.aviso}</span>}
                <span className="ed hallazgoTitular" style={{ fontSize: 18 }}>{x.titular}</span>
                <span className="hallazgoDetalle" style={{ fontSize: 12.5 }}>{x.detalle}</span>
              </button>
              <Fuente texto={baseDe(x)} />
              <Enlaces h={x} onLey={onLey} />
              </div>
            ))}
          </div>
        ) : (
          <button className="hallazgoCuerpo" onClick={abrir(h.seccion)}
            style={{ display: 'grid' }}>
            <AnimatePresence mode="wait" custom={sentido} initial={false}>
              <motion.span key={h.titular} custom={sentido} variants={variantes}
                initial={reducido ? false : 'entra'} animate="centro" exit={reducido ? undefined : 'sale'}
                transition={SALIDA} style={{ display: 'block' }}>
                {h.aviso && <span className="hallazgoAviso">{h.aviso}</span>}
                <span className="ed hallazgoTitular" style={{ display: 'block' }}>{h.titular}</span>
                <span className="hallazgoDetalle" style={{ display: 'block' }}>{h.detalle}</span>
              </motion.span>
            </AnimatePresence>
          </button>
        )}

        {!verTodos && <Fuente key={`f-${h.titular}`} texto={base} />}

        {!verTodos && <Enlaces key={h.titular} h={h} onLey={onLey} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {!verTodos && (
            <div className="hallazgosPuntos">
              {lista.map((_, n) => (
                <button key={n} onClick={() => { setManual(true); setSentido(n > i ? 1 : -1); setI(n); }}
                  data-on={n === i ? '1' : '0'} aria-label={`Hallazgo ${n + 1}`} />
              ))}
            </div>
          )}
          <button onClick={() => setVerTodos(v => !v)} className="em hallazgoVerTodos">
            {verTodos ? 'ver de uno en uno' : `ver los ${lista.length}`}
          </button>
        </div>

        {descartados > 0 && (
          <div className="em" style={{ fontSize: 10, color: P.papel, opacity: 0.6, marginTop: 12, lineHeight: 1.5 }}>
            {descartados === 1
              ? 'Un hallazgo no se enseña porque no trae el dato en que se apoya.'
              : `${descartados} hallazgos no se enseñan porque no traen el dato en que se apoyan.`}
          </div>
        )}
      </section>
    </Entrada>
  );
}