import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DestelloSuave } from './Destello.jsx';
import Contraste from './Contraste.jsx';
import { VOTO } from '../lib/paleta.js';
import { traerMapaPartidos, traerSesgo, traerAuditoriaEjeVotos, traerSubejes, traerBaseComun, traerVotosPorClase, traerIniciativasPartido } from '../lib/cliente.js';
import {
  traerReferencias, traerFuentesExternas, traerDimensionesRegimen, NOMBRE_DIMENSION
} from '../lib/referencias.js';
import { marcaDe } from '../lib/regimenes-marca.js';
import { puntoSvg, indiceMasCercano } from '../lib/svgPuntero.js';

const esTactil = typeof window !== 'undefined' &&
  (window.matchMedia?.('(hover: none)').matches || 'ontouchstart' in window);

const VIAJE = { type: 'spring', stiffness: 90, damping: 20, mass: 1 };

const C = {
  papel: '#F3F1E8', superficie: '#FFFFFF', pizarra: '#18211E',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1'
};

const NOMBRE_DIM = {
  gasto: 'gasto público',
  impuestos: 'impuestos',
  regulacion: 'regulación empresarial',
  derechos: 'derechos individuales',
  migracion: 'reglas de migración'
};

function listarDims(dims) {
  if (!dims) return null;
  const partes = String(dims).split('+').map(d => NOMBRE_DIM[d] || d);
  if (partes.length === 1) return partes[0];
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
}

const CAMPO = 1.12;
const ESCALA_MIN = 1.24;
const ESCALA_CHES = 1.24 / 5;
const FORMAS = ['circulo', 'triangulo', 'cuadrado', 'pentagono', 'hexagono'];
const LADOS = { triangulo: 3, cuadrado: 4, pentagono: 5, hexagono: 6 };
const MAX_RANURAS = 5;

function poligono(cx, cy, r, lados, giro = -Math.PI / 2) {
  const salida = [];
  for (let i = 0; i < lados; i++) {
    const a = giro + (i * 2 * Math.PI) / lados;
    salida.push(`${(cx + r * Math.cos(a)).toFixed(4)},${(cy + r * Math.sin(a)).toFixed(4)}`);
  }
  return salida.join(' ');
}

function ranuraDe(rf) {
  if (rf.partido_slug) return 'espana';
  if (rf.tipo === 'regimen') return 'historicos';
  return rf.pais_nombre || 'sin-pais';
}

