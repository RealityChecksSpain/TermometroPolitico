import React, { useState } from 'react';
import Explica from './Explica.jsx';
import { GRAVEDAD, OPINION } from '../lib/fiscalizacion.js';
import { siglasPartido } from '../lib/etiquetas.js';

const C = { tinta: '#14161A', media: '#4A5057', tenue: '#7C8288', linea: '#E3DFD1', fondo: '#F5F4EE' };
const VISIBLES = 5;

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function listar(trozos) {
  if (trozos.length < 2) return trozos[0] ?? '';
  return `${trozos.slice(0, -1).join(', ')} y ${trozos[trozos.length - 1]}`;
}

function fraseOpinion(o) {
  if (o.opinion === 'favorable') return 'Dijo que sus cuentas reflejan fielmente su situación.';
  if (o.opinion === 'desfavorable') return 'Dijo que sus cuentas no reflejan fielmente su situación ni sus resultados.';
  if (o.opinion === 'denegada') return 'No pudo dar una opinión sobre sus cuentas.';
  const limite = o.limitacion ? ' y por lo que no pudo revisar' : '';
  return `Dijo que sus cuentas reflejan fielmente su situación, salvo por ${plural(o.salvedades, 'salvedad', 'salvedades')}${limite}.`;
}

function fraseCuenta(c, total) {
  const trozos = [];
  if (c.infraccion) trozos.push(plural(c.infraccion, 'posible infracción', 'posibles infracciones'));
  if (c.incumplimiento) trozos.push(plural(c.incumplimiento, 'incumplimiento', 'incumplimientos'));
  if (c.contable) trozos.push(`${c.contable} de contabilidad`);
  return `${plural(total, 'reparo', 'reparos')}: ${listar(trozos)}.`;
}

function Sello({ estilo, children }) {
  return (
    <span className="em" style={{
      display: 'inline-block', fontSize: 9.5, padding: '1px 6px', borderRadius: 2,
      background: estilo.fondo, color: estilo.color, fontWeight: 600, whiteSpace: 'nowrap'
    }}>
      {children}
    </span>
  );
}

function Nota({ texto, url }) {
  if (!texto) return null;
  return (
    <div style={{
      fontSize: 10.5, color: C.media, lineHeight: 1.5, marginTop: 5,
      paddingLeft: 8, borderLeft: `2px solid ${C.linea}`
    }}>
      {texto}
      {url && (
        <>
          {' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="em" style={{ color: C.media, whiteSpace: 'nowrap' }}>
            fuente →
          </a>
        </>
      )}
    </div>
  );
}

function Caja({ ejercicio, children }) {
  return (
    <div style={{ border: `1px solid ${C.linea}`, borderRadius: 3, background: C.fondo, padding: 12, marginBottom: 12 }}>
      <div className="em" style={{
        fontSize: 9.5, color: C.tenue, textTransform: 'uppercase',
        letterSpacing: '.06em', fontWeight: 600, marginBottom: 9
      }}>
        Tribunal de Cuentas{ejercicio ? ` · cuentas de ${ejercicio}` : ''}
      </div>
      {children}
    </div>
  );
}

function Bloque({ f, titulo }) {
  const [todos, setTodos] = useState(false);
  const total = f.reparos.length;
  const lista = todos ? f.reparos : f.reparos.slice(0, VISIBLES);
  const o = f.opinion;

  return (
    <div style={{ marginBottom: 6 }}>
      {titulo && (
        <div className="ed" style={{ fontSize: 13.5, fontWeight: 700, color: C.tinta, margin: '2px 0 6px' }}>{titulo}</div>
      )}

      {o && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Sello estilo={OPINION[o.opinion]}>{OPINION[o.opinion].texto}</Sello>
            {o.opinion === 'con_salvedades' && <Explica termino="salvedad" titulo="Salvedad" />}
            {o.pagina != null && (
              <span className="em" style={{ fontSize: 9.5, color: C.tenue, marginLeft: 'auto' }}>p. {o.pagina}</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: C.tinta, lineHeight: 1.5 }}>{fraseOpinion(o)}</div>
          <Nota texto={o.nota} url={o.notaUrl} />
        </div>
      )}

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: C.media, lineHeight: 1.5, marginBottom: 6 }}>
          <span>{fraseCuenta(f.cuenta, total)}</span>
          {f.cuenta.infraccion > 0 && <Explica termino="posibleInfraccion" titulo="Posible infracción" />}
        </div>
      )}

      {lista.map(r => (
        <div key={r.clave} style={{ borderTop: `1px solid ${C.linea}`, padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <Sello estilo={GRAVEDAD[r.gravedad]}>{GRAVEDAD[r.gravedad].texto}</Sello>
            {r.pagina != null && (
              <span className="em" style={{ fontSize: 9.5, color: C.tenue, marginLeft: 'auto' }}>p. {r.pagina}</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: C.tinta, lineHeight: 1.5 }}>{r.resumen}</div>
          <Nota texto={r.nota} url={r.notaUrl} />
        </div>
      ))}

      {total > VISIBLES && (
        <button onClick={() => setTodos(!todos)} className="em" style={{
          marginTop: 4, padding: '4px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 2,
          background: 'transparent', color: C.media, border: `1px solid ${C.linea}`
        }}>
          {todos ? 'ver menos' : `ver los ${total}`}
        </button>
      )}
    </div>
  );
}

