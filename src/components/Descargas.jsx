import React, { useState } from 'react';
import { supabase } from '../lib/cliente.js';
import { aCsv, descargar } from '../lib/csv.js';

const C = {
  superficie: '#FFFFFF', tinta: '#14161A', papel: '#EFEFE9',
  media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3'
};

const CONJUNTOS = [
  {
    id: 'diputados', nombre: 'Diputados',
    que: 'Los 410 mandatos con partido, circunscripción, asistencia, disidencias, minutos de tribuna y declaraciones de intereses.',
    vista: 'mv_diputados', orden: 'nombre_completo'
  },
  {
    id: 'votaciones', nombre: 'Votaciones',
    que: 'Las 2.055 votaciones con recuentos, resultado, expediente y enlace al acta oficial.',
    vista: 'mv_votaciones', orden: 'fecha'
  },
  {
    id: 'normas', nombre: 'Normas agrupadas',
    que: 'Una fila por norma, con sus enmiendas contadas, materia, colectivos afectados y resumen.',
    vista: 'mv_normas', orden: 'fecha'
  },
  {
    id: 'promesas', nombre: 'Compromisos electorales',
    que: 'Los compromisos extraídos de los programas de 2023, con partido, materia y si son verificables.',
    vista: 'v_promesas', orden: 'partido'
  },
  {
    id: 'actividades', nombre: 'Intereses declarados',
    que: 'Actividades, donaciones y fundaciones declaradas por cada diputado.',
    vista: 'v_actividades', orden: 'nombre_completo'
  },
  {
    id: 'ejes', nombre: 'Posición de los partidos',
    que: 'Los ejes calculados desde programas y desde votos, con el número de señales que sustenta cada uno.',
    vista: 'v_mapa_partidos', orden: 'siglas'
  },
  {
    id: 'tiempo', nombre: 'Tiempo de palabra',
    que: 'Minutos de tribuna e intervenciones por partido.',
    vista: 'mv_tiempo_por_grupo', orden: 'minutos'
  }
];

async function traerTodo(vista, orden) {
  const filas = [];
  let desde = 0;
  for (;;) {
    const { data, error } = await supabase.from(vista).select('*').order(orden).range(desde, desde + 999);
    if (error) throw error;
    if (!data?.length) break;
    filas.push(...data);
    if (data.length < 1000) break;
    desde += 1000;
    if (desde > 60000) break;
  }
  return filas;
}

export default function Descargas() {
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);

  async function bajar(c, formato) {
    setOcupado(c.id + formato); setError(null);
    try {
      const filas = await traerTodo(c.vista, c.orden);
      const fecha = new Date().toISOString().slice(0, 10);
      if (formato === 'csv') {
        descargar(`escano-${c.id}-${fecha}.csv`, aCsv(filas));
      } else {
        descargar(`escano-${c.id}-${fecha}.json`, JSON.stringify(filas, null, 2), 'application/json');
      }
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="ed" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
        Descarga los datos
      </h1>
      <p style={{ fontSize: 16, color: C.media, lineHeight: 1.55, marginTop: 14 }}>
        Todo lo que ves aquí se puede descargar y comprobar por tu cuenta. Sin registro, sin permisos,
        sin límites. Si publicas algo con estos datos, cita al Congreso de los Diputados como fuente
        original y enlaza al acta correspondiente.
      </p>

      {error && (
        <div style={{ margin: '16px 0', padding: 12, background: '#FBE9EC', border: '1px solid #E8C0C6', borderRadius: 3, fontSize: 12.5, color: '#8E0B20' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        {CONJUNTOS.map(c => (
          <div key={c.id} style={{ padding: '15px 0', borderTop: `1px solid ${C.linea}` }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <div className="ed" style={{ fontSize: 17, fontWeight: 600 }}>{c.nombre}</div>
                <div style={{ fontSize: 13, color: C.media, lineHeight: 1.5, marginTop: 3 }}>{c.que}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {['csv', 'json'].map(f => (
                  <button key={f} onClick={() => bajar(c, f)} disabled={ocupado !== null} className="em" style={{
                    padding: '7px 13px', fontSize: 11.5, cursor: ocupado ? 'wait' : 'pointer',
                    background: f === 'csv' ? C.tinta : 'transparent',
                    color: f === 'csv' ? C.papel : C.media,
                    border: `1px solid ${f === 'csv' ? C.tinta : C.linea}`,
                    borderRadius: 2, opacity: ocupado && ocupado !== c.id + f ? 0.4 : 1
                  }}>
                    {ocupado === c.id + f ? 'preparando…' : f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 26, padding: 16, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
        <div className="ed" style={{ fontSize: 15, fontWeight: 600 }}>Notas para quien vaya a publicar</div>
        <ul style={{ fontSize: 13, color: C.media, lineHeight: 1.6, margin: '9px 0 0', paddingLeft: 18 }}>
          <li style={{ marginBottom: 6 }}>
            Los CSV van en UTF-8 con separador de punto y coma, que es lo que espera Excel en español.
          </li>
          <li style={{ marginBottom: 6 }}>
            Las columnas que empiezan por <code>eje_</code> son cálculos nuestros, no datos oficiales.
            Su método está en «Cómo se hace esto» y el número de señales que las sustenta va al lado.
          </li>
          <li style={{ marginBottom: 6 }}>
            Los resúmenes y las etiquetas de colectivos los genera un modelo de lenguaje sobre el texto
            oficial. Verifícalos contra el enlace antes de citarlos.
          </li>
          <li>
            Los recuentos de votos no son estimaciones: salen de los votos individuales publicados
            por la Cámara y se validan contra los totales oficiales.
          </li>
        </ul>
      </div>
    </div>
  );
}
