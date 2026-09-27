import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { textoGlosario } from '../lib/glosario.js';
import { useTactil } from '../lib/pantalla.js';

const estilos = `
.explicaCaja{position:relative;display:inline-flex;vertical-align:middle;margin-left:5px}
.explicaMarca{position:relative;display:inline-flex;align-items:center;justify-content:center;
width:18px;height:18px;border-radius:18px;border:0;background:#9C4225;color:#F3F1E8;
font-size:12px;font-weight:700;line-height:1;padding:0;cursor:help;font-family:inherit;
flex-shrink:0;transition:transform 140ms ease}
.explicaMarca[data-tono="claro"]{background:#E8C56A;color:#14161A}
.explicaMarca:hover,.explicaMarca:focus-visible{transform:scale(1.12)}
.explicaMarca:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.explicaMarca::after{content:'';position:absolute;inset:-3px;border-radius:50%;
border:2px solid #9C4225;opacity:0;animation:explicaLlama 2.6s ease-out 3}
.explicaMarca[data-tono="claro"]::after{border-color:#E8C56A}
.explicaMarca[aria-expanded="true"]::after,.explicaMarca:hover::after{animation:none}
@keyframes explicaLlama{
0%{transform:scale(.8);opacity:0}
12%{opacity:.85}
40%{transform:scale(1.45);opacity:0}
100%{transform:scale(1.45);opacity:0}}
@media(prefers-reduced-motion:reduce){.explicaMarca::after{animation:none}}
.explicaGlobo{position:fixed;z-index:900;width:max-content;
max-width:min(280px,calc(100vw - 24px));
background:#FFFFFF;color:#2F343A;border:1px solid #D8D3C4;border-radius:3px;
box-shadow:0 6px 20px rgba(20,22,26,.16);padding:10px 12px;
font-family:'Archivo Variable','Archivo',system-ui,sans-serif;
font-size:12.5px;line-height:1.5;font-weight:400;letter-spacing:0;text-align:left;
white-space:normal;text-transform:none;cursor:auto}
.explicaTermino{display:block;font-weight:700;margin-bottom:3px;color:#14161A}
@media(hover:none){
.explicaMarca{width:26px;height:26px;font-size:14px}
.explicaGlobo{font-size:13.5px}
}
`;

const MARGEN = 12;
const HUECO = 7;
const ESPERA = 120;

export default function Explica({ termino, texto, titulo, tono = 'oscuro' }) {
  const cuerpo = texto ?? textoGlosario(termino);
  const tactil = useTactil();
  const [abierto, setAbierto] = useState(false);
  const [sitio, setSitio] = useState(null);
  const caja = useRef(null);
  const marca = useRef(null);
  const globo = useRef(null);
  const reloj = useRef(null);
  const id = useId();

  const cancelar = useCallback(() => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
  }, []);

  const pedirCierre = useCallback(() => {
    cancelar();
    reloj.current = setTimeout(() => setAbierto(false), ESPERA);
  }, [cancelar]);

  const abrir = useCallback(() => { cancelar(); setAbierto(true); }, [cancelar]);

  useEffect(() => cancelar, [cancelar]);

  useLayoutEffect(() => {
    if (!abierto) { setSitio(null); return; }
    if (typeof window === 'undefined') return;
    const colocar = () => {
      const m = marca.current;
      const g = globo.current;
      if (!m || !g) return;
      const r = m.getBoundingClientRect();
      const b = g.getBoundingClientRect();
      const ancho = document.documentElement.clientWidth;
      const alto = document.documentElement.clientHeight;
      const tope = Math.max(MARGEN, ancho - MARGEN - b.width);
      const izq = Math.min(Math.max(r.left + r.width / 2 - b.width / 2, MARGEN), tope);
      let arriba = r.bottom + HUECO;
      if (arriba + b.height > alto - MARGEN && r.top - HUECO - b.height > MARGEN) {
        arriba = r.top - HUECO - b.height;
      }
      setSitio({ izq, arriba });
    };
    colocar();
    window.addEventListener('scroll', colocar, true);
    window.addEventListener('resize', colocar);
    return () => {
      window.removeEventListener('scroll', colocar, true);
      window.removeEventListener('resize', colocar);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto || typeof document === 'undefined') return;
    const fuera = e => {
      if (caja.current?.contains(e.target)) return;
      if (globo.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const tecla = e => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  if (!cuerpo) return null;

  const burbuja = abierto && typeof document !== 'undefined' && createPortal(
    <span className="explicaGlobo" role="tooltip" id={id} ref={globo}
      style={sitio
        ? { top: sitio.arriba, left: sitio.izq }
        : { top: 0, left: 0, visibility: 'hidden' }}
      onMouseEnter={tactil ? undefined : cancelar}
      onMouseLeave={tactil ? undefined : pedirCierre}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}>
      {titulo && <span className="explicaTermino">{titulo}</span>}
      {cuerpo}
    </span>,
    document.body
  );

  return (
    <span className="explicaCaja" ref={caja}
      onMouseEnter={tactil ? undefined : abrir}
      onMouseLeave={tactil ? undefined : pedirCierre}>
      <style>{estilos}</style>
      <button type="button" className="explicaMarca" data-tono={tono} ref={marca}
        aria-label={`Qué es ${titulo ?? termino ?? 'esto'}`}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          if (tactil && abierto) setAbierto(false);
          else abrir();
        }}
        onFocus={tactil ? undefined : abrir}
        onBlur={tactil ? undefined : pedirCierre}>?</button>
      {burbuja}
    </span>
  );
}