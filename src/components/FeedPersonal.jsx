import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { traerActividadSeguida } from '../lib/cliente.js';
import { leerSeguimientos, totalSeguimientos } from '../lib/seguimientos.js';
import { VOTO } from '../lib/paleta.js';

const C = {
  papel: '#F3F1E8', superficie: '#FFFFFF', tinta: '#15171A', media: '#4A5057',
  tenue: '#7C8288', linea: '#DCDCD3', acento: '#E0492E', ...VOTO
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const ETIQUETA_VOTO = {
  si: 'Votó sí', no: 'Votó no', abstencion: 'Se abstuvo',
  no_vota: 'No votó', ausente: 'Ausente'
};

const COLOR_VOTO = {
  si: VOTO.si, no: VOTO.no, abstencion: VOTO.abs,
  no_vota: '#7C8288', ausente: '#7C8288'
};

const ORIGEN = { iniciativa: 'Ley que sigues', materia: 'Materia que sigues', politico: 'Diputado que sigues' };

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

function Franja({ si, no, abs, aprobada }) {
  const s = Number(si ?? 0);
  const n = Number(no ?? 0);
  const a = Number(abs ?? 0);
  const t = s + n + a || 1;
  const segs = [['A favor', s, C.si, aprobada], ['En contra', n, C.no, !aprobada], ['Abstención', a, C.abs, false]];
  return (
    <div style={{ display: 'flex', height: 22, width: '100%', alignItems: 'flex-end' }}>
      {segs.filter(([, v]) => v > 0).map(([et, v, color, gana]) => (
        <div
          key={et}
          title={`${et}: ${v}`}
          style={{
            width: `${(v / t) * 100}%`, height: gana ? 22 : 15, background: color,
            position: 'relative', borderRadius: 0
          }}
        >
          {gana && (
            <span style={{
              position: 'absolute', left: 4, top: 7, width: 5, height: 5,
              background: C.papel, borderRadius: 0
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function nombreCorto(completo) {
  const partes = String(completo ?? '').trim().split(/\s+/);
  if (partes.length <= 2) return completo ?? '';
  return `${partes[0]} ${partes[partes.length - 2]}`;
}

function Retrato({ foto, nombre }) {
  const [fallo, setFallo] = useState(false);
  const iniciales = String(nombre ?? '?').trim().slice(0, 1).toUpperCase();
  if (!foto || fallo) {
    return (
      <span className="em" style={{
        width: 26, height: 26, flex: '0 0 26px', background: C.linea, color: C.media,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700
      }}>{iniciales}</span>
    );
  }
  return (
    <img
      src={foto}
      alt=""
      onError={() => setFallo(true)}
      style={{ width: 26, height: 26, flex: '0 0 26px', objectFit: 'cover', display: 'block', filter: 'grayscale(1)' }}
    />
  );
}

function ListaSeguidos({ seguidos }) {
  return (
    <div style={{ border: `1px solid ${C.linea}`, margin: '10px 0 0' }}>
      {seguidos.map((s, i) => (
        <div
          key={s.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px',
            borderTop: i === 0 ? 'none' : `1px solid ${C.linea}`
          }}
        >
          <Retrato foto={s.foto} nombre={s.nombre} />
          <span className="em" style={{ fontSize: 11, color: C.tinta, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombreCorto(s.nombre)}
          </span>
          <span style={{ width: 8, height: 8, flex: '0 0 8px', background: COLOR_VOTO[s.voto] ?? C.tenue }} />
          <span className="em" style={{ fontSize: 10.5, color: C.media, whiteSpace: 'nowrap' }}>
            {ETIQUETA_VOTO[s.voto] ?? 'Sin registro'}
          </span>
        </div>
      ))}
    </div>
  );
}

function Procedencia({ motivos }) {
  const politicos = motivos.filter(m => m.tipo === 'politico').length;
  const otros = motivos.filter(m => m.tipo !== 'politico');
  const trozos = [];
  if (politicos === 1) trozos.push('Diputado que sigues');
  if (politicos > 1) trozos.push(`${politicos} diputados que sigues`);
  otros.forEach(m => trozos.push(ORIGEN[m.tipo] ?? m.tipo));
  return (
    <span className="em" style={{
      fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.07em',
      fontWeight: 700, color: C.acento
    }}>
      {trozos.join(' · ')}
    </span>
  );
}

function Tarjeta({ fila }) {
  const aprobada = fila.resultado === 'aprobada';
  const dudoso = fila.similitud != null && Number(fila.similitud) < 0.9;
  const contexto = fila.motivos.find(m => m.tipo !== 'politico');
  return (
    <article style={{
      background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 0,
      boxShadow: `3px 3px 0 ${C.linea}`, padding: '13px 15px 15px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
        <Procedencia motivos={fila.motivos} />
        <span className="em" style={{ fontSize: 10.5, color: C.tenue, whiteSpace: 'nowrap' }}>
          {fechaCorta(fila.fecha)}
        </span>
      </div>

      {fila.materia_nombre && (
        <span className="em" style={{
          display: 'inline-block', marginBottom: 6, padding: '2px 7px',
          background: fila.materia_color || C.media, color: '#fff',
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em'
        }}>
          {fila.materia_nombre}
        </span>
      )}

      <h3 className="ed" style={{ fontSize: 15.5, lineHeight: 1.3, margin: '0 0 4px', color: C.tinta, fontWeight: 500 }}>
        {fila.titulo}
      </h3>

      {contexto?.nombre && contexto.nombre !== fila.titulo && (
        <p className="em" style={{ fontSize: 10.5, color: C.tenue, margin: '0 0 9px' }}>
          {contexto.nombre}
        </p>
      )}

      {fila.seguidos.length > 0 && <ListaSeguidos seguidos={fila.seguidos} />}

      {fila.faltan > 0 && (
        <p className="em" style={{ fontSize: 9.5, color: C.tenue, margin: '6px 0 0' }}>
          {fila.faltan === 1
            ? 'Otro diputado que sigues no consta en esta votación.'
            : `Otros ${fila.faltan} diputados que sigues no constan en esta votación.`}
        </p>
      )}

      <div style={{ marginTop: 11 }}>
        <Franja si={fila.total_si} no={fila.total_no} abs={fila.total_abstencion} aprobada={aprobada} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, gap: 10 }}>
        <span className="em" style={{ fontSize: 10.5, color: aprobada ? C.si : C.no, fontWeight: 600 }}>
          {aprobada ? 'Aprobada' : 'Rechazada'}
        </span>
        <span className="em" style={{ fontSize: 10.5, color: C.tenue }}>
          {fila.total_si}–{fila.total_no}
        </span>
      </div>

      {dudoso && (
        <p className="em" style={{
          fontSize: 9.5, color: C.tenue, margin: '9px 0 0', paddingTop: 7,
          borderTop: `1px solid ${C.linea}`
        }}>
          Vínculo entre votación y ley deducido por similitud de título, sin confirmar.
        </p>
      )}
    </article>
  );
}

function Vacio({ titulo, cuerpo }) {
  return (
    <div style={{
      border: `1px solid ${C.linea}`, borderRadius: 0, padding: '26px 22px',
      background: C.superficie, maxWidth: 460
    }}>
      <h3 className="ed" style={{ fontSize: 17, margin: '0 0 7px', color: C.tinta, fontWeight: 500 }}>{titulo}</h3>
      <p className="em" style={{ fontSize: 12, lineHeight: 1.6, color: C.media, margin: 0 }}>{cuerpo}</p>
    </div>
  );
}

export default function FeedPersonal() {
  const [filas, setFilas] = useState([]);
  const [siguiendo, setSiguiendo] = useState(() => leerSeguimientos());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const s = leerSeguimientos();
      if (!vivo) return;
      setSiguiendo(s);
      if (totalSeguimientos(s) === 0) { setCargando(false); return; }
      const f = await traerActividadSeguida(s, 40);
      if (!vivo) return;
      setFilas(f);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, []);

  if (cargando) {
    return <div className="em" style={{ padding: 30, fontSize: 12, color: C.tenue }}>Cargando…</div>;
  }

  const total = totalSeguimientos(siguiendo);

  if (total === 0) {
    return (
      <Vacio
        titulo="Todavía no sigues nada"
        cuerpo="Pulsa Seguir en cualquier ley, materia o diputado y su actividad aparecerá aquí. No hace falta cuenta: se guarda en este navegador."
      />
    );
  }

  if (filas.length === 0) {
    return (
      <Vacio
        titulo="Sin movimientos"
        cuerpo="Sigues cosas, pero ninguna ha pasado por el pleno todavía. Volverá a llenarse cuando se vote."
      />
    );
  }

  return (
    <section>
      <p className="em" style={{ fontSize: 10.5, color: C.tenue, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {filas.length} votaciones · sigues {total}
      </p>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {filas.map((f, i) => (
          <motion.div
            key={f.votacion_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.025 }}
          >
            <Tarjeta fila={f} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}