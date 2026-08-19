import { exigirEnv } from './supabase';

export interface LimitesTier {
  rpm: number;
  rpd: number;
}

export const LIMITES: Record<string, LimitesTier> = {
  'gemini-flash-latest': { rpm: 15, rpd: 1500 },
  'gemini-flash-lite-latest': { rpm: 30, rpd: 1500 },
  'gemini-3-flash-preview': { rpm: 15, rpd: 1500 },
  'gemini-3.1-flash-lite': { rpm: 30, rpd: 1500 },
  'gemini-3.1-flash-lite-preview': { rpm: 30, rpd: 1500 }
};

export function limitesDe(modelo: string): LimitesTier {
  if (LIMITES[modelo]) return LIMITES[modelo];
  if (/flash-lite/.test(modelo)) return { rpm: 30, rpd: 1500 };
  if (/flash/.test(modelo)) return { rpm: 15, rpd: 1500 };
  return { rpm: 5, rpd: 50 };
}

export function modelosDisponibles(): string[] {
  const lista = (process.env.MODELO_IA ?? 'gemini-flash-lite-latest')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return lista.length ? lista : ['gemini-flash-lite-latest'];
}

export function modeloActivo(): string {
  return modelosDisponibles()[0];
}

export class Cadencia {
  private ultima = 0;
  private hoy = 0;
  private seguidos429 = 0;
  private agotados = new Set<string>();
  private readonly intervaloMs: number;
  private readonly rpd: number;

  constructor(modelo: string, margen = 1.15) {
    const l = limitesDe(modelo);
    this.intervaloMs = Math.ceil((60_000 / l.rpm) * margen);
    this.rpd = l.rpd;
  }

  get consumidasHoy() {
    return this.hoy;
  }

  get quedanHoy() {
    return this.rpd - this.hoy;
  }

  agotado() {
    return this.hoy >= this.rpd;
  }

  marcarAgotado(modelo: string) {
    this.agotados.add(modelo);
    return this.agotados.size;
  }

  estaAgotado(modelo: string) {
    return this.agotados.has(modelo);
  }

  get modelosAgotados() {
    return Array.from(this.agotados);
  }

  todosAgotados(modelos: string[]) {
    return modelos.every(m => this.agotados.has(m));
  }

  registrar429() {
    this.seguidos429++;
    return this.seguidos429;
  }

  registrarExito() {
    this.seguidos429 = 0;
  }

  get bloqueada() {
    return false;
  }

  async esperar() {
    const ahora = Date.now();
    const espera = this.intervaloMs - (ahora - this.ultima);
    if (espera > 0) await new Promise(r => setTimeout(r, espera));
    this.ultima = Date.now();
    this.hoy++;
  }
}

export class CuotaDiariaAgotada extends Error {
  constructor(rpd: number) {
    super(
      rpd > 0
        ? `Cuota diaria agotada (${rpd} peticiones). Reanuda manana; el progreso esta guardado.`
        : 'Todos los modelos de la cadena han agotado su cuota diaria. ' +
          'Anade mas modelos a MODELO_IA o reanuda manana; el progreso esta guardado.'
    );
    this.name = 'CuotaDiariaAgotada';
  }
}

export interface RespuestaGemini<T> {
  ok: boolean;
  datos: T | null;
  bruto: string;
  error?: string;
  tokensEntrada?: number;
  tokensSalida?: number;
}

