import React, { useEffect, useState } from 'react';
import { PALETAS } from './Bauhaus.jsx';
import { traerIniciativaMadrid } from '../lib/cliente.js';
import { implicacionDe } from '../lib/implicaciones.js';

const P = PALETAS.madrid;

const estilos = `
.imBloque{border-top:3px solid ${P.negro};padding:16px 0 6px;margin-top:18px}
.imRotulo{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px}
.imTenue{font-size:11px;color:${P.gris};line-height:1.5}
.imEnlace{color:${P.c};font-size:12px}
.imBoton{display:inline-block;padding:9px 14px;font-size:12.5px;font-weight:700;background:${P.negro};color:${P.papel};text-decoration:none;box-shadow:3px 3px 0 ${P.a}}
.imTramite{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;padding:8px 0;border-bottom:1px solid #E1E5EA;font-size:12.5px;line-height:1.45}
@media(max-width:600px){.imTramite{grid-template-columns:1fr;gap:2px}}
`;

const ES_LEY = new Set(['PL', 'PROPL']);

const QUE_ES = {
  PL: 'Un proyecto de ley lo presenta el Gobierno regional. Si la Asamblea lo aprueba, es ley en la Comunidad de Madrid.',
  PROPL: 'Una proposición de ley la presentan los grupos. Si la Asamblea la aprueba, es ley en la Comunidad de Madrid. Algunas se dirigen al Congreso de los Diputados, que es quien decide.',
  PNL: 'Una proposición no de ley es una petición política: la Asamblea pide o insta a un Gobierno a hacer algo. No cambia por sí sola ninguna norma.'
};

const NOMBRE_TIPO = { PL: 'Proyecto de ley', PROPL: 'Proposición de ley', PNL: 'Proposición no de ley' };

const CLASE_TEXTO = {
  ley: 'del texto de la ley aprobada',
  aprobado: 'del texto aprobado por la Asamblea',
  presentado: 'del texto presentado, antes de votarse'
};

function fecha(iso) {
  return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
}

function autorCorto(a) {
  if (!a) return null;
  if (a === 'GOBIERNO') return 'Gobierno regional';
  if (a === 'INICIATIVA POPULAR O MUNICIPAL') return 'Iniciativa popular o municipal';
  return a;
}

