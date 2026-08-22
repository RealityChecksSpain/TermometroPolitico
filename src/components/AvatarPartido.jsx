import React, { useState } from 'react';

/** Avatar con foto o bloque de color del partido / iniciales. */
export default function AvatarPartido({ foto, color, siglas, nombre, w = 30, h = 38 }) {
  const [rota, setRota] = useState(false);
  const bg = color || '#8E9299';
  const letras = (siglas || nombre || '?').toString().slice(0, 3).toUpperCase();

  if (foto && !rota) {
    return (
      <img
        src={foto}
        alt=""
        width={w}
        height={h}
        loading="lazy"
        onError={() => setRota(true)}
        style={{
          width: w, height: h, objectFit: 'cover', borderRadius: 2, flexShrink: 0,
          borderLeft: `3px solid ${bg}`, background: '#E4E4DC'
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{
        width: w, height: h, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center',
        background: bg, color: '#fff', fontSize: Math.max(8, Math.min(11, w * 0.32)),
        fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'center',
        padding: 2, boxSizing: 'border-box'
      }}
      className="em"
    >
      {letras}
    </span>
  );
}
