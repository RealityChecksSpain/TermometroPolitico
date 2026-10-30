import React from 'react';
import { motion } from 'framer-motion';

export const SUAVE = [0.22, 1, 0.36, 1];

export const PALETAS = {
  espana: {
    negro: '#17130F', crema: '#F2E7D3', papel: '#FAF3E6', gris: '#5E574D',
    a: '#B5382C', b: '#D6A03A', c: '#21466D', d: '#2D5A45', e: '#EE9D57', puntos: '#B5382C'
  },
  madrid: {
    negro: '#121A24', crema: '#E3EAF2', papel: '#F4F7FB', gris: '#4F5B69',
    a: '#1B3A63', b: '#D6A03A', c: '#2C6DB0', d: '#5E93C4', e: '#9DC3E6', puntos: '#2C6DB0'
  },
  andalucia: {
    negro: '#10201A', crema: '#E3F0E7', papel: '#F6FBF7', gris: '#4D5E55',
    a: '#007A33', b: '#E7B32E', c: '#0E5C34', d: '#4FA36F', e: '#A9D6B8', puntos: '#007A33'
  }
};

export function borde(p) {
  return `3px solid ${p.negro}`;
}

export function cssBauhaus(p) {
  const B = borde(p);
  return `
.bh { color: ${p.negro}; }
.bh-titulo { font-family: 'Archivo Variable', 'Archivo', system-ui, sans-serif; font-weight: 800; letter-spacing: -.025em; line-height: .98; }
.bh-mono { font-family: 'DM Mono', ui-monospace, monospace; text-transform: uppercase; letter-spacing: .06em; }
.bh-marco { position: relative; background: ${p.crema}; border: ${B}; margin: 4px 0 26px; }
.bh-cabeza { padding: 20px 24px 16px; border-bottom: ${B}; position: relative; overflow: hidden; display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.bh-cuerpo { padding: 18px 24px 20px; background: ${p.papel}; }
@media (max-width: 640px) { .bh-cabeza { padding: 14px 14px 12px; } .bh-cuerpo { padding: 14px; } }
.bh-chip { font-family: 'DM Mono', ui-monospace, monospace; font-size: 11px; font-weight: 500; padding: 5px 10px; cursor: pointer;
  background: ${p.papel}; color: ${p.negro}; border: 2px solid ${p.negro}; box-shadow: 2px 2px 0 ${p.negro};
  display: inline-flex; align-items: center; gap: 6px;
  transition: transform .15s ease, box-shadow .15s ease, background .2s, color .2s; }
.bh-chip:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 ${p.negro}; }
.bh-chip:active { transform: translate(2px, 2px); box-shadow: 0 0 0 ${p.negro}; }
.bh-chip[data-on='1'] { background: ${p.negro}; color: ${p.papel}; }
@media (hover: none) { .bh-chip { min-height: 40px; padding: 8px 12px; font-size: 12px; } }
.bh-input { width: 100%; padding: 14px 16px; font-size: 17px; border: ${B}; background: ${p.papel}; color: ${p.negro};
  box-shadow: 5px 5px 0 ${p.negro}; outline: none; font-family: 'Archivo Variable', 'Archivo', system-ui, sans-serif; }
.bh-input:focus { box-shadow: 7px 7px 0 ${p.c}; }
.bh-tarjeta { border: ${B}; box-shadow: 6px 6px 0 ${p.negro}; transition: transform .2s ease, box-shadow .2s ease; }
.bh-tarjeta:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0 ${p.negro}; }
.bh-cifra { font-size: 40px; }
@media (max-width: 640px) { .bh-cifra { font-size: 28px; } }
.bh-mas { margin-top: 22px; border-top: 2px solid ${p.negro}; padding-top: 12px; }
.bh-mas summary { cursor: pointer; list-style: none; font-family: 'DM Mono', ui-monospace, monospace; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em; display: inline-flex; gap: 8px; align-items: center; }
.bh-mas summary::-webkit-details-marker { display: none; }
.bh-mas summary::after { content: '+'; }
.bh-mas[open] summary::after { content: '−'; }
.bh-mas > div { font-size: 12.5px; line-height: 1.7; color: ${p.gris}; margin-top: 10px; max-width: 75ch; display: grid; gap: 8px; }
.bh-lista > * { border-top: 2px solid ${p.negro}; }
.bh-lista > *:last-child { border-bottom: 2px solid ${p.negro}; }
@media (prefers-reduced-motion: reduce) { .bh * { transition: none !important; animation: none !important; } }
`;
}

