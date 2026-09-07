export const MARCA_REGIMEN = {
  'regimen:de-1933': { codigo: 'NS', fondo: '#5E2B2B', texto: '#F2E7C9' },
  'regimen:it-1922': { codigo: 'FN', fondo: '#2B2E33', texto: '#F2E7C9' },
  'regimen:su-1928': { codigo: 'PB', fondo: '#B0472F', texto: '#F2E7C9' },
  'regimen:cn-1949': { codigo: 'PC', fondo: '#C25539', texto: '#F2E7C9' },
  'regimen:cu-1959': { codigo: 'CC', fondo: '#A34A46', texto: '#F2E7C9' },
  'regimen:kh-1975': { codigo: 'JR', fondo: '#8C4033', texto: '#F2E7C9' },
  'regimen:kp-1990': { codigo: 'WK', fondo: '#7C8B5A', texto: '#F2E7C9' },
  'regimen:cl-1973': { codigo: 'PD', fondo: '#3A5A78', texto: '#F2E7C9' },
  'regimen:es-1939': { codigo: 'FE', fondo: '#4E6E86', texto: '#F2E7C9' },
  'regimen:gr-1967': { codigo: 'EE', fondo: '#585E66', texto: '#F2E7C9' },
  'regimen:za-1948': { codigo: 'PN', fondo: '#6B5340', texto: '#F2E7C9' },
  'regimen:iq-1968': { codigo: 'BA', fondo: '#6E7A4B', texto: '#F2E7C9' },
  'regimen:jp-1931': { codigo: 'IM', fondo: '#4F5B3A', texto: '#F2E7C9' },
  'regimen:ir-1979': { codigo: 'RI', fondo: '#39705C', texto: '#F2E7C9' },
  'regimen:kr-1961': { codigo: 'SK', fondo: '#6E6A8C', texto: '#F2E7C9' }
};

export function marcaDe(clave, indice = 0) {
  if (MARCA_REGIMEN[clave]) return MARCA_REGIMEN[clave];
  const reserva = ['#2B2E33', '#B0472F', '#3E7A86', '#C79A3A', '#6E6A8C', '#7C8B5A'];
  return {
    codigo: String(indice + 1).padStart(2, '0'),
    fondo: reserva[indice % reserva.length],
    texto: '#F2E7C9'
  };
}