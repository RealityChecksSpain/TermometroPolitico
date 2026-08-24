import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { traerPromesaVsVoto } from '../lib/cliente.js';

const C = {
  superficie: '#FFFFFF', pizarra: '#1F2328', tinta: '#14161A',
  media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3'
};

export default function GraficoBrecha({ compacto }) {
  const reducido = useReducedMotion();
  const [datos, setDatos] = useState(null);
  const [encima, setEncima] = useState(null);

  useEffect(() => { traerPromesaVsVoto().then(setDatos).catch(() => setDatos([])); }, []);

  if (!datos) return null;
  if (datos.length === 0) return null;

  const ancho = 100;
  const pos = v => ((Number(v) + 1) / 2) * ancho;

  return (
    <div style={{ background: C.pizarra, borderRadius: 3, padding: compacto ? 16 : 'clamp(18px, 3vw, 26px)' }}>
      <div className="ed" style={{ color: '#F7F7F2', fontSize: compacto ? 16 : 20, fontWeight: 600, lineHeight: 1.25 }}>
        Lo que prometen gastar frente a lo que votan
      </div>
      <div style={{ color: '#A8AEB4', fontSize: 12.5, lineHeight: 1.55, margin: '8px 0 18px', maxWidth: 560 }}>
        El punto claro es su programa electoral. El relleno, cómo han votado después.
        La línea entre ambos es la distancia entre lo dicho y lo hecho.
      </div>

      <div className="em" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#6E747A', marginBottom: 10 }}>
        <span>← MÁS GASTO</span>
        <span>MENOS GASTO →</span>
      </div>

      {datos.map(d => {
        const a = pos(d.prometido_gasto);
        const b = pos(d.votado_gasto);
        const activo = encima === d.partido;
        return (
          <div key={d.partido}
            onMouseEnter={() => setEncima(d.partido)}
            onMouseLeave={() => setEncima(null)}
            style={{ padding: '7px 0', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="em" style={{
                width: 66, fontSize: 10.5, flexShrink: 0,
                color: activo ? '#F2F3F0' : '#9AA0A6'
              }}>{d.siglas}</span>

              <div style={{ flex: 1, position: 'relative', height: 16 }}>
                <div style={{
                  position: 'absolute', top: 7, left: 0, right: 0, height: 1, background: '#3A4048'
                }} />
                <motion.div style={{
                  position: 'absolute', top: 7, height: 2, borderRadius: 2,
                  background: d.color || '#8E9299', opacity: 0.55
                }}
                  initial={reducido ? false : { left: `${a}%`, width: '0%' }}
                  whileInView={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }}
                  viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                  transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.1 }} />
                <div style={{
                  position: 'absolute', top: 3, left: `${a}%`, width: 11, height: 11,
                  marginLeft: -5.5, borderRadius: 11,
                  border: `2px solid ${d.color || '#8E9299'}`, background: C.pizarra
                }} />
                <motion.div style={{
                  position: 'absolute', top: 3, width: 11, height: 11,
                  marginLeft: -5.5, borderRadius: 11, background: d.color || '#8E9299'
                }}
                  initial={reducido ? false : { left: `${a}%` }}
                  whileInView={{ left: `${b}%`, scale: activo ? 1.3 : 1 }}
                  viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                  transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.1 }} />
              </div>

              <span className="em" style={{
                width: 52, fontSize: 10.5, textAlign: 'right', flexShrink: 0,
                color: Number(d.brecha_gasto) > 0.15 ? '#E08278'
                     : Number(d.brecha_gasto) < -0.15 ? '#5FBF92' : '#6E747A'
              }}>
                {Number(d.brecha_gasto) > 0 ? '+' : ''}{Number(d.brecha_gasto).toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #3A4048' }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="em" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#9AA0A6' }}>
            <svg width="13" height="13"><circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="#D8D8D0" strokeWidth="2" /></svg>
            lo que prometió
          </span>
          <span className="em" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#9AA0A6' }}>
            <svg width="13" height="13"><circle cx="6.5" cy="6.5" r="5" fill="#D8D8D0" /></svg>
            cómo ha votado
          </span>
        </div>
        <div style={{ color: '#8E959C', fontSize: 11.5, lineHeight: 1.55 }}>
          Un número positivo significa que en la práctica ha votado por gastar menos de lo que su
          programa prometía. Negativo, lo contrario. Ninguna de las dos cosas es buena ni mala:
          es la diferencia entre el compromiso y el acto.
        </div>
      </div>
    </div>
  );
}