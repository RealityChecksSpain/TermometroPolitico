import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, motionValue, useReducedMotion } from 'framer-motion';
import { Cifra, Item, Lista, SALIDA } from './Movimiento.jsx';
import { traerFeed, traerMaterias } from '../lib/cliente.js';
import { estaSeguido } from '../lib/seguimientos.js';
import BotonSeguir from './BotonSeguir.jsx';
import { nombreCompletoNorma, resumenBreve, titularDeNorma, vehiculoNorma } from '../lib/fraseCorta.js';
import { useTelefono } from '../lib/pantalla.js';
import { VOTO } from '../lib/paleta.js';

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3',
  ...VOTO
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const estilos = `
.feedPista{position:relative}
.feedTarjeta{background:${C.superficie};border:1px solid ${C.linea};border-radius:2px;
cursor:pointer;position:relative;border-left:4px solid var(--materia,${C.linea})}
.feedCab{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.feedTitular{font-weight:600;line-height:1.24;letter-spacing:-0.015em;margin:0;color:${C.tinta}}
.feedResumen{color:${C.media};line-height:1.5;margin-top:8px}
.feedOficial{color:${C.tenue};line-height:1.45;margin-top:8px}
.feedTipo{display:block;color:${C.media};font-weight:700;letter-spacing:.05em;
text-transform:uppercase;font-size:9.5px;margin-bottom:3px}
.feedLeyenda{display:flex;gap:12px;margin-top:6px;flex-wrap:wrap}
.feedEfectos{display:flex;gap:5px;flex-wrap:wrap;margin-top:12px}
.feedAcciones{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.feedAccion{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:2px;
background:#F1EFE4;color:#3A3F45;border:1px solid #DFD9C6;font-weight:600;letter-spacing:.01em}
.feedAccion::before{content:'';width:5px;height:5px;border-radius:5px;background:var(--tono,#8E9299);flex-shrink:0}
.feedAviso{color:#6B5518;background:#FFF8E6;border:1px solid #E8D9A8;display:inline-block;
padding:2px 7px;margin-top:8px;border-radius:2px;font-size:10px}
.feedQueEs{color:${C.tenue};line-height:1.5;margin:8px 0 0;padding-left:9px;
border-left:2px solid ${C.linea}}
@media(max-width:700px){.feedQueEs{font-size:12px}}
@media(min-width:701px){.feedQueEs{font-size:12.5px}}
@media(max-width:700px){.feedAccion{font-size:11.5px;padding:4px 9px}}
@media(min-width:701px){.feedAccion{font-size:12px}}
@media(max-width:700px){
.feedTarjeta{padding:13px 13px 15px;border-left-width:3px}
.feedTitular{font-size:17px}
.feedResumen{font-size:13px}
.feedOficial{font-size:11px}
.feedLeyenda{gap:10px}
}
@media(min-width:701px){
.feedTarjeta{padding:15px 16px}
.feedTarjeta[data-destacada="1"]{padding:clamp(16px,2.5vw,22px)}
.feedTitular{font-size:clamp(16px,2vw,19px)}
.feedTarjeta[data-destacada="1"] .feedTitular{font-size:clamp(20px,2.8vw,28px)}
.feedResumen{font-size:13.5px}
.feedOficial{font-size:11.5px}
}
`;