export function Titular({ texto, quieto, estrecho, tam }) {
  const palabras = texto.split(' ');
  return (
    <h2 className="bh-titulo" style={{ fontSize: tam ?? (estrecho ? 30 : 50), margin: '6px 0 0' }} aria-label={texto}>
      {palabras.map((x, i) => (
        <motion.span key={i} aria-hidden="true" initial={quieto ? false : { y: 40, opacity: 0, rotate: i % 2 ? 6 : -6 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.15 + i * 0.045 }}
          style={{ display: 'inline-block', marginRight: '0.24em', transformOrigin: 'bottom left' }}>{x}</motion.span>
      ))}
    </h2>
  );
}

export function Formas({ p, quieto, estrecho }) {
  const B = borde(p);
  const flota = (d, y = 8) => quieto ? {} : { animate: { y: [0, -y, 0] }, transition: { duration: d, repeat: Infinity, ease: 'easeInOut' } };
  const gira = d => quieto ? {} : { animate: { rotate: 360 }, transition: { duration: d, repeat: Infinity, ease: 'linear' } };
  return (
    <div aria-hidden="true" style={{ position: 'relative', height: estrecho ? 46 : 64, overflow: 'hidden', borderBottom: B, background: p.papel }}>
      <motion.div initial={quieto ? false : { x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, ease: SUAVE }}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '22%', background: p.a, borderRight: B }} />
      <motion.div {...flota(5)} style={{ position: 'absolute', left: '25%', top: estrecho ? 6 : 8, width: estrecho ? 34 : 48, height: estrecho ? 34 : 48, borderRadius: '50%', background: p.b, border: B }} />
      <motion.div {...gira(18)} style={{ position: 'absolute', left: '34%', top: estrecho ? -18 : -24, width: estrecho ? 64 : 88, height: estrecho ? 64 : 88, borderRadius: '50%', background: `conic-gradient(${p.c} 0 50%, transparent 50% 100%)`, border: B }} />
      <div style={{ position: 'absolute', left: '46%', top: 0, bottom: 0, width: '16%', display: 'flex', gap: estrecho ? 4 : 6, padding: '0 8px' }}>
        {Array.from({ length: estrecho ? 5 : 7 }, (_, i) => (
          <motion.span key={i} initial={quieto ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.06, ease: SUAVE }}
            style={{ flex: 1, background: p.negro, transformOrigin: 'top' }} />
        ))}
      </div>
      <motion.div {...flota(6.5, 6)} style={{ position: 'absolute', left: '66%', bottom: -2, width: estrecho ? 50 : 70, height: estrecho ? 25 : 35, borderRadius: '70px 70px 0 0', background: p.e, border: B, borderBottom: 'none' }} />
      <motion.div initial={quieto ? false : { x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.1, ease: SUAVE }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '20%', background: p.c, borderLeft: B }} />
      <motion.div {...gira(24)} style={{ position: 'absolute', right: '14%', top: estrecho ? 8 : 10, width: estrecho ? 28 : 40, height: estrecho ? 28 : 40, background: p.d, border: B }} />
    </div>
  );
}

export function Marco({ p, antetitulo, titulo, accion, quieto, estrecho, formas = false, sombra = true, children }) {
  return (
    <motion.section className="bh bh-marco"
      initial={quieto ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: SUAVE }}
      style={{ boxShadow: sombra && !estrecho ? `10px 10px 0 ${p.negro}` : 'none' }}>
      {(antetitulo || titulo) && (
        <div className="bh-cabeza">
          <span aria-hidden="true" style={{
            position: 'absolute', right: -20, top: -20, width: estrecho ? 130 : 230, height: estrecho ? 130 : 230, borderRadius: '50%', pointerEvents: 'none',
            backgroundImage: `radial-gradient(${p.puntos} 2px, transparent 2.6px)`, backgroundSize: '10px 10px',
            WebkitMaskImage: 'radial-gradient(circle at 70% 30%, #000 0%, transparent 68%)', maskImage: 'radial-gradient(circle at 70% 30%, #000 0%, transparent 68%)'
          }} />
          <div style={{ position: 'relative', minWidth: 0 }}>
            {antetitulo && <div className="bh-mono" style={{ fontSize: estrecho ? 11 : 12.5, fontWeight: 600 }}>{antetitulo}</div>}
            {titulo && <Titular texto={titulo} quieto={quieto} estrecho={estrecho} tam={estrecho ? 26 : 38} />}
          </div>
          {accion}
        </div>
      )}
      {formas && <Formas p={p} quieto={quieto} estrecho={estrecho} />}
      {children}
    </motion.section>
  );
}

export function Cifra({ fondo, tinta, valor, texto, pie }) {
  return (
    <div className="bh-tarjeta" style={{ background: fondo, color: tinta, padding: '14px 16px', minWidth: 0 }}>
      <div className="bh-titulo bh-cifra" style={{ lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, lineHeight: 1.3 }}>{texto}</div>
      {pie && <div className="bh-mono" style={{ fontSize: 9.5, marginTop: 8, opacity: 0.8, textTransform: 'none', letterSpacing: 0 }}>{pie}</div>}
    </div>
  );
}
