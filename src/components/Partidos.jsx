import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { traerProgramas, traerPromesas, traerResumenPromesas } from '../lib/cliente.js';
import { Cifra, Rotulo } from './Movimiento.jsx';
import { siglasPartido } from '../lib/etiquetas.js';

const ESTADO = {
  cumplida: { icono: '✓', color: '#2E7D5B', fondo: '#E6F2EB', texto: 'cumplida' },
  apoyada_sin_aprobar: { icono: '◐', color: '#8A6D1F', fondo: '#F6EFDC', texto: 'la apoyó, no salió' },
  contradicha: { icono: '✕', color: '#9E1B32', fondo: '#FBE9EC', texto: 'votó lo contrario' },
  pendiente: { icono: '○', color: '#8E9299', fondo: '#F1F1EC', texto: 'sin votación aún' }
};

const ORDEN = ['cumplida', 'apoyada_sin_aprobar', 'contradicha', 'pendiente'];

const MUESTRA_MINIMA = 10;

function desdeResumen(f) {
  if (!f) return null;
  const total = Number(f.total ?? 0);
  const juzgadas = Number(f.juzgadas ?? 0);
  const intentadas = Number(f.intentadas ?? 0);
  return {
    cumplida: Number(f.cumplida ?? 0),
    apoyada_sin_aprobar: Number(f.apoyada_sin_aprobar ?? 0),
    contradicha: Number(f.contradicha ?? 0),
    pendiente: Number(f.pendiente ?? 0),
    total,
    juzgadas,
    intentadas,
    cobertura: total ? Math.round((juzgadas / total) * 100) : 0,
    pct: juzgadas >= MUESTRA_MINIMA ? Math.round((intentadas / juzgadas) * 100) : null,
    servidor: true
  };
}

const C = { superficie: '#FFFFFF', tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1' };

const OFICIALES = {
  psoe: 'https://www.psoe.es', pp: 'https://www.pp.es', vox: 'https://www.voxespana.es',
  sumar: 'https://movimientosumar.es', podemos: 'https://podemos.info',
  erc: 'https://www.esquerra.cat', junts: 'https://www.junts.cat',
  bildu: 'https://ehbildu.eus', pnv: 'https://www.eaj-pnv.eus',
  bng: 'https://www.bng.gal', cc: 'https://coalicioncanaria.org',
  upn: 'https://upn.es', compromis: 'https://compromis.net'
};

function Estado({ pr }) {
  const e = ESTADO[pr.estado] ?? ESTADO.pendiente;
  const titulo = pr.norma_titular
    ? `${e.texto} · ${pr.norma_titular}${pr.norma_justificacion ? ` · ${pr.norma_justificacion}` : ''}`
    : e.texto;
  return (
    <span title={titulo} className="em" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
      fontSize: 10, padding: '2px 6px', borderRadius: 2,
      background: e.fondo, color: e.color, fontWeight: 600, cursor: 'help'
    }}>
      <span style={{ fontSize: 11, lineHeight: 1 }}>{e.icono}</span>{e.texto}
    </span>
  );
}

function contar(filas) {
  const verificables = (filas ?? []).filter(x => x.verificable);
  const n = { cumplida: 0, apoyada_sin_aprobar: 0, contradicha: 0, pendiente: 0 };
  for (const x of verificables) {
    if (n[x.estado] === undefined) n.pendiente++;
    else n[x.estado]++;
  }
  const total = verificables.length;
  const juzgadas = total - n.pendiente;
  const intentadas = n.cumplida + n.apoyada_sin_aprobar;
  return {
    ...n, total, juzgadas, intentadas,
    cobertura: total ? Math.round((juzgadas / total) * 100) : 0,
    pct: juzgadas >= MUESTRA_MINIMA ? Math.round((intentadas / juzgadas) * 100) : null,
    servidor: false
  };
}

