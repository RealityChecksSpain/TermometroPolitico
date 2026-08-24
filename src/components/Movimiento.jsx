import React, { useEffect } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

export const MUELLE = { type: 'spring', stiffness: 200, damping: 24, mass: 1 };
export const MUELLE_SUAVE = { type: 'spring', stiffness: 140, damping: 22, mass: 1 };
export const SALIDA = { duration: 0.55, ease: [0.16, 1, 0.3, 1] };

export function Entrada({ children, retraso = 0, desde = 14, unaVez = true, ...resto }) {
  const reducido = useReducedMotion();
  return (
    <motion.div
      initial={reducido ? false : { opacity: 0, y: desde }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: unaVez, margin: '0px 0px -80px 0px' }}
      transition={{ ...SALIDA, delay: retraso }}
      {...resto}>
      {children}
    </motion.div>
  );
}

export function Lista({ children, escalon = 0.055, ...resto }) {
  const reducido = useReducedMotion();
  return (
    <motion.div
      initial={reducido ? false : 'oculto'}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      variants={{ visible: { transition: { staggerChildren: escalon } }, oculto: {} }}
      {...resto}>
      {children}
    </motion.div>
  );
}

export function Item({ children, desde = 12, ...resto }) {
  return (
    <motion.div
      variants={{ oculto: { opacity: 0, y: desde }, visible: { opacity: 1, y: 0 } }}
      transition={SALIDA}
      {...resto}>
      {children}
    </motion.div>
  );
}

export function Cifra({ valor = 0, decimales = 0, sufijo = '' }) {
  const reducido = useReducedMotion();
  const bruto = useMotionValue(reducido ? valor : 0);
  const suave = useSpring(bruto, { stiffness: 90, damping: 22, mass: 1 });
  const texto = useTransform(suave, v => {
    const n = decimales ? v.toFixed(decimales) : String(Math.round(v));
    return `${n}${sufijo}`;
  });
  const ref = React.useRef(null);
  const dentro = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });

  useEffect(() => {
    if (dentro) bruto.set(valor);
  }, [dentro, valor, bruto]);

  return <motion.span ref={ref}>{reducido ? `${valor}${sufijo}` : texto}</motion.span>;
}

export function Barra({ tramos, alto = 8, fondo = '#EDEBE2', radio = 4 }) {
  const reducido = useReducedMotion();
  const total = tramos.reduce((s, t) => s + (t.valor || 0), 0) || 1;
  return (
    <motion.div
      style={{ display: 'flex', height: alto, borderRadius: radio, overflow: 'hidden', background: fondo }}
      initial={reducido ? false : 'oculto'}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      variants={{ visible: { transition: { staggerChildren: 0.06 } }, oculto: {} }}>
      {tramos.map(t => t.valor > 0 && (
        <motion.i key={t.clave} title={t.titulo}
          style={{ display: 'block', background: t.color, height: '100%' }}
          variants={{ oculto: { width: 0 }, visible: { width: `${(t.valor / total) * 100}%` } }}
          transition={SALIDA} />
      ))}
    </motion.div>
  );
}

export function Rotulo({ children, pie, accion, onAccion, color = '#7A6132' }) {
  const reducido = useReducedMotion();
  return (
    <Entrada desde={8} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span className="em" style={{
          fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color, fontWeight: 600
        }}>{children}</span>
        {pie && <span style={{ fontSize: 12, color: '#6E6656' }}>{pie}</span>}
        {accion && (
          <button className="em" onClick={onAccion} style={{
            marginLeft: 'auto', background: 'none', border: 0, padding: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 11.5, color: '#5C5442'
          }}>{accion}</button>
        )}
      </div>
      <motion.div
        style={{ height: 1, background: '#DDD8C6', transformOrigin: 'left', marginTop: 8 }}
        initial={reducido ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
    </Entrada>
  );
}
