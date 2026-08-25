import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { fraseCortaDeNorma, nombreOficialNorma } from '../lib/fraseCorta.js';
import { etiquetasDeNorma } from '../lib/etiquetas.js';
import { cabeza as cabezaDe, figura, limitar, mezcla, pildora, trazo } from '../lib/morfo.js';

const TINTA = '#15171A';
const PAPEL = '#F3F1E8';
const ROJO = '#B4552F';
const HUESO = '#EFE1C4';

function diseno(cfg) {
  const { W, H, cx, ny, s, base, arco0, arcoPaso, barra, lupaR, alzada, copia } = cfg;
  const f = figura(cx, ny, s);
  const b = pildora(barra.x1, barra.x2, barra.y1, barra.y2);
  const cyBarra = (barra.y1 + barra.y2) / 2;
  return {
    W, H, cx, base, s, ny,
    ai: f[3].x, at: f[3].y, td: f[7].x,
    figura: f,
    barra: b,
    arcos: Array.from({ length: 9 }, (_, i) => ({ r: arco0 + i * arcoPaso, i })),
    cabeza: cabezaDe(cx, ny, s),
    destino: { x: barra.x2 - lupaR * 1.28, y: cyBarra, r: lupaR },
    alzada,
    copia,
    campo: {
      izq: barra.x1 + (barra.y2 - barra.y1) * 0.68,
      der: barra.x2 - lupaR * 2.9,
      arr: barra.y1,
      alto: barra.y2 - barra.y1
    },
    lupa: { izq: barra.x2 - lupaR * 2.3, ancho: lupaR * 2.05, arr: barra.y1, alto: barra.y2 - barra.y1 }
  };
}

const AMPLIO = diseno({
  W: 1120, H: 380, cx: 560, ny: 141, s: 0.69, base: 366, arco0: 150, arcoPaso: 27,
  barra: { x1: 150, x2: 970, y1: 288, y2: 356 }, lupaR: 26, alzada: 78,
  copia: { arr: 0.52, izq: 0.134, ancho: 0.732, escala: 3.1 }
});

const COMPACTO = diseno({
  W: 640, H: 640, cx: 320, ny: 185, s: 0.88, base: 610, arco0: 150, arcoPaso: 30,
  barra: { x1: 20, x2: 620, y1: 494, y2: 574 }, lupaR: 30, alzada: 118,
  copia: { arr: 0.62, izq: 0.06, ancho: 0.88, escala: 6.4 }
});

const QUIEN = [
  'autónomo', 'madre soltera', 'migrante', 'pensionista',
  'inquilina', 'agricultor', 'enfermera', 'estudiante'
];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const MUESTRA = [
  { id: 'a', materia: 'VIVIENDA', color: '#C88A1E', frase: 'Medidas fiscales contra la especulación', oficial: 'Proposición de Ley de medidas fiscales contra la especulación inmobiliaria', etiquetas: ['Inquilinos', 'Propietarios de vivienda'], si: 178, no: 172, aprobada: true, fecha: '' },
  { id: 'b', materia: 'IMPUESTOS', color: '#1F7A72', frase: 'Deducciones para damnificados por la DANA', oficial: 'Real Decreto-ley de medidas urgentes de apoyo a los damnificados', etiquetas: ['Contribuyentes', 'Autónomos'], si: 340, no: 0, aprobada: true, fecha: '' },
  { id: 'c', materia: 'MUTUALIDADES', color: '#B4552F', frase: 'Reforma del régimen de clases pasivas', oficial: 'Proposición de Ley de modificación del Real Decreto Legislativo 8/2015', etiquetas: ['Pensionistas', 'Empleo público'], si: 176, no: 174, aprobada: false, fecha: '' },
  { id: 'd', materia: 'SANIDAD', color: '#2E7D5B', frase: 'Cribado neonatal obligatorio cada dos años', oficial: 'Proposición de Ley sobre el programa de cribado neonatal', etiquetas: ['Familias', 'Pacientes'], si: 331, no: 4, aprobada: true, fecha: '' },
  { id: 'e', materia: 'ENERGÍA', color: '#8A6BB5', frase: 'Plan de respuesta a la crisis energética', oficial: 'Tramitación como Proyecto de Ley por el procedimiento de urgencia', etiquetas: ['Consumidores', 'Pymes / microempresas'], si: 182, no: 168, aprobada: true, fecha: '' },
  { id: 'f', materia: 'TRABAJO', color: '#B4552F', frase: 'Reducción de la jornada laboral', oficial: 'Proposición de Ley de reducción de la jornada máxima legal', etiquetas: ['Trabajadores por cuenta ajena', 'Pymes / microempresas'], si: 170, no: 178, aprobada: false, fecha: '' }
];

