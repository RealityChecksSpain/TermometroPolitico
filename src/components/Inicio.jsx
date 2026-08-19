import React from 'react';

const C = {
  papel: '#EFEFE9', superficie: '#FFFFFF', pizarra: '#1F2328',
  tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3',
  si: '#2E7D5B', no: '#B23A2E', abs: '#B8912E'
};

function Puerta({ numero, titulo, texto, pie, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', background: C.superficie, border: `1px solid ${C.linea}`,
      borderRadius: 3, padding: '20px 18px', cursor: 'pointer', width: '100%',
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 160,
      transition: 'border-color 150ms ease, transform 150ms ease'
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.tinta; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.linea; e.currentTarget.style.transform = 'none'; }}>
      <span className="em" style={{ fontSize: 11, color: C.tenue }}>{numero}</span>
      <span className="ed" style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15 }}>{titulo}</span>
      <span style={{ fontSize: 13.5, color: C.media, lineHeight: 1.5 }}>{texto}</span>
      <span className="em" style={{ fontSize: 11, color: C.tinta, marginTop: 'auto', fontWeight: 500 }}>{pie} →</span>
    </button>
  );
}

function Muestra({ forma, texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <svg width="22" height="22" viewBox="-8 -8 16 16" style={{ flexShrink: 0 }}>
        {forma === 'relleno' && <circle r="6.2" fill="#C8102E" />}
        {forma === 'anillo' && <circle r="5.4" fill="none" stroke="#C8102E" strokeWidth="3.6" />}
        {forma === 'punto' && <><circle r="6.2" fill="#C8102E" opacity="0.2" /><circle r="2.2" fill="#C8102E" /></>}
      </svg>
      <span style={{ fontSize: 13, color: C.media }}>{texto}</span>
    </div>
  );
}

