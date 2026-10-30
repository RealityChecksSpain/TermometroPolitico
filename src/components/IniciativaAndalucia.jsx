import React, { useEffect, useState } from 'react';
import { PALETAS } from './Bauhaus.jsx';
import { VotosDeVotacion } from './VotacionesAndalucia.jsx';
import Edad from './EdadAndalucia.jsx';
import { traerIniciativaAndalucia, traerVotacionesDeExpedienteAndalucia } from '../lib/cliente.js';
import { implicacionDe } from '../lib/implicaciones.js';
import {
  TIPO_INICIATIVA, SENTIDO, tituloLegible, fechaCorta, etiquetaLegislatura, autoresDe, ES_LEY, QUE_ES_TIPO
} from '../lib/andalucia-web.js';

const P = PALETAS.andalucia;

const estilos = `
.iaBloque{border-top:3px solid ${P.negro};padding:16px 0 6px;margin-top:18px}
.iaRotulo{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px}
.iaTenue{font-size:11px;color:${P.gris};line-height:1.5}
.iaEnlace{color:${P.c};font-size:12px}
.iaBoton{display:inline-block;padding:9px 14px;font-size:12.5px;font-weight:700;background:${P.negro};color:${P.papel};text-decoration:none;box-shadow:3px 3px 0 ${P.a}}
.iaTramite{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #D5E2D9;font-size:12.5px;line-height:1.45}
.iaVotacion{border:2px solid ${P.negro};padding:12px;margin-bottom:12px;background:${P.papel}}
@media(max-width:600px){.iaTramite{grid-template-columns:1fr;gap:2px}}
`;

const CLASE_TEXTO = {
  ley: 'del texto de la ley aprobada',
  aprobado: 'del texto aprobado por el Pleno',
  presentado: 'del texto presentado, antes de votarse'
};

function Votacion({ v, orden, total, diputados, colores }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="iaVotacion">
      <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>
        {v.titulo_particular || (total > 1 ? `Votación ${orden} de ${total} de este debate` : 'Votación en el Pleno')}
      </div>
      <div className="em" style={{ fontSize: 10.5, color: P.gris, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: '#fff', padding: '2px 7px', fontSize: 10, background: v.resultado === 'aprobada' ? '#1F7A45' : v.resultado === 'rechazada' ? '#B23A2E' : P.gris }}>{v.resultado === 'aprobada' ? 'ganó el sí' : v.resultado === 'rechazada' ? 'ganó el no' : v.resultado}</span>
        <span>{v.si} sí · {v.no} no · {v.abstencion ?? 0} abst.</span>
        <span>{fechaCorta(v.fecha)}</span>
      </div>
      {v.voto_grupos && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          {Object.entries(v.voto_grupos).map(([s, voto]) => (
            <span key={s} className="em" style={{ fontSize: 10, padding: '2px 7px', border: `1.5px solid ${P.negro}`, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <span style={{ width: 7, height: 7, borderRadius: 7, background: colores.get(s) ?? '#8E9299' }} />
              {s}: <strong style={{ color: SENTIDO[voto]?.color }}>{SENTIDO[voto]?.texto ?? voto}</strong>
            </span>
          ))}
        </div>
      )}
      <button className="bh-chip" style={{ marginTop: 10 }} onClick={() => setAbierta(a => !a)} aria-expanded={abierta}>
        {abierta ? 'Ocultar el voto de cada diputado' : 'Ver el voto de cada diputado'}
      </button>
      {abierta && <VotosDeVotacion v={v} diputados={diputados} colores={colores} legislatura={v.legislatura} />}
    </div>
  );
}

