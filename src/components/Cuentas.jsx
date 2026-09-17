import React, { useState } from 'react';
import { ETIQUETAS, euros, millones } from '../lib/cuentas.js';

const C = { tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1', fondo: '#F5F4EE' };
const PUBLICO = '#2E5E8A';
const PRIVADO = '#8A6D1F';
const GASTO = '#9E1B32';

const DETALLE = [
  'subvenciones_funcionamiento',
  'aportaciones_grupos_institucionales',
  'cuotas_afiliados',
  'aportaciones_cargos_publicos',
  'donaciones_y_legados',
  'gastos_personal',
  'total_activo',
  'patrimonio_neto'
];

function Bloque({ etiqueta, valor, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="em" style={{ fontSize: 9.5, color: C.tenue, marginBottom: 1 }}>{etiqueta}</div>
      <div className="ed" style={{ fontSize: 17, fontWeight: 600, color, lineHeight: 1.1 }}>
        {millones(valor) ?? '—'}
      </div>
    </div>
  );
}

export default function Cuentas({ partido, datos }) {
  const [detalle, setDetalle] = useState(false);

  if (datos === null) {
    return (
      <div style={{ border: `1px solid ${C.linea}`, borderRadius: 3, padding: 12, background: C.fondo, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.tenue, lineHeight: 1.5 }}>
          Las cuentas no se pueden leer ahora mismo.
        </div>
      </div>
    );
  }

  const d = datos?.[partido];
  if (!d) return null;

  const { cifras, ejercicio, ingresos, gastos, publico, privado, saldo, porcentajePublico, fuente } = d;
  const tope = Math.max(ingresos ?? 0, gastos ?? 0) || 1;
  const anchoPublico = ((publico ?? 0) / tope) * 100;
  const anchoPrivado = ((privado ?? 0) / tope) * 100;
  const anchoGasto = ((gastos ?? 0) / tope) * 100;

  const presentes = DETALLE.filter(k => Number.isFinite(cifras[k]));

  return (
    <div style={{ border: `1px solid ${C.linea}`, borderRadius: 3, background: C.fondo, padding: 12, marginBottom: 12 }}>
      <div className="em" style={{
        fontSize: 9.5, color: C.tenue, textTransform: 'uppercase',
        letterSpacing: '.06em', fontWeight: 600, marginBottom: 9
      }}>
        Dinero · {ejercicio}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <Bloque etiqueta="entró" valor={ingresos} color={C.tinta} />
        <Bloque etiqueta="gastó" valor={gastos} color={GASTO} />
      </div>

      <div style={{ marginBottom: 3 }}>
        <div style={{ display: 'flex', height: 9, borderRadius: 1, overflow: 'hidden', background: '#EDEBE2' }}>
          <div style={{ width: `${anchoPublico}%`, background: PUBLICO }} />
          <div style={{ width: `${anchoPrivado}%`, background: PRIVADO }} />
        </div>
      </div>
      <div style={{ marginBottom: 9 }}>
        <div style={{ display: 'flex', height: 9, borderRadius: 1, overflow: 'hidden', background: '#EDEBE2' }}>
          <div style={{ width: `${anchoGasto}%`, background: GASTO }} />
        </div>
      </div>

      {porcentajePublico != null && (
        <div style={{ fontSize: 11.5, color: C.media, lineHeight: 1.5, marginBottom: 9 }}>
          <span style={{ color: PUBLICO, fontWeight: 600 }}>{porcentajePublico} de cada 100 €</span> que
          entraron son dinero público: subvenciones y aportaciones de grupos institucionales.
          El resto son cuotas, aportaciones de cargos y donaciones.
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.linea}`, paddingTop: 7 }}>
        {saldo != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
            <span style={{ color: C.media }}>entró menos gastó</span>
            <span className="ed" style={{ color: saldo >= 0 ? C.tinta : GASTO, fontWeight: 600 }}>
              {saldo >= 0 ? '+' : '−'}{euros(Math.abs(saldo))} €
            </span>
          </div>
        )}
        {Number.isFinite(cifras.resultado_ejercicio) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
            <span style={{ color: C.media }}>resultado del ejercicio</span>
            <span className="ed" style={{ color: C.tinta, fontWeight: 600 }}>
              {euros(cifras.resultado_ejercicio)} €
            </span>
          </div>
        )}
        {Number.isFinite(cifras.deuda_entidades_credito) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
            <span style={{ color: C.media }}>debe a los bancos</span>
            <span className="ed" style={{ color: C.tinta, fontWeight: 600 }}>
              {euros(cifras.deuda_entidades_credito)} €
            </span>
          </div>
        )}
      </div>

      {detalle && presentes.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.linea}`, marginTop: 7, paddingTop: 7 }}>
          {presentes.map(k => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, padding: '2px 0' }}>
              <span style={{ color: C.media }}>{ETIQUETAS[k]}</span>
              <span className="ed" style={{ color: C.tinta }}>{euros(cifras[k])} €</span>
            </div>
          ))}
        </div>
      )}

      {presentes.length > 0 && (
        <button onClick={() => setDetalle(!detalle)} className="em" style={{
          marginTop: 8, padding: '4px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 2,
          background: 'transparent', color: C.media, border: `1px solid ${C.linea}`
        }}>
          {detalle ? 'menos detalle' : 'de dónde sale'}
        </button>
      )}

      <div style={{ fontSize: 9.5, color: C.tenue, marginTop: 9, lineHeight: 1.5 }}>
        Cifras transcritas de las cuentas anuales que el partido publica en su web.
        Este es el dinero del partido: no incluye lo que gastan sus grupos parlamentarios,
        que rinden cuentas aparte.
      </div>

      {fuente?.url && (
        <a href={fuente.url} target="_blank" rel="noreferrer" className="em"
          style={{ fontSize: 10.5, color: C.media, display: 'block', marginTop: 7 }}>
          {fuente.titulo ?? 'Documento original'} →
        </a>
      )}
    </div>
  );
}
