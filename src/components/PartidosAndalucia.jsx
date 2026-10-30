import React, { useEffect, useMemo, useState } from 'react';
import { PALETAS } from './Bauhaus.jsx';
import { traerVotacionesAndalucia } from '../lib/cliente.js';
import { coincidencias, media, mediana, euros, decimal } from '../lib/andalucia-web.js';

const P = PALETAS.andalucia;

const estilos = `
.paCaja{overflow-x:auto;margin:6px 0 18px;-webkit-overflow-scrolling:touch}
.paTabla{width:100%;border-collapse:collapse;font-size:12.5px;min-width:560px}
.paTabla th{font-weight:600;font-size:11px;text-align:right;padding:8px;border-bottom:2px solid ${P.negro};white-space:nowrap}
.paTabla th:first-child,.paTabla td:first-child{text-align:left}
.paTabla td{padding:8px;border-bottom:1px solid #DCE7DF;text-align:right;font-variant-numeric:tabular-nums}
.paSub{display:block;font-size:10.5px;color:${P.gris}}
.paTitulo{font-family:'DM Mono',ui-monospace,monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:18px 0 4px}
`;

const MINIMO_XIII = 30;

function Porcentaje({ x }) {
  if (!x) return '—';
  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 90, height: 8, background: '#DCE7DF', position: 'relative', display: 'inline-block' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${x.pct}%`, background: P.a }} />
        </span>
        <span style={{ minWidth: 38 }}>{x.pct} %</span>
      </span>
      <span className="paSub">{x.iguales} de {x.total}</span>
    </>
  );
}

export default function PartidosAndalucia({ diputados, partidos }) {
  const [xii, setXii] = useState(null);
  const [xiii, setXiii] = useState(null);

  useEffect(() => {
    traerVotacionesAndalucia(12).then(setXii).catch(() => setXii([]));
    traerVotacionesAndalucia(13).then(setXiii).catch(() => setXiii([]));
  }, []);

  const grupos = useMemo(() => partidos.map(p => {
    const suyos = diputados.filter(d => d.partido_siglas === p.siglas);
    const conDecl = suyos.filter(d => d.url_declaracion);
    const sinCargo = suyos.filter(d => !d.cargo && d.votaciones > 0);
    return {
      ...p,
      gobierno: suyos.filter(d => d.cargo).length,
      declaraciones: conDecl.length,
      inmuebles: media(conDecl.map(d => d.n_inmuebles_equivalentes)),
      viviendas: media(conDecl.map(d => d.n_viviendas_equivalentes)),
      catastral: mediana(conDecl.map(d => d.valor_catastral_propio)),
      cuentas: mediana(conDecl.map(d => d.saldo_cuentas)),
      faltas: media(sinCargo.map(d => (100 * d.faltas) / d.votaciones))
    };
  }), [diputados, partidos]);

  const pares = useMemo(() => {
    if (!xii || !xiii) return null;
    const antes = new Map(coincidencias(xii).map(p => [`${p.a}|${p.b}`, p]));
    const ahora = new Map(coincidencias(xiii).map(p => [`${p.a}|${p.b}`, p]));
    const claves = [...new Set([...antes.keys(), ...ahora.keys()])];
    return claves.map(k => ({ k, antes: antes.get(k), ahora: ahora.get(k), a: k.split('|')[0], b: k.split('|')[1] }))
      .filter(x => (x.antes?.total ?? 0) >= 20)
      .sort((x, y) => (y.antes?.pct ?? 0) - (x.antes?.pct ?? 0));
  }, [xii, xiii]);

  const pocasXiii = (xiii?.length ?? 0) < MINIMO_XIII;

  return (
    <div>
      <style>{estilos}</style>
      <div className="paTitulo">Lo que declaran sus diputados</div>
      <div className="paCaja">
        <table className="paTabla">
          <thead>
            <tr>
              <th>Grupo</th><th>Escaños</th><th>En el Gobierno</th>
              <th>Propiedades<span className="paSub">media por diputado</span></th>
              <th>Viviendas<span className="paSub">media por diputado</span></th>
              <th>Valor catastral<span className="paSub">mediana de su parte</span></th>
              <th>En cuentas<span className="paSub">mediana</span></th>
              <th>Votaciones sin votar<span className="paSub">media, sin cargos</span></th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(g => (
              <tr key={g.siglas}>
                <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: g.color, marginRight: 6 }} />{g.siglas}</td>
                <td>{g.n}</td>
                <td>{g.gobierno || '—'}</td>
                <td>{decimal(g.inmuebles)}</td>
                <td>{decimal(g.viviendas)}</td>
                <td>{euros(g.catastral) ?? '—'}</td>
                <td>{euros(g.cuentas) ?? '—'}</td>
                <td>{g.faltas != null ? `${decimal(g.faltas)} %` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="paTitulo">Antes y ahora: cuántas veces votan igual</div>
      <p style={{ fontSize: 12.5, color: P.gris, margin: '0 0 6px', lineHeight: 1.55 }}>
        Porcentaje de votaciones del Pleno en las que dos grupos votaron lo mismo (la postura de cada grupo es la de la mayoría de sus diputados).
        La XII legislatura va de 2022 a 2026{xii ? ` (${xii.length} votaciones)` : ''}; la XIII empezó en 2026{xiii ? ` (${xiii.length} votaciones)` : ''}.
      </p>
      {pocasXiii && xiii && (
        <p style={{ fontSize: 12, color: P.negro, background: P.b, padding: '6px 9px', margin: '0 0 8px', border: `2px solid ${P.negro}` }}>
          La XIII lleva menos de {MINIMO_XIII} votaciones: su columna todavía no permite comparar. Se enseña cuando haya suficientes.
        </p>
      )}
      {!pares && <p style={{ fontSize: 12, color: P.gris }}>Cargando votaciones…</p>}
      {pares && (
        <div className="paCaja">
          <table className="paTabla" style={{ minWidth: 420, maxWidth: pocasXiii ? 620 : 820 }}>
            <thead><tr><th>Grupos</th><th>XII (2022-2026)</th>{!pocasXiii && <th>XIII (desde 2026)</th>}</tr></thead>
            <tbody>
              {pares.map(x => (
                <tr key={x.k}>
                  <td>{x.a} y {x.b}</td>
                  <td><Porcentaje x={x.antes} /></td>
                  {!pocasXiii && <td><Porcentaje x={x.ahora} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="bh-mas">
        <summary>Cómo se calcula y de dónde sale</summary>
        <div>
          <span>Propiedades y viviendas: media por diputado, contando cada inmueble por la parte que se declara poseer. Valor catastral y saldo en cuentas: mediana, porque unas pocas declaraciones muy altas moverían la media de todo el grupo.</span>
          <span>Votaciones sin votar: porcentaje medio de votaciones del Pleno en las que no consta voto, sin contar a quienes están en el Consejo de Gobierno.</span>
          <span>En la XII, Adelante Andalucía votaba dentro del grupo Mixto y aquí aparece con sus propias siglas.</span>
        </div>
      </details>
    </div>
  );
}
