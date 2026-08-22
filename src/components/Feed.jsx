import React, { useEffect, useRef, useState, useCallback } from 'react';
import { traerFeed } from '../lib/cliente.js';
import { fraseCortaDeNorma, nombreOficialNorma } from '../lib/fraseCorta.js';

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3',
  si: '#2E7D5B', no: '#B23A2E', abs: '#B8912E'
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaCorta(f) {
  if (!f) return '';
  const d = new Date(f + 'T12:00:00');
  const hoy = new Date();
  const dias = Math.round((hoy - d) / 86400000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoy.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

/** @deprecated usa fraseCortaDeNorma; se mantiene el export para Inicio. */
export function fraseCorta(n) {
  return fraseCortaDeNorma(n, 52);
}

function MiniResultado({ si, no, abs, aprobada }) {
  const t = si + no + abs || 1;
  const R = 28;
  const stroke = 7;
  const c = 2 * Math.PI * R;
  const segs = [
    [(si / t) * c, C.si],
    [(abs / t) * c, C.abs],
    [(no / t) * c, C.no]
  ];
  let offset = 0;
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={R} fill="none" stroke="#E4E4DC" strokeWidth={stroke} />
        {segs.map(([len, col], i) => {
          if (len <= 0) return null;
          const el = (
            <circle key={i} cx="36" cy="36" r={R} fill="none" stroke={col} strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
              strokeLinecap="butt" transform="rotate(-90 36 36)" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', pointerEvents: 'none'
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: aprobada ? C.si : C.no }}>
          {aprobada ? 'SÍ' : 'NO'}
        </span>
        <span className="em" style={{ fontSize: 8, color: C.tenue }}>{Math.round((si / t) * 100)}%</span>
      </div>
    </div>
  );
}

function BarrasVoto({ si, no, abs }) {
  const t = si + no + abs || 1;
  const filas = [
    ['A favor', si, C.si],
    ['En contra', no, C.no],
    ['Abs.', abs, C.abs]
  ];
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
      {filas.map(([et, v, col]) => v > 0 && (
        <div key={et} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="em" style={{ width: 58, fontSize: 9.5, color: C.tenue, flexShrink: 0 }}>{et}</span>
          <div style={{ flex: 1, height: 8, background: '#EDEDE6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${(v / t) * 100}%`, height: '100%', background: col, borderRadius: 2,
              transition: 'width 400ms ease'
            }} />
          </div>
          <span className="em" style={{ width: 28, fontSize: 10, color: C.media, textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Tarjeta({ n, onAbrir, destacada, limpiarTitular }) {
  const aprobada = (n.resultado_final ?? n.resultado_ultima) === 'aprobada';
  const frase = fraseCortaDeNorma(n, 46);
  const tituloLegal = limpiarTitular
    ? limpiarTitular(n.titular || n.subtitulo || n.titulo)
    : nombreOficialNorma(n);
  const efectos = Array.isArray(n.efectos) ? n.efectos : [];

  return (
    <article onClick={() => onAbrir(n)} style={{
      background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3,
      padding: destacada ? 'clamp(16px, 2.5vw, 22px)' : '14px 15px',
      cursor: 'pointer', transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 180ms ease',
      borderLeft: `4px solid ${n.materia_color || C.linea}`,
      position: 'relative'
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = C.tinta;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(20,22,26,0.06)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = C.linea;
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {n.materia_nombre ? (
          <span className="em" style={{
            fontSize: destacada ? 12 : 11, letterSpacing: '.06em', textTransform: 'uppercase',
            fontWeight: 700, color: '#fff', background: n.materia_color || C.media,
            padding: '3px 9px', borderRadius: 2
          }}>{n.materia_nombre}</span>
        ) : (
          <span className="em" style={{
            fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600,
            color: C.media, border: `1px solid ${C.linea}`, padding: '3px 9px', borderRadius: 2
          }}>Sin materia</span>
        )}
        <span className="em" style={{ fontSize: 10.5, color: C.tenue }}>{fechaCorta(n.fecha)}</span>
        {n.votaciones_norma > 1 && (
          <span className="em" style={{ fontSize: 10, color: C.media }}>
            {n.votaciones_norma} votaciones
          </span>
        )}
        <span className="em" style={{
          fontSize: 10, fontWeight: 700, marginLeft: 'auto',
          color: aprobada ? C.si : C.no, textTransform: 'uppercase', letterSpacing: '.05em'
        }}>{aprobada ? 'Aprobada' : 'Rechazada'}</span>
      </div>

      <h3 className="ed" style={{
        fontSize: destacada ? 'clamp(20px, 2.8vw, 28px)' : 'clamp(16px, 2vw, 19px)',
        fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.015em', margin: 0, color: C.tinta
      }}>
        {frase || (String(tituloLegal).length > 90 ? String(tituloLegal).slice(0, 87) + '…' : tituloLegal)}
      </h3>

      <div className="em" style={{
        fontSize: 11, color: C.tenue, lineHeight: 1.45, marginTop: 8
      }} title={tituloLegal}>
        {String(tituloLegal).length > 150 ? String(tituloLegal).slice(0, 147) + '…' : tituloLegal}
      </div>

      <div style={{
        display: 'flex', gap: 14, alignItems: 'center', marginTop: 14,
        padding: '10px 12px', background: C.papel, borderRadius: 3
      }}>
        <MiniResultado si={n.total_si} no={n.total_no} abs={n.total_abstencion} aprobada={aprobada} />
        <BarrasVoto si={n.total_si} no={n.total_no} abs={n.total_abstencion} />
      </div>

      {efectos.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }}>
          {efectos.slice(0, destacada ? 4 : 3).map(e => (
            <span key={e.slug} className="em" style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 2,
              background: C.superficie, color: C.media, border: `1px solid ${C.linea}`
            }}>{e.nombre}</span>
          ))}
        </div>
      )}
    </article>
  );
}

export default function Feed({ filtros, onAbrir, cabecera, limpiarTitular }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fin, setFin] = useState(false);
  const centinela = useRef(null);
  const pagina = useRef(0);
  const clave = JSON.stringify(filtros ?? {});

  const cargar = useCallback(async (reset) => {
    setCargando(true);
    try {
      const desde = reset ? 0 : pagina.current * 20;
      const nuevos = await traerFeed(20, desde, filtros ?? {});
      setItems(prev => reset ? nuevos : [...prev, ...nuevos]);
      setFin(nuevos.length < 20);
      pagina.current = reset ? 1 : pagina.current + 1;
    } catch {
      setFin(true);
    } finally {
      setCargando(false);
    }
  }, [clave]);

  useEffect(() => { pagina.current = 0; setFin(false); cargar(true); }, [clave]);

  useEffect(() => {
    if (fin || cargando) return;
    const el = centinela.current;
    if (!el) return;
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) cargar(false); }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fin, cargando, cargar]);

  return (
    <div>
      {cabecera}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((n, i) => (
          <Tarjeta key={n.clave_norma} n={n} onAbrir={onAbrir} destacada={i === 0} limpiarTitular={limpiarTitular} />
        ))}
      </div>

      {cargando && (
        <div className="em" style={{ padding: 24, textAlign: 'center', color: C.tenue, fontSize: 12 }}>
          cargando…
        </div>
      )}

      {!cargando && items.length === 0 && (
        <div style={{ padding: 36, textAlign: 'center', color: C.tenue, fontSize: 13 }}>
          No hay leyes con esos filtros.
        </div>
      )}

      <div ref={centinela} style={{ height: 1 }} />

      {fin && items.length > 0 && (
        <div className="em" style={{ padding: 24, textAlign: 'center', color: C.tenue, fontSize: 11 }}>
          Has llegado al final · {items.length} normas
        </div>
      )}
    </div>
  );
}
