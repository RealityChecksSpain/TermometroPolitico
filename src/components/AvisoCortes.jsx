import React from 'react';
import { BOE_DISOLUCION, cortesDisueltas } from '../lib/legislatura.js';

export default function AvisoCortes() {
  if (!cortesDisueltas()) return null;
  return (
    <aside role="note" aria-label="Cortes disueltas" style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      background: '#FFF8E6', border: '1px solid #E8D9A8', borderLeft: '4px solid #B8912E',
      borderRadius: 3, padding: '12px 14px', margin: '4px 0 18px', color: '#4A3B12'
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="ed" style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, marginBottom: 4 }}>
          Las Cortes están disueltas
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          Desde el 6 de octubre no hay Pleno. Elecciones generales el 29 de noviembre; las nuevas
          Cortes se constituyen el 23 de diciembre. Hasta entonces solo se reúne la Diputación
          Permanente, 69 diputados que pueden convalidar o derogar los decretos ley del Gobierno.
          Si el Congreso publica sus votaciones, salen aquí marcadas.
        </div>
        <a href={BOE_DISOLUCION} target="_blank" rel="noopener noreferrer" className="em" style={{
          display: 'inline-block', marginTop: 8, fontSize: 11.5, color: '#6B5518', fontWeight: 600
        }}>Real Decreto 806/2026, en el BOE ↗</a>
      </div>
    </aside>
  );
}
