import React, { useEffect, useState } from 'react';
import { traerProgramas, traerPromesas } from '../lib/cliente.js';

const C = { superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3' };

const OFICIALES = {
  psoe: 'https://www.psoe.es', pp: 'https://www.pp.es', vox: 'https://www.voxespana.es',
  sumar: 'https://movimientosumar.es', podemos: 'https://podemos.info',
  erc: 'https://www.esquerra.cat', junts: 'https://www.junts.cat',
  bildu: 'https://ehbildu.eus', pnv: 'https://www.eaj-pnv.eus',
  bng: 'https://www.bng.gal', cc: 'https://coalicioncanaria.org',
  upn: 'https://upn.es', compromis: 'https://compromis.net'
};

export default function Partidos({ onDiputados }) {
  const [programas, setProgramas] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [promesas, setPromesas] = useState({});
  const [soloVerificables, setSoloVerificables] = useState(true);
  const [fMateria, setFMateria] = useState(null);

  useEffect(() => { traerProgramas().then(setProgramas).catch(() => setProgramas([])); }, []);

  async function abrir(p) {
    if (abierto === p.partido) { setAbierto(null); return; }
    setAbierto(p.partido);
    setFMateria(null);
    if (!promesas[p.partido]) {
      const l = await traerPromesas(p.partido, false, 400);
      setPromesas(prev => ({ ...prev, [p.partido]: l }));
    }
  }

  if (programas === null) return <div style={{ padding: 30, textAlign: 'center', color: C.tenue, fontSize: 12 }}>Cargando…</div>;

  if (programas.length === 0) return (
    <div style={{ padding: 24, background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 3 }}>
      <div style={{ fontSize: 13, color: '#6B5518', lineHeight: 1.6 }}>
        Todavía no hay programas cargados. Pon los PDF en <code>programas/</code> y ejecuta{' '}
        <code>npm run programas</code>.
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginBottom: 14 }}>
        Compromisos extraídos de los programas electorales de 2023. Los marcados como{' '}
        <strong>verificables</strong> son los que se pueden contrastar con una votación del Congreso.
        El resto son declaraciones de intención.
      </div>

      {programas.map(p => {
        const activo = abierto === p.partido;
        const todas = (promesas[p.partido] ?? []).filter(x => !soloVerificables || x.verificable);
        const materias = Array.from(
          todas.reduce((m, x) => {
            if (!x.materia) return m;
            const a = m.get(x.materia) ?? { nombre: x.materia_nombre, color: x.materia_color, n: 0 };
            a.n++; m.set(x.materia, a); return m;
          }, new Map()).entries()
        ).sort((a, b) => b[1].n - a[1].n);
        const lista = fMateria ? todas.filter(x => x.materia === fMateria) : todas;
        const pct = p.promesas ? Math.round((p.verificables / p.promesas) * 100) : 0;

        return (
          <div key={p.id} style={{
            border: `1px solid ${activo ? p.color : C.linea}`, borderRadius: 3,
            background: C.superficie, marginBottom: 8, overflow: 'hidden',
            transition: 'border-color 160ms ease'
          }}>
            <button onClick={() => abrir(p)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
              padding: '13px 14px', background: 'transparent', border: 'none', cursor: 'pointer'
            }}>
              <span style={{ width: 5, height: 40, background: p.color || '#8E9299', borderRadius: 5, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="ed" style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{p.siglas}</span>
                <span className="em" style={{ display: 'block', fontSize: 10.5, color: C.tenue, marginTop: 2 }}>
                  {p.promesas} compromisos · {p.verificables} verificables ({pct}%) · {p.paginas} páginas
                </span>
              </span>
              <span style={{ color: C.tenue, fontSize: 15, flexShrink: 0 }}>{activo ? '−' : '+'}</span>
            </button>

            {activo && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: '#E4E4DC', marginBottom: 12 }}>
                  <div style={{ width: `${pct}%`, background: p.color || '#8E9299' }} />
                </div>

                <button onClick={() => setSoloVerificables(!soloVerificables)} className="em" style={{
                  padding: '4px 9px', fontSize: 10.5, cursor: 'pointer', borderRadius: 2, marginBottom: 10,
                  background: soloVerificables ? C.tinta : 'transparent',
                  color: soloVerificables ? '#EFEFE9' : C.media,
                  border: `1px solid ${soloVerificables ? C.tinta : C.linea}`
                }}>
                  {soloVerificables ? 'solo verificables' : 'todos los compromisos'}
                </button>

                {materias.length > 1 && (
                  <>
                    <div style={{ fontSize: 10, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600, margin: '4px 0 7px' }}>
                      Qué propone sobre
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                      {materias.map(([slug, m]) => (
                        <button key={slug} onClick={() => setFMateria(fMateria === slug ? null : slug)} style={{
                          padding: '4px 9px', fontSize: 11, borderRadius: 2, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                          background: fMateria === slug ? (m.color || C.tinta) : 'transparent',
                          color: fMateria === slug ? '#FFFFFF' : C.media,
                          border: `1px solid ${fMateria === slug ? (m.color || C.tinta) : C.linea}`,
                          fontWeight: fMateria === slug ? 600 : 400
                        }}>
                          {m.nombre}
                          <span className="em" style={{ fontSize: 10, opacity: .75 }}>{m.n}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {lista.length === 0 && (
                  <div style={{ fontSize: 12, color: C.tenue, padding: '10px 0' }}>
                    {fMateria ? 'Este partido no propone nada verificable sobre esa materia.' : 'Sin compromisos que mostrar.'}
                  </div>
                )}

                {lista.slice(0, 60).map(pr => (
                  <div key={pr.id} style={{ padding: '9px 0', borderTop: `1px solid ${C.linea}` }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{pr.texto}</div>
                    <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {pr.materia_nombre && (
                        <span style={{ background: (pr.materia_color || '#8E9299') + '22', color: pr.materia_color || C.media, padding: '1px 5px', borderRadius: 2 }}>
                          {pr.materia_nombre}
                        </span>
                      )}
                      {pr.verificable && <span style={{ color: '#2E7D5B' }}>verificable</span>}
                      {pr.votaciones_relacionadas > 0 && (
                        <span>{pr.votaciones_relacionadas} votaciones relacionadas</span>
                      )}
                    </div>
                  </div>
                ))}

                {lista.length > 60 && (
                  <div className="em" style={{ fontSize: 10.5, color: C.tenue, marginTop: 10 }}>
                    Mostrando 60 de {lista.length}.
                  </div>
                )}

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.linea}` }}>
                  <a href={OFICIALES[p.partido] ?? '#'} target="_blank" rel="noreferrer" className="em"
                    style={{ fontSize: 11, color: C.media, display: 'block' }}>
                    Web oficial de {p.siglas} · descarga allí el programa completo →
                  </a>
                  <div style={{ fontSize: 10, color: C.tenue, marginTop: 7, lineHeight: 1.5 }}>
                    No alojamos los programas: son obra de cada partido. Aquí solo se publican
                    compromisos extraídos y reformulados, con enlace a la fuente original.
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}