function Destacada({ v, onAbrir }) {
  if (!v) return null;
  const aprobada = v.resultado === 'aprobada';
  const total = v.total_si + v.total_no + v.total_abstencion || 1;
  const efectos = Array.isArray(v.efectos) ? v.efectos.slice(0, 3) : [];

  return (
    <button onClick={() => onAbrir(v.id)} style={{
      textAlign: 'left', width: '100%', cursor: 'pointer', border: 'none', padding: 0,
      background: C.pizarra, borderRadius: 3, overflow: 'hidden', display: 'block'
    }}>
      <div style={{ padding: 'clamp(20px, 3.5vw, 34px)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <span className="em" style={{
            fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase',
            color: C.pizarra, background: '#EFEFE9', padding: '3px 8px', borderRadius: 2, fontWeight: 500
          }}>Lo último votado</span>
          {v.materia_nombre && (
            <span className="em" style={{
              fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase',
              color: v.materia_color || '#9AA0A6', border: `1px solid ${(v.materia_color || '#9AA0A6')}66`,
              padding: '3px 8px', borderRadius: 2
            }}>{v.materia_nombre}</span>
          )}
          <span className="em" style={{ fontSize: 11, color: '#6E747A' }}>{v.fecha}</span>
        </div>

        <div className="ed" style={{
          color: '#F7F7F2', fontSize: 'clamp(20px, 3.2vw, 31px)', fontWeight: 700,
          lineHeight: 1.18, letterSpacing: '-0.02em', maxWidth: 780
        }}>
          {String(v.subtitulo || v.titulo).slice(0, 175)}
        </div>

        {v.resumen && (
          <div style={{ color: '#A8AEB4', fontSize: 'clamp(13px, 1.6vw, 15px)', lineHeight: 1.55, marginTop: 12, maxWidth: 660 }}>
            {String(v.resumen).slice(0, 210)}{String(v.resumen).length > 210 ? '…' : ''}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap' }}>
          <span className="ed" style={{
            fontSize: 'clamp(15px, 2vw, 19px)', fontWeight: 800, letterSpacing: '-0.01em',
            color: aprobada ? '#5FBF92' : '#E08278'
          }}>{aprobada ? 'APROBADA' : 'RECHAZADA'}</span>
          <span className="em" style={{ fontSize: 12, color: '#9AA0A6' }}>
            {v.total_si} a favor · {v.total_no} en contra · {v.total_abstencion} abstenciones
          </span>
        </div>

        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#363B42', marginTop: 10, maxWidth: 560 }}>
          {[[v.total_si, C.si], [v.total_abstencion, C.abs], [v.total_no, C.no]].map(([n, col], i) =>
            n > 0 && <div key={i} style={{ width: `${(n / total) * 100}%`, background: col }} />)}
        </div>

        {efectos.length > 0 && (
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #363B42' }}>
            <div className="em" style={{ fontSize: 10, color: '#6E747A', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 11 }}>
              A quién afecta
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {efectos.map(e => (
                <div key={e.slug}>
                  <div style={{ color: '#F2F3F0', fontSize: 13, fontWeight: 600 }}>{e.nombre}</div>
                  <div style={{ color: '#9AA0A6', fontSize: 12.5, lineHeight: 1.45, marginTop: 3 }}>{e.efecto}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="em" style={{ fontSize: 11, color: '#C9CDD2', marginTop: 20, fontWeight: 500 }}>
          Ver quién votó qué →
        </div>
      </div>
    </button>
  );
}

export default function Inicio({ cobertura, coherencia, destacadas, onIr, onVotacion }) {
  const destacada = destacadas?.[0];
  const otras = (destacadas ?? []).slice(1, 4);
  const hayCoherencia = (coherencia ?? []).some(c => c.promesas_votadas > 0);
  return (
    <div>
      <div style={{ padding: '10px 0 4px' }}>
        <h1 className="ed" style={{
          fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 800, lineHeight: 1.02,
          margin: 0, letterSpacing: '-0.03em', maxWidth: 760
        }}>
          ¿Sabes qué votó<br />tu diputado?
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2.2vw, 19px)', color: C.media, lineHeight: 1.5,
          margin: '18px 0 0', maxWidth: 560
        }}>
          Cada ley. Cada voto. Cada uno de los 350. Datos oficiales del Congreso,
          sin opinión, sin filtro y con el enlace a la fuente en cada dato.
        </p>
      </div>

      {cobertura && (
        <div style={{
          display: 'flex', gap: 'clamp(18px, 4vw, 44px)', flexWrap: 'wrap',
          padding: '22px 0 26px', borderBottom: `1px solid ${C.linea}`, marginBottom: 26
        }}>
          {[
            [new Date(cobertura.ultima_sesion + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }), 'último pleno con votaciones'],
            [Number(cobertura.votaciones).toLocaleString('es'), 'votaciones registradas'],
            ['cada noche', 'se actualiza']
          ].map(([n, t]) => (
            <div key={t}>
              <div className="ed" style={{ fontSize: 'clamp(22px, 3.4vw, 30px)', fontWeight: 800, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 12, color: C.tenue, marginTop: 5 }}>{t}</div>
            </div>
          ))}
        </div>
      )}

      {destacada && (
        <div style={{ marginBottom: 26 }}>
          <Destacada v={destacada} onAbrir={onVotacion} />
          {otras.length > 0 && (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 8 }}>
              {otras.map(o => (
                <button key={o.id} onClick={() => onVotacion(o.id)} style={{
                  textAlign: 'left', background: C.superficie, border: `1px solid ${C.linea}`,
                  borderRadius: 3, padding: 13, cursor: 'pointer'
                }}>
                  <div className="em" style={{ fontSize: 10, color: o.materia_color || C.tenue, marginBottom: 5 }}>
                    {o.materia_nombre ?? o.fecha}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 500 }}>
                    {String(o.subtitulo || o.titulo).slice(0, 88)}…
                  </div>
                  <div className="em" style={{
                    fontSize: 10.5, marginTop: 7, fontWeight: 600,
                    color: o.resultado === 'aprobada' ? C.si : C.no
                  }}>{o.resultado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Puerta numero="01" titulo="Leyes que te afectan"
          texto="Filtra por tu situación: autónomo, inquilino, pensionista, con hijos. Verás qué se votó sobre eso y qué cambia."
          pie="Ver las leyes" onClick={() => onIr('leyes')} />
        <Puerta numero="02" titulo="Tu diputado"
          texto="Busca por provincia o por nombre. Su historial completo de votos, cuántos plenos se saltó y si alguna vez rompió con su partido."
          pie="Buscar diputado" onClick={() => onIr('diputados')} />
        <Puerta numero="03" titulo="¿Cumplen lo que prometieron?"
          texto="Los compromisos de cada programa electoral de 2023, cruzados con cómo votaron después en el Congreso."
          pie="Ver programas" onClick={() => onIr('partidos')} />
      </div>

      {hayCoherencia && (
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 11, color: C.tenue, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 12 }}>
            Promesas que llegaron a votación
          </div>
          <div style={{ background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3, padding: 16 }}>
            {coherencia.filter(c => c.promesas_votadas > 0).slice(0, 8).map(c => (
              <div key={c.partido} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                <span style={{ width: 4, height: 22, background: c.color || '#8E9299', borderRadius: 4, flexShrink: 0 }} />
                <span style={{ width: 82, fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>{c.siglas}</span>
                <span style={{ flex: 1, display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#E4E4DC' }}>
                  <span style={{ width: `${c.pct_coherencia ?? 0}%`, background: c.color || '#8E9299' }} />
                </span>
                <span className="em" style={{ fontSize: 12.5, width: 48, textAlign: 'right', flexShrink: 0 }}>
                  {c.pct_coherencia ?? 0}%
                </span>
                <span className="em" style={{ fontSize: 10.5, color: C.tenue, width: 80, textAlign: 'right', flexShrink: 0 }}>
                  {c.cumplidas}/{c.promesas_votadas}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: C.tenue, lineHeight: 1.55, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.linea}` }}>
              Porcentaje de compromisos electorales que llegaron a votarse y en los que el partido
              votó en la dirección que prometió. Los compromisos que nunca se sometieron a votación
              no cuentan aquí: se listan aparte en cada partido.
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 30, background: C.pizarra, borderRadius: 3, padding: '20px 18px' }}>
        <div className="ed" style={{ color: '#F2F3F0', fontSize: 17, fontWeight: 700 }}>
          Cómo se lee el hemiciclo
        </div>
        <div style={{ color: '#9AA0A6', fontSize: 13.5, lineHeight: 1.55, margin: '8px 0 16px', maxWidth: 520 }}>
          Cada punto es un escaño. El color es el partido. Cuando eliges una votación,
          la forma del punto cambia según lo que votó esa persona.
        </div>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Muestra forma="relleno" texto="Votó a favor" />
          <Muestra forma="anillo" texto="Votó en contra" />
          <Muestra forma="punto" texto="Se abstuvo" />
        </div>
        <div style={{ color: '#6E747A', fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
          Usamos la forma y no el color porque el color ya indica el partido.
          Así se distingue también en blanco y negro y con daltonismo.
        </div>
      </div>

      <div style={{ marginTop: 26, padding: 18, background: C.superficie, border: `1px solid ${C.linea}`, borderRadius: 3 }}>
        <div className="ed" style={{ fontSize: 17, fontWeight: 700 }}>De dónde salen estos datos</div>
        <div style={{ fontSize: 13.5, color: C.media, lineHeight: 1.6, marginTop: 8, maxWidth: 640 }}>
          Todo procede del portal de datos abiertos del Congreso de los Diputados y se actualiza
          cada noche. Los recuentos no son estimaciones: se calculan sobre los votos individuales
          que publica la Cámara. Los resúmenes de las leyes se generan automáticamente a partir
          del texto oficial del Boletín de las Cortes, y siempre puedes abrir ese texto para
          comprobarlo.
        </div>
        <div style={{ fontSize: 13.5, color: C.media, lineHeight: 1.6, marginTop: 12, maxWidth: 640 }}>
          Esta herramienta no valora ni puntúa a nadie. No dice si una ley es buena o mala, ni si
          un diputado lo hace bien o mal. Enseña lo que hizo y te deja juzgar a ti.
        </div>
      </div>
    </div>
  );
}