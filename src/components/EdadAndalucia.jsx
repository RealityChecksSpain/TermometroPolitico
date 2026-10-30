import React from 'react';
import { PALETAS } from './Bauhaus.jsx';
import { etiquetaLegislatura } from '../lib/andalucia-web.js';

const P = PALETAS.andalucia;

export default function Edad({ legislatura }) {
  const nueva = Number(legislatura) === 13;
  const e = etiquetaLegislatura(legislatura);
  return (
    <span title={e.larga} style={{
      fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
      padding: '1px 6px', border: `1.5px solid ${nueva ? P.a : P.negro}`, background: nueva ? P.a : 'transparent', color: nueva ? '#fff' : P.negro
    }}>{e.corta}</span>
  );
}
