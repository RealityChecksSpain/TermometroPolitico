import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { traerProgramasInicio } from '../lib/cliente.js';
import { useTelefono } from '../lib/pantalla.js';
import { declaracionesDe, partidosSoloDeclaraciones, SIN_DATOS, REVISADO } from '../lib/declaraciones2026.js';

const NEGRO = '#17130F';
const CREMA = '#F2E7D3';
const PAPEL = '#FAF3E6';
const GRIS = '#5E574D';
const ROJO = '#B5382C';
const MOSTAZA = '#D6A03A';
const AZUL = '#21466D';
const VERDE = '#2D5A45';
const NARANJA = '#EE9D57';
const SUAVE = [0.22, 1, 0.36, 1];
const BORDE = `3px solid ${NEGRO}`;
const SOMBRA = `6px 6px 0 ${NEGRO}`;

const VOTADAS = [
  { k: 'cumplida', color: VERDE, corto: 'Cumplidas', largo: 'La votó a favor y salió una norma.' },
  { k: 'apoyada_no_decisiva', color: AZUL, corto: 'No decisivas', largo: 'La apoyó en una votación que no aprueba ninguna norma.' },
  { k: 'apoyada_sin_aprobar', color: MOSTAZA, corto: 'Apoyó, no salió', largo: 'La apoyó y la votación no salió adelante.' },
  { k: 'contradicha', color: ROJO, corto: 'Votó en contra', largo: 'Votó lo contrario de lo que prometió.' }
];

const FILTROS = [
  { tema: 'Impuestos', a: ['impuestos:reduce', 'Bajar'], b: ['impuestos:aumenta', 'Subir'] },
  { tema: 'Gasto público', a: ['gasto_publico:reduce', 'Menos'], b: ['gasto_publico:aumenta', 'Más'] },
  { tema: 'Servicios y empresas públicas', a: ['propiedad_publica:reduce', 'Más gestión privada'], b: ['propiedad_publica:aumenta', 'Más gestión pública'] },
  { tema: 'Trabajo', a: ['proteccion_laboral:reduce', 'Más flexibilidad'], b: ['proteccion_laboral:aumenta', 'Más protección'] },
  { tema: 'Regulación del mercado', a: ['regulacion_mercado:reduce', 'Menos'], b: ['regulacion_mercado:aumenta', 'Más'] },
  { tema: 'Inmigración', a: ['apertura_migratoria:reduce', 'Más control'], b: ['apertura_migratoria:aumenta', 'Más vías de entrada'] },
  { tema: 'Policía y penas', a: ['orden_publico:reduce', 'Más poder policial y penal'], b: ['orden_publico:aumenta', 'Más garantías'] },
  { tema: 'Autonomías', a: ['descentralizacion:reduce', 'Más Estado'], b: ['descentralizacion:aumenta', 'Más autogobierno'] },
  { tema: 'Medio ambiente', a: ['medio_ambiente:reduce', 'Menos exigencias'], b: ['medio_ambiente:aumenta', 'Más protección'] },
  { tema: 'Unión Europea', a: ['integracion_europea:reduce', 'Menos integración'], b: ['integracion_europea:aumenta', 'Más integración'] }
];

const ETIQUETA = Object.fromEntries(FILTROS.flatMap(f => [[f.a[0], `${f.tema}: ${f.a[1].toLowerCase()}`], [f.b[0], `${f.tema}: ${f.b[1].toLowerCase()}`]]));

const CLAVES = [
  { re: 'vivienda[s]?|alquiler(?:es)?|inquilin[oa]s?|desahucios?|casas|suelo|licencias de obra|zonas tensionadas|pisos turísticos', fondo: ROJO, tinta: '#FFF' },
  { re: 'impuestos?|IVA|IRPF|sociedades|transmisiones|cuota de autónomos|herencias|fortunas|beneficios extraordinarios|deflactar', fondo: MOSTAZA, tinta: NEGRO },
  { re: 'inmigración|migratori[ao]|remigración|prioridad nacional|Ceuta|fronteras?|nacionalidad', fondo: AZUL, tinta: '#FFF' },
  { re: 'sanidad|sanitari[ao]|salud|hospital(?:es)?', fondo: VERDE, tinta: '#FFF' },
  { re: 'jornada(?: laboral)?|salario mínimo|SMI|empleo|despido|autónomos|35 horas|36 horas', fondo: NARANJA, tinta: NEGRO },
  { re: 'centrales nucleares|nucleares|renovables|energía|clima|medio ambiente', fondo: VERDE, tinta: '#FFF' },
  { re: 'nuevo estatus|autogobierno|plurinacionalidad|competencias', fondo: AZUL, tinta: '#FFF' },
  { re: 'pensiones|educación|becas', fondo: ROJO, tinta: '#FFF' }
];
const RE_CLAVES = new RegExp(`(${CLAVES.map(c => c.re).join('|')})`, 'gi');

