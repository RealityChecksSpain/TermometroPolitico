import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Destellos suaves (no “cenizas de juego”): puntos estáticos con opacidad
 * que respiran muy despacio para resaltar un bloque sin parecer particulas de acción.
 */
export function DestelloSuave({ color = 'rgba(255,255,255,0.35)', n = 8 }) {
  const pts = useMemo(() => Array.from({ length: n }, (_, i) => ({
    id: i,
    left: `${8 + (i * 11 + (i % 3) * 7) % 84}%`,
    top: `${12 + (i * 17) % 70}%`,
    size: 1.5 + (i % 3) * 0.6,
    delay: (i % 5) * 0.35
  })), [n]);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pts.map(p => (
        <motion.span
          key={p.id}
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.12, 0.4, 0.12] }}
          transition={{ duration: 5.5, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
          style={{
            position: 'absolute', left: p.left, top: p.top,
            width: p.size, height: p.size, borderRadius: 99,
            background: color
          }}
        />
      ))}
    </div>
  );
}

export function EntradaSuave({ children, delay = 0, y = 10 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
