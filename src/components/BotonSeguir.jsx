import React, { useState } from 'react';
import { alternarSeguimiento } from '../lib/seguimientos.js';

const C = { tinta: '#15171A', tenue: '#7C8288', linea: '#DCDCD3', acento: '#E0492E', crema: '#F3F1E8' };

const estilos = `
.btnSeguir{position:relative;border-radius:0;text-transform:uppercase;letter-spacing:.06em;
font-weight:600;cursor:pointer}
@media(hover:none){
.btnSeguir::after{content:'';position:absolute;top:50%;left:50%;width:100%;height:100%;
min-width:44px;min-height:44px;transform:translate(-50%,-50%)}
}
`;

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
      <style>{estilos}</style>
      <button
        type="button"
        onClick={alternar}
        className="em btnSeguir"
        style={{
          border: `1px solid ${seguido ? C.acento : C.linea}`,
          background: seguido ? C.acento : 'transparent',
          color: seguido ? C.crema : C.tinta,
          padding: compacto ? '4px 9px' : '6px 12px',
          fontSize: compacto ? 10.5 : 11.5
        }}
      >
        {seguido ? 'Siguiendo' : 'Seguir'}
      </button>
      {aviso && <span className="em" style={{ fontSize: 11, color: C.tenue }}>{aviso}</span>}
    </span>
  );
}