function Resaltado({ texto }) {
  if (!texto) return null;
  const trozos = String(texto).split(RE_CLAVES);
  return trozos.map((t, i) => {
    if (i % 2 === 0) return <React.Fragment key={i}>{t}</React.Fragment>;
    const c = CLAVES.find(x => new RegExp(`^(?:${x.re})$`, 'i').test(t)) ?? CLAVES[0];
    return (
      <span key={i} style={{ background: c.fondo, color: c.tinta, padding: '0 4px', fontWeight: 700, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>{t}</span>
    );
  });
}

const CSS = `
.bh { font-family: inherit; color: ${NEGRO}; }
.bh-titulo { font-family: 'Archivo', system-ui, sans-serif; font-weight: 800; letter-spacing: -.025em; line-height: .98; }
.bh-mono { font-family: 'DM Mono', ui-monospace, monospace; text-transform: uppercase; letter-spacing: .06em; }
.bh-fila { position: relative; display: grid; grid-template-columns: 58px 1fr auto; align-items: stretch; width: 100%;
  min-height: 62px; border: none; border-bottom: ${BORDE}; background: ${PAPEL}; cursor: pointer; text-align: left; padding: 0; overflow: hidden; }
.bh-fila:last-child { border-bottom: none; }
.bh-fila .bh-disco { margin: auto; width: 40px; height: 40px; border-radius: 50%; border: ${BORDE}; background: var(--c);
  transition: transform .45s cubic-bezier(.22,1,.36,1), border-radius .45s; }
.bh-fila:hover .bh-disco { transform: rotate(45deg) scale(1.06); border-radius: 6px; }
.bh-fila[data-on='1'] .bh-disco { border-radius: 0; transform: none; }
.bh-fila .bh-celda { border-left: ${BORDE}; padding: 8px 12px; display: flex; flex-direction: column; justify-content: center; position: relative; z-index: 1; }
.bh-fila .bh-relleno { position: absolute; inset: 0; background: var(--c); transform: scaleX(0); transform-origin: left; transition: transform .5s cubic-bezier(.22,1,.36,1); z-index: 0; }
.bh-fila:hover .bh-relleno { transform: scaleX(.035); }
.bh-fila[data-on='1'] .bh-relleno { transform: scaleX(1); }
.bh-fila .bh-nombre { font-weight: 800; font-size: 19px; letter-spacing: -.01em; line-height: 1; transition: color .4s; }
.bh-fila .bh-sub { font-family: 'DM Mono', ui-monospace, monospace; font-size: 11px; margin-top: 4px; transition: color .4s; }
.bh-fila[data-on='1'] .bh-nombre, .bh-fila[data-on='1'] .bh-sub { color: var(--t); }
.bh-fila[data-apagado='1'] { opacity: .32; }
.bh-cuenta { align-self: center; margin-right: 10px; position: relative; z-index: 1; font-family: 'DM Mono', monospace; font-weight: 700; font-size: 12px;
  background: ${PAPEL}; border: 2px solid ${NEGRO}; padding: 1px 7px; }
.bh-chip { font-family: 'DM Mono', ui-monospace, monospace; font-size: 11px; font-weight: 500; padding: 5px 10px; cursor: pointer;
  background: ${PAPEL}; color: ${NEGRO}; border: 2px solid ${NEGRO}; box-shadow: 2px 2px 0 ${NEGRO};
  transition: transform .15s ease, box-shadow .15s ease, background .2s, color .2s; }
.bh-chip:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 ${NEGRO}; }
.bh-chip:active { transform: translate(2px, 2px); box-shadow: 0 0 0 ${NEGRO}; }
.bh-chip[data-on='1'] { background: ${NEGRO}; color: ${PAPEL}; }
.bh-tarjeta { transition: transform .2s ease, box-shadow .2s ease; }
.bh-tarjeta:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0 ${NEGRO}; }
@media (prefers-reduced-motion: reduce) { .bh * { transition: none !important; } }
`;

function numero(v) {
  return Number(v ?? 0);
}

function colorDe(p) {
  return p?.color && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#6E675C';
}

function claro(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42;
}

function textoSobre(hex) {
  return claro(hex) ? NEGRO : '#FFFFFF';
}

function arco(cx, cy, r, a0, a1) {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

function fechaLegible(f) {
  if (!f) return '';
  const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [a, mes, d] = f.split('-');
  if (d) return `${Number(d)} ${m[Number(mes) - 1]} ${a}`;
  if (mes) return `${m[Number(mes) - 1]} ${a}`;
  return a;
}

function Formas({ quieto, estrecho }) {
  const flota = (d, y = 8) => quieto ? {} : { animate: { y: [0, -y, 0] }, transition: { duration: d, repeat: Infinity, ease: 'easeInOut' } };
  const gira = d => quieto ? {} : { animate: { rotate: 360 }, transition: { duration: d, repeat: Infinity, ease: 'linear' } };
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: estrecho ? 46 : 64, overflow: 'hidden', borderBottom: BORDE }}>
      <motion.div initial={quieto ? false : { x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, ease: SUAVE }}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '22%', background: ROJO, borderRight: BORDE }} />
      <motion.div {...flota(5)} style={{ position: 'absolute', left: '25%', top: estrecho ? 6 : 8, width: estrecho ? 34 : 48, height: estrecho ? 34 : 48, borderRadius: '50%', background: MOSTAZA, border: BORDE }} />
      <motion.div {...gira(18)} style={{ position: 'absolute', left: '34%', top: estrecho ? -18 : -24, width: estrecho ? 64 : 88, height: estrecho ? 64 : 88, borderRadius: '50%', background: `conic-gradient(${AZUL} 0 50%, transparent 50% 100%)`, border: BORDE }} />
      <div style={{ position: 'absolute', left: '46%', top: 0, bottom: 0, width: '16%', display: 'flex', gap: estrecho ? 4 : 6, padding: '0 8px' }}>
        {Array.from({ length: estrecho ? 5 : 7 }, (_, i) => (
          <motion.span key={i} initial={quieto ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.06, ease: SUAVE }}
            style={{ flex: 1, background: NEGRO, transformOrigin: 'top' }} />
        ))}
      </div>
      <motion.div {...flota(6.5, 6)} style={{ position: 'absolute', left: '66%', bottom: -2, width: estrecho ? 50 : 70, height: estrecho ? 25 : 35, borderRadius: '70px 70px 0 0', background: NARANJA, border: BORDE, borderBottom: 'none' }} />
      <motion.div initial={quieto ? false : { x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.1, ease: SUAVE }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '20%', background: AZUL, borderLeft: BORDE }} />
      <motion.div {...gira(24)} style={{ position: 'absolute', right: '14%', top: estrecho ? 8 : 10, width: estrecho ? 28 : 40, height: estrecho ? 28 : 40, background: VERDE, border: BORDE }} />
    </div>
  );
}