function fechaCorta(f) {
  if (!f) return '';
  const d = new Date(`${f}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const dias = Math.round((hoy - d) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoy.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

export function fraseCorta(n) {
  return titularDeNorma(n, 88);
}

const SUBE = /^(m[áa]s|sube|abre|amplía|amplia|nacionaliza|cede|protege|refuerza|relaja)\b/i;

function TONO_ACCION(a) {
  return SUBE.test(a) ? '#2E7D5B' : '#B4552F';
}

function resultadoDeNorma(n) {
  const votaciones = Number(n?.votaciones_norma ?? n?.votaciones ?? 1);
  const dudoso = n?.resultado_fiable === false && votaciones > 1;
  const bruto = dudoso
    ? (n?.resultado_ultima ?? null)
    : (n?.resultado_final ?? n?.resultado_ultima ?? n?.resultado ?? null);
  if (bruto === 'aprobada') {
    return { texto: dudoso ? 'Última: aprobada' : 'Aprobada', color: C.si, conocido: true, dudoso, gana: 'si' };
  }
  if (bruto === 'rechazada') {
    return { texto: dudoso ? 'Última: rechazada' : 'Rechazada', color: C.no, conocido: true, dudoso, gana: 'no' };
  }
  return { texto: 'Sin resultado en el acta', color: C.tenue, conocido: false, dudoso: false, gana: null };
}

function Franja({ si, no, abs, gana, destacada, estrecho }) {
  const s = Number(si ?? 0);
  const n = Number(no ?? 0);
  const a = Number(abs ?? 0);
  const t = s + n + a || 1;
  const segs = [
    ['A favor', s, C.si, gana === 'si'],
    ['En contra', n, C.no, gana === 'no'],
    ['Abstención', a, C.abs, false]
  ];
  const alto = destacada && !estrecho ? 26 : 20;
  const resalte = 7;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', width: '100%',
        height: alto + resalte, overflow: 'hidden'
      }}>
        {segs.map(([et, v, col, lidera], i) => v > 0 && (
          <motion.div key={et}
            title={`${et}: ${v}`}
            style={{
              background: col, height: lidera ? alto + resalte : alto, minWidth: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
            }}
            initial={{ width: 0 }}
            whileInView={{ width: `${(v / t) * 100}%` }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{ ...SALIDA, delay: i * 0.06 }}>
            {lidera && (v / t) > 0.12 && (
              <span style={{ width: 7, height: 7, borderRadius: 7, background: '#F3F1E8', flexShrink: 0 }} />
            )}
            {(v / t) > (estrecho ? 0.16 : 0.09) && (
              <span className="em" style={{
                fontSize: lidera ? 11 : 10, fontWeight: 700, color: '#F3F1E8',
                whiteSpace: 'nowrap', padding: '0 4px'
              }}>
                <Cifra valor={v} />
              </span>
            )}
          </motion.div>
        ))}
      </div>
      <div className="feedLeyenda">
        {segs.map(([et, v, col, lidera]) => v > 0 && (
          <span key={et} className="em" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5,
            color: lidera ? C.tinta : C.media, fontWeight: lidera ? 700 : 400,
            letterSpacing: '.06em', textTransform: 'uppercase'
          }}>
            <span style={{ width: 8, height: 8, background: col, flexShrink: 0 }} />
            {et}{(v / t) > (estrecho ? 0.16 : 0.09) ? '' : ` ${v}`}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tarjeta({ n, onAbrir, destacada, materiaId, estrecho }) {
  const reducido = useReducedMotion();
  const [seguida, setSeguida] = useState(() => (materiaId ? estaSeguido('materia', materiaId) : false));
  const resultado = resultadoDeNorma(n);
  const titular = titularDeNorma(n, destacada && !estrecho ? 130 : 96);
  const resumen = resumenBreve(n, estrecho ? 1 : 2);
  const oficial = nombreCompletoNorma(n);
  const vehiculo = vehiculoNorma(n);
  const efectos = Array.isArray(n.efectos) ? n.efectos : [];
  const acciones = Array.isArray(n.acciones) ? n.acciones.slice(0, estrecho ? 2 : 3) : [];
  const votaciones = Number(n.votaciones_norma ?? n.votaciones ?? 1);
  const cabeza = titular ? titular.replace(/…$/, '').toLowerCase().slice(0, 40) : '';
  const mismoTexto = Boolean(resumen && cabeza && resumen.toLowerCase().startsWith(cabeza));

  return (
    <motion.article className="feedTarjeta" data-destacada={destacada ? '1' : '0'}
      onClick={() => onAbrir(n)}
      style={{ '--materia': n.materia_color || C.linea }}
      whileHover={reducido || estrecho ? undefined : { y: -3, borderColor: C.tinta }}
      whileTap={reducido ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}>

      <div className="feedCab">
        {n.materia_nombre ? (
          <span className="em" style={{
            fontSize: destacada && !estrecho ? 12 : 10.5, letterSpacing: '.06em', textTransform: 'uppercase',
            fontWeight: 700, color: '#fff', background: n.materia_color || C.media,
            padding: '3px 9px', borderRadius: 2
          }}>{n.materia_nombre}</span>
        ) : (
          <span className="em" style={{
            fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600,
            color: C.media, border: `1px solid ${C.linea}`, padding: '3px 9px', borderRadius: 2
          }}>Sin materia</span>
        )}
        <span className="em" style={{ fontSize: 10.5, color: C.tenue }}>{fechaCorta(n.fecha)}</span>
        {votaciones > 1 && (
          <span className="em" style={{ fontSize: 10, color: C.media }}>{votaciones} votaciones</span>
        )}
        <span className="em" style={{
          fontSize: 10, fontWeight: 700, marginLeft: 'auto',
          color: resultado.conocido && !resultado.dudoso ? '#F3F1E8' : C.media,
          background: resultado.conocido && !resultado.dudoso ? resultado.color : 'transparent',
          border: resultado.conocido && !resultado.dudoso ? 'none' : `1px solid ${C.linea}`,
          padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '.06em'
        }}>{resultado.texto}</span>
      </div>

      <h3 className="ed feedTitular">{titular}</h3>

      {vehiculo && !vehiculo.fuerzaDeLey && (
        <div className="em feedAviso">{vehiculo.nombre} · no tiene fuerza de ley</div>
      )}

      {acciones.length > 0 && (
        <div className="feedAcciones">
          {acciones.map(a => (
            <span key={a} className="feedAccion"
              style={{ '--tono': TONO_ACCION(a) }}>{a}</span>
          ))}
        </div>
      )}

      {resumen && !mismoTexto && <p className="feedResumen" style={{ margin: 0 }}>{resumen}</p>}

      {!resumen && vehiculo?.queEs && <p className="feedQueEs">{vehiculo.queEs}</p>}

      {(oficial || vehiculo) && (
        <div className="em feedOficial">
          {vehiculo && <span className="feedTipo">{vehiculo.nombre}</span>}
          {oficial}
        </div>
      )}

      <Franja si={n.total_si} no={n.total_no} abs={n.total_abstencion}
        gana={resultado.gana} destacada={destacada} estrecho={estrecho} />

      {resultado.dudoso && (
        <div className="em" style={{ fontSize: 10, color: '#8A6D1F', marginTop: 8, lineHeight: 1.5 }}>
          Esta norma tiene {votaciones} votaciones y los datos abiertos no permiten saber cuál fue la
          final. Se muestra la última registrada.
        </div>
      )}

      {(efectos.length > 0 || materiaId) && (
        <div className="feedEfectos">
          {efectos.slice(0, destacada && !estrecho ? 4 : 3).map(e => (
            <span key={e.slug} className="em" style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 2,
              background: C.superficie, color: C.media, border: `1px solid ${C.linea}`
            }}>{e.nombre}</span>
          ))}
          {materiaId && (
            <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', marginLeft: 'auto' }}>
              <BotonSeguir tipo="materia" id={materiaId} seguido={seguida}
                alCambiar={(_t, _i, ahora) => setSeguida(ahora)} compacto />
            </span>
          )}
        </div>
      )}
    </motion.article>
  );
}

const FRANJAS = ['#E0492E', '#EE7B3A', '#F2A93E', '#F7E2B4', '#0E3550', '#1A6B8A', '#17836F'];
const VAIVEN = [1.7, 2.4, 1.3, 3.1, 2.0, 2.7, 1.5];
const FASE = [0, 1.9, 3.4, 0.8, 4.6, 2.6, 5.4];
const GROSOR = 13;
const CARRILES = 7;
const SALIENTE = 58;
const DESFASE = 130;
const HUECO = CARRILES * 13 + 12;

export default function Feed({ filtros, onAbrir, cabecera }) {
  const reducido = useReducedMotion();
  const estrecho = useTelefono();
  const [items, setItems] = useState([]);
  const [materias, setMaterias] = useState(new Map());
  const [cargando, setCargando] = useState(true);
  const [fin, setFin] = useState(false);
  const [fallo, setFallo] = useState(null);
  const valores = useRef([]);
  const centinela = useRef(null);
  const pista = useRef(null);
  const pagina = useRef(0);
  const clave = JSON.stringify(filtros ?? {});
  const conFranjas = !reducido && !estrecho;

  const valorDe = i => {
    if (!valores.current[i]) valores.current[i] = motionValue(0);
    return valores.current[i];
  };

  const barras = Array.from({ length: CARRILES }, (_, i) => valorDe(i));

  const cargar = useCallback(async (reset) => {
    setCargando(true);
    try {
      const desde = reset ? 0 : pagina.current * 20;
      const nuevos = await traerFeed(20, desde, filtros ?? {});
      setFallo(null);
      setItems(prev => (reset ? nuevos : [...prev, ...nuevos]));
      setFin(nuevos.length < 20);
      pagina.current = reset ? 1 : pagina.current + 1;
    } catch (e) {
      console.error('traerFeed', e);
      setFallo(e?.message || String(e));
      setFin(true);
    } finally {
      setCargando(false);
    }
  }, [clave]);

  useEffect(() => {
    let vivo = true;
    traerMaterias()
      .then(lista => { if (vivo) setMaterias(new Map(lista.map(m => [m.slug, m.id]))); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    pagina.current = 0;
    setFin(false);
    cargar(true);
  }, [clave]);

  useEffect(() => {
    if (!conFranjas) return;
    let pedido = 0;
    const medir = () => {
      pedido = 0;
      const cont = pista.current;
      if (!cont) return;
      const marco = cont.getBoundingClientRect();
      if (marco.height <= 0) return;
      const linea = window.innerHeight * 0.62;
      const bruto = (linea - marco.top) / marco.height;
      const avance = bruto < 0 ? 0 : bruto > 1 ? 1 : bruto;
      const resto = 1 - avance;
      const brecha = DESFASE * 0.55 * resto;
      for (let i = 0; i < CARRILES; i++) {
        const vaiven = Math.sin(avance * VAIVEN[i] * 6.2832 + FASE[i]) * DESFASE * 1.42 * resto;
        const punta = (linea - i * brecha + vaiven - marco.top) / marco.height;
        valorDe(i).set(punta < 0 ? 0 : punta > 1 ? 1 : punta);
      }
    };
    const alMover = () => { if (!pedido) pedido = requestAnimationFrame(medir); };
    medir();
    window.addEventListener('scroll', alMover, { passive: true });
    window.addEventListener('resize', alMover);
    return () => {
      if (pedido) cancelAnimationFrame(pedido);
      window.removeEventListener('scroll', alMover);
      window.removeEventListener('resize', alMover);
    };
  }, [items.length, conFranjas]);

  useEffect(() => {
    if (fin || cargando) return;
    const el = centinela.current;
    if (!el) return;
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) cargar(false); }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fin, cargando, cargar]);

  return (
    <div>
      <style>{estilos}</style>
      {cabecera}
      <div ref={pista} className="feedPista"
        style={conFranjas ? { marginLeft: -SALIENTE, paddingLeft: HUECO + SALIENTE } : undefined}>
        {conFranjas && items.length > 0 ? barras.map((v, i) => (
          <motion.span key={i} style={{
            position: 'absolute', left: i * GROSOR, top: 0, height: '100%', width: GROSOR,
            borderRadius: GROSOR, background: FRANJAS[i % FRANJAS.length],
            transformOrigin: 'top', scaleY: v, pointerEvents: 'none'
          }} />
        )) : null}
        <Lista style={{ display: 'grid', gap: estrecho ? 12 : 10 }}>
          {items.map((n, i) => (
            <Item key={n.clave_norma ?? n.id ?? i}>
              <Tarjeta n={n} onAbrir={onAbrir} destacada={i === 0} estrecho={estrecho}
                materiaId={materias.get(n.materia) ?? null} />
            </Item>
          ))}
        </Lista>
      </div>

      {cargando && (
        <div className="em" style={{ padding: 24, textAlign: 'center', color: C.tenue, fontSize: 12 }}>
          cargando…
        </div>
      )}

      {!cargando && items.length === 0 && !fallo && (
        <div style={{ padding: 36, textAlign: 'center', color: C.tenue, fontSize: 13 }}>
          No hay leyes con esos filtros.
        </div>
      )}

      {!cargando && fallo && (
        <div style={{
          padding: 20, margin: '12px 0', borderRadius: 2, fontSize: 13, lineHeight: 1.6,
          background: '#FFF8E6', border: '1px solid #E8D9A8', color: '#6B5518'
        }}>
          <strong>No se han podido cargar las leyes.</strong>
          <div className="em" style={{ fontSize: 11, marginTop: 6, color: '#8A6D1F' }}>{fallo}</div>
          <button onClick={() => { pagina.current = 0; setFin(false); cargar(true); }} className="em" style={{
            marginTop: 12, padding: '6px 12px', fontSize: 11.5, cursor: 'pointer',
            background: 'transparent', border: '1px solid #C8A85A', borderRadius: 2, color: '#6B5518'
          }}>Reintentar</button>
        </div>
      )}

      <div ref={centinela} style={{ height: 1 }} />

      {fin && items.length > 0 && (
        <div className="em" style={{ padding: 24, textAlign: 'center', color: C.tenue, fontSize: 11 }}>
          Has llegado al final · <Cifra valor={items.length} /> normas
        </div>
      )}
    </div>
  );
}