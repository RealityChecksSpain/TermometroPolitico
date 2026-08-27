import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, motionValue, useReducedMotion } from 'framer-motion';
import { Cifra, Item, Lista, SALIDA } from './Movimiento.jsx';
import { traerFeed } from '../lib/cliente.js';
import { fraseCortaDeNorma, nombreOficialNorma } from '../lib/fraseCorta.js';
import { VOTO } from '../lib/paleta.js';

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3',
  ...VOTO
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaCorta(f) {
  if (!f) return '';
  const d = new Date(f + 'T12:00:00');
  const hoy = new Date();
  const dias = Math.round((hoy - d) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoy.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

export function fraseCorta(n) {
  return fraseCortaDeNorma(n, 52);
}


function Franja({ si, no, abs, aprobada, destacada }) {
  const s = Number(si ?? 0);
  const n = Number(no ?? 0);
  const a = Number(abs ?? 0);
  const t = s + n + a || 1;
  const segs = [
    ['A favor', s, C.si, aprobada],
    ['En contra', n, C.no, !aprobada],
    ['Abstención', a, C.abs, false]
  ];
  const alto = destacada ? 26 : 20;
  const resalte = 7;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', width: '100%',
        height: alto + resalte, overflow: 'hidden'
      }}>
        {segs.map(([et, v, col, gana], i) => v > 0 && (
          <motion.div key={et}
            style={{
              background: col, height: gana ? alto + resalte : alto, minWidth: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
            }}
            initial={{ width: 0 }}
            whileInView={{ width: `${(v / t) * 100}%` }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{ ...SALIDA, delay: i * 0.06 }}>
            {gana && (
              <span style={{
                width: 7, height: 7, borderRadius: 7, background: '#F3F1E8', flexShrink: 0
              }} />
            )}
            <span className="em" style={{
              fontSize: gana ? 11 : 10, fontWeight: 700, color: '#F3F1E8',
              whiteSpace: 'nowrap', padding: '0 4px'
            }}>
              <Cifra valor={v} />
            </span>
          </motion.div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        {segs.map(([et, v, col, gana]) => v > 0 && (
          <span key={et} className="em" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5,
            color: gana ? C.tinta : C.media, fontWeight: gana ? 700 : 400,
            letterSpacing: '.06em', textTransform: 'uppercase'
          }}>
            <span style={{ width: 8, height: 8, background: col, flexShrink: 0 }} />
            {et}
          </span>
        ))}
      </div>
    </div>
  );
}

function Tarjeta({ n, onAbrir, destacada, limpiarTitular }) {
  const reducido = useReducedMotion();
  const aprobada = (n.resultado_final ?? n.resultado_ultima) === 'aprobada';
  const frase = fraseCortaDeNorma(n, destacada ? 120 : 88);
  const tituloLegal = limpiarTitular
    ? limpiarTitular(n.titular || n.subtitulo || n.titulo)
    : nombreOficialNorma(n);
  const efectos = Array.isArray(n.efectos) ? n.efectos : [];

  return (
    <motion.article onClick={() => onAbrir(n)} style={{
      background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 2,
      padding: destacada ? 'clamp(16px, 2.5vw, 22px)' : '14px 15px',
      cursor: 'pointer', borderLeft: `4px solid ${n.materia_color || C.linea}`,
      position: 'relative'
    }}
      whileHover={reducido ? undefined : { y: -3, borderColor: C.tinta }}
      whileTap={reducido ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {n.materia_nombre ? (
          <span className="em" style={{
            fontSize: destacada ? 12 : 11, letterSpacing: '.06em', textTransform: 'uppercase',
            fontWeight: 700, color: '#fff', background: n.materia_color || C.media,
            padding: '3px 9px', borderRadius: 2
          }}>{n.materia_nombre}</span>
        ) : (
          <span className="em" style={{
            fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600,
            color: C.media, border: `1px solid ${C.linea}`, padding: '3px 9px', borderRadius: 2
          }}>Sin materia</span>
        )}
        <span className="em" style={{ fontSize: 10.5, color: C.tenue }}>{fechaCorta(n.fecha)}</span>
        {n.votaciones_norma > 1 && (
          <span className="em" style={{ fontSize: 10, color: C.media }}>
            {n.votaciones_norma} votaciones
          </span>
        )}
        <span className="em" style={{
          fontSize: 10, fontWeight: 700, marginLeft: 'auto', color: '#F3F1E8',
          background: aprobada ? C.si : C.no, padding: '3px 8px',
          textTransform: 'uppercase', letterSpacing: '.06em'
        }}>{aprobada ? 'Aprobada' : 'Rechazada'}</span>
      </div>

      <h3 className="ed" style={{
        fontSize: destacada ? 'clamp(20px, 2.8vw, 28px)' : 'clamp(16px, 2vw, 19px)',
        fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.015em', margin: 0, color: C.tinta
      }}>
        {frase || (String(tituloLegal).length > 130 ? String(tituloLegal).slice(0, 127) + '…' : tituloLegal)}
      </h3>

      <div className="em" style={{
        fontSize: 11, color: C.tenue, lineHeight: 1.45, marginTop: 8
      }} title={tituloLegal}>
        {String(tituloLegal).length > 260 ? String(tituloLegal).slice(0, 257) + '…' : tituloLegal}
      </div>

      <Franja si={n.total_si} no={n.total_no} abs={n.total_abstencion} aprobada={aprobada} destacada={destacada} />

      {efectos.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }}>
          {efectos.slice(0, destacada ? 4 : 3).map(e => (
            <span key={e.slug} className="em" style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 2,
              background: C.superficie, color: C.media, border: `1px solid ${C.linea}`
            }}>{e.nombre}</span>
          ))}
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

export default function Feed({ filtros, onAbrir, cabecera, limpiarTitular }) {
  const reducido = useReducedMotion();
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fin, setFin] = useState(false);
  const [fallo, setFallo] = useState(null);
  const valores = useRef([]);
  const centinela = useRef(null);
  const pista = useRef(null);
  const pagina = useRef(0);
  const clave = JSON.stringify(filtros ?? {});
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
      setItems(prev => reset ? nuevos : [...prev, ...nuevos]);
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
    pagina.current = 0;
    setFin(false);
    cargar(true);
  }, [clave]);

  useEffect(() => {
    if (reducido) return;
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
  }, [items.length, reducido]);

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
      {cabecera}
      <div ref={pista} style={{ position: 'relative', marginLeft: -SALIENTE, paddingLeft: HUECO + SALIENTE }}>
      {!reducido && items.length > 0 ? barras.map((v, i) => (
        <motion.span key={i} style={{
          position: 'absolute', left: i * GROSOR, top: 0, height: '100%', width: GROSOR,
          borderRadius: GROSOR, background: FRANJAS[i % FRANJAS.length],
          transformOrigin: 'top', scaleY: v, pointerEvents: 'none'
        }} />
      )) : null}
      <Lista style={{ display: 'grid', gap: 10 }}>
        {items.map((n, i) => (
          <Item key={n.clave_norma}>
            <Tarjeta n={n} onAbrir={onAbrir} destacada={i === 0} limpiarTitular={limpiarTitular} />
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