function Rosco({ partido, color, activo, onActivo, tam, quieto }) {
  const votadas = VOTADAS.reduce((s, e) => s + numero(partido[e.k]), 0);
  const total = votadas + numero(partido.pendiente);
  const c = tam / 2;
  const rFuera = c - 8;
  const rDentro = c - 38;
  const grosor = 26;
  let ang = -Math.PI / 2;
  const tramos = VOTADAS.map(e => {
    const v = numero(partido[e.k]);
    const largo = votadas ? (v / votadas) * Math.PI * 2 : 0;
    const t = { ...e, v, a0: ang, a1: ang + largo };
    ang += largo;
    return t;
  }).filter(t => t.v > 0);
  const cobertura = total ? votadas / total : 0;
  const elegido = tramos.find(t => t.k === activo);
  const centro = elegido ?? tramos.find(t => t.k === 'cumplida') ?? { corto: 'Cumplidas', v: 0, color: NEGRO };
  const L = 2 * Math.PI * rFuera;
  return (
    <svg viewBox={`0 0 ${tam} ${tam}`} width={tam} height={tam} role="img" style={{ overflow: 'visible' }}
      aria-label={`${partido.siglas}: de ${votadas} promesas que llegaron a votarse, ${tramos.map(t => `${t.corto} ${t.v}`).join(', ')}`}>
      <circle cx={c} cy={c} r={rFuera} fill="none" stroke={NEGRO} strokeWidth="1.5" strokeDasharray="3 5" />
      <motion.circle cx={c} cy={c} r={rFuera} fill="none" stroke={color} strokeWidth="9"
        transform={`rotate(-90 ${c} ${c})`} initial={quieto ? false : { strokeDasharray: `0 ${L}` }}
        animate={{ strokeDasharray: `${cobertura * L} ${L}` }} transition={{ duration: 1.1, ease: SUAVE }} />
      <circle cx={c} cy={c} r={rDentro + grosor / 2 + 2} fill="none" stroke={NEGRO} strokeWidth="3" />
      <circle cx={c} cy={c} r={rDentro - grosor / 2 - 2} fill={PAPEL} stroke={NEGRO} strokeWidth="3" />
      {tramos.map((t, i) => {
        const on = activo === t.k;
        return (
          <motion.path key={`${partido.siglas}-${t.k}`} d={arco(c, c, rDentro, t.a0, Math.max(t.a0 + 0.001, t.a1))} fill="none" stroke={t.color}
            initial={quieto ? false : { pathLength: 0 }} animate={{ pathLength: 1, strokeWidth: on ? grosor + 10 : grosor, opacity: activo && !on ? 0.4 : 1 }}
            transition={{ pathLength: { duration: 0.7, delay: 0.1 + i * 0.14, ease: SUAVE }, strokeWidth: { duration: 0.2 }, opacity: { duration: 0.2 } }}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onActivo(t.k)} onMouseLeave={() => onActivo(null)} onClick={() => onActivo(on ? null : t.k)} />
        );
      })}
      {tramos.map(t => {
        const x0 = c + (rDentro - grosor / 2 - 2) * Math.cos(t.a0), y0 = c + (rDentro - grosor / 2 - 2) * Math.sin(t.a0);
        const x1 = c + (rDentro + grosor / 2 + 2) * Math.cos(t.a0), y1 = c + (rDentro + grosor / 2 + 2) * Math.sin(t.a0);
        return <line key={`s-${t.k}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={NEGRO} strokeWidth="3" />;
      })}
      {!quieto && (
        <motion.circle cx={c} cy={c} r={rDentro - grosor / 2 - 12} fill="none" stroke={NEGRO} strokeWidth="6" strokeDasharray={`${(rDentro - grosor / 2 - 12) * 2.2} 400`}
          animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: `${c}px ${c}px` }} />
      )}
      <AnimatePresence mode="wait">
        <motion.g key={centro.k ?? 'nada'} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.18 }} style={{ transformOrigin: `${c}px ${c}px` }}>
          <text x={c} y={c + 6} textAnchor="middle" style={{ fontSize: tam * 0.2, fontWeight: 800, fill: NEGRO, letterSpacing: '-.04em' }}>
            {votadas ? `${Math.round((centro.v / votadas) * 100)}%` : '—'}
          </text>
          <text x={c} y={c + tam * 0.115} textAnchor="middle" className="bh-mono" style={{ fontSize: tam * 0.052, fill: NEGRO, fontWeight: 600 }}>
            {centro.corto}
          </text>
        </motion.g>
      </AnimatePresence>
    </svg>
  );
}

function Escaparate({ partido, estrecho, quieto }) {
  const [activo, setActivo] = useState(null);
  const color = colorDe(partido);
  const votadas = VOTADAS.reduce((s, e) => s + numero(partido[e.k]), 0);
  const total = votadas + numero(partido.pendiente);
  const detalle = activo ? VOTADAS.find(e => e.k === activo) : null;
  const tam = estrecho ? 220 : 250;
  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: estrecho ? '1fr' : `${tam + 20}px 1fr`, gap: estrecho ? 16 : 26, alignItems: 'center', padding: estrecho ? 16 : 24 }}>
      <div style={{ display: 'grid', justifyItems: 'center', position: 'relative' }}>
        <Rosco partido={partido} color={color} activo={activo} onActivo={setActivo} tam={tam} quieto={quieto} />
        {!estrecho && <span aria-hidden="true" style={{ position: 'absolute', right: -30, top: 34, width: 60, height: 3, background: NEGRO, transform: 'rotate(-28deg)', transformOrigin: 'left' }} />}
      </div>
      <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
        <div>
          <div className="bh-mono" style={{ fontSize: 12, fontWeight: 600 }}>Programa de 2023</div>
          <div className="bh-titulo" style={{ fontSize: estrecho ? 30 : 40 }}>{partido.siglas === 'SUMAR' ? 'Sumar (coalición de 2023)' : partido.nombre ?? partido.siglas}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <motion.div className="bh-tarjeta" initial={quieto ? false : { y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.15, ease: SUAVE }}
            style={{ background: NARANJA, border: BORDE, boxShadow: SOMBRA, padding: '12px 14px' }}>
            <div className="bh-titulo" style={{ fontSize: estrecho ? 34 : 44 }}>{total ? Math.round((votadas / total) * 100) : 0}%</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.3, marginTop: 4, fontWeight: 500 }}>de sus {total} promesas verificables llegó a alguna votación (anillo exterior)</div>
          </motion.div>
          <motion.div className="bh-tarjeta" initial={quieto ? false : { y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.25, ease: SUAVE }}
            style={{ background: AZUL, color: '#FFF', border: BORDE, boxShadow: SOMBRA, padding: '12px 14px' }}>
            <div className="bh-titulo" style={{ fontSize: estrecho ? 34 : 44 }}>{numero(partido.pendiente)}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.3, marginTop: 4, fontWeight: 500 }}>sin ninguna votación relacionada encontrada</div>
          </motion.div>
        </div>
        <div style={{ display: 'grid', gap: 2 }}>
          {VOTADAS.map((e, i) => {
            const v = numero(partido[e.k]);
            const on = activo === e.k;
            return (
              <motion.button key={e.k} onMouseEnter={() => setActivo(e.k)} onMouseLeave={() => setActivo(null)} onFocus={() => setActivo(e.k)} onBlur={() => setActivo(null)}
                initial={quieto ? false : { x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
                style={{
                  display: 'grid', gridTemplateColumns: '18px 1fr 54px 52px', alignItems: 'center', gap: 10, padding: '5px 6px',
                  border: 'none', background: on ? CREMA : 'transparent', cursor: 'default', textAlign: 'left', color: NEGRO
                }}>
                <span style={{ width: 16, height: 16, background: e.color, border: `2px solid ${NEGRO}`, borderRadius: i % 2 ? 0 : '50%' }} />
                <span className="bh-mono" style={{ fontSize: 13, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>{e.corto}</span>
                <span style={{ justifySelf: 'end', fontWeight: 800, fontSize: 15, background: e.color, color: textoSobre(e.color), border: `2px solid ${NEGRO}`, padding: '0 6px', minWidth: 34, textAlign: 'center' }}>{v}</span>
                <span className="bh-mono" style={{ fontSize: 12, justifySelf: 'end' }}>{votadas ? Math.round((v / votadas) * 100) : 0}%</span>
              </motion.button>
            );
          })}
        </div>
        <div style={{ minHeight: 18, fontSize: 13, color: GRIS }}>{detalle ? detalle.largo : 'El anillo interior reparte las promesas que sí llegaron a votarse.'}</div>
      </div>
    </div>
  );
}

function SoloAhora({ partido, estrecho }) {
  const color = colorDe(partido);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: estrecho ? '1fr' : '160px 1fr', gap: 20, alignItems: 'center', padding: estrecho ? 16 : 24 }}>
      <div aria-hidden="true" style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, border: BORDE }} />
        <div style={{ position: 'absolute', left: 70, top: 0, width: 70, height: 140, background: CREMA, borderLeft: BORDE, borderRadius: '0 70px 70px 0', border: BORDE }} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div className="bh-mono" style={{ fontSize: 12, fontWeight: 600 }}>Sin programa propio en 2023</div>
        <div className="bh-titulo" style={{ fontSize: estrecho ? 30 : 40 }}>{partido.nombre}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>En 2023 sus promesas iban en el programa de la coalición Sumar; para ver qué se cumplió de aquel programa, elige SUMAR. Abajo, lo que dice ahora.</div>
      </div>
    </div>
  );
}

function Medida({ children, color, pie, enFiltro, i }) {
  return (
    <motion.li initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: i * 0.05, ease: SUAVE }}
      style={{
        display: 'grid', gridTemplateColumns: '10px 1fr', border: BORDE, borderTop: i ? 'none' : BORDE,
        background: enFiltro ? CREMA : PAPEL
      }}>
      <span style={{ background: color, borderRight: BORDE }} />
      <span style={{ padding: '9px 12px', fontSize: 14, lineHeight: 1.45, fontWeight: 500 }}>
        {children}
        {pie && <span className="bh-mono" style={{ display: 'block', fontSize: 10.5, color: GRIS, marginTop: 4, textTransform: 'none', letterSpacing: '.02em' }}>{pie}</span>}
      </span>
    </motion.li>
  );
}

function Rotulo({ children, adorno }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className="bh-mono" style={{ fontSize: 13, fontWeight: 700 }}>{children}</span>
      {adorno}
    </div>
  );
}

function Rayas() {
  return (
    <span aria-hidden="true" style={{ flex: 1, display: 'grid', gap: 3 }}>
      {[0, 1, 2, 3].map(i => <span key={i} style={{ height: 3, background: NEGRO }} />)}
    </span>
  );
}

function Pasado({ partido, filtro }) {
  const [pestana, setPestana] = useState('cumplida');
  const pestanas = [
    { k: 'cumplida', titulo: 'Logros', vacio: 'Ninguna promesa verificable acabó en una norma aprobada con su voto.' },
    { k: 'contradicha', titulo: 'Votó en contra', vacio: 'No votó en contra de ninguna de sus promesas verificables.' },
    { k: 'apoyada_sin_aprobar', titulo: 'Apoyó, no salió', vacio: 'Ninguna.' }
  ];
  const est = VOTADAS.find(e => e.k === pestana);
  const p = pestanas.find(x => x.k === pestana);
  const delFiltro = filtro ? partido.filtros?.[filtro] : null;
  const filas = partido.muestras?.[pestana] ?? [];
  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start', minWidth: 0 }}>
      <Rotulo adorno={<span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', background: MOSTAZA, border: BORDE, flexShrink: 0 }} />}>2023 · lo que prometió y lo que votó</Rotulo>
      {filtro && (
        delFiltro ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li className="bh-mono" style={{ fontSize: 11, marginBottom: 6, textTransform: 'none' }}>{delFiltro.n} promesa{delFiltro.n === 1 ? '' : 's'} en «{ETIQUETA[filtro]}». Por ejemplo:</li>
            {(delFiltro.ejemplos ?? []).map((t, i) => <Medida key={i} i={i} color={colorDe(partido)} enFiltro><Resaltado texto={t} /></Medida>)}
          </ul>
        ) : <div style={{ fontSize: 13, color: GRIS }}>Su programa de 2023 no tenía promesas en «{ETIQUETA[filtro]}».</div>
      )}
      <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {pestanas.map(x => {
          const e = VOTADAS.find(s => s.k === x.k);
          return (
            <button key={x.k} role="tab" aria-selected={x.k === pestana} className="bh-chip" data-on={x.k === pestana ? '1' : '0'} onClick={() => setPestana(x.k)}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: e.color, marginRight: 6, border: `1.5px solid ${x.k === pestana ? PAPEL : NEGRO}` }} />
              {x.titulo} · {numero(partido[x.k])}
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.ul key={`${partido.siglas}-${pestana}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filas.length ? filas.map((f, i) => (
            <Medida key={i} i={i} color={est.color} pie={f.norma ? `${f.norma.length > 100 ? `${f.norma.slice(0, 100)}…` : f.norma}${f.fecha ? ` · ${fechaLegible(f.fecha)}` : ''}` : null}>
              <Resaltado texto={f.texto} />
            </Medida>
          )) : <li style={{ fontSize: 13, color: GRIS }}>{p.vacio}</li>}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}

function Ahora({ siglas, color, filtro }) {
  const d = declaracionesDe(siglas);
  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start', minWidth: 0 }}>
      <Rotulo adorno={<Rayas />}>2026 · lo que dice ahora</Rotulo>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        {d?.estado ?? SIN_DATOS}
        {d?.fuenteEstado && <> <a href={d.fuenteEstado.url} target="_blank" rel="noopener noreferrer" style={{ color: NEGRO, fontWeight: 600 }}>{d.fuenteEstado.fuente} ↗</a></>}
      </div>
      {d?.puntos?.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {d.puntos.map((p, i) => (
            <Medida key={i} i={i} color={color} enFiltro={filtro && p.filtros?.includes(filtro)}
              pie={<>{fechaLegible(p.fecha)} · <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: GRIS }}>{p.fuente} ↗</a></>}>
              <Resaltado texto={p.texto} />
            </Medida>
          ))}
        </ul>
      )}
      <div className="bh-mono" style={{ fontSize: 10.5, color: GRIS, textTransform: 'none', letterSpacing: '.02em' }}>Declaraciones en prensa revisadas el {fechaLegible(REVISADO)}. Se cambiarán por el programa electoral cuando se publique.</div>
    </div>
  );
}