function codigoDe(texto) {
  const limpio = String(texto ?? '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, '');
  return (limpio.slice(0, 2) || '··').toUpperCase();
}

const NOMBRE_CLASE = {
  ley_final: 'Votaciones finales de norma',
  decisoria: 'Tomas en consideración y totalidad',
  enmienda: 'Enmiendas a leyes en trámite',
  tramite: 'Trámite parlamentario',
  no_vinculante: 'Declaraciones sin valor de ley'
};

const NOMBRE_SUBEJE = {
  gasto_publico: 'Gasto público',
  impuestos: 'Impuestos',
  regulacion_mercado: 'Regulación de empresas',
  derechos_individuales: 'Derechos individuales',
  apertura_migratoria: 'Migración',
  moral_tradicional: 'Moral y familia',
  religion_estado: 'Religión y Estado',
  orden_publico: 'Orden público',
  diversidad_cultural: 'Diversidad cultural'
};

const ETIQUETA_DIM = {
  gasto_publico: ['recortar gasto', 'ampliar gasto'],
  impuestos: ['bajar impuestos', 'subir impuestos'],
  regulacion_mercado: ['desregular', 'regular más'],
  derechos_individuales: ['restringir derechos', 'ampliar derechos'],
  apertura_migratoria: ['cerrar la migración', 'abrir la migración'],
  moral_tradicional: ['la moral tradicional', 'la autonomía personal'],
  religion_estado: ['privilegios confesionales', 'la laicidad'],
  orden_publico: ['más poder policial', 'más garantías'],
  diversidad_cultural: ['la asimilación', 'la pluralidad']
};

function GuiaEje({ titulo, intro, a, b, miramos, colorA, colorB }) {
  return (
    <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 15, height: '100%' }}>
      <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.6, marginTop: 8 }}>{intro}</div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{
          fontSize: 11, color: colorA || C.tinta, textTransform: 'uppercase',
          letterSpacing: '.06em', fontWeight: 700
        }}>
          {a.titulo}
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{a.texto}</div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{
          fontSize: 11, color: colorB || C.tinta, textTransform: 'uppercase',
          letterSpacing: '.06em', fontWeight: 700
        }}>
          {b.titulo}
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{b.texto}</div>
      </div>

      <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.linea}` }}>
        <div className="em" style={{ fontSize: 10, color: C.tenue, letterSpacing: '.05em', fontWeight: 600 }}>
          LO QUE MIRAMOS
        </div>
        <div style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginTop: 5 }}>{miramos}</div>
      </div>
    </div>
  );
}

export default function Mapa({ onDiputados }) {
  const [datos, setDatos] = useState(null);
  const [subejes, setSubejes] = useState(null);
  const [baseComun, setBaseComun] = useState(null);
  const [votosClase, setVotosClase] = useState(null);
  const [iniciativas, setIniciativas] = useState(null);
  const [referencias, setReferencias] = useState(null);
  const [fuentesExternas, setFuentesExternas] = useState(null);
  const [dimRegimen, setDimRegimen] = useState(null);
  const [ranuras, setRanuras] = useState(null);
  const [activos, setActivos] = useState(() => new Set());
  const [fuente, setFuente] = useState('programa');
  const [encima, setEncima] = useState(null);
  const [fijado, setFijado] = useState(null);
  const [sesgo, setSesgo] = useState(null);
  const [auditoria, setAuditoria] = useState(null);
  const [vista, setVista] = useState({ z: 1, px: 0, py: 0 });
  const arrastre = useRef(null);
  const svgRef = useRef(null);

  const VB = { x: -1.45, y: -1.5, w: 2.9, h: 3.05 };
  const viewBox = useMemo(() => {
    const w = VB.w / vista.z;
    const h = VB.h / vista.z;
    const cx = VB.x + VB.w / 2 + vista.px;
    const cy = VB.y + VB.h / 2 + vista.py;
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  }, [vista]);

  const acercar = useCallback((factor, foco) => {
    setVista(v => {
      const z = Math.min(6, Math.max(1, v.z * factor));
      if (z === v.z) return v;
      if (!foco) return { z, px: v.px, py: v.py };
      const k = 1 / v.z - 1 / z;
      return {
        z,
        px: v.px + (foco.x - (VB.x + VB.w / 2 + v.px)) * k * v.z,
        py: v.py + (foco.y - (VB.y + VB.h / 2 + v.py)) * k * v.z
      };
    });
  }, []);

  const reencuadrar = useCallback(() => setVista({ z: 1, px: 0, py: 0 }), []);

  useEffect(() => {
    traerMapaPartidos().then(setDatos).catch(() => setDatos([]));
    traerSesgo().then(setSesgo).catch(() => setSesgo(null));
    traerAuditoriaEjeVotos().then(setAuditoria).catch(() => setAuditoria(null));
    traerSubejes().then(setSubejes).catch(() => setSubejes(null));
    traerBaseComun().then(setBaseComun).catch(() => setBaseComun(null));
    traerVotosPorClase().then(setVotosClase).catch(() => setVotosClase(null));
    traerIniciativasPartido().then(setIniciativas).catch(() => setIniciativas(null));
    traerReferencias().then(setReferencias).catch(() => setReferencias([]));
    traerFuentesExternas().then(setFuentesExternas).catch(() => setFuentesExternas([]));
    traerDimensionesRegimen().then(setDimRegimen).catch(() => setDimRegimen({}));
  }, []);


  const puntos = useMemo(() => {
    if (fuente === 'referencias') {
      const propios = new Map((datos ?? []).map(d => [d.partido, d]));
      const forma = new Map((ranuras ?? []).map(rn => [rn.id, rn.forma]));
      return (referencias ?? [])
        .filter(rf => activos.has(rf.clave) && forma.has(ranuraDe(rf)))
        .map(rf => {
        const mio = rf.partido_slug ? propios.get(rf.partido_slug) : null;
        const x = (rf.x - 5) * ESCALA_CHES;
        const y = (5 - rf.y) * ESCALA_CHES;
        return {
          forma: forma.get(ranuraDe(rf)),
          codigo: rf.tipo === 'regimen' ? marcaDe(rf.clave).codigo : codigoDe(rf.nombre_corto || rf.nombre),
          partido: rf.clave,
          siglas: rf.nombre_corto || rf.nombre,
          nombre: rf.nombre,
          pais: rf.pais_nombre,
          anio: rf.anio,
          fuentes: rf.fuentes,
          territorial: rf.territorial,
          bruto_x: rf.x,
          bruto_y: rf.y,
          esEspanol: Boolean(rf.partido_slug),
          esRegimen: rf.tipo === 'regimen',
          democracia: rf.democracia,
          democraciaDesde: rf.democracia_desde,
          democraciaHasta: rf.democracia_hasta,
          color: mio?.color || '#C9CDD2',
          escanos: mio?.escanos ?? null,
          n: rf.n_x,
          escala: 1,
          x, y, cx: x, cy: -y,
          ex: rf.ex * ESCALA_CHES,
          ey: rf.ey * ESCALA_CHES
        };
      });
    }
    if (!datos) return [];
    let list = datos
      .map(d => ({
        ...d,
        x: fuente === 'programa' ? d.prog_economico
          : fuente === 'territorio' ? d.voto_territorial : d.voto_economico,
        y: fuente === 'programa' ? d.prog_social
          : fuente === 'territorio' ? d.voto_social : d.voto_social,
        n: fuente === 'programa' ? d.promesas_codificadas
          : fuente === 'territorio' ? d.voto_n_territorial : d.voto_n_economico,
        ex: fuente === 'programa' ? null
          : fuente === 'territorio' ? d.voto_err_territorial : d.voto_err_economico,
        ey: fuente === 'programa' ? null : d.voto_err_social,
        nulo: fuente === 'programa' ? false
          : fuente === 'territorio' ? false : Boolean(d.voto_eco_nulo)
      }))
      .filter(d => d.x !== null && d.x !== undefined && d.y !== null && d.y !== undefined)
      .map(d => ({ ...d, x: Number(d.x), y: Number(d.y) }));

    if (fuente !== 'programa') {
      const tope = Math.max(
        0.05,
        ...list.map(p => Math.abs(Number(p.x)) + Math.abs(Number(p.ex ?? 0)) * 1.96),
        ...list.map(p => Math.abs(Number(p.y)) + Math.abs(Number(p.ey ?? 0)) * 1.96)
      );
      const k = Math.max(ESCALA_MIN, CAMPO / tope);
      list = list.map(p => ({
        ...p,
        escala: k,
        x: Number(p.x) * k,
        y: Number(p.y) * k,
        ex: Number(p.ex ?? 0) * 1.96 * k,
        ey: Number(p.ey ?? 0) * 1.96 * k
      }));
    }

    return list.map(d => ({ ...d, cx: d.x, cy: -d.y }));
  }, [datos, fuente, referencias, ranuras, activos]);

  const escala = puntos[0]?.escala ?? 1;

  const porRanura = useMemo(() => {
    const m = new Map();
    for (const rf of referencias ?? []) {
      const id = ranuraDe(rf);
      if (!m.has(id)) m.set(id, []);
      m.get(id).push(rf);
    }
    for (const [id, lista] of m) {
      lista.sort((a, b) => id === 'historicos'
        ? (a.democracia ?? 1) - (b.democracia ?? 1)
        : String(a.nombre_corto ?? '').localeCompare(String(b.nombre_corto ?? ''), 'es'));
    }
    return m;
  }, [referencias]);

  const paisesLibres = useMemo(() => {
    const puestos = new Set((ranuras ?? []).map(rn => rn.id));
    return Array.from(porRanura.keys())
      .filter(id => id !== 'espana' && id !== 'historicos' && !puestos.has(id))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [porRanura, ranuras]);

  useEffect(() => {
    if (ranuras !== null || !referencias || referencias.length === 0) return;
    const iniciales = [];
    if (porRanura.has('espana')) iniciales.push({ id: 'espana', titulo: 'España', forma: 'circulo' });
    if (porRanura.has('historicos')) iniciales.push({ id: 'historicos', titulo: 'Regímenes históricos', forma: 'triangulo' });
    setRanuras(iniciales);
    setActivos(new Set(iniciales.flatMap(rn => (porRanura.get(rn.id) ?? []).map(rf => rf.clave))));
  }, [referencias, porRanura, ranuras]);

  const formaLibre = () => FORMAS.find(f => f !== 'circulo' && f !== 'triangulo'
    && !(ranuras ?? []).some(rn => rn.forma === f)) ?? 'hexagono';

  const anadirPais = pais => {
    if (!pais || (ranuras ?? []).length >= MAX_RANURAS) return;
    setRanuras(previo => [...(previo ?? []), { id: pais, titulo: pais, forma: formaLibre() }]);
    setActivos(previo => {
      const siguiente = new Set(previo);
      (porRanura.get(pais) ?? []).forEach(rf => siguiente.add(rf.clave));
      return siguiente;
    });
  };

  const quitarRanura = id => {
    setRanuras(previo => (previo ?? []).filter(rn => rn.id !== id));
    setActivos(previo => {
      const siguiente = new Set(previo);
      (porRanura.get(id) ?? []).forEach(rf => siguiente.delete(rf.clave));
      return siguiente;
    });
  };

  const alternarClave = clave => setActivos(previo => {
    const siguiente = new Set(previo);
    if (siguiente.has(clave)) siguiente.delete(clave);
    else siguiente.add(clave);
    return siguiente;
  });

  const alternarRanura = (id, encender) => setActivos(previo => {
    const siguiente = new Set(previo);
    (porRanura.get(id) ?? []).forEach(rf => {
      if (encender) siguiente.add(rf.clave);
      else siguiente.delete(rf.clave);
    });
    return siguiente;
  });

  const separables = useMemo(() => {
    const m = new Map();
    if (fuente === 'referencias') return m;
    for (const p of puntos) {
      const otros = puntos.filter(q => q.partido !== p.partido);
      const n = otros.filter(q => {
        const margen = Math.sqrt(Number(p.ex ?? 0) ** 2 + Number(q.ex ?? 0) ** 2);
        return Math.abs(Number(p.x) - Number(q.x)) > margen;
      }).length;
      m.set(p.partido, n);
    }
    return m;
  }, [puntos, fuente]);

  const r = escanos => 0.035 + Math.sqrt(Number(escanos ?? 1)) * 0.011;

  const conEtiqueta = useMemo(() => {
    const orden = [...puntos].sort((a, b) => a.cx - b.cx || b.cy - a.cy);
    const puestas = [];
    return orden.map(p => {
      const radio = fuente === 'referencias' ? (p.esRegimen ? 0.072 : 0.064) : r(p.escanos);
      const base = p.cy + radio + 0.095;
      let ly = base;
      let intentos = 0;
      while (puestas.some(q => Math.abs(q.x - p.cx) < 0.30 && Math.abs(q.y - ly) < 0.085) && intentos < 8) {
        ly += 0.088;
        intentos++;
      }
      puestas.push({ x: p.cx, y: ly });
      return { ...p, labelY: ly, radio };
    });
  }, [puntos, separables, fuente]);

  const resolver = useCallback((clientX, clientY) => {
    const p = puntoSvg(svgRef.current, clientX, clientY);
    if (!p) return null;
    const coords = conEtiqueta.map(q => ({ cx: q.cx, cy: q.cy }));
    const maxR = Math.max(0.12, ...conEtiqueta.map(q => q.radio * 2.4));
    const idx = indiceMasCercano(coords, p.x, p.y, maxR);
    if (idx < 0) return null;
    return conEtiqueta[idx];
  }, [conEtiqueta]);

  const onPointerMove = useCallback(e => {
    const a = arrastre.current;
    if (a) {
      if (Math.abs(e.clientX - a.sx) > 3 || Math.abs(e.clientY - a.sy) > 3) a.movido = true;
      if (!a.movido) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      const unidadesPorPx = (VB.w / a.z) / rect.width;
      setVista(v => ({
        ...v,
        px: a.px - (e.clientX - a.sx) * unidadesPorPx,
        py: a.py - (e.clientY - a.sy) * unidadesPorPx
      }));
      return;
    }
    const hit = resolver(e.clientX, e.clientY);
    setEncima(hit ? hit.partido : null);
  }, [resolver]);

  const onPointerLeave = useCallback(() => {
    arrastre.current = null;
    setEncima(null);
  }, []);

  const onPointerDown = useCallback(e => {
    if (e.button != null && e.button !== 0) return;
    arrastre.current = {
      sx: e.clientX, sy: e.clientY,
      px: vista.px, py: vista.py, z: vista.z,
      movido: false
    };
    try { svgRef.current?.setPointerCapture?.(e.pointerId); } catch { /* sin captura */ }
  }, [resolver, vista]);

  const onPointerUp = useCallback(e => {
    const a = arrastre.current;
    arrastre.current = null;
    try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* sin captura */ }
    if (a?.movido) return;
    const hit = resolver(e.clientX, e.clientY);
    if (!hit) {
      setFijado(null);
      return;
    }
    setEncima(prev => (esTactil && prev === hit.partido ? null : hit.partido));
    setFijado(prev => (prev === hit.partido ? null : hit.partido));
  }, [resolver]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const alRodar = e => {
      e.preventDefault();
      e.stopPropagation();
      const p = puntoSvg(svg, e.clientX, e.clientY);
      acercar(e.deltaY < 0 ? 1.18 : 1 / 1.18, p);
    };
    svg.addEventListener('wheel', alRodar, { passive: false });
    return () => svg.removeEventListener('wheel', alRodar);
  }, [acercar, datos, fuente]);

  if (datos === null) return <div style={{ padding: 40, textAlign: 'center', color: C.tenue, fontSize: 13 }}>Cargando…</div>;

  const activo = encima ? conEtiqueta.find(p => p.partido === encima) : null;
  const anclado = fijado ? conEtiqueta.find(p => p.partido === fijado) : null;
  const comparando = Boolean(anclado && activo && anclado.partido !== activo.partido);
  const faltan = 13 - (datos?.length ?? 0);

  const Ficha = ({ activo }) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 11, height: 11, flexShrink: 0,
          borderRadius: fuente === 'referencias' && !activo.esEspanol ? 0 : 11,
          background: fuente === 'referencias' && !activo.esEspanol ? 'transparent' : activo.color,
          border: fuente === 'referencias' && !activo.esEspanol ? '1px solid #EDE7D4' : 'none',
          transform: fuente === 'referencias' && activo.esRegimen ? 'rotate(45deg)' : 'none'
        }} />
        <span style={{ color: '#F2F3F0', fontSize: 14.5, fontWeight: 600 }}>{activo.siglas}</span>
        {fuente === 'referencias'
          ? <span className="em" style={{ color: '#9AA0A6', fontSize: 11 }}>{activo.pais} · {activo.anio}</span>
          : <span className="em" style={{ color: '#9AA0A6', fontSize: 11 }}>{activo.escanos} escaños</span>}
      </div>
      {fuente === 'referencias' && (
        <div className="em" style={{ color: '#A8AEB4', fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
          izquierda-derecha {Number(activo.bruto_x).toFixed(2)} · conservador-progresista {Number(activo.bruto_y).toFixed(2)}
          {activo.territorial != null && <> · territorial {Number(activo.territorial).toFixed(2)}</>}
          <span style={{ display: 'block', color: '#7C8288', fontSize: 10.5, marginTop: 4 }}>
            escala 0 a 10 · {activo.fuentes.map(f => fuentesExternas?.find(x => x.id === f)?.nombre ?? f).join(' · ')}
            {activo.nombre && activo.nombre !== activo.siglas && <> · {activo.nombre}</>}
          </span>
          {activo.esRegimen && (() => {
            const filas = dimRegimen?.[activo.partido] ?? [];
            if (!filas.length) return null;
            const orden = { izq_der: 0, con_pro: 1 };
            const lista = [...filas].sort((a2, b2) =>
              (orden[a2.eje] ?? 9) - (orden[b2.eje] ?? 9) || b2.acuerdo - a2.acuerdo);
            return (
              <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #3A4048' }}>
                <div className="em" style={{
                  fontSize: 9.5, color: '#7C8288', letterSpacing: '.09em',
                  textTransform: 'uppercase', marginBottom: 6
                }}>
                  por qué está ahí
                </div>
                {lista.map(f => (
                  <div key={f.dimension} style={{ marginBottom: 6 }}>
                    <div className="em" style={{ fontSize: 10.5, color: '#C9CDD2' }}>
                      {NOMBRE_DIMENSION[f.dimension] ?? f.dimension}
                      <span style={{ color: f.valor === 'neutro' ? '#7C8288' : '#E8C56A' }}> · {f.valor}</span>
                      <span style={{ color: '#7C8288' }}> · acuerdo {f.acuerdo.toFixed(2)} de {f.votantes}</span>
                    </div>
                    {f.cita && (
                      <div className="em" style={{ fontSize: 10, color: '#8E959C', lineHeight: 1.5 }}>
                        {f.cita}
                      </div>
                    )}
                  </div>
                ))}
                <div className="em" style={{ fontSize: 10, color: '#7C8288', lineHeight: 1.5, marginTop: 6 }}>
                  Cada dimensión es la respuesta mayoritaria de los codificadores, con su grado de
                  acuerdo y la medida concreta que aportó quien la justificó.
                </div>
              </div>
            );
          })()}

          {activo.esRegimen && activo.democracia != null && (
            <span style={{ display: 'block', color: '#A8AEB4', fontSize: 11, marginTop: 6 }}>
              Democracia liberal {Number(activo.democracia).toFixed(3)} de 1
              {activo.democraciaDesde != null && <> · media de {activo.democraciaDesde} a {activo.democraciaHasta}</>}
              <span style={{ display: 'block', color: '#7C8288', fontSize: 10.5, marginTop: 3 }}>
                V-Dem. No entra en ningún eje: solo marca el grosor del rombo.
              </span>
            </span>
          )}
        </div>
      )}
      {fuente !== 'referencias' && (
      <div className="em" style={{ color: '#A8AEB4', fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
        {fuente === 'territorio' ? 'territorial' : 'económico'} {Number(activo.x / (fuente === 'programa' ? 1 : escala)).toFixed(2)}
        {fuente !== 'programa' && activo.ex > 0 && ` ±${(activo.ex / escala).toFixed(2)}`}
        {' · '}social {Number(activo.y / (fuente === 'programa' ? 1 : escala)).toFixed(2)}
        {fuente !== 'programa' && activo.ey > 0 && ` ±${(activo.ey / escala).toFixed(2)}`}
        {' · '}calculado sobre {activo.n} {fuente === 'programa' ? 'compromisos' : 'votos codificados'}
      </div>
      )}
      {fuente !== 'programa' && fuente !== 'referencias' && Number(activo.n ?? 0) < 25 && (
        <div className="em" style={{ color: '#E8C56A', fontSize: 10.5, marginTop: 6, lineHeight: 1.6 }}>
          Base muy corta: {activo.n} normas. Con tan pocas, la posición de este partido
          es orientativa y no debería compararse con la de partidos que tienen cientos.
        </div>
      )}
      {fuente !== 'programa' && fuente !== 'referencias' && (activo.ex > 0 || activo.ey > 0) && (
        <div className="em" style={{ color: '#8E959C', fontSize: 10.5, marginTop: 6, lineHeight: 1.6 }}>
          El óvalo es el margen de error: la posición real está casi con seguridad
          dentro de él. Es ancho cuando el partido ha votado pocas normas de las que
          dividen al pleno en esa dimensión, no cuando su postura sea ambigua.
          {' '}Se distingue de {separables.get(activo.partido) ?? 0} de {puntos.length - 1} partidos.
        </div>
      )}
      {(() => {
        if (fuente === 'referencias') return null;
        const f = iniciativas?.[String(activo.siglas ?? '').trim().toUpperCase()];
        if (!f || !f.presentadas) return null;
        return (
          <div className="em" style={{ fontSize: 10.5, color: '#A8AEB4', marginTop: 8, lineHeight: 1.6 }}>
            su grupo presenta {f.presentadas} iniciativas
            {f.grupo_compartido && (
              <span style={{ display: 'block', color: '#7C8288', fontSize: 9.5 }}>
                comparte el Grupo Mixto con otros {f.partidos_en_grupo - 1} partidos: la autoría es del grupo, no del partido
              </span>
            )}
          </div>
        );
      })()}

      {(() => {
        if (fuente === 'referencias') return null;
        const clases = votosClase?.[String(activo.siglas ?? '').trim().toUpperCase()] ?? [];
        const orden = { ley_final: 0, decisoria: 1, enmienda: 2, tramite: 3, no_vinculante: 4 };
        const lista = [...clases]
          .filter(c => c.clase !== 'sin_clasificar')
          .sort((a2, b2) => (orden[a2.clase] ?? 9) - (orden[b2.clase] ?? 9));
        if (!lista.length) return null;
        return (
          <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #3A4048' }}>
            <div className="em" style={{ fontSize: 9.5, color: '#7C8288', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 6 }}>
              cómo vota
            </div>
            {lista.map(c => {
              const total = Number(c.si) + Number(c.no) + Number(c.abstencion) || 1;
              const trozos = [
                [Number(c.si), VOTO.si],
                [Number(c.no), VOTO.no],
                [Number(c.abstencion), VOTO.abs]
              ];
              return (
                <div key={c.clase} style={{ marginBottom: 7 }}>
                  <div className="em" style={{ fontSize: 10.5, color: '#C9CDD2', marginBottom: 3 }}>
                    {NOMBRE_CLASE[c.clase] ?? c.clase}
                    <span style={{ color: '#7C8288' }}> · {c.votaciones} votaciones</span>
                  </div>
                  <div style={{ display: 'flex', height: 9, overflow: 'hidden' }}>
                    {trozos.map(([v, col], i) => v > 0 && (
                      <div key={i} style={{ background: col, width: `${(v / total) * 100}%` }} />
                    ))}
                  </div>
                  <div className="em" style={{ fontSize: 9.5, color: '#8E959C', marginTop: 3 }}>
                    {c.si} sí · {c.no} no · {c.abstencion} abstenciones
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {fuente === 'votos' && (() => {
        const filas = subejes?.[String(activo.siglas ?? '').trim().toUpperCase()] ?? [];
        const dentro = filas.filter(f => !baseComun || baseComun.has(`${f.eje}|${f.dim}`));
        if (!dentro.length) return null;
        const orden = { economico: 0, social: 1 };
        const lista = [...dentro].sort((a2, b2) =>
          (orden[a2.eje] ?? 9) - (orden[b2.eje] ?? 9) || Math.abs(b2.bruto) - Math.abs(a2.bruto));
        return (
          <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #3A4048' }}>
            <div className="em" style={{ fontSize: 9.5, color: '#7C8288', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 6 }}>
              por qué está ahí
            </div>
            {lista.map(f => {
              const pct = Math.round(Math.abs(Number(f.bruto)) * 100);
              const hacia = Number(f.bruto) >= 0 ? ETIQUETA_DIM[f.dim]?.[0] : ETIQUETA_DIM[f.dim]?.[1];
              return (
                <div key={`${f.eje}-${f.dim}`} style={{ marginBottom: 5 }}>
                  <div className="em" style={{ fontSize: 10.5, color: '#C9CDD2' }}>
                    {NOMBRE_SUBEJE[f.dim] ?? f.dim}
                  </div>
                  <div className="em" style={{ fontSize: 10, color: '#8E959C', lineHeight: 1.5 }}>
                    {pct === 0
                      ? `sin diferencia sobre ${f.n_reduce + f.n_aumenta} normas`
                      : `${pct} % más de apoyo a ${hacia}`}
                    {' · '}{f.n_reduce} y {f.n_aumenta} normas
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {fuente === 'votos' && activo.voto_apoyo_gobierno != null && (
        <div className="em" style={{ color: '#7C8288', fontSize: 10.5, marginTop: 3 }}>
          apoya el {Math.round(Number(activo.voto_apoyo_gobierno) * 100)} % de las normas del Gobierno
          {activo.nulo && ' · su posición no se distingue de cero'}
        </div>
      )}
      {fuente === 'programa' && activo.prog_bruto_economico != null && (
        <div className="em" style={{ color: '#7C8288', fontSize: 10.5, marginTop: 3 }}>
          valor absoluto sin comparar: {Number(activo.prog_bruto_economico).toFixed(2)}
        </div>
      )}
      {activo.mas_disidente && Number(activo.disidencias_max) > 0 && (
        <div style={{ color: '#8E959C', fontSize: 11.5, marginTop: 5 }}>
          Quien más se separa del partido: {activo.mas_disidente} ({activo.disidencias_max} veces)
        </div>
      )}
    </div>
  );


  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['programa', 'Lo que prometieron'], ['votos', 'Lo que han votado'], ['territorio', 'Territorialidad'], ['referencias', 'Comparativa internacional']].map(([k, t]) => (
          <button key={k} onClick={() => setFuente(k)} style={{
            padding: '9px 16px', fontSize: 13.5, cursor: 'pointer', borderRadius: 2,
            fontWeight: fuente === k ? 600 : 400,
            background: fuente === k ? C.tinta : 'transparent',
            color: fuente === k ? C.papel : C.media,
            border: `1px solid ${fuente === k ? C.tinta : C.linea}`
          }}>{t}</button>
        ))}
      </div>

      {puntos.length === 0 ? (
        <div style={{ padding: 24, background: '#FFF8E6', border: '1px solid #E8D9A8', borderRadius: 3, fontSize: 13, color: '#6B5518', lineHeight: 1.6 }}>
          {fuente === 'referencias'
            ? (referencias === null
              ? 'Cargando las posiciones externas…'
              : 'No hay posiciones externas publicadas. Carga una fuente con npm run posiciones:cargar, verifica los polos y publícala.')
            : datos.length > 0
            ? `Hay ${datos.length} partidos en la base, pero ninguno tiene aún los dos ejes (${fuente === 'programa' ? 'programa' : 'votos'}) completos.`
            : (fuente === 'programa'
              ? 'Todavía no hay suficientes compromisos codificados. Ejecuta npm run codificar y luego el SQL sql/create_v_mapa_partidos.sql.'
              : 'Todavía no hay suficientes leyes codificadas. Ejecuta npm run codificar:leyes y el SQL sql/create_v_mapa_partidos.sql.')}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 12,
          alignItems: 'stretch'
        }}
          className="mapaLayout">
          <style>{`
            @media(min-width:960px){
              .mapaLayout{grid-template-columns:minmax(200px,.85fr) minmax(320px,1.3fr) minmax(200px,.85fr)!important}
            }
          `}</style>

          <div className="mapaLado">
            {fuente === 'votos' && auditoria?.economico_margen_escaso && (
              <div style={{
                background: '#2A2E35', border: '1px solid #3A4048', borderRadius: 2,
                padding: '9px 11px', marginBottom: 10, fontSize: 11.5,
                color: '#C9CDD2', lineHeight: 1.5
              }}>
                <strong style={{ color: '#E8C56A' }}>Margen escaso.</strong> Este eje supera la
                comprobación contra el azar por poco (p = {Number(auditoria.p_economico).toFixed(3)},
                el límite es 0,05) y solo {auditoria.economico_significativos ?? 0} de{' '}
                {auditoria.partidos_economico ?? 13} partidos tienen posición distinguible del centro.
                En esta legislatura el Congreso apenas ha votado normas que recorten gasto o
                desregulen, así que hay poco contraste que medir.
              </div>
            )}
            <GuiaEje
              titulo={fuente === 'territorio' ? 'Eje territorial' : 'Eje económico'}
              intro={fuente === 'territorio'
                ? 'Mide dónde debe residir el poder: en el Estado central o en las comunidades autónomas. Es independiente de los otros dos ejes y en España es el que más separa a los partidos.'
                : fuente === 'referencias'
                ? 'Mismo eje que en las otras pestañas, pero medido por otra gente: expertos académicos en cada país puntúan a sus propios partidos del 0 al 10 según qué papel dan al Estado en la economía.'
                : 'Mide una sola cosa: qué papel debe tener el Estado en la economía. No mide simpatías ni identidades.'}
              colorA="#C45C52"
              colorB="#3D7AB8"
              a={fuente === 'territorio' ? {
                titulo: 'Descentralizador',
                texto: 'Las competencias y los recursos deben acercarse a quien conoce el territorio. Incluye transferencias, financiación autonómica y reconocimiento de lenguas y culturas propias.'
              } : {
                titulo: 'Izquierda económica',
                texto: 'El mercado por sí solo genera desigualdad, así que el Estado debe corregirla: más gasto público, impuestos progresivos y reglas que limiten el poder de las empresas. Es la línea que va de Marx a la socialdemocracia de posguerra.'
              }}
              b={fuente === 'territorio' ? {
                titulo: 'Centralista',
                texto: 'La igualdad entre ciudadanos exige reglas comunes y un Estado que las garantice. Incluye recentralizar competencias, unidad de mercado y una lengua común en la Administración.'
              } : {
                titulo: 'Derecha económica',
                texto: 'El mercado asigna mejor que cualquier planificador porque nadie reúne toda la información necesaria para decidir por los demás: menos gasto, impuestos bajos y menos regulación. Es el argumento de Hayek y Friedman.'
              }}
              miramos={fuente === 'territorio'
                ? <>Solo descentralización, sobre {auditoria?.n_territorial ?? '—'} normas. Las
                    competencias europeas quedan fuera: no hay suficientes normas votadas en los
                    dos sentidos por casi todos los partidos.</>
                : fuente === 'referencias'
                ? <>La variable <em>lrecon</em> de la encuesta: la posición del partido sobre gasto,
                    impuestos y regulación según los especialistas del país. Ni esta aplicación ni
                    sus datos intervienen en el número.</>
                : <>De las seis dimensiones económicas solo entran las que tienen normas contestadas
                    en los dos sentidos por casi todos los partidos, sobre {auditoria?.n_economico ?? '—'} normas.
                    El gasto público queda fuera: el Congreso casi nunca vota recortes.</>}
            />
          </div>

          <div style={{
            position: 'relative',
            background: C.pizarra, borderRadius: 3, padding: 'clamp(14px, 2.5vw, 22px)', minWidth: 0
          }}>
            <DestelloSuave color="rgba(232,197,106,0.35)" n={6} />
            <div style={{
              position: 'absolute', right: 14, top: 14, zIndex: 2,
              display: 'flex', flexDirection: 'column', gap: 4
            }}>
              {[['+', () => acercar(1.4, null)], ['−', () => acercar(1 / 1.4, null)]].map(([t, fn]) => (
                <button key={t} onClick={fn} aria-label={t === '+' ? 'Acercar' : 'Alejar'} style={{
                  width: 26, height: 26, borderRadius: 3, cursor: 'pointer', lineHeight: 1,
                  background: 'rgba(255,255,255,0.09)', color: '#D8DCE0',
                  border: '1px solid rgba(255,255,255,0.16)', fontSize: 15, fontWeight: 600
                }}>{t}</button>
              ))}
              {vista.z > 1 && (
                <button onClick={reencuadrar} aria-label="Reencuadrar" style={{
                  width: 26, height: 26, borderRadius: 3, cursor: 'pointer', lineHeight: 1,
                  background: 'rgba(255,255,255,0.09)', color: '#D8DCE0',
                  border: '1px solid rgba(255,255,255,0.16)', fontSize: 11
                }}>⤢</button>
              )}
            </div>
            <svg ref={svgRef}
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: 'auto', maxHeight: '58vh', display: 'block', margin: '0 auto', touchAction: 'none', cursor: vista.z > 1 ? 'grab' : 'crosshair', userSelect: 'none' }}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              role="img"
              aria-label="Mapa de partidos en dos ejes">
              <rect x="-1.45" y="-1.5" width="2.9" height="3.05" fill="transparent" />
              <rect x="-1.24" y="-1.24" width="1.24" height="1.24" fill="#EE7B3A14" />
              <rect x="0" y="-1.24" width="1.24" height="1.24" fill="#1A6B8A18" />
              <rect x="-1.24" y="0" width="1.24" height="1.24" fill="#17836F14" />
              <rect x="0" y="0" width="1.24" height="1.24" fill="#F2A93E12" />
              <line x1="-1.24" y1="0" x2="1.24" y2="0" stroke="#EDE7D4" strokeOpacity="0.5" strokeWidth="0.013" />
              <line x1="0" y1="-1.24" x2="0" y2="1.24" stroke="#EDE7D4" strokeOpacity="0.5" strokeWidth="0.013" />
              <path d="M0 -0.13L0.0221 -0.0221L0.13 0L0.0221 0.0221L0 0.13L-0.0221 0.0221L-0.13 0L-0.0221 -0.0221Z"
                fill="#EDE7D4" fillOpacity="0.62" />

                            <text x="-1.32" y="-1.28" fill="#EE7B3A" fontSize="0.092" fontWeight="700"
                fontFamily="DM Mono, monospace" letterSpacing="0.02">{fuente === 'territorio' ? 'DESCENTRALIZADOR' : 'IZQUIERDA'}</text>
              <text x="1.32" y="-1.28" fill="#4E9BBE" fontSize="0.092" fontWeight="700"
                textAnchor="end" fontFamily="DM Mono, monospace" letterSpacing="0.02">{fuente === 'territorio' ? 'CENTRALISTA' : 'DERECHA'}</text>
              <text x="0" y="-1.40" fill="#F2A93E" fontSize="0.092" fontWeight="700"
                textAnchor="middle" fontFamily="DM Mono, monospace" letterSpacing="0.02">CONSERVADOR</text>
              <text x="0" y="1.48" fill="#2FA98F" fontSize="0.092" fontWeight="700"
                textAnchor="middle" fontFamily="DM Mono, monospace" letterSpacing="0.02">PROGRESISTA</text>

              {conEtiqueta.map(p => {
                const on = !encima || encima === p.partido || fijado === p.partido;
                const destacado = encima === p.partido || fijado === p.partido;
                const conEtiquetaVisible = fuente !== 'referencias';
                const desviada = conEtiquetaVisible && p.labelY > p.cy + p.radio + 0.12;
                return (
                  <g key={p.partido}
                    style={{ transition: 'opacity 160ms ease' }}
                    opacity={on ? 1 : 0.16}
                    pointerEvents="none">
                    {desviada && (
                      <motion.line
                        initial={false}
                        animate={{ x1: p.cx, y1: p.cy + p.radio, x2: p.cx, y2: p.labelY - 0.045 }}
                        transition={VIAJE}
                        stroke="#5A6067" strokeWidth="0.005" />
                    )}
                    {fuente !== 'programa' && encima === p.partido && (p.ex > 0 || p.ey > 0) && (
                      <>
                        <motion.ellipse
                          initial={false}
                          animate={{
                            cx: p.cx, cy: p.cy,
                            rx: Math.max(p.ex, p.radio * 1.3), ry: Math.max(p.ey, p.radio * 1.3)
                          }}
                          transition={VIAJE}
                          fill={p.color || '#8E9299'} opacity="0.16"
                          stroke={p.color || '#8E9299'} strokeOpacity="0.45"
                          strokeWidth="0.007" strokeDasharray="0.03 0.022" />
                        <motion.text
                          initial={false}
                          animate={{
                            x: p.cx,
                            y: p.cy - Math.max(p.ey, p.radio * 1.3) - 0.045
                          }}
                          transition={VIAJE}
                          fill="#C9CDD2" stroke={C.pizarra} strokeWidth="0.012"
                          paintOrder="stroke" strokeLinejoin="round"
                          fontSize="0.05" textAnchor="middle" fontFamily="DM Mono, monospace">
                          margen de error
                        </motion.text>
                      </>
                    )}
                    {fuente === 'referencias' ? (
                      <>
                        {p.forma === 'circulo' ? (
                          <circle
                            cx={p.cx} cy={p.cy}
                            r={destacado ? p.radio * 1.18 : p.radio}
                            fill={p.esEspanol ? (p.color || '#8E9299') : marcaDe(p.partido).fondo}
                            stroke="#EDE7D4"
                            strokeOpacity={destacado ? 1 : 0.72}
                            strokeWidth="0.011" />
                        ) : (
                          <polygon
                            points={poligono(p.cx, p.cy, destacado ? p.radio * 1.2 : p.radio, LADOS[p.forma] ?? 4)}
                            fill={p.esRegimen ? marcaDe(p.partido).fondo : 'rgba(20,23,26,0.72)'}
                            stroke="#EDE7D4"
                            strokeOpacity={destacado ? 1 : 0.72}
                            strokeWidth="0.011" />
                        )}
                        <text
                          x={p.cx} y={p.cy + 0.019}
                          fill={p.esRegimen ? marcaDe(p.partido).texto : p.esEspanol ? '#14171A' : '#E4DCC6'}
                          fontSize="0.058" textAnchor="middle"
                          fontFamily="DM Mono, monospace" fontWeight={600}
                          style={{ pointerEvents: 'none' }}>
                          {p.codigo}
                        </text>
                      </>
                    ) : (
                      <motion.circle
                        initial={false}
                        animate={{
                          cx: p.cx, cy: p.cy,
                          r: destacado ? p.radio * 1.22 : p.radio
                        }}
                        transition={VIAJE}
                        fill={p.color || '#8E9299'}
                        stroke={C.pizarra}
                        strokeWidth="0.014" />
                    )}
                    {conEtiquetaVisible && (
                      <motion.text
                        initial={false}
                        animate={{ x: p.cx, y: p.labelY }}
                        transition={VIAJE}
                        fill={encima === p.partido ? '#FFFFFF' : '#C9CDD2'}
                        stroke={C.pizarra} strokeWidth="0.014" strokeOpacity="0.75"
                        paintOrder="stroke" strokeLinejoin="round"
                        fontSize="0.058" textAnchor="middle" fontFamily="DM Mono, monospace"
                        fontWeight={encima === p.partido ? 500 : 400}>
                        {p.siglas}
                      </motion.text>
                    )}
                  </g>
                );
              })}
            </svg>

            {faltan > 0 && fuente !== 'referencias' && (
              <div className="em" style={{ fontSize: 10.5, color: '#8E959C', marginBottom: 8 }}>
                {datos.length} de 13 partidos con datos suficientes. El resto aparecerá cuando termine la codificación.
              </div>
            )}

            <div style={{ minHeight: 56, marginTop: 12, paddingTop: 12, borderTop: '1px solid #3A4048' }}>
              {activo || anclado ? (
                <div style={{
                  display: comparando ? 'grid' : 'block',
                  gridTemplateColumns: comparando ? '1fr 1fr' : undefined,
                  gap: comparando ? 14 : 0
                }}>
                  {anclado && (
                    <div>
                      <div className="em" style={{
                        fontSize: 9.5, color: '#7C8288', letterSpacing: '.09em',
                        textTransform: 'uppercase', marginBottom: 6
                      }}>
                        fijado · vuelve a pulsarlo para soltarlo
                      </div>
                      <Ficha activo={anclado} />
                    </div>
                  )}
                  {activo && (!anclado || comparando) && (
                    <div>
                      {anclado && (
                        <div className="em" style={{
                          fontSize: 9.5, color: '#7C8288', letterSpacing: '.09em',
                          textTransform: 'uppercase', marginBottom: 6
                        }}>
                          encima
                        </div>
                      )}
                      <Ficha activo={activo} />
                    </div>
                  )}
                </div>
              ) : (
          <div style={{ color: '#8E959C', fontSize: 12, lineHeight: 1.5 }}>
            {fuente === 'referencias'
              ? <>Cada ranura de comparación tiene su figura: círculo para España, triángulo para los
                  regímenes históricos, y cuadrado, pentágono y hexágono para los países que añadas.
                  Dentro de cada figura va el código de dos letras. Aquí ningún punto sale de las votaciones del Congreso: todos,
                  incluidos los españoles, vienen de la misma encuesta a expertos, en su escala de
                  0 a 10.{esTactil ? ' Toca' : ' Pasa por encima de'} uno para ver de qué país y de
                  qué año es.</>
              : <>Cada círculo es un partido y su tamaño es el número de escaños.
                  {esTactil ? ' Toca uno' : ' Pasa por encima de uno'} para ver su posición exacta.</>}
            <span> Pulsa uno para dejarlo fijado y {esTactil ? 'toca' : 'pasa por encima de'} otro:
              los dos paneles quedan lado a lado para compararlos.</span>
            {fuente === 'votos' && (
              <span> La posición por votos no mide cuánto apoya un partido, sino cuánto más
                apoya lo que <em>baja</em> gasto, impuestos o regulación que lo que los sube.
                El centro exacto significa que vota igual en ambos casos.
                {esTactil ? ' Toca' : ' Pasa por encima de'} un partido para ver su margen de error.</span>
            )}
            {fuente !== 'programa' && escala / ESCALA_MIN >= 1.15 && (
              <span> El eje está ampliado {(escala / ESCALA_MIN).toFixed(1)} veces para que las
                diferencias se vean: las posiciones reales caben en una franja estrecha alrededor
                del centro, y los números del panel son los de verdad, sin ampliar.</span>
            )}
          </div>
              )}
            </div>
          </div>

          <div className="mapaLado">
            <GuiaEje
              titulo="Eje social"
              intro="Es un eje independiente del económico. Se puede situar a un lado en economía y al otro en este. En España se confunden a menudo; por eso el mapa los separa."
              colorA="#B8912E"
              colorB="#2A9A86"
              a={{
                titulo: 'Conservador',
                texto: 'Las instituciones y costumbres heredadas acumulan una sabiduría que nadie diseñó y que conviene no desmontar a la ligera. Es la tesis de Burke: prudencia frente al cambio rápido, y prioridad de la comunidad, la familia y la nación sobre la elección individual.'
              }}
              b={{
                titulo: 'Progresista',
                texto: 'Cada persona debe poder decidir sobre su vida mientras no dañe a otros, y las costumbres heredadas no bastan para justificar una restricción. Viene de Mill y del liberalismo de los derechos: ampliar la autonomía personal y quitar límites que no protegen a nadie.'
              }}
              miramos={fuente === 'votos'
                ? <>Derechos individuales y reglas de migración. El grupo más pequeño tiene {auditoria?.n_social ?? '—'} normas votadas con división real.</>
                : fuente === 'referencias'
                ? <>La variable <em>galtan</em> de la encuesta, invertida para que arriba quede
                    conservador y abajo progresista, igual que en el resto del mapa.</>
                : <>Derechos individuales y reglas de entrada/regularización de migrantes. Nada más.</>}
            />
          </div>
        </div>
      )}

      {fuente === 'programa' && sesgo && sesgo.partidos > 0 && (
        <div style={{ marginTop: 14, padding: 16, background: C.pizarra, borderRadius: 3 }}>
          <div className="ed" style={{ color: '#F2F3F0', fontSize: 16, fontWeight: 700 }}>
            {sesgo.prometen_expandir} de {sesgo.partidos} programas solo prometen gastar más
          </div>
          <div style={{ color: '#A8AEB4', fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Contando en bruto, sin comparar unos con otros, casi todos los partidos emiten muchas más
            señales de aumentar gasto, ayudas y servicios que de reducirlos:
            {' '}<strong style={{ color: '#F2F3F0' }}>{Number(sesgo.señales_expansivas).toLocaleString('es')}</strong> frente a
            {' '}<strong style={{ color: '#F2F3F0' }}>{Number(sesgo.señales_restrictivas).toLocaleString('es')}</strong>.
            Ningún programa dice que va a recortar, ni siquiera los que después lo hacen.
          </div>
          <div style={{ color: '#8E959C', fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>
            Por eso el mapa muestra posiciones relativas: en términos absolutos todos caerían a la
            izquierda y la escala no distinguiría nada.
          </div>
        </div>
      )}

      {fuente !== 'territorio' && fuente !== 'referencias' && <Contraste datos={datos} />}

      {fuente === 'referencias' && ranuras && (
        <div style={{ marginTop: 14, padding: 15, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>Qué comparas</div>
            <div className="em" style={{ color: C.tenue, fontSize: 11.5 }}>
              {ranuras.length} de {MAX_RANURAS} ranuras · una figura por ranura
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {ranuras.map(rn => {
              const lista = porRanura.get(rn.id) ?? [];
              const marcados = lista.filter(rf => activos.has(rf.clave)).length;
              const todos = marcados === lista.length && lista.length > 0;
              return (
                <div key={rn.id} style={{
                  flex: '1 1 232px', minWidth: 210, maxWidth: 320,
                  border: `1px solid ${C.linea}`, borderRadius: 3, padding: 10, background: C.papel
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="20" height="20" viewBox="-1 -1 2 2" style={{ flexShrink: 0 }}>
                      {rn.forma === 'circulo'
                        ? <circle cx="0" cy="0" r="0.78" fill="none" stroke={C.media} strokeWidth="0.16" />
                        : <polygon points={poligono(0, 0, 0.85, LADOS[rn.forma] ?? 4)} fill="none" stroke={C.media} strokeWidth="0.16" />}
                    </svg>
                    <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{rn.titulo}</span>
                    <button
                      onClick={() => alternarRanura(rn.id, !todos)}
                      className="em"
                      style={{
                        background: 'none', border: `1px solid ${C.linea}`, borderRadius: 3,
                        color: C.media, fontSize: 10.5, padding: '2px 6px', cursor: 'pointer'
                      }}>
                      {todos ? 'ninguno' : 'todos'}
                    </button>
                    {rn.id !== 'espana' && (
                      <button
                        onClick={() => quitarRanura(rn.id)}
                        aria-label={`Quitar ${rn.titulo}`}
                        style={{
                          background: 'none', border: 'none', color: C.tenue,
                          fontSize: 15, lineHeight: 1, cursor: 'pointer', padding: '0 2px'
                        }}>
                        ×
                      </button>
                    )}
                  </div>

                  <div className="em" style={{ color: C.tenue, fontSize: 10.5, margin: '5px 0 7px' }}>
                    {marcados} de {lista.length} en el mapa
                  </div>

                  <div style={{ maxHeight: 168, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {lista.map(rf => {
                      const on = activos.has(rf.clave);
                      const codigo = rf.tipo === 'regimen'
                        ? marcaDe(rf.clave).codigo
                        : codigoDe(rf.nombre_corto || rf.nombre);
                      return (
                        <button
                          key={rf.clave}
                          onClick={() => alternarClave(rf.clave)}
                          title={`${rf.nombre}${rf.anio ? ` · ${rf.anio}` : ''}`}
                          className="em"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: on ? 'rgba(0,0,0,0.05)' : 'none',
                            border: `1px solid ${on ? C.linea : 'transparent'}`,
                            borderRadius: 3, padding: '2px 5px', cursor: 'pointer',
                            color: on ? C.tinta : C.tenue, fontSize: 10.5
                          }}>
                          <span style={{
                            width: 15, height: 15, borderRadius: rf.tipo === 'regimen' ? 15 : 2,
                            background: on && rf.tipo === 'regimen' ? marcaDe(rf.clave).fondo : 'transparent',
                            border: `1px solid ${on ? C.media : C.linea}`,
                            color: on && rf.tipo === 'regimen' ? marcaDe(rf.clave).texto : 'inherit',
                            fontSize: 8.5, display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {codigo}
                          </span>
                          {rf.nombre_corto || rf.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {ranuras.length < MAX_RANURAS && paisesLibres.length > 0 && (
              <div style={{
                flex: '1 1 200px', minWidth: 190, maxWidth: 260,
                border: `1px dashed ${C.linea}`, borderRadius: 3, padding: 10
              }}>
                <div className="em" style={{ color: C.tenue, fontSize: 10.5, marginBottom: 7 }}>
                  AÑADIR PAÍS
                </div>
                <select
                  value=""
                  onChange={e => anadirPais(e.target.value)}
                  aria-label="Añadir un país a la comparación"
                  style={{
                    width: '100%', background: 'transparent', color: C.tinta,
                    border: `1px solid ${C.linea}`, borderRadius: 3,
                    padding: '5px 6px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer'
                  }}>
                  <option value="">Elige uno…</option>
                  {paisesLibres.map(pais => (
                    <option key={pais} value={pais}>
                      {pais} ({(porRanura.get(pais) ?? []).length})
                    </option>
                  ))}
                </select>
                <div className="em" style={{ color: C.tenue, fontSize: 10.5, marginTop: 7, lineHeight: 1.45 }}>
                  Cada país entra con todos sus partidos marcados. Quita los que sobren.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {fuente === 'referencias' && (
        <div style={{ marginTop: 14, padding: 15, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
          <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>De dónde salen estos puntos</div>
          <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 8 }}>
            Esta pestaña no calcula nada. Muestra tal cual las posiciones que publican encuestas
            académicas a especialistas de cada país, con su escala original de 0 a 10 y el año de
            la medición. Los ejes son los mismos que en el resto del mapa, pero la escala no: por
            eso los partidos españoles aparecen aquí en el sitio que les dan los expertos, no en el
            que sale de sus votaciones. Comparar los dos mapas es informativo; mezclarlos, no.
          </div>
          <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
            Cada partido se muestra en su medición más reciente disponible, que no siempre es la
            misma para todos: un partido que dejó de existir o dejó de tener escaños se queda con la
            última ola en la que fue evaluado. El panel de cada punto indica el año.
          </div>
          <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
            Los rombos son regímenes históricos y no vienen de ninguna encuesta: nadie ha preguntado
            nunca a un panel de expertos por la posición de un régimen sin elecciones. Están
            codificados aquí, dimensión a dimensión, sobre política documentada, por varios modelos
            de lenguaje que responden por separado; su desacuerdo es la elipse que rodea al punto.
            Es la información más débil de toda la aplicación y así hay que leerla.
          </div>
          <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
            El eje horizontal mide una sola cosa: cuánto interviene el Estado en la economía. Por esa
            vara, una economía de guerra dirigida desde el Estado puntúa igual que una economía
            planificada, y los dos regímenes aparecen cerca. Eso no dice que se parecieran: dice que
            este eje no sirve para distinguirlos. Lo que sí los distingue de una democracia está en el
            panel de cada rombo, en el índice de democracia liberal.
          </div>
          {fuentesExternas?.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.linea}` }}>
              {fuentesExternas.map(f => (
                <div key={f.id} style={{ fontSize: 12.5, color: C.media, lineHeight: 1.55, marginBottom: 6 }}>
                  <strong>{f.nombre}</strong>{f.ola ? ` · ola ${f.ola}` : ''} · {f.institucion}
                  {f.url && <> · <a href={f.url} target="_blank" rel="noreferrer" style={{ color: C.media }}>{f.url}</a></>}
                  {f.cita && <span style={{ display: 'block', color: C.tenue, fontSize: 11.5 }}>{f.cita}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {fuente !== 'referencias' && (
      <div style={{ marginTop: 14, padding: 15, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
        <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>Cómo se calcula esta posición</div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 8 }}>
          Nadie decide si un partido es de izquierdas o de derechas. Cada compromiso electoral y cada
          norma se etiqueta según <strong>seis preguntas de hecho</strong>: ¿sube o baja el gasto público?
          ¿sube o baja los impuestos? ¿añade o quita regulación? ¿amplía o restringe derechos individuales?
          ¿facilita o endurece la migración? ¿transfiere o recentraliza competencias?
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          La posición es <strong>relativa a los demás partidos españoles</strong>, no absoluta. Se cuenta
          cuántas señales de cada tipo emite cada partido y se compara con la media del conjunto. Hace falta
          así porque todos los programas prometen sobre todo gastar y ampliar: en términos absolutos todos
          saldrían a la izquierda. Lo que distingue a unos de otros es <em>cuánto</em> lo hacen comparados
          entre sí.
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          <strong>Lo que prometieron</strong> sale de los programas de 2023 y es una posición
          <em> relativa</em> al resto de partidos españoles. <strong>Lo que han votado</strong> se
          calcula distinto y tiene cero absoluto: para cada partido se compara qué porcentaje de las
          normas que <em>reducen</em> gasto, impuestos o regulación apoyó, frente al porcentaje de
          las que los <em>aumentan</em>. La diferencia entre esos dos porcentajes es su posición.
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          Esa resta existe por un motivo concreto: en un parlamento con disciplina de voto, la
          oposición vota que no a casi todo y el Gobierno que sí a casi todo, independientemente del
          contenido. Contar votos a favor mide bloque parlamentario, no ideología. Al restar, esa
          propensión se cancela y queda solo la sensibilidad al contenido. La comparación se hace
          además por separado dentro de las normas del Gobierno y dentro de las del resto, para que
          quién propone la norma no contamine el resultado.
        </div>
        <div style={{ fontSize: 13, color: C.media, lineHeight: 1.6, marginTop: 10 }}>
          Un partido que vota igual suba o baje el gasto sale en el centro exacto, sea cual sea su
          tasa de votos a favor. Por eso la oposición sistemática no empuja a nadie hacia un extremo.
          Ningún eje se invierte ni se reescala a mano.
        </div>
        {fuente === 'votos' && auditoria && (
          (auditoria.etiqueta_permitida !== 'izquierda-derecha' ||
           auditoria.etiqueta_permitida_social !== 'conservador-progresista') && (
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.linea}`,
            fontSize: 13, color: C.media, lineHeight: 1.6
          }}>
            <strong>Hasta dónde llega la precisión.</strong>{' '}
            {auditoria.etiqueta_permitida !== 'izquierda-derecha' && (
              <>El eje económico ordena a los partidos, pero con poco margen: solo{' '}
                {auditoria.economico_significativos ?? 0} de {auditoria.partidos_economico ?? 13} tienen
                posición distinguible del centro, porque el Congreso apenas vota normas que recorten
                gasto o desregulen. El orden es informativo; las distancias exactas, no.{' '}</>
            )}
            {auditoria.etiqueta_permitida_social !== 'conservador-progresista' && (
              <>En el eje social la base es de {auditoria.n_social ?? '—'} normas con división real.</>
            )}
          </div>
        ))}

        {fuente === 'votos' && auditoria?.p_economico != null && (
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.linea}`,
            fontSize: 13, color: C.media, lineHeight: 1.6
          }}>
            <strong>Cómo sabemos que esto no es solo gobierno contra oposición.</strong> Se barajan
            al azar las etiquetas de las normas {auditoria.placebo_reps} veces y se recalcula el mapa.
            Si los partidos votaran solo según su bloque, barajar no cambiaría nada. El eje económico
            real separa a los partidos {Number(auditoria.rango_economico).toFixed(2)} puntos; barajando,
            la media baja a {Number(auditoria.placebo_medio_economico).toFixed(2)} y el máximo de las
            {' '}{auditoria.placebo_reps} tiradas fue {Number(auditoria.placebo_max_economico).toFixed(2)}.
            {' '}El eje social real separa {Number(auditoria.rango_social).toFixed(2)} frente a un máximo
            barajado de {Number(auditoria.placebo_max_social).toFixed(2)}.
            {' '}Es la prueba de que lo que ordena a los partidos es el contenido de las leyes.
          </div>
        )}
      </div>
      )}
    </div>
  );
}