export default function IniciativaAndalucia({ votacion, colores, diputados, onVolver }) {
  const expediente = votacion?.expediente ?? null;
  const [ini, setIni] = useState(undefined);
  const [votaciones, setVotaciones] = useState(null);
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    setIni(undefined);
    setVotaciones(null);
    if (!expediente) { setIni(null); setVotaciones([votacion]); return; }
    traerIniciativaAndalucia(expediente).then(x => { if (vivo) setIni(x); }).catch(() => { if (vivo) setIni(null); });
    traerVotacionesDeExpedienteAndalucia(expediente, votacion.legislatura)
      .then(x => { if (vivo) setVotaciones(x.length ? x : [votacion]); })
      .catch(() => { if (vivo) setVotaciones([votacion]); });
    return () => { vivo = false; };
  }, [expediente]);

  const tipo = ini?.tipo ?? votacion?.tipo_iniciativa;
  const esLey = ES_LEY.has(tipo);
  const autores = autoresDe(ini?.proponente);
  const titulo = ini?.frase_corta || ini?.extracto || tituloLegible(votacion);
  const oficial = ini?.extracto || tituloLegible(votacion);
  const efectos = Array.isArray(ini?.efectos) ? ini.efectos : [];
  const puntos = Array.isArray(ini?.puntos_clave) ? ini.puntos_clave : [];
  const tramites = Array.isArray(ini?.tramites) ? ini.tramites : [];
  const visibles = votaciones && !todas ? votaciones.slice(0, 3) : votaciones;

  return (
    <div>
      <style>{estilos}</style>
      <button onClick={onVolver} className="bh-chip" style={{ marginBottom: 14 }}>← Volver a la lista</button>

      <div className="em" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 10.5, color: P.gris }}>
        <Edad legislatura={votacion?.legislatura} />
        <span>{etiquetaLegislatura(votacion?.legislatura).larga}</span>
        <span>·</span>
        <span>{TIPO_INICIATIVA[tipo] ?? ini?.tipo_nombre ?? tipo ?? ''}</span>
        {ini?.materia_nombre && (
          <span style={{ background: ini.materia_color || P.c, color: '#fff', padding: '2px 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{ini.materia_nombre}</span>
        )}
      </div>

      <h3 className="bh-titulo" style={{ fontSize: 'clamp(22px,3.4vw,32px)', margin: '10px 0 8px', lineHeight: 1.1 }}>{titulo}</h3>
      {titulo !== oficial && <div style={{ fontSize: 13, color: P.gris, lineHeight: 1.5 }}>{oficial}</div>}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 13 }}>
        {autores.length > 0 && (
          <div>
            <span style={{ color: P.gris }}>Presentada por </span>
            {autores.map((a, i) => (
              <span key={a}>
                {colores.get(a) && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: colores.get(a), margin: '0 4px 1px 2px' }} />}
                <strong>{a}</strong>{i < autores.length - 2 ? ', ' : i === autores.length - 2 ? ' y ' : ''}
              </span>
            ))}
          </div>
        )}
        {ini?.estado && <div><span style={{ color: P.gris }}>Estado: </span><strong>{ini.estado}</strong></div>}
        {ini?.fecha_creacion && <div><span style={{ color: P.gris }}>Registrada el </span>{fechaCorta(ini.fecha_creacion)}</div>}
      </div>

      {QUE_ES_TIPO[tipo] && (
        <div style={{ marginTop: 12, padding: '8px 11px', fontSize: 12.5, lineHeight: 1.5, background: esLey ? P.crema : '#FFF6DB', border: `2px solid ${esLey ? P.negro : P.b}` }}>
          {!esLey && <strong>Esto no es una ley. </strong>}{QUE_ES_TIPO[tipo]}
        </div>
      )}

      {ini === undefined && <p className="iaTenue" style={{ marginTop: 16 }}>Cargando la iniciativa…</p>}

      {efectos.length > 0 && (
        <div className="iaBloque">
          <div className="iaRotulo">Si esto te afecta</div>
          {efectos.map(e => {
            const tip = implicacionDe(e.slug);
            return (
              <div key={e.slug} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: '1px solid #D5E2D9' }}>
                <span style={{ flexShrink: 0, width: 8, height: 8, marginTop: 6, background: ini?.materia_color || P.a }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.nombre}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 3 }}>{e.efecto}</div>
                  {tip && esLey && <div className="iaTenue" style={{ marginTop: 6 }}><strong style={{ color: P.negro }}>Qué mirar:</strong> {tip.hacer}</div>}
                </div>
              </div>
            );
          })}
          <div className="iaTenue" style={{ marginTop: 8 }}>Colectivos elegidos de una lista cerrada. El efecto dice lo que {esLey ? 'cambia' : 'se pide'}, no si es bueno o malo.</div>
        </div>
      )}

      {ini?.resumen && (
        <div className="iaBloque">
          <div className="iaRotulo">Qué dice</div>
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>{ini.resumen}</div>
          {puntos.length > 0 && (
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
              {puntos.map((p, i) => <li key={i} style={{ marginBottom: 5 }}>{p}</li>)}
            </ul>
          )}
          {ini.a_quien_afecta && (
            <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 12, paddingTop: 10, borderTop: '1px solid #D5E2D9' }}>
              <strong>A quién nombra el texto:</strong> {ini.a_quien_afecta}
            </div>
          )}
          <div className="iaTenue" style={{ marginTop: 10 }}>
            Resumen automático {CLASE_TEXTO[ini.basado_en] ?? 'del texto oficial'}{ini.texto_fuente ? `, publicado en el ${ini.texto_fuente}` : ''}.
          </div>
        </div>
      )}

      {ini !== undefined && !ini?.resumen && (
        <div className="iaBloque">
          <div className="iaRotulo">Qué dice</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{oficial}</div>
          <div className="iaTenue" style={{ marginTop: 8 }}>
            {!ini
              ? 'Todavía no hay resumen de esta iniciativa.'
              : ini.texto_url
                ? 'Todavía no hay resumen de esta iniciativa. Su texto oficial está enlazado abajo.'
                : 'No hemos encontrado su texto en el Boletín Oficial del Parlamento. Los trámites de abajo enlazan a los documentos oficiales.'}
          </div>
        </div>
      )}

      <div className="iaBloque">
        <div className="iaRotulo">Cómo se votó{votaciones && votaciones.length > 1 ? ` · ${votaciones.length} votaciones` : ''}</div>
        {!votaciones && <p className="iaTenue">Cargando votaciones…</p>}
        {votaciones && votaciones.length > 1 && votaciones.every(v => !v.titulo_particular) && (
          <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 12px' }}>
            Hubo {votaciones.length} votaciones. El registro oficial de votaciones no dice qué se votó en cada una (enmiendas, puntos o el texto completo); lo detalla el Diario de Sesiones, enlazado en los trámites.
            {ini?.estado && <> El estado oficial de la iniciativa es <strong>{ini.estado.toLowerCase()}</strong>.</>}
          </p>
        )}
        {visibles?.map(v => {
          const mismas = votaciones.filter(x => x.sesion === v.sesion);
          return <Votacion key={v.id} v={v} orden={mismas.indexOf(v) + 1} total={mismas.length} diputados={diputados} colores={colores} />;
        })}
        {votaciones && votaciones.length > 3 && (
          <button className="bh-chip" onClick={() => setTodas(t => !t)}>{todas ? 'Ver menos' : `Ver las ${votaciones.length} votaciones`}</button>
        )}
      </div>

      <div className="iaBloque">
        <div className="iaRotulo">Trámites y textos oficiales</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {ini?.texto_url && <a className="iaBoton" href={ini.texto_url} target="_blank" rel="noopener noreferrer">Leer el texto en el {ini.texto_fuente?.split(' - ')[0] ?? 'BOPA'} ↗</a>}
          {ini?.url_ficha && <a className="iaEnlace" href={ini.url_ficha} target="_blank" rel="noopener noreferrer">Ficha oficial de la iniciativa ↗</a>}
          {!ini && votacion?.fuente_url && <a className="iaEnlace" href={votacion.fuente_url} target="_blank" rel="noopener noreferrer">Registro oficial de la votación ↗</a>}
        </div>
        {tramites.map((t, i) => (
          <div key={i} className="iaTramite">
            <span className="em" style={{ color: P.gris, fontSize: 11 }}>{fechaCorta(t.fecha)}</span>
            <span>
              {t.descripcion}
              {t.enlaces?.length > 0 && (
                <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                  {t.enlaces.map(e => <a key={e.url + e.texto} className="iaEnlace" href={e.url} target="_blank" rel="noopener noreferrer">{e.texto} ↗</a>)}
                </span>
              )}
            </span>
          </div>
        ))}
        {ini?.expediente && <div className="iaTenue" style={{ marginTop: 8 }}>Expediente {ini.expediente}</div>}
      </div>
    </div>
  );
}
