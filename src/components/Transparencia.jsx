import React from 'react';
import { ESTADOS } from '../lib/transparencia.js';
import { siglasPartido } from '../lib/etiquetas.js';

const C = { tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1' };

function Chip({ estado }) {
  const e = ESTADOS[estado] ?? ESTADOS.sin_comprobar;
  return (
    <span className="em" style={{
      flexShrink: 0, fontSize: 10, padding: '2px 6px', borderRadius: 2,
      background: e.fondo, color: e.color, fontWeight: 600
    }}>
      {e.texto}
    </span>
  );
}

export default function Transparencia({ partido, siglas, datos }) {
  if (datos === null) {
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.linea}` }}>
        <div style={{ fontSize: 11.5, color: C.tenue, lineHeight: 1.5 }}>
          Las comprobaciones de publicidad activa no se pueden leer ahora mismo, así que esta
          ficha no dice qué publica este partido ni qué deja de publicar.
        </div>
      </div>
    );
  }

  const { catalogo, resumen, detalle, webs } = datos;
  const r = resumen[partido] ?? null;
  const filas = detalle[partido] ?? {};
  const web = webs[partido] ?? null;
  const nombre = siglasPartido(siglas);

  const sinComprobar = catalogo.filter(o => !filas[o.codigo]).length;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.linea}` }}>
      <div style={{
        fontSize: 10, color: C.tenue, textTransform: 'uppercase',
        letterSpacing: '.05em', fontWeight: 600, marginBottom: 7
      }}>
        Lo que la ley le obliga a publicar
      </div>

      <div style={{ fontSize: 12, color: C.media, lineHeight: 1.55, marginBottom: 10 }}>
        El artículo 14.Ocho de la ley de financiación obliga a cada partido a publicar{' '}
        <strong>en su propia web</strong> el balance, la cuenta de resultados, sus créditos
        pendientes con entidad, importe, tipo de interés y plazo, las subvenciones recibidas y
        las donaciones de más de 25.000 € con la identidad del donante. Esto es lo que había
        cuando se miró.
      </div>

      {r === null ? (
        <div style={{ fontSize: 12, color: C.tenue, lineHeight: 1.55, padding: '4px 0 2px' }}>
          Todavía no se ha comprobado la web de {nombre}. Son {catalogo.length} comprobaciones y
          ninguna está hecha, así que esta ficha no afirma nada sobre este partido.
        </div>
      ) : (
        <>
          <div className="em" style={{ fontSize: 11.5, color: C.tinta, marginBottom: 2 }}>
            {r.publicadas} de {r.enLaLey} publicadas
            {sinComprobar > 0 && (
              <span style={{ color: '#8A6D1F' }}> · {sinComprobar} sin comprobar</span>
            )}
          </div>
          <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 10 }}>
            ejercicio {r.ejercicio}
            {r.ultimaConsulta && <> · última consulta {r.ultimaConsulta}</>}
          </div>

          <div style={{ borderTop: `1px solid ${C.linea}` }}>
            {catalogo.map(o => {
              const f = filas[o.codigo] ?? null;
              const estado = f?.estado ?? 'sin_comprobar';
              return (
                <div key={o.codigo} style={{
                  padding: '7px 0', borderBottom: `1px solid ${C.linea}`,
                  display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap'
                }}>
                  <div style={{ flex: '1 1 190px', minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.tinta, lineHeight: 1.45 }}>
                      {o.descripcion}
                    </div>
                    <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 3 }}>
                      art. {o.articulo}
                      {f?.url && (
                        <>
                          {' · '}
                          <a href={f.url} target="_blank" rel="noreferrer" style={{ color: C.media }}>
                            página consultada →
                          </a>
                        </>
                      )}
                    </div>
                    {f?.nota && (
                      <div style={{ fontSize: 11, color: C.media, marginTop: 4, lineHeight: 1.45 }}>
                        {f.nota}
                      </div>
                    )}
                  </div>
                  <Chip estado={estado} />
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 10.5, color: C.tenue, marginTop: 9, lineHeight: 1.5 }}>
            «No publicado» significa que no aparecía en la página enlazada el día que se miró, no
            que el partido no lo haya enviado al Tribunal de Cuentas. Son dos obligaciones
            distintas y aquí solo se comprueba la de publicar en la web.
          </div>
        </>
      )}

      {web ? (
        <a href={web} target="_blank" rel="noreferrer" className="em"
          style={{ fontSize: 11, color: C.media, display: 'block', marginTop: 10 }}>
          Web oficial de {nombre} · descarga allí el programa completo →
        </a>
      ) : (
        <div className="em" style={{ fontSize: 11, color: C.tenue, marginTop: 10 }}>
          No hay web oficial registrada para {nombre}.
        </div>
      )}

      <div style={{ fontSize: 10, color: C.tenue, marginTop: 7, lineHeight: 1.5 }}>
        No alojamos los programas: son obra de cada partido. Aquí solo se publican compromisos
        extraídos y reformulados, con enlace a la fuente original.
      </div>
    </div>
  );
}
