import React, { useState } from 'react';
import { alternarSeguimiento } from '../lib/seguimientos.js';

const C = { tinta: '#15171A', tenue: '#7C8288', linea: '#DCDCD3', acento: '#E0492E', crema: '#F3F1E8' };

export default function BotonSeguir({ tipo, id, seguido, alCambiar, compacto = false }) {
  const [aviso, setAviso] = useState('');

  function alternar() {
    const r = alternarSeguimiento(tipo, id);
    if (!r.ok) {
      setAviso('Tu navegador no deja guardar');
      return;
    }
    setAviso('');
    alCambiar?.(tipo, id, r.seguido);
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={alternar}
        className="em"
        style={{
          border: `1px solid ${seguido ? C.acento : C.linea}`,
          background: seguido ? C.acento : 'transparent',
          color: seguido ? C.crema : C.tinta,
          borderRadius: 0,
          padding: compacto ? '3px 8px' : '5px 11px',
          fontSize: compacto ? 10 : 11,
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {seguido ? 'Siguiendo' : 'Seguir'}
      </button>
      {aviso && <span className="em" style={{ fontSize: 10, color: C.tenue }}>{aviso}</span>}
    </span>
  );
}