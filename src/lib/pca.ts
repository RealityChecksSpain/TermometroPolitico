export interface MatrizVotos {
  filas: string[];
  columnas: string[];
  datos: Float64Array;
  presentes: Uint8Array;
}

export interface ResultadoPca {
  componentes: { valores: Float64Array; varianzaExplicada: number }[];
  filas: string[];
  votosPorFila: Int32Array;
}

function centrarPorColumna(m: MatrizVotos): Float64Array {
  const n = m.filas.length;
  const p = m.columnas.length;
  const x = new Float64Array(n * p);

  for (let j = 0; j < p; j++) {
    let suma = 0;
    let cuenta = 0;
    for (let i = 0; i < n; i++) {
      if (m.presentes[i * p + j]) {
        suma += m.datos[i * p + j];
        cuenta++;
      }
    }
    const media = cuenta > 0 ? suma / cuenta : 0;
    for (let i = 0; i < n; i++) {
      x[i * p + j] = m.presentes[i * p + j] ? m.datos[i * p + j] - media : 0;
    }
  }
  return x;
}

function gram(x: Float64Array, n: number, p: number): Float64Array {
  const g = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    const oi = i * p;
    for (let k = i; k < n; k++) {
      const ok = k * p;
      let s = 0;
      for (let j = 0; j < p; j++) s += x[oi + j] * x[ok + j];
      g[i * n + k] = s;
      g[k * n + i] = s;
    }
  }
  return g;
}

function multiplicar(g: Float64Array, v: Float64Array, n: number): Float64Array<ArrayBuffer> {
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const o = i * n;
    for (let j = 0; j < n; j++) s += g[o + j] * v[j];
    r[i] = s;
  }
  return r;
}

function normalizar(v: Float64Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const norma = Math.sqrt(s);
  if (norma > 0) for (let i = 0; i < v.length; i++) v[i] /= norma;
  return norma;
}

function deflactar(g: Float64Array, v: Float64Array, lambda: number, n: number) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g[i * n + j] -= lambda * v[i] * v[j];
    }
  }
}

export function pca(m: MatrizVotos, componentes = 2, iteraciones = 300): ResultadoPca {
  const n = m.filas.length;
  const p = m.columnas.length;

  const x = centrarPorColumna(m);
  const g = gram(x, n, p);

  let trazaTotal = 0;
  for (let i = 0; i < n; i++) trazaTotal += g[i * n + i];

  const votosPorFila = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let j = 0; j < p; j++) if (m.presentes[i * p + j]) c++;
    votosPorFila[i] = c;
  }

  const salida: ResultadoPca['componentes'] = [];
  let semilla = 12345;
  const aleatorio = () => {
    semilla = (semilla * 1664525 + 1013904223) % 4294967296;
    return semilla / 4294967296 - 0.5;
  };

  for (let c = 0; c < componentes; c++) {
    let v: Float64Array<ArrayBuffer> = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = aleatorio();
    normalizar(v);

    let lambda = 0;
    for (let it = 0; it < iteraciones; it++) {
      const w = multiplicar(g, v, n);
      const norma = normalizar(w);
      let delta = 0;
      for (let i = 0; i < n; i++) delta += Math.abs(w[i] - v[i]);
      v = w;
      lambda = norma;
      if (delta < 1e-10) break;
    }

    const puntuaciones = new Float64Array(n);
    const escala = Math.sqrt(Math.max(lambda, 0));
    for (let i = 0; i < n; i++) puntuaciones[i] = v[i] * escala;

    salida.push({
      valores: puntuaciones,
      varianzaExplicada: trazaTotal > 0 ? lambda / trazaTotal : 0
    });

    deflactar(g, v, lambda, n);
  }

  return { componentes: salida, filas: m.filas, votosPorFila };
}

export function escalarA(valores: Float64Array, min = -1, max = 1): Float64Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of valores) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const rango = hi - lo;
  const salida = new Float64Array(valores.length);
  for (let i = 0; i < valores.length; i++) {
    salida[i] = rango === 0 ? 0 : min + ((valores[i] - lo) / rango) * (max - min);
  }
  return salida;
}

export function correlacion(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let dbb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    dbb += y * y;
  }
  const den = Math.sqrt(da * dbb);
  return den === 0 ? 0 : num / den;
}
