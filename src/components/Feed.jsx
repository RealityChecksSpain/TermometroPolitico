import React, { useEffect, useRef, useState, useCallback } from 'react';
import { traerFeed } from '../lib/cliente.js';

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

function primeraFrase(t) {
  if (!t) return null;
  const f = String(t).split(/(?<=\.)\s+/)[0];
  return f.length > 190 ? f.slice(0, 187) + '…' : f;
}

function Tarjeta({ n, onAbrir, destacada, limpiarTitular }) {
  const aprobada = (n.resultado_final ?? n.resultado_ultima) === 'aprobada';
  const total = n.total_si + n.total_no + n.total_abstencion || 1;
  const efectos = Array.isArray(n.efectos) ? n.efectos : [];
  const frase = primeraFrase(n.resumen);
  const titular = limpiarTitular ? limpiarTitular(n.titular) : n.titular;

  return (
    <article onClick={() => onAbrir(n)} style={{
      background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3,
      padding: destacada ? 'clamp(18px, 3vw, 26px)' : '16px 17px',
      cursor: 'pointer', transition: 'border-color 140ms ease, transform 140ms ease'
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.tinta; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.linea; }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
        {n.materia_nombre && (
          <span className="em" style={{
            fontSize: 9.5, letterSpacing: '.07em', textTransform: 'uppercase', fontWeight: 500,
            color: n.materia_color || C.media,
            borderBottom: `2px solid ${n.materia_color || C.media}`, paddingBottom: 1
          }}>{n.materia_nombre}</span>
        )}
        <span className="em" style={{ fontSize: 10.5, color: C.tenue }}>{fechaCorta(n.fecha)}</span>
        <span className="em" style={{
          fontSize: 10, fontWeight: 600, marginLeft: 'auto',
          color: aprobada ? C.si : C.no, textTransform: 'uppercase', letterSpacing: '.05em'
        }}>{aprobada ? 'Aprobada' : 'Rechazada'}</span>
      </div>

      <h3 className="ed" style={{
        fontSize: destacada ? 'clamp(21px, 3.1vw, 30px)' : 'clamp(16px, 2.1vw, 19px)',
        fontWeight: destacada ? 600 : 500, lineHeight: 1.22, letterSpacing: '-0.012em', margin: 0
      }}>
        {String(titular).length > (destacada ? 190 : 130)
          ? String(titular).slice(0, destacada ? 187 : 127) + '…'
          : titular}
      </h3>

      {frase && (
        <p style={{
          fontSize: destacada ? 15.5 : 14, color: C.media, lineHeight: 1.55, margin: '10px 0 0'
        }}>{frase}</p>
      )}

      {efectos.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }}>
          {efectos.slice(0, destacada ? 4 : 3).map(e => (
            <span key={e.slug} className="em" style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 20,
              background: C.papel, color: C.media, border: `1px solid ${C.linea}`
            }}>{e.nombre}</span>
          ))}
          {efectos.length > (destacada ? 4 : 3) && (
            <span className="em" style={{ fontSize: 10, color: C.tenue, alignSelf: 'center' }}>
              +{efectos.length - (destacada ? 4 : 3)}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: '#E4E4DC', marginTop: 14 }}>
        {[[n.total_si, C.si], [n.total_abstencion, C.abs], [n.total_no, C.no]].map(([v, col], i) =>
          v > 0 && <div key={i} style={{ width: `${(v / total) * 100}%`, background: col }} />)}
      </div>
      <div className="em" style={{ fontSize: 10, color: C.tenue, marginTop: 6, display: 'flex', gap: 12 }}>
        <span style={{ color: C.si }}>{n.total_si} a favor</span>
        <span style={{ color: C.no }}>{n.total_no} en contra</span>
        {n.total_abstencion > 0 && <span style={{ color: C.abs }}>{n.total_abstencion} abst.</span>}
        {n.votaciones > 1 && <span style={{ marginLeft: 'auto' }}>{n.votaciones} votaciones</span>}
      </div>
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
