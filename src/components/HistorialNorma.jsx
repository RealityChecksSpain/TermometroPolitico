import React from 'react';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288',
  linea: '#DCDCD3', si: '#2E7D5B', no: '#B23A2E'
};

/**
 * Línea de tiempo precisa de votaciones de una misma norma.
 * Solo muestra datos del Congreso (fecha, título de votación, sí/no, resultado).
 */
export default function HistorialNorma({ enmiendas, compacto }) {
  if (!enmiendas?.length) return null;

  const ordenadas = [...enmiendas].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  return (
    <div style={{
      background: C.superficie,
      border: `1px solid ${C.linea}`,
      borderRadius: 3,
      padding: compacto ? 12 : 14,
      marginTop: compacto ? 0 : 12
    }}>
      <div style={{
        fontSize: 10, color: C.tenue, textTransform: 'uppercase',
        letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12
      }}>
        Historial de esta norma · {ordenadas.length} votación{ordenadas.length === 1 ? '' : 'es'}
      </div>

      <div style={{ position: 'relative', paddingLeft: 18 }}>
        <div style={{
          position: 'absolute', left: 5, top: 4, bottom: 4, width: 2,
          background: C.linea, borderRadius: 2
        }} />

        {ordenadas.map((e, i) => {
          const ok = e.resultado === 'aprobada';
          const esUltima = i === ordenadas.length - 1;
          return (
            <div key={e.id} style={{
              position: 'relative', paddingBottom: esUltima ? 0 : 14,
              opacity: e.es_tramite ? 0.85 : 1
            }}>
              <span style={{
                position: 'absolute', left: -16, top: 4, width: 10, height: 10,
                borderRadius: 10, background: ok ? C.si : C.no,
                border: `2px solid ${C.superficie}`, boxSizing: 'border-box'
              }} />
              <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 3 }}>
                {e.fecha}
                {e.es_tramite ? ' · enmienda / trámite' : ' · votación principal'}
              </div>
              <div style={{ fontSize: compacto ? 12 : 12.5, lineHeight: 1.35, color: C.tinta }}>
                {e.titulo}
              </div>
              <div className="em" style={{
                fontSize: 10.5, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap'
              }}>
                <span style={{ color: C.si }}>Sí {e.total_si}</span>
                <span style={{ color: C.no }}>No {e.total_no}</span>
                <span style={{
                  marginLeft: 'auto', fontWeight: 600, color: ok ? C.si : C.no
                }}>{e.resultado}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
