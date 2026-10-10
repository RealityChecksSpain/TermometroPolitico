import React from 'react';
import { BOE_DISOLUCION, cortesDisueltas } from '../lib/legislatura.js';

export default function AvisoCortes() {
  if (!cortesDisueltas()) return null;
  return (
    <aside role="note" aria-label="Cortes disueltas" style={{
      background: '#FFF8E6', border: '1px solid #E8D9A8', borderLeft: '4px solid #B8912E',
      borderRadius: 3, padding: '7px 12px', margin: '2px 0 14px', color: '#4A3B12', fontSize: 12.5, lineHeight: 1.45
    }}>
      <div>
        <strong>Cortes disueltas.</strong> Elecciones el 29 de noviembre; hasta el 23 de diciembre solo se reúne la Diputación Permanente.
      </div>
      <a href={BOE_DISOLUCION} target="_blank" rel="noopener noreferrer" className="em" style={{ fontSize: 11, color: '#6B5518', fontWeight: 600 }}>
        Real Decreto 806/2026, en el BOE ↗
      </a>
    </aside>
  );
}