import React, { useState } from 'react';
import { ESTADOS } from '../lib/transparencia.js';
import { siglasPartido } from '../lib/etiquetas.js';

const C = { tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1', fondo: '#F5F4EE' };

const ORDEN = ['publicado', 'parcial', 'ausente', 'no_verificable', 'sin_comprobar'];

function color(estado) {
  return (ESTADOS[estado] ?? ESTADOS.sin_comprobar).color;
}

function texto(estado) {
  return (ESTADOS[estado] ?? ESTADOS.sin_comprobar).texto;
}

function Barra({ estados }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
      {estados.map((e, i) => (
        <div key={i} title={texto(e)} style={{
          flex: 1, height: 6, borderRadius: 1, background: color(e),
          opacity: e === 'sin_comprobar' ? 0.35 : 1
        }} />
      ))}
    </div>
  );
}

function Fila({ obligacion, dato }) {
  const estado = dato?.estado ?? 'sin_comprobar';
  return (
    <div style={{ padding: '7px 0', borderTop: `1px solid ${C.linea}` }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
        <span style={{
          flexShrink: 0, width: 6, height: 6, borderRadius: 3, marginTop: 1,
          background: color(estado), opacity: estado === 'sin_comprobar' ? 0.35 : 1
        }} />
        <span style={{ fontSize: 11.5, color: C.tinta, lineHeight: 1.4 }}>
          {obligacion.descripcion}
        </span>
      </div>
      <div className="em" style={{ fontSize: 10, color: color(estado), marginLeft: 13, marginTop: 2, fontWeight: 600 }}>
        {texto(estado)}
        <span style={{ color: C.tenue, fontWeight: 400 }}> · art. {obligacion.articulo}</span>
      </div>
      {dato?.nota && (
        <div style={{ fontSize: 10.5, color: C.media, marginLeft: 13, marginTop: 3, lineHeight: 1.45 }}>
          {dato.nota}
        </div>
      )}
      {dato?.url && (
        <a href={dato.url} target="_blank" rel="noreferrer" className="em"
          style={{ fontSize: 10, color: C.media, marginLeft: 13, display: 'inline-block', marginTop: 3 }}>
          página consultada →
        </a>
      )}
    </div>
  );
}

export default function Transparencia({ partido, siglas, datos }) {
  const [todas, setTodas] = useState(false);
  const nombre = siglasPartido(siglas);

  if (datos === null) {
    return (
      <div style={{ border: `1px solid ${C.linea}`, borderRadius: 3, padding: 12, background: C.fondo }}>
        <div style={{ fontSize: 11, color: C.tenue, lineHeight: 1.5 }}>
          Las comprobaciones de publicidad activa no se pueden leer ahora mismo.
        </div>
      </div>
    );
  }

  const { catalogo, resumen, detalle, webs } = datos;
  const r = resumen[partido] ?? null;
  const filas = detalle[partido] ?? {};
  const web = webs[partido] ?? null;

  const estados = catalogo.map(o => filas[o.codigo]?.estado ?? 'sin_comprobar');
  const cuenta = {};
  for (const e of estados) cuenta[e] = (cuenta[e] ?? 0) + 1;

  const excepciones = catalogo.filter(o => (filas[o.codigo]?.estado ?? 'sin_comprobar') !== 'publicado');
  const visibles = todas ? catalogo : excepciones;

  return (
    <div style={{ border: `1px solid ${C.linea}`, borderRadius: 3, background: C.fondo, padding: 12 }}>
      <div className="em" style={{
        fontSize: 9.5, color: C.tenue, textTransform: 'uppercase',
        letterSpacing: '.06em', fontWeight: 600, marginBottom: 8
      }}>
        Publicidad activa
      </div>

      {r === null ? (
        <>
          <Barra estados={estados} />
          <div style={{ fontSize: 11.5, color: C.media, lineHeight: 1.5 }}>
            Las {catalogo.length} comprobaciones de {nombre} están sin hacer. Esta ficha no afirma
            nada sobre este partido.
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span className="ed" style={{ fontSize: 30, fontWeight: 600, color: C.tinta, lineHeight: 1 }}>
              {cuenta.publicado ?? 0}
            </span>
            <span style={{ fontSize: 12.5, color: C.media }}>de {catalogo.length} publicadas</span>
          </div>

          <Barra estados={estados} />

          <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 10, lineHeight: 1.5 }}>
            ejercicio {r.ejercicio}
            {r.ultimaConsulta && <> · consultado {r.ultimaConsulta}</>}
            <br />
            {ORDEN.filter(e => e !== 'publicado' && cuenta[e])
              .map(e => `${cuenta[e]} ${texto(e)}`)
              .join(' · ')}
          </div>

          {visibles.length === 0 ? (
            <div style={{ fontSize: 11.5, color: C.media, lineHeight: 1.5, paddingTop: 8, borderTop: `1px solid ${C.linea}` }}>
              Las {catalogo.length} estaban publicadas el día que se miró.
            </div>
          ) : (
            visibles.map(o => (
              <Fila key={o.codigo} obligacion={o} dato={filas[o.codigo] ?? null} />
            ))
          )}

          <button onClick={() => setTodas(!todas)} className="em" style={{
            marginTop: 9, padding: '4px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 2,
            background: 'transparent', color: C.media, border: `1px solid ${C.linea}`
          }}>
            {todas ? 'solo lo que falla' : `ver las ${catalogo.length}`}
          </button>

          <div style={{ fontSize: 9.5, color: C.tenue, marginTop: 10, lineHeight: 1.5 }}>
            El art. 14.Ocho obliga a publicar en la web del partido balance, cuenta de resultados,
            créditos con entidad, importe, tipo de interés y plazo, subvenciones y donaciones de
            más de 25.000 € con el donante. «No publicado» significa que no estaba en la página
            enlazada ese día, no que no se rindieran cuentas al Tribunal.
          </div>
        </>
      )}

      {web && (
        <a href={web} target="_blank" rel="noreferrer" className="em"
          style={{ fontSize: 10.5, color: C.media, display: 'block', marginTop: 9 }}>
          Web oficial de {nombre} →
        </a>
      )}
    </div>
  );
}