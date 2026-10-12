export function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  const nombres = (cab ?? []).map(c => c.replace(/^﻿/, '').trim());
  return resto.filter(f => f.length > 1).map(f => Object.fromEntries(nombres.map((n, k) => [n, (f[k] ?? '').trim()])));
}

export function fechaIso(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function legislaturaDe(v: string): number | null {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;
  const romanos: Record<string, number> = { I: 1, V: 5, X: 10 };
  const r = v.trim().toUpperCase();
  if (!/^[IVX]+$/.test(r)) return null;
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const a = romanos[r[i]], b = romanos[r[i + 1]] ?? 0;
    total += a < b ? -a : a;
  }
  return total;
}