export async function preguntar<T>(
  prompt: string,
  cadencia: Cadencia,
  opciones: { esquema?: object; reintentos?: number; temperatura?: number } = {}
): Promise<RespuestaGemini<T>> {
  const { esquema, reintentos = 2, temperatura = 0 } = opciones;
  const clave = exigirEnv('GEMINI_API_KEY');
  const modelos = modelosDisponibles();

  let ultimoError = '';

  if (cadencia.todosAgotados(modelos)) {
    throw new CuotaDiariaAgotada(0);
  }

  for (const modelo of modelos) {
    if (cadencia.estaAgotado(modelo)) continue;

    for (let intento = 0; intento < reintentos; intento++) {
      await cadencia.esperar();

      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: temperatura,
                maxOutputTokens: Number(process.env.MAX_TOKENS_IA ?? 4096),
                responseMimeType: 'application/json',
                ...(process.env.NIVEL_RAZONAMIENTO
                  ? { thinkingConfig: { thinkingLevel: process.env.NIVEL_RAZONAMIENTO } }
                  : {}),
                ...(esquema && process.env.SIN_ESQUEMA !== 'true' ? { responseSchema: esquema } : {})
              }
            })
          }
        );
      } catch (e) {
        ultimoError = `${modelo}: ${e}`;
        await new Promise(r => setTimeout(r, 2000 * (intento + 1)));
        continue;
      }

      if (res.status === 404 || res.status === 400) {
        ultimoError = `${modelo}: HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`;
        break;
      }

      if (res.status === 429) {
        const cuerpo = await res.text();
        let detalle = '';
        let porMinuto = false;
        let esperaSeg = 20;

        try {
          const j = JSON.parse(cuerpo);
          const violaciones = (j.error?.details ?? []).flatMap((d: any) => d.violations ?? []);
          const ids = violaciones.map((v: any) => String(v.quotaId ?? ''));
          detalle = ids.join(', ') || String(j.error?.message ?? '').slice(0, 90);
          porMinuto = ids.some((i: string) => /PerMinute/i.test(i)) && !ids.some((i: string) => /PerDay/i.test(i));

          const retry = (j.error?.details ?? []).find((d: any) => String(d['@type'] ?? '').includes('RetryInfo'));
          if (retry?.retryDelay) {
            const seg = parseFloat(String(retry.retryDelay).replace('s', ''));
            if (Number.isFinite(seg)) esperaSeg = Math.min(Math.max(seg + 1, 2), 90);
          }
        } catch {
          detalle = cuerpo.slice(0, 90);
        }

        if (porMinuto) {
          ultimoError = `${modelo}: limite por minuto, esperando ${esperaSeg}s`;
          await new Promise(r => setTimeout(r, esperaSeg * 1000));
          continue;
        }

        const n = cadencia.marcarAgotado(modelo);
        ultimoError = `${modelo}: cuota diaria agotada [${detalle}]. Modelos agotados: ${n}/${modelos.length}`;
        console.log(`  · ${modelo} sin cuota diaria, pasando al siguiente modelo`);

        if (cadencia.todosAgotados(modelos)) {
          throw new CuotaDiariaAgotada(0);
        }
        break;
      }

      if (res.status === 503) {
        ultimoError = `${modelo}: saturado (503)`;
        break;
      }

      if (!res.ok) {
        ultimoError = `${modelo}: HTTP ${res.status}`;
        await new Promise(r => setTimeout(r, 3000 * (intento + 1)));
        continue;
      }

      const cuerpo = await res.json();
      const candidato = cuerpo.candidates?.[0];
      const bruto = (candidato?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');

      if (!bruto) {
        ultimoError =
          `${modelo}: respuesta vacia, finishReason=${candidato?.finishReason ?? '?'}` +
          (candidato?.finishReason === 'MAX_TOKENS' ? ' — sube MAX_TOKENS_IA' : '') +
          (cuerpo.promptFeedback?.blockReason ? ` bloqueado=${cuerpo.promptFeedback.blockReason}` : '');
        continue;
      }

      try {
        const datos = JSON.parse(bruto.replace(/```json|```/g, '').trim()) as T;
        cadencia.registrarExito();
        return {
          ok: true,
          datos,
          bruto,
          tokensEntrada: cuerpo.usageMetadata?.promptTokenCount,
          tokensSalida: cuerpo.usageMetadata?.candidatesTokenCount
        };
      } catch {
        ultimoError = `${modelo}: respuesta no es JSON valido`;
      }
    }
  }

  return { ok: false, datos: null, bruto: '', error: ultimoError };
}

export interface Progreso {
  procesados: number;
  omitidos: number;
  fallidos: number;
  cuotaAgotada: boolean;
}

export async function procesarLote<E, S>(
  elementos: E[],
  tarea: (elemento: E, cadencia: Cadencia) => Promise<S | null>,
  opciones: { alProgreso?: (i: number, total: number, e: E, ok: boolean) => void } = {}
): Promise<Progreso> {
  const cadencia = new Cadencia(modeloActivo());
  const progreso: Progreso = { procesados: 0, omitidos: 0, fallidos: 0, cuotaAgotada: false };

  for (let i = 0; i < elementos.length; i++) {
    try {
      const r = await tarea(elementos[i], cadencia);
      if (r === null) progreso.fallidos++;
      else progreso.procesados++;
      opciones.alProgreso?.(i + 1, elementos.length, elementos[i], r !== null);
    } catch (e) {
      if (e instanceof CuotaDiariaAgotada) {
        progreso.cuotaAgotada = true;
        progreso.omitidos = elementos.length - i;
        break;
      }
      progreso.fallidos++;
      if (progreso.fallidos <= 3) console.error(`  fallo en ${i}: ${e}`);
    }
  }

  return progreso;
}