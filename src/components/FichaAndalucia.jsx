import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import AvatarPartido from './AvatarPartido.jsx';
import { useBloqueoScroll, useTelefono } from '../lib/pantalla.js';
import { traerVotosDiputadoAndalucia, traerVotacionesAndalucia } from '../lib/cliente.js';
import { SENTIDO, tituloLegible, fechaCorta, euros, decimal } from '../lib/andalucia-web.js';

const C = { tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCE7DF', fondo: '#F4FAF6', enlace: '#0E5C34' };
const TIPO = { V: 'Vivienda', L: 'Local', O: 'Otro inmueble urbano', R: 'Inmueble rústico' };
const CLAVE = { P: 'pleno dominio', N: 'nuda propiedad', M: 'titularidad parcial' };

function Rotulo({ children }) {
  return <div className="em" style={{ fontSize: 10, color: C.tenue, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{children}</div>;
}

function Cifra({ valor, etiqueta }) {
  if (valor == null) return null;
  return (
    <div>
      <div className="ed" style={{ fontSize: 16, fontWeight: 600 }}>{valor}</div>
      <div style={{ fontSize: 11, color: C.tenue }}>{etiqueta}</div>
    </div>
  );
}

function Bloque({ children, fondo = C.fondo }) {
  return <div style={{ padding: '12px 16px 16px', background: fondo, borderBottom: `1px solid ${C.linea}` }}>{children}</div>;
}

function Lista({ titulo, filas }) {
  if (!filas?.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div className="em" style={{ fontSize: 10, color: C.tenue, marginBottom: 4 }}>{titulo}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.media, lineHeight: 1.6 }}>
        {filas.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}

export default function FichaAndalucia({ d, onCerrar }) {
  const reducido = useReducedMotion();
  const estrecho = useTelefono();
  useBloqueoScroll(Boolean(d));
  const [votos, setVotos] = useState(null);
  const [votaciones, setVotaciones] = useState([]);

  useEffect(() => {
    if (!d) return;
    let vivo = true;
    setVotos(null);
    traerVotosDiputadoAndalucia(d.id_externo).then(x => { if (vivo) setVotos(x); }).catch(() => { if (vivo) setVotos([]); });
    traerVotacionesAndalucia(13).then(x => { if (vivo) setVotaciones(x); }).catch(() => {});
    return () => { vivo = false; };
  }, [d?.id_externo]);

  useEffect(() => {
    if (!d) return;
    const tecla = e => { if (e.key === 'Escape') onCerrar?.(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [d, onCerrar]);

  const distintos = useMemo(() => {
    if (!votos || !votaciones.length) return null;
    const grupos = new Map(votaciones.map(v => [v.id, v.voto_grupos ?? {}]));
    return votos.filter(vo => ['si', 'no', 'abstencion'].includes(vo.voto) && grupos.get(vo.votacion_id)?.[vo.partido_siglas] && grupos.get(vo.votacion_id)[vo.partido_siglas] !== vo.voto);
  }, [votos, votaciones]);

  if (!d) return null;
  const inmuebles = Array.isArray(d.inmuebles) ? d.inmuebles : [];
  const parte = i => (i.porcentaje != null ? `${decimal(i.porcentaje)} %` : 'entero');

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,32,26,0.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onCerrar}
      initial={reducido ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24 }}>
      <motion.div className="e" onClick={e => e.stopPropagation()} role="dialog" aria-label={`Ficha de ${d.nombre_completo}`}
        initial={reducido ? false : { y: 44, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
        drag={estrecho && !reducido ? 'y' : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_e, info) => { if (info.offset.y > 110 || info.velocity.y > 620) onCerrar?.(); }}
        style={{ background: '#FFFFFF', width: '100%', maxWidth: 620, borderRadius: '10px 10px 0 0', maxHeight: '90vh', overflowY: 'auto',
          WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {estrecho && (
          <div style={{ padding: '8px 0 2px', display: 'flex', justifyContent: 'center' }}>
            <span style={{ width: 38, height: 4, borderRadius: 4, background: '#D5D2C6' }} />
          </div>
        )}

        <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.linea}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
              {d.foto_url
                ? <img src={d.foto_url} alt="" width="58" height="74" style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} loading="lazy" />
                : <AvatarPartido color={d.color} siglas={d.partido_siglas} nombre={d.nombre_completo} w={58} h={74} />}
              <div style={{ minWidth: 0 }}>
                <div className="ed" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.2 }}>{d.nombre_completo}</div>
                <div className="em" style={{ fontSize: 11, color: C.tenue, marginTop: 4 }}>
                  {d.partido_siglas ?? d.grupo} · {d.circunscripcion}{d.escano ? ` · escaño ${d.escano}` : ''}
                </div>
                {d.cargo && <div style={{ fontSize: 12, color: C.media, marginTop: 6 }}>{d.cargo}</div>}
                <div className="em" style={{ fontSize: 10.5, marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {d.url_ficha && <a href={d.url_ficha} target="_blank" rel="noopener noreferrer" style={{ color: C.enlace }}>ficha oficial ↗</a>}
                  {d.url_declaracion && (
                    <a href={d.url_declaracion} target="_blank" rel="noopener noreferrer" style={{ color: C.enlace }}>
                      declaración{d.declaracion_pagina ? `, pág. ${d.declaracion_pagina}` : ''} ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onCerrar} aria-label="Cerrar"
              style={{ background: 'none', border: 0, fontSize: 22, lineHeight: 1, color: C.tenue, cursor: 'pointer', alignSelf: 'flex-start' }}>×</button>
          </div>
        </div>

        <Bloque>
          <Rotulo>Propiedades</Rotulo>
          {d.nota && <div style={{ fontSize: 12, color: C.media, marginBottom: 8, lineHeight: 1.5 }}>{d.nota}</div>}
          {!d.url_declaracion && <div style={{ fontSize: 12.5, color: C.media }}>No hemos encontrado su declaración de bienes publicada.</div>}
          {d.url_declaracion && !inmuebles.length && <div style={{ fontSize: 12.5, color: C.media }}>Su declaración no incluye ningún inmueble.</div>}
          {inmuebles.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 6 }}>
                <Cifra valor={d.n_inmuebles} etiqueta="inmuebles declarados" />
                <Cifra valor={decimal(d.n_inmuebles_equivalentes)} etiqueta="contando la parte que posee" />
                <Cifra valor={decimal(d.n_viviendas_equivalentes)} etiqueta="viviendas, contando la parte" />
                <Cifra valor={euros(d.valor_catastral_propio)} etiqueta="valor catastral de su parte" />
              </div>
              <Lista titulo="Uno a uno, según la declaración" filas={inmuebles.map(i =>
                `${TIPO[i.tipo] ?? i.tipo} en ${i.provincia ?? '—'} · ${parte(i)} · ${CLAVE[i.clave] ?? i.clave}${i.valor_catastral != null ? ` · valor catastral ${euros(i.valor_catastral)}` : ''}`)} />
            </>
          )}
        </Bloque>

        {d.url_declaracion && (
          <Bloque fondo="#FFFFFF">
            <Rotulo>Dinero, vehículos y deudas</Rotulo>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Cifra valor={d.saldo_cuentas != null ? `${euros(d.saldo_cuentas)}${d.saldo_porcentaje ? ` (${decimal(d.saldo_porcentaje)} %)` : ''}` : null} etiqueta="en cuentas bancarias" />
              <Cifra valor={euros(d.valores_total)} etiqueta="en acciones, fondos y planes" />
              <Cifra valor={euros(d.deudas_total)} etiqueta="de deudas" />
            </div>
            <Lista titulo="Acciones, fondos y planes" filas={(d.valores ?? []).map(x => `${x.entidad}${x.valor != null ? `: ${euros(x.valor)}` : ''}`)} />
            <Lista titulo="Vehículos y otros bienes" filas={(d.bienes_otros ?? []).map(x => `${x.descripcion}${x.valor != null ? `: ${euros(x.valor)}` : ''}`)} />
            <Lista titulo="Créditos, préstamos y deudas" filas={(d.deudas ?? []).map(x => `${x.descripcion}${x.valor != null ? `: ${euros(x.valor)}` : ''}`)} />
          </Bloque>
        )}

        {(d.cargos_publicos?.length > 0 || d.actividades_privadas?.length > 0) && (
          <Bloque>
            <Rotulo>Cargos y actividades declarados</Rotulo>
            <Lista titulo="Cargos públicos" filas={d.cargos_publicos} />
            <Lista titulo="Actividades privadas" filas={d.actividades_privadas} />
          </Bloque>
        )}

        <Bloque fondo="#FFFFFF">
          <Rotulo>Cómo vota</Rotulo>
          {votos == null && <div style={{ fontSize: 12, color: C.tenue }}>Cargando votos…</div>}
          {votos && (
            <>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 6 }}>
                <Cifra valor={votos.length} etiqueta="votaciones del Pleno desde su alta" />
                <Cifra valor={votos.filter(v => v.voto === 'ausente').length} etiqueta="sin votar" />
                {distintos && <Cifra valor={distintos.length} etiqueta="veces votó distinto a su grupo" />}
              </div>
              {d.cargo && <div style={{ fontSize: 11.5, color: C.media, marginBottom: 6 }}>Está en el Consejo de Gobierno: falta al Pleno por la agenda del Gobierno.</div>}
              <Lista titulo="Últimas votaciones" filas={votos.slice(0, 12).map(vo =>
                `${fechaCorta(vo.parl_votaciones?.fecha)} · ${SENTIDO[vo.voto]?.texto ?? vo.voto}${vo.delegado ? ' (delegado)' : ''} · ${tituloLegible(vo.parl_votaciones).slice(0, 110)}`)} />
            </>
          )}
        </Bloque>

        <div className="em" style={{ padding: '12px 16px 18px', fontSize: 10, color: C.tenue, lineHeight: 1.55 }}>
          {d.url_declaracion ? `Bienes según ${d.bienes_fuente}${d.declaracion_motivo ? ` (${d.declaracion_motivo.toLowerCase()})` : ''}, leídos tal y como los publica el Parlamento.` : ''}
          {' '}Cada propiedad cuenta por la parte que declara poseer. El valor catastral lo fija Hacienda y suele estar por debajo del de mercado. Los votos salen del registro electrónico de votaciones del Pleno.
        </div>
      </motion.div>
    </motion.div>
  );
}
