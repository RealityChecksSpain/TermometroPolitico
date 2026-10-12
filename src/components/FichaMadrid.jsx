import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { desgloseBienes } from '../lib/inmuebles.js';
import { traerDocumentosMadrid } from '../lib/cliente.js';
import AvatarPartido from './AvatarPartido.jsx';
import Explica from './Explica.jsx';
import { useBloqueoScroll, useTelefono } from '../lib/pantalla.js';

const C = { tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1', fondo: '#F8F6EE' };

function euros(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;
}

function fecha(iso) {
  return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : null;
}

function decimal(v) {
  return Number(v).toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

function Rotulo({ children }) {
  return (
    <div className="em" style={{ fontSize: 10, color: C.tenue, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Cifra({ valor, etiqueta, children }) {
  if (valor == null) return null;
  return (
    <div>
      <div className="ed" style={{ fontSize: 16, fontWeight: 600 }}>{valor}</div>
      <div style={{ fontSize: 11, color: C.tenue }}>{etiqueta}{children}</div>
    </div>
  );
}

function Bloque({ children, fondo = C.fondo }) {
  return <div style={{ padding: '12px 16px 16px', background: fondo, borderBottom: `1px solid ${C.linea}` }}>{children}</div>;
}

function Texto({ titulo, texto }) {
  if (!texto) return null;
  return (
    <div style={{ marginTop: 9 }}>
      <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 3 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: C.media, lineHeight: 1.5, whiteSpace: 'pre-line', paddingLeft: 8, borderLeft: `2px solid ${C.linea}` }}>{texto}</div>
    </div>
  );
}

export default function FichaMadrid({ d, onCerrar }) {
  const reducido = useReducedMotion();
  const estrecho = useTelefono();
  useBloqueoScroll(Boolean(d));
  const [documentos, setDocumentos] = useState(null);

  useEffect(() => {
    if (!d) return;
    let vivo = true;
    setDocumentos(null);
    traerDocumentosMadrid(d.id_asamblea)
      .then(x => { if (vivo) setDocumentos(x); })
      .catch(() => { if (vivo) setDocumentos([]); });
    return () => { vivo = false; };
  }, [d?.id_asamblea]);

  useEffect(() => {
    if (!d) return;
    const tecla = e => { if (e.key === 'Escape') onCerrar?.(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [d, onCerrar]);

  if (!d) return null;

  const desglose = desgloseBienes(d);
  const hayInmuebles = d.n_inmuebles != null;
  const dinero = [
    ['depósitos', euros(d.depositos)],
    ['valores y acciones', euros(d.valores)],
    ['planes de pensiones', euros(d.planes_pensiones)],
    ['deudas pendientes', euros(d.deuda_pendiente)],
    ['préstamos que ha concedido', euros(d.prestamos_concedido)]
  ].filter(([, v]) => v);
  const rentas = [
    ['del trabajo', euros(d.rendimientos_trabajo)],
    ['del capital', euros(d.rendimientos_capital)],
    ['de actividades económicas', euros(d.rendimientos_actividades)],
    ['IRPF pagado', euros(d.irpf_pagado)]
  ].filter(([, v]) => v);
  const esGobierno = d.plenos_convocado > 0 && d.plenos_faltados == null;
  const sinInmueblesDeclarados = /sin inmuebles declarados/i.test(d.dudas ?? '');

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,22,26,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCerrar}
      initial={reducido ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24 }}>
      <motion.div className="e" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Ficha de ${d.nombre_completo}`}
        initial={reducido ? false : { y: 44, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
        drag={estrecho && !reducido ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_e, info) => { if (info.offset.y > 110 || info.velocity.y > 620) onCerrar?.(); }}
        style={{
          background: '#FFFFFF', width: '100%', maxWidth: 620, borderRadius: '10px 10px 0 0',
          maxHeight: '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain', paddingBottom: 'env(safe-area-inset-bottom)'
        }}>
        {estrecho && (
          <div style={{ padding: '8px 0 2px', display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 38, height: 4, borderRadius: 4, background: '#D5D2C6' }} />
          </div>
        )}

        <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.linea}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
              <AvatarPartido color={d.color} siglas={d.partido_siglas || d.grupo} nombre={d.nombre_completo} w={58} h={74} />
              <div style={{ minWidth: 0 }}>
                <div className="ed" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>{d.nombre_completo}</div>
                <div className="em" style={{ fontSize: 11, color: C.tenue, marginTop: 4 }}>
                  {d.partido_siglas ?? d.grupo ?? 'Sin grupo'} · Asamblea de Madrid
                  {d.fecha_alta ? ` · en el escaño desde ${fecha(d.fecha_alta)}` : ''}
                </div>
                {d.cargos && <div style={{ fontSize: 12, color: C.media, marginTop: 6, lineHeight: 1.4 }}>{d.cargos}</div>}
                <div className="em" style={{ fontSize: 10.5, marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {d.url_ficha && <a href={d.url_ficha} target="_blank" rel="noopener noreferrer" style={{ color: '#3C63A0' }}>ficha oficial ↗</a>}
                  {d.email && <a href={`mailto:${d.email}`} style={{ color: '#3C63A0' }}>{d.email}</a>}
                </div>
              </div>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar"
              style={{ background: 'none', border: 0, fontSize: 22, lineHeight: 1, color: C.tenue, cursor: 'pointer', alignSelf: 'flex-start' }}>×</button>
          </div>
        </div>

        <Bloque>
          <Rotulo>Propiedades</Rotulo>
          {!d.url_declaracion && <div style={{ fontSize: 12.5, color: C.media }}>La Asamblea no tiene publicada ninguna declaración de bienes de este diputado.</div>}
          {d.url_declaracion && !hayInmuebles && <div style={{ fontSize: 12.5, color: C.media }}>La lectura de la declaración no dio un recuento de inmuebles. Abre el PDF para verla.</div>}
          {hayInmuebles && (
            <>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 6 }}>
                <Cifra valor={d.n_inmuebles} etiqueta={desglose.map(x => x.texto).join(' · ') || 'inmuebles declarados'} />
                {d.n_inmuebles_equivalentes != null && (
                  <Cifra valor={decimal(d.n_inmuebles_equivalentes)} etiqueta="en propiedad plena">
                    <Explica termino="inmueblesEquivalentes" titulo="Inmuebles equivalentes" />
                  </Cifra>
                )}
                {d.n_viviendas_equivalentes != null && <Cifra valor={decimal(d.n_viviendas_equivalentes)} etiqueta="viviendas en propiedad plena" />}
              </div>
              {(d.n_inmuebles_propios != null || d.n_inmuebles_sociedad != null) && (
                <div style={{ fontSize: 11.5, color: C.media, lineHeight: 1.6 }}>
                  <div><strong>{d.n_inmuebles_propios ?? 0}</strong> a su nombre</div>
                  <div>
                    <strong>{d.n_inmuebles_sociedad ?? 0}</strong> a nombre de una sociedad no cotizada
                    <Explica termino="viaSociedad" titulo="Vía sociedad" />
                  </div>
                </div>
              )}
              {sinInmueblesDeclarados && (
                <div style={{ fontSize: 11.5, color: C.media, marginTop: 6 }}>Las tablas de inmuebles de su declaración están vacías: cuenta como cero.</div>
              )}
              <Texto titulo="Inmuebles a su nombre, según la declaración" texto={d.inmuebles_detalle_propios} />
              <Texto titulo="Inmuebles a través de sociedades, según la declaración" texto={d.inmuebles_detalle_sociedad} />
            </>
          )}
        </Bloque>

        {(dinero.length > 0 || d.patrimonio_euros != null || d.vehiculos != null) && (
          <Bloque fondo="#FFFFFF">
            <Rotulo>Dinero y vehículos</Rotulo>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: dinero.length ? 8 : 0 }}>
              <Cifra valor={euros(d.patrimonio_euros)} etiqueta="patrimonio líquido est.">
                <Explica termino="patrimonioLiquido" titulo="Patrimonio líquido" />
              </Cifra>
              <Cifra valor={d.vehiculos} etiqueta="vehículos" />
            </div>
            {dinero.length > 0 && (
              <div style={{ fontSize: 12, color: C.media, lineHeight: 1.6 }}>
                {dinero.map(([k, v]) => <div key={k}>{k}: <strong>{v}</strong></div>)}
              </div>
            )}
            <Texto titulo="Vehículos, según la declaración" texto={d.vehiculos_detalle} />
          </Bloque>
        )}

        {(rentas.length > 0 || d.rentas_detalle) && (
          <Bloque>
            <Rotulo>Ingresos declarados</Rotulo>
            {rentas.length > 0 && (
              <div style={{ fontSize: 12, color: C.media, lineHeight: 1.6 }}>
                {rentas.map(([k, v]) => <div key={k}>{k === 'IRPF pagado' ? k : `Rendimientos ${k}`}: <strong>{v}</strong></div>)}
              </div>
            )}
            <Texto titulo="Detalle de rentas, según la declaración" texto={d.rentas_detalle} />
          </Bloque>
        )}

        {d.plenos_convocado > 0 && (
          <Bloque fondo="#FFFFFF">
            <Rotulo>Asistencia a Pleno</Rotulo>
            {esGobierno ? (
              <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.5 }}>
                Es miembro del Gobierno regional. La lista oficial de asistentes no recoge a la presidenta ni a los consejeros en los Plenos ordinarios, así que no se le cuentan faltas.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <Cifra valor={d.plenos_faltados} etiqueta={`faltas de ${d.plenos_convocado} Plenos`} />
                <Cifra valor={d.plenos_asistidos} etiqueta="Plenos asistidos" />
                {d.telematicos > 0 && <Cifra valor={d.telematicos} etiqueta="por vía telemática" />}
              </div>
            )}
          </Bloque>
        )}

        {(documentos?.length > 0 || d.url_declaracion) && (
          <Bloque>
            <Rotulo>Documentos publicados por la Asamblea</Rotulo>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.65 }}>
              {(documentos?.length ? documentos : [{ url: d.url_declaracion, tipo: 'Declaración de bienes', fecha: d.fecha_declaracion }]).map(doc => (
                <li key={doc.url}>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3C63A0' }}>
                    {doc.tipo}{doc.fecha ? ` · ${fecha(doc.fecha)}` : ''} ↗
                  </a>
                  {doc.url === d.url_declaracion && <span className="em" style={{ fontSize: 10, color: C.tenue }}> · la que se ha leído</span>}
                </li>
              ))}
            </ul>
          </Bloque>
        )}

        <div className="em" style={{ padding: '12px 16px 18px', fontSize: 10, color: C.tenue, lineHeight: 1.55 }}>
          {d.url_declaracion
            ? `Cifras sacadas del PDF oficial${d.fecha_declaracion ? ` del ${fecha(d.fecha_declaracion)}` : ''} por un modelo de lenguaje${d.inmuebles_revisado ? `; los inmuebles se revisaron el ${fecha(d.inmuebles_revisado)}` : ', sin revisión humana'}.`
            : 'Sin declaración de bienes publicada.'}
          {' '}Cada propiedad cuenta por la parte que declara poseer: media casa es 0,5. El patrimonio líquido suma depósitos, valores y planes y resta deudas; no valora los inmuebles.
          {d.url_declaracion && !d.fiable && ' Esta lectura está marcada como dudosa y no entra en los hallazgos.'}
          {' '}Abre la declaración para comprobar cualquier cifra.
        </div>
      </motion.div>
    </motion.div>
  );
}
