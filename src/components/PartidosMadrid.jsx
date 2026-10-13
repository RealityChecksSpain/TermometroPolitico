import React, { useEffect, useMemo, useState } from 'react';
import { traerIniciativasResumenMadrid } from '../lib/cliente.js';

const estilos = `
.pmCaja{overflow-x:auto;margin:6px 0 18px;-webkit-overflow-scrolling:touch}
.pmTabla{width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px}
.pmTabla th{font-weight:600;font-size:11px;text-align:right;padding:8px;border-bottom:2px solid #14161A;white-space:nowrap}
.pmTabla th:first-child,.pmTabla td:first-child{text-align:left}
.pmTabla td{padding:8px;border-bottom:1px solid #EFECE2;text-align:right;font-variant-numeric:tabular-nums;vertical-align:top}
.pmTabla td:first-child{color:#4A5057;max-width:230px}
.pmTabla .pmGrupo td{background:#E3EAF2;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#7C8288;font-weight:600}
.pmSub{display:block;font-size:10.5px;color:#7C8288}
`;

const TIPOS = [
  ['Preguntas orales', ['PCOP', 'PCOC']],
  ['Preguntas por escrito', ['PE']],
  ['Peticiones de información', ['PI']],
  ['Comparecencias pedidas', ['C']],
  ['Interpelaciones y mociones', ['I', 'M']],
  ['Proposiciones no de ley', ['PNL']],
  ['Proposiciones de ley', ['PROPL']]
];

const VOTABLES = new Set(['PNL', 'PROPL']);

function numero(v, dec = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('es-ES', { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

function media(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function mediana(xs) {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

function valores(lista, campo) {
  return lista.map(d => d[campo]).filter(v => v != null && v !== '').map(Number).filter(Number.isFinite);
}

export default function PartidosMadrid({ diputados, partidos }) {
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    traerIniciativasResumenMadrid().then(setResumen).catch(() => setResumen([]));
  }, []);

  const grupos = useMemo(() => partidos.filter(p => p.siglas !== 'SIN PARTIDO').map(p => {
    const suyos = diputados.filter(d => d.partido_siglas === p.siglas);
    const fiables = suyos.filter(d => d.url_declaracion && d.fiable);
    const faltas = valores(suyos.filter(d => d.plenos_convocado > 0), 'plenos_faltados');
    return {
      ...p,
      leidas: suyos.filter(d => d.url_declaracion).length,
      fiables: fiables.length,
      inmuebles: media(valores(fiables, 'n_inmuebles_equivalentes')),
      viviendas: media(valores(fiables, 'n_viviendas_equivalentes')),
      cuatroMas: fiables.filter(d => Number(d.n_viviendas_equivalentes) >= 4).length,
      patrimonio: mediana(valores(fiables, 'patrimonio_euros')),
      trabajo: mediana(valores(fiables, 'rendimientos_trabajo')),
      faltas: media(faltas),
      conFaltas: faltas.length
    };
  }), [diputados, partidos]);

  const iniciativas = useMemo(() => {
    const m = new Map();
    for (const r of resumen ?? []) {
      for (const [nombre, siglas] of TIPOS) {
        if (!siglas.includes(r.tipo_siglas)) continue;
        const k = `${nombre}|${r.siglas}`;
        const v = m.get(k) ?? { presentadas: 0, no_admitidas: 0, votadas: 0, aprobadas: 0 };
        v.presentadas += r.presentadas;
        v.no_admitidas += r.no_admitidas;
        v.votadas += r.votadas;
        v.aprobadas += r.aprobadas;
        m.set(k, v);
      }
    }
    return m;
  }, [resumen]);

  const fila = (etiqueta, f, sub) => (
    <tr>
      <td>{etiqueta}{sub && <span className="pmSub">{sub}</span>}</td>
      {grupos.map(g => <td key={g.siglas}>{f(g)}</td>)}
    </tr>
  );

  const euros = v => v == null ? '—' : `${numero(Math.round(v), 0)} €`;

  return (
    <div>
      <style>{estilos}</style>
      <div className="pmCaja">
        <table className="pmTabla">
          <thead>
            <tr>
              <th />
              {grupos.map(g => (
                <th key={g.siglas}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: g.color, marginRight: 6 }} />
                  {g.siglas}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fila('Escaños', g => g.n)}
            <tr className="pmGrupo"><td colSpan={grupos.length + 1}>Patrimonio declarado</td></tr>
            {fila('Declaraciones que entran', g => `${g.fiables} de ${g.n}`, 'las leídas sin lectura dudosa')}
            {fila('Propiedades por diputado', g => numero(g.inmuebles), 'media, en propiedad plena')}
            {fila('Viviendas por diputado', g => numero(g.viviendas), 'media, en propiedad plena')}
            {fila('Con cuatro o más viviendas', g => g.cuatroMas)}
            {fila('Patrimonio líquido', g => euros(g.patrimonio), 'mediana: depósitos, valores y planes menos deudas')}
            {fila('Rendimientos del trabajo', g => euros(g.trabajo), 'mediana de lo declarado')}
            <tr className="pmGrupo"><td colSpan={grupos.length + 1}>Pleno</td></tr>
            {fila('Faltas a Pleno por diputado', g => numero(g.faltas), 'media, sin contar al Gobierno regional')}
            <tr className="pmGrupo"><td colSpan={grupos.length + 1}>Iniciativas presentadas · XIII legislatura</td></tr>
            {resumen == null && fila('Cargando…', () => '')}
            {resumen && TIPOS.map(([nombre, siglas]) => fila(nombre, g => {
              const v = iniciativas.get(`${nombre}|${g.siglas}`);
              if (!v?.presentadas) return '0';
              const pct = 100 * v.no_admitidas / v.presentadas;
              return (
                <>
                  {numero(v.presentadas, 0)}
                  <span className="pmSub">{numero(pct)} % no admitidas</span>
                  {siglas.some(s => VOTABLES.has(s)) && <span className="pmSub">{v.aprobadas} aprobadas de {v.votadas} votadas</span>}
                </>
              );
            }))}
          </tbody>
        </table>
      </div>

      <details className="bh-mas">

        <summary>Cómo se calcula y de dónde sale</summary>

        <div>
        Patrimonio: la última declaración de bienes de cada diputado publicada por la Asamblea, leída por un modelo de lenguaje; las de lectura dudosa no entran.
        Cada propiedad cuenta por la parte que declara poseer: media casa es 0,5. Quien deja vacías las tablas de inmuebles cuenta como cero.
        El patrimonio líquido no valora casas ni coches, porque la declaración no pone su valor. Se da la mediana y no la media para que una sola declaración muy alta, o mal leída, no mueva la cifra del grupo.
        Faltas: lista oficial de asistentes a cada Pleno celebrado desde el alta de cada diputado; a la presidenta y a los consejeros no se les cuentan.
        Iniciativas: datos abiertos de la Asamblea; las presentadas por varios grupos a la vez y las iniciativas populares o municipales no se atribuyen a ninguno.
        La Mesa decide qué se admite a trámite y los datos abiertos no dicen el motivo de cada inadmisión. Las aprobaciones son el resultado de la cámara, donde el PP tiene mayoría absoluta desde 2023: la Asamblea no publica cómo vota cada grupo.

        </div>

      </details>
    </div>
  );
}