function pct(v, total) {
  return `${(v / total) * 100}%`;
}

function arco(d, r) {
  return `M ${d.cx - r} ${d.base} A ${r} ${r} 0 0 1 ${d.cx + r} ${d.base}`;
}

function fechaCorta(f) {
  if (!f) return '';
  const x = new Date(`${f}T12:00:00`);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getDate()} ${MESES[x.getMonth()]}`;
}

function normalizar(n, i, colectivos) {
  if (n && n.__muestra) return n;
  const oficial = String(nombreOficialNorma(n) ?? '');
  return {
    id: n.clave_norma ?? `n${i}`,
    materia: n.materia_nombre ?? '',
    color: n.materia_color ?? '#5A6067',
    frase: fraseCortaDeNorma(n, 88) || oficial.slice(0, 88),
    oficial: oficial.length > 190 ? `${oficial.slice(0, 187)}…` : oficial,
    etiquetas: etiquetasDeNorma(n, colectivos).slice(0, 3),
    si: n.total_si ?? 0,
    no: n.total_no ?? 0,
    aprobada: (n.resultado_final ?? n.resultado_ultima) === 'aprobada',
    fecha: fechaCorta(n.fecha),
    fila: n
  };
}

export function pulsoEscanos() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('escano:pulso'));
}

const estilos = `
.pvPortada{position:relative;width:100vw;margin-left:calc(50% - 50vw);background:${PAPEL};padding:18px 0 18px;margin-bottom:var(--s4,20px);overflow-x:clip;overflow-y:visible}
.pvCentro{max-width:1120px;margin:0 auto;padding:0 20px}
.pvCabecera{text-align:center;max-width:900px;margin:0 auto}
.pvTitular{margin:0;font-size:clamp(26px,3.9vw,46px);font-weight:600;letter-spacing:-.03em;line-height:1.05;color:#14161A}
.pvBajada{margin:6px auto 0;max-width:580px;font-size:clamp(12px,1.25vw,15px);line-height:1.5;color:#4A5057}
.pvEscena{position:relative;width:100%;max-width:1000px;container-type:inline-size;margin:2px auto 0}
.pvLienzo{position:absolute;inset:0;width:100%;height:100%;display:block}
.pvCopia{position:absolute;text-align:center;pointer-events:none}
.pvPregunta{margin:0;font-weight:600;letter-spacing:-.02em;color:#14161A;line-height:1.1}
.pvGiro{color:${ROJO};font-style:normal}
.pvInvita{margin:.66em auto 0;max-width:34em;line-height:1.45;color:#4A5057}
.pvCampo{position:absolute;background:none;border:0;outline:none;color:${HUESO};font-family:inherit;padding:0}
.pvCampo::placeholder{color:#8B8474}
.pvLupa{position:absolute;background:none;border:0;padding:0;cursor:pointer}
.pvSugerencias{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;max-width:760px;margin:12px auto 0}
.pvSugerencia{background:none;border:1px solid #D6CFBB;border-radius:20px;color:#5C5442;font:inherit;font-size:12.5px;padding:6px 13px;cursor:pointer;transition:border-color 140ms ease,color 140ms ease}
.pvSugerencia:hover{border-color:${TINTA};color:${TINTA}}
.pvEncabezado{display:flex;align-items:baseline;gap:12px;margin:22px auto 10px;flex-wrap:wrap}
.pvEncabezadoTitulo{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7A6132;margin:0}
.pvEncabezadoPie{font-size:12px;color:#6E6656;margin:0}
.pvTodas{margin-left:auto;background:none;border:0;padding:0;cursor:pointer;font:inherit;font-size:11.5px;color:#5C5442;letter-spacing:.04em}
.pvTodas:hover{color:${TINTA}}
.pvTarjetas{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 auto}
.pvCelda{position:relative}
.pvTarjeta{position:relative;width:100%;text-align:left;background:${TINTA};border:0;border-radius:2px;padding:15px;cursor:pointer;color:${HUESO};font:inherit;display:flex;flex-direction:column;gap:9px;min-height:100px}
.pvTarjeta:focus-visible{outline:2px solid ${ROJO};outline-offset:2px}
.pvPunto{position:absolute;top:13px;right:13px;width:9px;height:9px;opacity:.9}
.pvAncla{position:absolute;left:-12px;right:-12px;top:0;z-index:20;pointer-events:none}
.pvTarjetaAlta{padding:19px 20px;overflow:hidden;will-change:height,transform;pointer-events:auto;cursor:pointer;outline:2px solid ${PAPEL};outline-offset:-2px;box-shadow:0 0 0 1px rgba(21,23,26,.18)}
.pvFraseGrande{font-size:15px;line-height:1.3;font-weight:600;color:#F7F3EA}
.pvEtiqueta{align-self:flex-start;padding:4px 9px;border-radius:0;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${PAPEL}}
.pvFrase{font-size:13.5px;line-height:1.34;color:#F2E9D6;font-weight:500}
.pvVoto{display:flex;height:5px;border-radius:0;overflow:hidden;background:#2B2F34;margin-top:auto}
.pvVoto i{display:block;height:100%}
.pvPanel{display:flex;flex-direction:column;gap:9px;margin-top:2px;position:relative}
.pvMeta{display:flex;gap:9px;align-items:center;font-size:10px;letter-spacing:.05em;text-transform:uppercase}
.pvOficial{font-size:11.5px;line-height:1.55;color:#C6B084}
.pvChips{display:flex;gap:4px;flex-wrap:wrap}
.pvChip{font-size:9.5px;padding:2px 7px;border-radius:0;border:1px solid rgba(198,176,132,.38);color:#E2D6BC}
@media(max-width:700px){
.pvPortada{padding:12px 0 14px}
.pvEncabezado{margin-top:26px}
.pvCentro{padding:0 14px}
.pvTarjetas{grid-template-columns:1fr;gap:22px;margin-top:26px}
.pvSugerencia{font-size:12px;padding:6px 11px}
}
`;

function Estela({ d, px, py, rigidez, roce }) {
  const gx = useSpring(px, { stiffness: rigidez, damping: roce });
  const gy = useSpring(py, { stiffness: rigidez, damping: roce });
  const ruta = useTransform([gx, gy], ([a, b]) => trazo(d.figura, d.barra, a, b));
  const opacidad = useTransform(
    [px, gx, py, gy],
    ([a, b, c, e]) => Math.min(0.2, (Math.abs(a - b) + Math.abs(c - e)) * 1.15)
  );
  return <motion.path d={ruta} fill={TINTA} style={{ opacity: opacidad }} pointerEvents="none" />;
}

function Detalles({ d, opacidad }) {
  const { cx, ny, s, ai, at, td } = d;
  return (
    <motion.g style={{ opacity: opacidad }} pointerEvents="none">
      <path d={`M ${cx - 46 * s} ${ny} L ${cx} ${ny + 92 * s} L ${cx + 46 * s} ${ny} Z`} fill={PAPEL} />
      <path d={`M ${cx - 13 * s} ${ny + 22 * s} L ${cx + 13 * s} ${ny + 22 * s} L ${cx + 8 * s} ${ny + 104 * s} L ${cx} ${ny + 118 * s} L ${cx - 8 * s} ${ny + 104 * s} Z`} fill={TINTA} />
      <path d={`M ${cx + 196 * s} ${ny + 176 * s} L ${cx + 262 * s} ${ny + 62 * s}`}
        fill="none" stroke={TINTA} strokeWidth={9 * s} />
      <circle cx={cx + 268 * s} cy={ny + 50 * s} r={17 * s} fill={TINTA} />
      <rect x={cx - 196 * s} y={ny + 208 * s} width={166 * s} height={11 * s} fill={PAPEL} />
      <rect x={cx - 196 * s} y={ny + 208 * s} width={11 * s} height={72 * s} fill={PAPEL} />
    </motion.g>
  );
}

function Ficha({ t, total, expandida }) {
  return (
    <>
      {expandida ? null : (
        <span className="pvPunto" style={{ background: t.color }} />
      )}

      {t.materia ? (
        <motion.span layout="position" className="em pvEtiqueta"
          style={{ background: t.color }}>{t.materia}</motion.span>
      ) : null}

      <motion.span layout="position"
        className={expandida ? 'pvFraseGrande' : 'pvFrase'}>{t.frase}</motion.span>

      {total > 0 ? (
        <motion.span layout className="pvVoto">
          <i style={{ width: `${(t.si / total) * 100}%`, background: '#2E7D5B' }} />
          <i style={{ width: `${(t.no / total) * 100}%`, background: '#B23A2E' }} />
        </motion.span>
      ) : null}

      {expandida ? (
        <motion.span className="pvPanel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}>
          <span className="em pvMeta">
            <span style={{ color: '#C6B084' }}>{t.fecha}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: t.aprobada ? '#5FBF92' : '#E08278' }}>
              {t.aprobada ? 'Aprobada' : 'Rechazada'}
            </span>
          </span>
          <span className="em pvOficial">{t.oficial}</span>
          {t.etiquetas.length ? (
            <span className="pvChips">
              {t.etiquetas.map(e => <span key={e} className="em pvChip">{e}</span>)}
            </span>
          ) : null}
          {total > 0 ? (
            <span className="em pvOficial">{t.si} a favor · {t.no} en contra</span>
          ) : null}
        </motion.span>
      ) : null}
    </>
  );
}

function Tarjeta({ t, indice, activo, onEntrar, onSalir, onAbrir, reducido, estrecho }) {
  const total = (t.si ?? 0) + (t.no ?? 0);
  const base = useRef(null);
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    const el = base.current;
    if (!el) return;
    const medir = () => setAlto(el.offsetHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const abierto = activo && !estrecho;

  return (
    <motion.div className="pvCelda"
      onMouseEnter={onEntrar} onMouseLeave={onSalir}
      initial={reducido ? false : { opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reducido ? 0 : 1.62 + indice * 0.07, type: 'spring', stiffness: 200, damping: 22 }}>

      <button ref={base} className="pvTarjeta" onClick={onAbrir}
        onFocus={onEntrar} onBlur={onSalir}
        style={{ opacity: abierto ? 0 : 1, height: abierto && alto ? alto : undefined }}>
        {abierto ? null : <Ficha t={t} total={total} expandida={estrecho} />}
      </button>

      <AnimatePresence>
        {abierto ? (
          <div className="pvAncla">
            <motion.div className="pvTarjeta pvTarjetaAlta" onClick={onAbrir}
              style={{ transformOrigin: 'top center' }}
              initial={reducido ? false : { height: alto || 100, scaleX: 1, scaleY: 1 }}
              animate={{
                height: 'auto',
                scaleX: [1, 0.965, 1.012, 1],
                scaleY: [1, 1.05, 0.99, 1]
              }}
              exit={reducido ? undefined : { height: alto || 100, scaleX: 1, scaleY: 1 }}
              transition={{
                height: { type: 'spring', stiffness: 300, damping: 18, mass: 0.9 },
                scaleX: { duration: 0.52, times: [0, 0.28, 0.62, 1], ease: 'easeOut' },
                scaleY: { duration: 0.52, times: [0, 0.28, 0.62, 1], ease: 'easeOut' },
                default: { type: 'spring', stiffness: 300, damping: 18 }
              }}>
              <Ficha t={t} total={total} expandida />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Portada({
  onIr, onLey, escanos = 350, leyes, ultimas = [], colectivos = [],
  valor = '', onValor, onEnviar, pensando = false, ejemplos = []
}) {
  const reducido = useReducedMotion();
  const [estrecho, setEstrecho] = useState(false);
  const d = estrecho ? COMPACTO : AMPLIO;

  const avance = useMotionValue(reducido ? 1 : 0);
  const px = useSpring(avance, { stiffness: 118, damping: 12.5, mass: 1 });
  const py = useSpring(avance, { stiffness: 220, damping: 30, mass: 1 });
  const ph = useSpring(avance, { stiffness: 100, damping: 14, mass: 1 });

  const [onda, setOnda] = useState(0);
  const [encima, setEncima] = useState(null);
  const [listo, setListo] = useState(Boolean(reducido));
  const [giro, setGiro] = useState(0);
  const campo = useRef(null);

  const cuerpo = useTransform([px, py], ([a, b]) => trazo(d.figura, d.barra, a, b));
  const cabezaX = useTransform(ph, v => mezcla(d.cabeza.x, d.destino.x, v));
  const cabezaY = useTransform(ph, v => mezcla(d.cabeza.y, d.destino.y, v) - d.alzada * Math.sin(Math.PI * limitar(v)));
  const cabezaR = useTransform(ph, v => mezcla(d.cabeza.r, d.destino.r, limitar(v)));
  const detalles = useTransform(py, [0, 0.36], [1, 0]);
  const interfaz = useTransform(px, [0.74, 1], [0, 1]);
  const lupa = useTransform(ph, [0.82, 1], [0, 1]);
  const lupaX = useTransform(cabezaX, v => v - d.destino.x);
  const lupaY = useTransform(cabezaY, v => v - d.destino.y);

  const disparar = useCallback(() => setOnda(n => n + 1), []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const leer = () => setEstrecho(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);

  useEffect(() => {
    if (reducido) return;
    const a = setTimeout(() => avance.set(1), 900);
    const b = setTimeout(() => setListo(true), 1500);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [reducido, avance]);

  useEffect(() => {
    window.addEventListener('escano:pulso', disparar);
    return () => window.removeEventListener('escano:pulso', disparar);
  }, [disparar]);

  useEffect(() => {
    if (reducido || valor) return;
    const i = setInterval(() => setGiro(n => (n + 1) % QUIEN.length), 2500);
    return () => clearInterval(i);
  }, [reducido, valor]);

  const tarjetas = useMemo(() => {
    const vistas = new Set();
    const unicas = (ultimas ?? []).filter(n => {
      const texto = String(fraseCortaDeNorma(n, 88) || nombreOficialNorma(n) || '')
        .toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, '').trim();
      const clave = texto || n?.clave_norma;
      if (!clave || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
    const filas = unicas.length ? unicas.slice(0, 6) : MUESTRA.map(m => ({ ...m, __muestra: true }));
    return filas.map((n, i) => normalizar(n, i, colectivos));
  }, [ultimas, colectivos]);

  const pistas = ejemplos.slice(0, 4);
  const anchoUtil = estrecho ? '100%' : pct(d.barra[7].x - d.barra[2].x, d.W);

  function enviar() {
    disparar();
    onEnviar?.();
  }

  return (
    <section className="pvPortada">
      <style>{estilos}</style>
      <div className="pvCentro">
        <div className="pvCabecera">
          <motion.h1 className="ed pvTitular"
            initial={reducido ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.6 }}>
            ¿Sabes lo que está haciendo tu gobierno?
          </motion.h1>
          <motion.p className="pvBajada"
            initial={reducido ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.58 }}>
            {escanos} escaños{leyes ? `, ${leyes} leyes votadas` : ''}. Cada una, quién la apoyó
            y a quién afecta.
          </motion.p>
        </div>

        <div className="pvEscena" style={{ aspectRatio: `${d.W} / ${d.H}` }}>
          <svg className="pvLienzo" viewBox={`0 0 ${d.W} ${d.H}`} preserveAspectRatio="xMidYMid meet"
            role="img" aria-label="Silueta parlamentaria que se transforma en un buscador">

            <motion.g pointerEvents="none"
              animate={onda ? { scale: [1, 1.018, 1] } : { scale: 1 }}
              transition={{ duration: 0.7, ease: [0.3, 1.4, 0.4, 1] }}
              style={{ transformOrigin: `${d.cx}px ${d.base}px` }}>
              {d.arcos.map(({ r, i }) => (
                <motion.path key={r} d={arco(d, r)} fill="none"
                  stroke={i % 2 ? '#D9CEB2' : '#E5E0D0'}
                  strokeWidth={i % 2 ? 1.6 : 13}
                  strokeDasharray={i % 2 ? '7 10' : undefined}
                  initial={reducido ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: i % 2 ? 0.5 : 0.62 }}
                  transition={{ delay: 0.1 + i * 0.055, duration: 0.9, ease: 'easeOut' }} />
              ))}
            </motion.g>

            {reducido ? null : (
              <>
                <Estela d={d} px={px} py={py} rigidez={78} roce={13} />
                <Estela d={d} px={px} py={py} rigidez={52} roce={12} />
                <Estela d={d} px={px} py={py} rigidez={34} roce={11} />
              </>
            )}

            <motion.path d={cuerpo} fill={TINTA} style={{ cursor: 'text' }}
              onClick={() => campo.current?.focus()} />

            <Detalles d={d} opacidad={detalles} />

            <motion.circle cx={cabezaX} cy={cabezaY} r={cabezaR} fill={ROJO} pointerEvents="none" />

            <motion.g style={{ opacity: lupa, x: lupaX, y: lupaY }} pointerEvents="none">
              {pensando ? (
                <motion.circle cx={d.destino.x - 3} cy={d.destino.y - 3} r={d.destino.r * 0.31}
                  fill="none" stroke={HUESO} strokeWidth={2.5} strokeDasharray="9 40" strokeLinecap="round"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  style={{ transformOrigin: `${d.destino.x - 3}px ${d.destino.y - 3}px` }} />
              ) : (
                <>
                  <circle cx={d.destino.x - 3} cy={d.destino.y - 3} r={d.destino.r * 0.31}
                    fill="none" stroke={HUESO} strokeWidth={2.5} />
                  <path d={`M ${d.destino.x + 3} ${d.destino.y + 3} L ${d.destino.x + 10} ${d.destino.y + 10}`}
                    stroke={HUESO} strokeWidth={2.5} strokeLinecap="round" />
                </>
              )}
            </motion.g>
          </svg>

          <motion.div className="pvCopia" style={{
            opacity: interfaz,
            left: pct(d.copia.izq * d.W, d.W),
            width: pct(d.copia.ancho * d.W, d.W),
            top: pct(d.copia.arr * d.H, d.H)
          }}>
            <p className="ed pvPregunta" style={{ fontSize: `clamp(19px, ${d.copia.escala}cqw, 34px)` }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={QUIEN[giro]} style={{ display: 'inline-block' }}
                  initial={reducido ? false : { y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reducido ? undefined : { y: -16, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}>
                  ¿Eres <em className="pvGiro">{QUIEN[giro]}</em>?
                </motion.span>
              </AnimatePresence>
            </p>
            <p className="pvInvita" style={{ fontSize: `clamp(11px, ${d.copia.escala * 0.46}cqw, 16px)` }}>
              Escribe tu situación y te enseño solo las leyes que te tocan a ti.
            </p>
          </motion.div>

          <motion.input ref={campo} className="pvCampo" value={valor}
            onChange={e => onValor?.(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && enviar()}
            placeholder="Soy autónoma y vivo de alquiler…"
            aria-label="Describe tu situación"
            style={{
              opacity: interfaz,
              pointerEvents: listo ? 'auto' : 'none',
              left: pct(d.campo.izq, d.W),
              width: pct(d.campo.der - d.campo.izq, d.W),
              top: pct(d.campo.arr, d.H),
              height: pct(d.campo.alto, d.H),
              fontSize: `clamp(13px, ${(d.campo.alto / d.W) * 100 * 0.27}cqw, 18px)`
            }} />

          <motion.button className="pvLupa" onClick={enviar} aria-label="Ver mis leyes"
            style={{
              opacity: interfaz,
              pointerEvents: listo ? 'auto' : 'none',
              left: pct(d.lupa.izq, d.W),
              width: pct(d.lupa.ancho, d.W),
              top: pct(d.lupa.arr, d.H),
              height: pct(d.lupa.alto, d.H)
            }} />
        </div>

        {pistas.length ? (
          <div className="pvSugerencias">
            {pistas.map((e, i) => (
              <motion.button key={e} className="pvSugerencia"
                onClick={() => { onValor?.(e); onEnviar?.(e); disparar(); }}
                initial={reducido ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducido ? 0 : 1.45 + i * 0.06, duration: 0.4 }}>
                {e}
              </motion.button>
            ))}
          </div>
        ) : null}

        <motion.div className="pvEncabezado" style={{ width: anchoUtil }}
          initial={reducido ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reducido ? 0 : 1.55, duration: 0.45 }}>
          <p className="em pvEncabezadoTitulo">Lo último votado en el pleno</p>
          <p className="pvEncabezadoPie">
            Pasa por encima para ver el texto oficial y a quién afecta.
          </p>
          <button className="em pvTodas" onClick={() => onIr?.('leyes')}>Ver todas →</button>
        </motion.div>

        <div className="pvTarjetas" style={{ width: anchoUtil }}>
          {tarjetas.map((t, i) => (
            <Tarjeta key={t.id} t={t} indice={i} reducido={reducido} estrecho={estrecho}
              activo={encima === i}
              onEntrar={() => setEncima(i)}
              onSalir={() => setEncima(null)}
              onAbrir={() => { disparar(); t.fila && onLey ? onLey(t.fila) : onIr?.('leyes'); }} />
          ))}
        </div>
      </div>
    </section>
  );
}