function Disco({ pct, color, animar }) {
  const R = 11.5;
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#E6E2D6" />
      {pct != null && (
        <motion.circle cx="24" cy="24" r={R} fill="none"
          stroke={color || '#8E9299'} strokeWidth="23"
          transform="rotate(-90 24 24)"
          initial={animar ? { pathLength: 0 } : false}
          animate={{ pathLength: Math.max(0, Math.min(1, pct / 100)) }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
      )}
      <path d="M24 24L24 1" stroke="#F3F1E8" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

function Balanza({ c, color, animar }) {
  if (!c.total) return null;
  return (
    <div style={{ display: 'flex', height: 8, overflow: 'hidden', background: '#EDEBE2' }}>
      {ORDEN.map(k => c[k] > 0 && (
        <motion.i key={k} title={`${c[k]} ${ESTADO[k].texto}`}
          style={{ display: 'block', background: k === 'pendiente' ? '#DCD9CE' : ESTADO[k].color }}
          initial={animar ? { width: 0 } : false}
          animate={{ width: `${(c[k] / c.total) * 100}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
      ))}
    </div>
  );
}

function frase(p, c) {
  if (!c.total) return 'Sin compromisos verificables emparejados con votaciones todavía.';
  if (!c.juzgadas) return `${c.total} compromisos verificables, ninguno ha llegado aún a votación.`;
  const trozos = [];
  if (c.cumplida) trozos.push(`cumplió ${c.cumplida}`);
  if (c.apoyada_sin_aprobar) trozos.push(`apoyó ${c.apoyada_sin_aprobar} sin que salieran adelante`);
  if (c.contradicha) trozos.push(`votó en contra de ${c.contradicha}`);
  if (!trozos.length) return `${c.juzgadas} compromisos ya votados, sin correspondencia clara.`;
  const cola = trozos.length > 1
    ? `${trozos.slice(0, -1).join(', ')} y ${trozos[trozos.length - 1]}`
    : trozos[0];
  const aviso = c.juzgadas < MUESTRA_MINIMA ? ' Muestra pequeña.' : '';
  return `De ${c.juzgadas} compromisos ya votados, ${siglasPartido(p.siglas)} ${cola}.${aviso}`;
}

export default function Partidos({ onDiputados }) {
  const [programas, setProgramas] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [promesas, setPromesas] = useState({});
  const [soloVerificables, setSoloVerificables] = useState(true);
  const [fMateria, setFMateria] = useState(null);

  const [resumen, setResumen] = useState(null);

  useEffect(() => { traerProgramas().then(setProgramas).catch(() => setProgramas([])); }, []);
  useEffect(() => { traerResumenPromesas().then(setResumen).catch(() => setResumen(null)); }, []);

  useEffect(() => {
    if (!programas?.length) return;
    let vivo = true;
    for (const p of programas) {
      traerPromesas(p.partido, false, 400)
        .then(l => { if (vivo) setPromesas(prev => ({ ...prev, [p.partido]: l })); })
        .catch(() => {});
    }
    return () => { vivo = false; };
  }, [programas]);

  const cuentas = useMemo(() => {
    const m = {};
    for (const p of programas ?? []) {
      const clave = String(p.siglas ?? p.partido ?? '').trim().toUpperCase();
      const delServidor = desdeResumen(resumen?.[clave]);
      if (delServidor) m[p.partido] = delServidor;
    }
    for (const k of Object.keys(promesas)) {
      if (!m[k]) m[k] = contar(promesas[k]);
    }
    return m;
  }, [promesas, programas, resumen]);

  const ordenados = useMemo(() => {
    if (!programas) return [];
    return [...programas].sort((a, b) => {
      const ca = cuentas[a.partido];
      const cb = cuentas[b.partido];
      const ia = ca?.intentadas ?? -1;
      const ib = cb?.intentadas ?? -1;
      if (ib !== ia) return ib - ia;
      const ja = ca?.juzgadas ?? 0;
      const jb = cb?.juzgadas ?? 0;
      if (jb !== ja) return jb - ja;
      return (b.promesas ?? 0) - (a.promesas ?? 0);
    });
  }, [programas, cuentas]);

  function abrir(p) {
    setAbierto(abierto === p.partido ? null : p.partido);
    setFMateria(null);
  }

  if (programas === null) {
    return <div style={{ padding: 30, textAlign: 'center', color: C.tenue, fontSize: 12 }}>Cargando…</div>;
  }

  if (programas.length === 0) {
    return (
      <div style={{ padding: 24, background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 3 }}>
        <div style={{ fontSize: 13, color: '#6B5518', lineHeight: 1.6 }}>
          Todavía no hay programas cargados. Pon los PDF en <code>programas/</code> y ejecuta{' '}
          <code>npm run programas</code>.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Rotulo pie="Ordenado por cumplimiento sobre los compromisos ya votados">
        Prometido contra votado
      </Rotulo>

      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginBottom: 6 }}>
        Qué prometió cada partido en 2023 y qué ha votado desde entonces. Solo cuentan los
        compromisos <strong>verificables</strong>: los que se pueden emparejar con una votación
        concreta del Congreso. Ordenado por porcentaje de cumplimiento sobre los ya votados.
      </div>

      <div className="em" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '0 0 16px', fontSize: 10.5, color: C.tenue }}>
        {ORDEN.map(k => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 9, height: 9, borderRadius: 2, background: k === 'pendiente' ? '#DCD9CE' : ESTADO[k].color }} />
            {ESTADO[k].texto}
          </span>
        ))}
      </div>

      {ordenados.map((p, indice) => {
        const activo = abierto === p.partido;
        const c = cuentas[p.partido];
        const cargando = !c;
        const todas = (promesas[p.partido] ?? []).filter(x => !soloVerificables || x.verificable);
        const materias = Array.from(
          todas.reduce((m, x) => {
            if (!x.materia) return m;
            const a = m.get(x.materia) ?? { nombre: x.materia_nombre, color: x.materia_color, n: 0 };
            a.n++; m.set(x.materia, a); return m;
          }, new Map()).entries()
        ).sort((a, b) => b[1].n - a[1].n);
        const filtradas = fMateria ? todas.filter(x => x.materia === fMateria) : todas;
        const lista = [...filtradas].sort(
          (x, y) => (ORDEN.indexOf(x.estado) + 1 || 99) - (ORDEN.indexOf(y.estado) + 1 || 99)
        );

        return (
          <motion.div key={p.id} layout
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            style={{
              border: `1px solid ${activo ? p.color : C.linea}`, borderRadius: 2,
              background: C.superficie, marginBottom: 8, overflow: 'hidden'
            }}>
            <button onClick={() => abrir(p)} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              padding: '14px 15px', background: 'transparent', border: 'none', cursor: 'pointer'
            }}>
              <Disco pct={c?.pct} color={p.color} animar={indice < 8} />

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="ed" style={{ fontSize: 16, fontWeight: 600 }}>{siglasPartido(p.siglas)}</span>
                  {c && (
                    <span className="em" style={{ fontSize: 11, color: C.tenue }}>
                      {c.pct != null
                        ? <><Cifra valor={c.intentadas} /> a favor de {c.juzgadas} ya votados (<Cifra valor={c.pct} sufijo="%" />)</>
                        : <><Cifra valor={c.intentadas} /> a favor de {c.juzgadas} ya votados</>}
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: C.media, lineHeight: 1.45, margin: '4px 0 7px' }}>
                  {cargando ? 'Cruzando compromisos con votaciones…' : frase(p, c)}
                </span>
                {!cargando && <Balanza c={c} color={p.color} animar={indice < 8} />}
                <span className="em" style={{ display: 'block', fontSize: 10, color: C.tenue, marginTop: 6 }}>
                  {p.promesas} compromisos en el programa · {p.verificables} verificables · {p.paginas} páginas
                  {c ? <> · emparejados con una votación: <Cifra valor={c.juzgadas} /> de {c.total} (<Cifra valor={c.cobertura} sufijo="%" />)</> : null}
                </span>
              </span>

              <span style={{ color: C.tenue, fontSize: 15, flexShrink: 0 }}>{activo ? '−' : '+'}</span>
            </button>

            {activo && (
              <div style={{ padding: '0 15px 15px' }}>
                <button onClick={() => setSoloVerificables(!soloVerificables)} className="em" style={{
                  padding: '4px 9px', fontSize: 10.5, cursor: 'pointer', borderRadius: 2, marginBottom: 10,
                  background: soloVerificables ? C.tinta : 'transparent',
                  color: soloVerificables ? '#F3F1E8' : C.media,
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
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.5, flex: 1, minWidth: 0 }}>{pr.texto}</div>
                      {pr.verificable && <Estado pr={pr} />}
                    </div>
                    <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {pr.materia_nombre && (
                        <span style={{ background: (pr.materia_color || '#8E9299') + '22', color: pr.materia_color || C.media, padding: '1px 5px', borderRadius: 2 }}>
                          {pr.materia_nombre}
                        </span>
                      )}
                      {pr.norma_titular && (
                        <span style={{ color: C.media }}>
                          {pr.norma_titular.length > 64 ? pr.norma_titular.slice(0, 64) + '…' : pr.norma_titular}
                        </span>
                      )}
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
                    Web oficial de {siglasPartido(p.siglas)} · descarga allí el programa completo →
                  </a>
                  <div style={{ fontSize: 10, color: C.tenue, marginTop: 7, lineHeight: 1.5 }}>
                    No alojamos los programas: son obra de cada partido. Aquí solo se publican
                    compromisos extraídos y reformulados, con enlace a la fuente original.
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}