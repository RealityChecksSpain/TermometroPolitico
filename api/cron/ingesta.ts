import { ejecutarIngesta } from '../../src/lib/congreso-adapter.js';
import { vaciarCola } from '../../src/lib/resolver.js';
import { autorizadoPorCron, sinCache } from '../../src/lib/autorizar.js';

export const config = { maxDuration: 60 };

const PRESUPUESTO_MS = 52_000;
const PLAZO_INGESTA_MS = 36_000;
const MINIMO_COLA_MS = 6_000;

export default async function handler(req: Request): Promise<Response> {
  if (!autorizadoPorCron(req)) return new Response('No autorizado', { status: 401 });

  const legislaturaId = process.env.LEGISLATURA_ACTIVA_ID;
  if (!legislaturaId) {
    console.error('cron/ingesta: falta LEGISLATURA_ACTIVA_ID');
    return sinCache({ ok: false, error: 'configuracion incompleta' }, 500);
  }

  const arranque = Date.now();

  try {
    const ingesta = await ejecutarIngesta(legislaturaId, 'XV', 10, { plazoMs: PLAZO_INGESTA_MS });
    const restante = PRESUPUESTO_MS - (Date.now() - arranque);
    const cola = restante > MINIMO_COLA_MS
      ? await vaciarCola(legislaturaId, { msMaximo: restante - 2000 })
      : null;

    const cuerpo = {
      ok: ingesta.estado === 'ok',
      ingesta,
      cola,
      colaOmitida: cola === null ? 'sin tiempo en esta ejecucion' : null,
      metricas: 'las refresca pg_cron a las 6:30, no este endpoint',
      segundos: Math.round((Date.now() - arranque) / 1000),
      ejecutado: new Date().toISOString()
    };

    if (ingesta.estado === 'error') {
      console.error('cron/ingesta', JSON.stringify(ingesta.errores.slice(0, 5)));
      return sinCache(cuerpo, 500);
    }
    if (ingesta.estado === 'parcial') {
      console.error('cron/ingesta parcial', JSON.stringify(ingesta.errores.slice(0, 5)));
    }
    return sinCache(cuerpo);
  } catch (e) {
    console.error('cron/ingesta', e);
    return sinCache({ ok: false, error: 'fallo en la ingesta', segundos: Math.round((Date.now() - arranque) / 1000) }, 500);
  }
}