export default function Programas({ onIr }) {
  const estrecho = useTelefono();
  const quieto = useReducedMotion();
  const [partidos, setPartidos] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [filtro, setFiltro] = useState(null);

  useEffect(() => {
    traerProgramasInicio()
      .then(filas => {
        const orden = [...filas].sort((a, b) => numero(b.promesas) - numero(a.promesas));
        const lista = [];
        for (const p of orden) {
          lista.push(p);
          if (p.siglas === 'SUMAR') lista.push(...partidosSoloDeclaraciones());
        }
        setPartidos(lista);
        setElegido(lista[0]?.siglas ?? null);
      })
      .catch(e => {
        console.error('Programas: no se han podido leer los programas', e);
        setFallo(true);
      });
  }, []);

  const cuentas = useMemo(() => {
    if (!filtro || !partidos) return {};
    return Object.fromEntries(partidos.map(p => {
      const de2023 = numero(p.filtros?.[filtro]?.n);
      const de2026 = (declaracionesDe(p.siglas)?.puntos ?? []).filter(x => x.filtros?.includes(filtro)).length;
      return [p.siglas, { de2023, de2026, total: de2023 + de2026 }];
    }));
  }, [filtro, partidos]);

  useEffect(() => {
    if (!filtro || !partidos || cuentas[elegido]?.total) return;
    const mejor = [...partidos].sort((a, b) => (cuentas[b.siglas]?.total ?? 0) - (cuentas[a.siglas]?.total ?? 0))[0];
    if (mejor && cuentas[mejor.siglas]?.total) setElegido(mejor.siglas);
  }, [filtro, cuentas, partidos, elegido]);

  if (fallo) return null;
  if (!partidos) {
    return <div style={{ height: 520, background: CREMA, border: BORDE, margin: '4px 0 28px' }} aria-busy="true" />;
  }
  if (!partidos.length) return null;

  const actual = partidos.find(p => p.siglas === elegido) ?? partidos[0];
  const color = colorDe(actual);

  return (
    <section className="bh" aria-label="Lo que prometieron los partidos y lo que votaron"
      style={{ margin: '4px 0 30px', background: CREMA, border: BORDE, boxShadow: estrecho ? 'none' : `10px 10px 0 ${NEGRO}` }}>
      <style>{CSS}</style>
      <div style={{ padding: estrecho ? '16px 14px 14px' : '22px 26px 18px', borderBottom: BORDE, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="bh-mono" style={{ fontSize: estrecho ? 11 : 13, fontWeight: 600 }}>Elecciones del 29 de noviembre</div>
          <motion.h2 className="bh-titulo" initial={quieto ? false : { y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: SUAVE }}
            style={{ fontSize: estrecho ? 30 : 52, margin: '6px 0 0' }}>
            Lo que prometieron, lo que votaron y lo que prometen ahora
          </motion.h2>
        </div>
        {onIr && <button className="bh-chip" data-on="0" onClick={() => onIr('partidos')}>Todas las promesas →</button>}
      </div>

      <Formas quieto={quieto} estrecho={estrecho} />

      <div style={{ display: 'grid', gridTemplateColumns: estrecho ? '1fr' : 'minmax(0, 1fr) 290px' }}>
        <div style={{ order: estrecho ? 2 : 1, minWidth: 0, borderRight: estrecho ? 'none' : BORDE }}>
          <motion.div key={`tinta-${actual.siglas}`} initial={quieto ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.55, ease: SUAVE }}
            style={{ height: 10, background: color, borderBottom: BORDE, transformOrigin: 'left' }} />
          <AnimatePresence mode="wait">
            <motion.div key={actual.siglas} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: SUAVE }}
              style={{ borderBottom: BORDE }}>
              {actual.soloDeclaraciones ? <SoloAhora partido={actual} estrecho={estrecho} /> : <Escaparate partido={actual} estrecho={estrecho} quieto={quieto} />}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.div key={`${actual.siglas}-detalle`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              style={{ display: 'grid', gridTemplateColumns: estrecho || actual.soloDeclaraciones ? '1fr' : '1fr 1fr', gap: estrecho ? 22 : 26, padding: estrecho ? 16 : 24 }}>
              {!actual.soloDeclaraciones && <Pasado partido={actual} filtro={filtro} />}
              <Ahora siglas={actual.siglas} color={color} filtro={filtro} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{
          order: estrecho ? 1 : 2, display: estrecho ? 'flex' : 'block', overflowX: estrecho ? 'auto' : 'visible',
          borderBottom: estrecho ? BORDE : 'none', background: PAPEL
        }}>
          {partidos.map((p, i) => {
            const c = colorDe(p);
            const n = filtro ? cuentas[p.siglas] : null;
            return (
              <motion.button key={p.siglas} className="bh-fila" data-on={p.siglas === actual.siglas ? '1' : '0'} data-apagado={filtro && !n?.total ? '1' : '0'}
                aria-pressed={p.siglas === actual.siglas} onClick={() => setElegido(p.siglas)}
                initial={quieto ? false : { x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.05 * i, ease: SUAVE }}
                style={{ '--c': c, '--t': textoSobre(c), flex: estrecho ? '0 0 auto' : undefined, width: estrecho ? 176 : '100%', borderRight: estrecho ? BORDE : 'none', borderBottom: estrecho ? 'none' : undefined }}>
                <span className="bh-relleno" />
                <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}><span className="bh-disco" /></span>
                <span className="bh-celda">
                  <span className="bh-nombre">{p.siglas}</span>
                  <span className="bh-sub">{p.soloDeclaraciones ? 'solo 2026' : `${numero(p.promesas)} promesas`}</span>
                </span>
                {n ? <span className="bh-cuenta" title={`${n.de2023} en 2023 · ${n.de2026} en 2026`}>{n.total}</span> : <span />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: BORDE, padding: estrecho ? 14 : '18px 26px', display: 'grid', gap: 10, background: PAPEL }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="bh-mono" style={{ fontSize: 13, fontWeight: 700 }}>Filtra por lo que prometen</span>
          {filtro && <button className="bh-chip" data-on="0" onClick={() => setFiltro(null)}>Quitar filtro ✕</button>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {FILTROS.map(f => (
            <div key={f.tema} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="bh-mono" style={{ fontSize: 11.5, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>{f.tema}</span>
              {[f.a, f.b].map(([clave, texto]) => (
                <button key={clave} className="bh-chip" data-on={filtro === clave ? '1' : '0'} aria-pressed={filtro === clave}
                  onClick={() => setFiltro(filtro === clave ? null : clave)}>{texto}</button>
              ))}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: GRIS, lineHeight: 1.5, margin: '2px 0 0' }}>
          Cada tema tiene sus dos sentidos. El número de cada partido suma sus promesas de 2023 en esa línea y sus declaraciones de 2026 que van en ella. Las de 2023 las clasifica un modelo de lenguaje promesa a promesa con las mismas reglas para todos; las de 2026, a mano, con su fuente. Las palabras en color marcan el tema de cada medida. «Sin votación» no quiere decir que la promesa no llegara al Congreso, sino que no hemos encontrado una votación relacionada.
        </p>
      </div>
    </section>
  );
}