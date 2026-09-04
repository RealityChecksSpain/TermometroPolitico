import React, { useState } from 'react';
import { enviarEnlaceAcceso, cerrarSesion } from '../lib/cliente.js';

const C = {
  superficie: '#FFFFFF', papel: '#F3F1E8', tinta: '#15171A', media: '#4A5057',
  tenue: '#7C8288', linea: '#DCDCD3', acento: '#E0492E'
};

export default function Acceso({ sesion, alCambiar }) {
  const [correo, setCorreo] = useState('');
  const [estado, setEstado] = useState('reposo');
  const [motivo, setMotivo] = useState('');

  async function enviar() {
    if (estado === 'enviando') return;
    setEstado('enviando');
    setMotivo('');
    const r = await enviarEnlaceAcceso(correo);
    if (r.ok) {
      setEstado('enviado');
      return;
    }
    setEstado('reposo');
    setMotivo(r.motivo === 'correo no valido' ? 'Ese correo no parece válido.' : r.motivo);
  }

  async function salir() {
    const r = await cerrarSesion();
    if (r.ok) alCambiar?.(null);
  }

  if (sesion) {
    return (
      <div style={{
        border: `1px solid ${C.linea}`, background: C.superficie, padding: '13px 15px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
      }}>
        <span className="em" style={{ fontSize: 11, color: C.media }}>Sesión iniciada</span>
        <button
          type="button"
          onClick={salir}
          className="em"
          style={{
            border: `1px solid ${C.linea}`, background: 'transparent', color: C.tinta,
            borderRadius: 0, padding: '5px 11px', fontSize: 10.5, textTransform: 'uppercase',
            letterSpacing: '.06em', fontWeight: 600, cursor: 'pointer'
          }}
        >
          Salir
        </button>
      </div>
    );
  }

  if (estado === 'enviado') {
    return (
      <div style={{ border: `1px solid ${C.linea}`, background: C.superficie, padding: '22px 20px', maxWidth: 460 }}>
        <h3 className="ed" style={{ fontSize: 17, margin: '0 0 7px', color: C.tinta, fontWeight: 500 }}>
          Mira tu correo
        </h3>
        <p className="em" style={{ fontSize: 12, lineHeight: 1.6, color: C.media, margin: 0 }}>
          Enviado a {correo.trim().toLowerCase()}. Ábrelo en este mismo navegador y quedarás
          dentro. Si no aparece en unos minutos, mira en spam.
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.linea}`, background: C.superficie, padding: '22px 20px', maxWidth: 460 }}>
      <p className="em" style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em',
        fontWeight: 700, color: C.acento, margin: '0 0 9px'
      }}>
        Para seguir leyes, materias y diputados
      </p>
      <h3 className="ed" style={{ fontSize: 17, margin: '0 0 7px', color: C.tinta, fontWeight: 500 }}>
        Entrar sin contraseña
      </h3>
      <p className="em" style={{ fontSize: 12, lineHeight: 1.6, color: C.media, margin: '0 0 6px' }}>
        Escribe tu correo y te llega un enlace. Al pulsarlo, entras. No hay contraseña
        que inventar ni que recordar.
      </p>
      <p className="em" style={{ fontSize: 11, lineHeight: 1.6, color: C.tenue, margin: '0 0 14px' }}>
        No es una suscripción. No te mandamos boletines ni nada que no hayas pedido.
        El correo sirve para reconocerte y para nada más.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={correo}
          onChange={e => setCorreo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
          placeholder="tu@correo.es"
          className="em"
          style={{
            flex: '1 1 200px', border: `1px solid ${C.linea}`, borderRadius: 0,
            padding: '8px 10px', fontSize: 12.5, color: C.tinta, background: C.papel
          }}
        />
        <button
          type="button"
          onClick={enviar}
          disabled={estado === 'enviando'}
          className="em"
          style={{
            border: `1px solid ${C.acento}`, background: C.acento, color: C.papel,
            borderRadius: 0, padding: '8px 15px', fontSize: 11, textTransform: 'uppercase',
            letterSpacing: '.06em', fontWeight: 600,
            cursor: estado === 'enviando' ? 'default' : 'pointer',
            opacity: estado === 'enviando' ? 0.5 : 1
          }}
        >
          {estado === 'enviando' ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </div>

      {motivo && (
        <p className="em" style={{ fontSize: 11, color: C.acento, margin: '10px 0 0' }}>{motivo}</p>
      )}
    </div>
  );
}