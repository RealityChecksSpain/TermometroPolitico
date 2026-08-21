/**
 * Normaliza importes de declaraciones (formato ES + erratas de 3 “decimales”).
 * Ej.: 187425535 (leído de «187.425,535») → 187425.54
 */

export function sanearImporte(n) {
  if (n == null || n === '') return null;
  let x = typeof n === 'string' ? parseEuroES(n) : Number(n);
  if (x == null || !Number.isFinite(x)) return null;

  const abs = Math.abs(x);
  // Entero enorme con residuo de 3 dígitos (céntimos mal pegados)
  if (abs >= 5_000_000 && Number.isInteger(x) && (abs % 1000) !== 0) {
    const y = x / 1000;
    if (Math.abs(y) < 5_000_000) x = y;
  }

  return Math.round(x * 100) / 100;
}

export function parseEuroES(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\s/g, '').replace(/€/g, '');
  if (!s || s === '-' || s === '—') return null;

  const neg = /^-/.test(s);
  s = s.replace(/^[+-]/, '');
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma >= 0 && lastComma > lastDot) {
    const enteros = s.slice(0, lastComma).replace(/\./g, '');
    let dec = s.slice(lastComma + 1).replace(/\D/g, '');
    if (dec.length > 2) dec = dec.slice(0, 2);
    const n = Number(`${enteros}.${dec || '0'}`);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }

  if (lastDot >= 0 && lastDot > lastComma) {
    const enteros = s.slice(0, lastDot).replace(/,/g, '');
    let dec = s.slice(lastDot + 1).replace(/\D/g, '');
    if (dec.length > 2) dec = dec.slice(0, 2);
    const n = Number(`${enteros}.${dec || '0'}`);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }

  const n = Number(s.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

const CAMPOS_EURO = [
  'rendimientos_trabajo',
  'rendimientos_capital',
  'rendimientos_actividades',
  'irpf_pagado',
  'depositos',
  'valores',
  'planes_pensiones',
  'prestamos_concedido',
  'deuda_pendiente'
];

export function sanearDeclaracion(d) {
  if (!d) return d;
  const out = { ...d };
  for (const k of CAMPOS_EURO) {
    if (out[k] != null) out[k] = sanearImporte(out[k]);
  }
  return out;
}

export function patrimonioLiquido(d) {
  const parts = [d?.depositos, d?.valores, d?.planes_pensiones]
    .map(v => (v == null ? null : Number(v)))
    .filter(v => v != null && Number.isFinite(v));
  if (!parts.length) return null;
  const activos = parts.reduce((a, b) => a + b, 0);
  const deuda = d?.deuda_pendiente != null ? Number(d.deuda_pendiente) : 0;
  return Math.round((activos - deuda) * 100) / 100;
}

export const UMBRAL = {
  depositosSospechosos: 5_000_000,
  patrimonioAlto: 10_000_000,
  patrimonioBajo: -1_000_000,
  patrimonioAbsurdo: 80_000_000,
  inmueblesAbsurdo: 80
};

export function motivoAnomalia(d) {
  const pat = patrimonioLiquido(d);
  const dep = d?.depositos != null ? Number(d.depositos) : null;
  if (dep != null && dep > UMBRAL.depositosSospechosos) return `depósitos ${dep} > 5M`;
  if (pat != null && pat > UMBRAL.patrimonioAlto) return `patrimonio ${pat} > 10M`;
  if (pat != null && pat < UMBRAL.patrimonioBajo) return `patrimonio ${pat} < -1M`;
  if (pat != null && Math.abs(pat) > UMBRAL.patrimonioAbsurdo) return 'patrimonio absurdo';
  return null;
}
