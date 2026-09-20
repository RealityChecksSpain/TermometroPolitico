import React, { useMemo } from 'react';
import { VOTO } from '../lib/paleta.js';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288',
  linea: '#DCDCD3', ...VOTO
};

const estilos = `
.posturas{display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:620px){.posturas{grid-template-columns:1fr 1fr}}
.posturaCol{border:1px solid ${C.linea};border-radius:3px;padding:11px 12px;background:#FCFBF7}
.posturaCab{display:flex;align-items:baseline;gap:7px;margin-bottom:9px}
.posturaGrupo{display:flex;align-items:center;gap:8px;padding:5px 0}
.posturaBarra{width:3px;height:17px;border-radius:3px;flex-shrink:0}
.posturaSiglas{font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.posturaN{font-size:11.5px;color:${C.tenue};flex-shrink:0}
`;

function Columna({ titulo, color, grupos, escanos, total }) {
  return (
    <div className="posturaCol">
      <div className="posturaCab">
        <span className="em" style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color
        }}>{titulo}</span>
        <span className="em" style={{ fontSize: 11, color: C.tenue, marginLeft: 'auto' }}>
          {escanos} escaños · {grupos.length} {grupos.length === 1 ? 'grupo' : 'grupos'}
        </span>
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 6, overflow: 'hidden', background: '#EAE8DE', marginBottom: 8 }}>
        <div style={{ width: `${total ? (escanos / total) * 100 : 0}%`, background: color }} />
      </div>
      {grupos.length === 0 ? (
        <div style={{ fontSize: 12, color: C.tenue, padding: '4px 0' }}>Ningún grupo.</div>
      ) : grupos.map(g => (
        <div key={g.grupo} className="posturaGrupo">
          <span className="posturaBarra" style={{ background: g.color || '#8E9299' }} />
          <span className="posturaSiglas">{g.grupo}</span>
          {g.rotos > 0 && (
            <span className="em" style={{
              fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8A6D1F',
              border: '1px solid #E8D9A8', borderRadius: 2, padding: '1px 5px', flexShrink: 0
            }}>dividido</span>
          )}
          <span className="em posturaN">{g.n}</span>
        </div>
      ))}
    </div>
  );
}

export default function Posturas({ analisis }) {
  const bloques = useMemo(() => {
    if (!analisis?.grupos?.length) return null;
    const clasificar = voto => analisis.grupos
      .map(g => ({
        grupo: g.grupo,
        color: g.color,
        n: g[voto] ?? 0,
        rotos: g.mayoritario === voto ? g.rebeldes.length : 0
      }))
      .filter(g => g.n > 0)
      .sort((a, b) => b.n - a.n);
    return {
      si: clasificar('si'),
      no: clasificar('no'),
      abstencion: clasificar('abstencion')
    };
  }, [analisis]);

  if (!bloques) return null;

  const suma = lista => lista.reduce((a, g) => a + g.n, 0);
  const nSi = suma(bloques.si);
  const nNo = suma(bloques.no);
  const nAbs = suma(bloques.abstencion);
  const total = nSi + nNo + nAbs;
  if (total === 0) return null;

  const divididos = analisis.grupos.filter(g => g.rebeldes.length > 0);
  const soloUno = bloques.si.length === 1 || bloques.no.length === 1;

  return (
    <div style={{
      background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3,
      padding: 14, marginTop: 12
    }}>
      <style>{estilos}</style>
      <div style={{
        fontSize: 10, color: C.tenue, textTransform: 'uppercase',
        letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10
      }}>
        Quién lo defendió y quién lo tumbó
      </div>

      <div className="posturas">
        <Columna titulo="A favor" color={C.si} grupos={bloques.si} escanos={nSi} total={total} />
        <Columna titulo="En contra" color={C.no} grupos={bloques.no} escanos={nNo} total={total} />
      </div>

      {nAbs > 0 && (
        <div style={{ marginTop: 10 }}>
          <Columna titulo="Abstención" color={C.abs} grupos={bloques.abstencion} escanos={nAbs} total={total} />
        </div>
      )}

      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 12 }}>
        {nSi > nNo
          ? <>Salió adelante con <strong>{nSi}</strong> escaños de {bloques.si.length} {bloques.si.length === 1 ? 'grupo' : 'grupos'} frente a <strong>{nNo}</strong> de {bloques.no.length}.</>
          : <>Se quedó en <strong>{nSi}</strong> escaños de {bloques.si.length} {bloques.si.length === 1 ? 'grupo' : 'grupos'} frente a <strong>{nNo}</strong> de {bloques.no.length}.</>}
        {soloUno && ' Un solo grupo sostiene uno de los dos lados.'}
        {divididos.length > 0 && (
          <> {divididos.length === 1 ? 'Un grupo se rompió' : `${divididos.length} grupos se rompieron`}: {divididos.map(g => g.grupo).join(', ')}.</>
        )}
      </div>

      <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 10, lineHeight: 1.5 }}>
        Las dos columnas salen del acta de la votación, no de lo que dijo cada grupo en el debate.
        Un voto en contra puede deberse al fondo de la norma, al momento o a la negociación; aquí
        solo consta el sentido del voto.
      </div>
    </div>
  );
}
