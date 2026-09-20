import { useEffect, useState } from 'react';

export const CORTE_TELEFONO = 700;
export const CORTE_TABLETA = 900;

export function useConsulta(consulta) {
  const [activa, setActiva] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(consulta).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(consulta);
    const leer = () => setActiva(mq.matches);
    leer();
    if (mq.addEventListener) {
      mq.addEventListener('change', leer);
      return () => mq.removeEventListener('change', leer);
    }
    mq.addListener(leer);
    return () => mq.removeListener(leer);
  }, [consulta]);

  return activa;
}

export function useTelefono() {
  return useConsulta(`(max-width: ${CORTE_TELEFONO}px)`);
}

export function useEscritorio() {
  return useConsulta(`(min-width: ${CORTE_TABLETA}px)`);
}

export function useTactil() {
  return useConsulta('(hover: none)');
}

export function useBloqueoScroll(activo) {
  useEffect(() => {
    if (!activo || typeof document === 'undefined') return;
    const cuerpo = document.body;
    const previo = cuerpo.style.overflow;
    const previoTop = cuerpo.style.top;
    const desplazamiento = window.scrollY;
    cuerpo.style.overflow = 'hidden';
    cuerpo.style.position = 'fixed';
    cuerpo.style.top = `-${desplazamiento}px`;
    cuerpo.style.width = '100%';
    return () => {
      cuerpo.style.overflow = previo;
      cuerpo.style.position = '';
      cuerpo.style.top = previoTop;
      cuerpo.style.width = '';
      window.scrollTo(0, desplazamiento);
    };
  }, [activo]);
}