export default function Fiscalizacion({ partido, siglas, datos }) {
  if (datos === undefined) return null;

  if (datos === null) {
    return (
      <Caja>
        <div style={{ fontSize: 11, color: C.tenue, lineHeight: 1.5 }}>
          Los reparos del Tribunal de Cuentas no se pueden leer ahora mismo.
        </div>
      </Caja>
    );
  }

  if (!datos.ejercicio) return null;

  const d = datos.porPartido?.[partido];
  const nombre = siglasPartido(siglas);

  if (!d || !d.formaciones.length) {
    return (
      <Caja ejercicio={datos.ejercicio}>
        <div style={{ fontSize: 11.5, color: C.media, lineHeight: 1.5 }}>
          El informe de fiscalización de {datos.ejercicio} no incluye a {nombre}.
        </div>
      </Caja>
    );
  }

  const propia = d.formaciones.find(f => f.nombre === null);
  const otras = d.formaciones.filter(f => f.nombre !== null);
  const varias = d.formaciones.length > 1;
  const extraido = d.formaciones.some(f => f.extraido);

  return (
    <Caja ejercicio={datos.ejercicio}>
      {!propia && (
        <div style={{ fontSize: 11.5, color: C.media, lineHeight: 1.5, marginBottom: 10 }}>
          {nombre} no se fiscaliza con su nombre en las cuentas de {datos.ejercicio}. El informe revisa
          por separado a las formaciones de su grupo:
        </div>
      )}

      {propia && <Bloque f={propia} titulo={varias ? nombre : null} />}

      {otras.map(f => (
        <div key={f.nombre} style={{ borderTop: varias ? `2px solid ${C.linea}` : 'none', paddingTop: varias ? 10 : 0, marginTop: varias ? 6 : 0 }}>
          <Bloque f={f} titulo={f.nombre} />
        </div>
      ))}

      <div style={{ fontSize: 9.5, color: C.tenue, marginTop: 9, lineHeight: 1.5 }}>
        Del informe de fiscalización del Tribunal de Cuentas, con la página de cada dato.
        {extraido
          ? ' Los ha sacado del informe un modelo de lenguaje y cada cifra está comprobada contra su página.'
          : ' Transcritos a mano del informe.'}
        {' '}Un reparo no es una condena.
      </div>

      {d.fuente && (
        <a href={d.fuente.url} target="_blank" rel="noopener noreferrer" className="em"
          style={{ fontSize: 10.5, color: C.media, display: 'block', marginTop: 7 }}>
          {d.fuente.titulo ?? 'Informe original'} →
        </a>
      )}
    </Caja>
  );
}