export default function IniciativaMadrid({ ley, colores, onVolver }) {
  const [ini, setIni] = useState(undefined);

  useEffect(() => {
    let vivo = true;
    setIni(undefined);
    traerIniciativaMadrid(ley.clave).then(x => { if (vivo) setIni(x); }).catch(() => { if (vivo) setIni(null); });
    return () => { vivo = false; };
  }, [ley.clave]);

  const tipo = ley.tipo_siglas;
  const esLey = ES_LEY.has(tipo);
  const oficial = ley.asunto ?? ini?.extracto ?? '';
  const titulo = ini?.frase_corta || (oficial.length > 180 ? `${oficial.slice(0, 180).replace(/\s+\S*$/, '')}…` : oficial);
  const efectos = Array.isArray(ini?.efectos) ? ini.efectos : [];
  const puntos = Array.isArray(ini?.puntos_clave) ? ini.puntos_clave : [];
  const tramites = Array.isArray(ini?.tramites) ? ini.tramites : [];
  const autor = autorCorto(ley.autor);
  const resultado = ley.resultado === 'APROBADA' ? 'aprobada' : ley.resultado === 'RECHAZADA' ? 'rechazada' : String(ley.estado ?? '').toLowerCase();

  return (
    <div>
      <style>{estilos}</style>
      <button onClick={onVolver} className="bh-chip" style={{ marginBottom: 14 }}>← Volver a la lista</button>

      <div className="em" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 10.5, color: P.gris }}>
        <span>{NOMBRE_TIPO[tipo] ?? tipo} {ley.exp_reg}/{ley.exp_ano}</span>
        {ini?.materia_nombre && (
          <span style={{ background: ini.materia_color || P.c, color: '#fff', padding: '2px 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{ini.materia_nombre}</span>
        )}
      </div>

      <h3 className="bh-titulo" style={{ fontSize: 'clamp(21px,3.2vw,30px)', margin: '10px 0 8px', lineHeight: 1.12 }}>{titulo}</h3>
      {ini?.frase_corta && oficial && (
        <details style={{ fontSize: 12.5, color: P.gris, lineHeight: 1.5 }}>
          <summary style={{ cursor: 'pointer' }}>Título oficial</summary>
          <div style={{ marginTop: 6 }}>{oficial}</div>
        </details>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 13 }}>
        {autor && (
          <div>
            <span style={{ color: P.gris }}>Presentada por </span>
            {colores?.get(ley.autor) && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: colores.get(ley.autor), margin: '0 4px 1px 2px' }} />}
            <strong>{autor}</strong>
          </div>
        )}
        {resultado && <div><span style={{ color: P.gris }}>Resultado: </span><strong>{resultado}</strong></div>}
        {tipo !== 'PNL' && ley.num_ley && ley.num_ley !== '-' && <div><strong>Ley {ley.num_ley}</strong></div>}
        {ley.fecha && <div><span style={{ color: P.gris }}>Fecha </span>{fecha(ley.fecha)}</div>}
      </div>
      {ley.firmantes && <div className="imTenue" style={{ marginTop: 6 }}>Firman: {ley.firmantes}</div>}

      {QUE_ES[tipo] && (
        <div style={{ marginTop: 12, padding: '8px 11px', fontSize: 12.5, lineHeight: 1.5, background: esLey ? P.crema : '#FFF6DB', border: `2px solid ${esLey ? P.negro : P.b}` }}>
          {!esLey && <strong>Esto no es una ley. </strong>}{QUE_ES[tipo]}
        </div>
      )}

      {ini === undefined && <p className="imTenue" style={{ marginTop: 16 }}>Cargando la iniciativa…</p>}

      {efectos.length > 0 && (
        <div className="imBloque">
          <div className="imRotulo">Si esto te afecta</div>
          {efectos.map(e => {
            const tip = implicacionDe(e.slug);
            return (
              <div key={e.slug} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: '1px solid #E1E5EA' }}>
                <span style={{ flexShrink: 0, width: 8, height: 8, marginTop: 6, background: ini?.materia_color || P.a }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.nombre}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 3 }}>{e.efecto}</div>
                  {tip && esLey && ini?.basado_en === 'ley' && <div className="imTenue" style={{ marginTop: 6 }}><strong style={{ color: P.negro }}>Qué mirar:</strong> {tip.hacer}</div>}
                </div>
              </div>
            );
          })}
          <div className="imTenue" style={{ marginTop: 8 }}>Colectivos elegidos de una lista cerrada. El efecto dice lo que {ini?.basado_en === 'ley' ? 'cambia' : 'se propone o se pide'}, no si es bueno o malo.</div>
        </div>
      )}

      <div className="imBloque">
        <div className="imRotulo">Qué dice</div>
        {ini?.resumen ? (
          <>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>{ini.resumen}</div>
            {puntos.length > 0 && (
              <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                {puntos.map((p, i) => <li key={i} style={{ marginBottom: 5 }}>{p}</li>)}
              </ul>
            )}
            {ini.a_quien_afecta && (
              <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 12, paddingTop: 10, borderTop: '1px solid #E1E5EA' }}>
                <strong>A quién nombra el texto:</strong> {ini.a_quien_afecta}
              </div>
            )}
            <div className="imTenue" style={{ marginTop: 10 }}>
              Resumen automático {CLASE_TEXTO[ini.basado_en] ?? 'del texto oficial'}{ini.texto_fuente ? `, publicado en ${ini.texto_fuente}` : ''}.
            </div>
          </>
        ) : ini !== undefined && (
          <>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{oficial}</div>
            <div className="imTenue" style={{ marginTop: 8 }}>Todavía no hay resumen de esta iniciativa. Arriba, su título o texto oficial tal y como lo publica la Asamblea.</div>
          </>
        )}
      </div>

      <div className="imBloque">
        <div className="imRotulo">Cómo se votó</div>
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          Resultado: <strong>{resultado || 'sin votar'}</strong>. La Asamblea de Madrid no publica cómo vota cada diputado ni cada grupo; el debate y la votación están en el Diario de Sesiones, enlazado en los documentos.
        </div>
      </div>

      <div className="imBloque">
        <div className="imRotulo">Trámites y documentos oficiales</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {ini?.texto_url && <a className="imBoton" href={ini.texto_url} target="_blank" rel="noopener noreferrer">Leer el texto oficial ↗</a>}
          {(ini?.url_ficha || ley.url) && <a className="imEnlace" href={ini?.url_ficha || ley.url} target="_blank" rel="noopener noreferrer">Ficha oficial de la iniciativa ↗</a>}
        </div>
        {tramites.map((t, i) => (
          <div key={i} className="imTramite">
            <span className="em" style={{ color: P.gris, fontSize: 11 }}>{fecha(t.fecha)}</span>
            <span>
              {t.descripcion}
              {t.enlaces?.length > 0 && (
                <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                  {t.enlaces.map(e => <a key={e.url + e.texto} className="imEnlace" href={e.url} target="_blank" rel="noopener noreferrer">{e.texto} ↗</a>)}
                </span>
              )}
            </span>
          </div>
        ))}
        {ini === null && <div className="imTenue">Todavía no hemos leído los documentos de esta iniciativa.</div>}
      </div>
    </div>
  );
}
