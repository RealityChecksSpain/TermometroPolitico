import { ejecutarIngesta } from '../../src/lib/congreso-adapter.js';
import { vaciarCola } from '../../src/lib/resolver.js';
import { autorizadoPorCron, sinCache } from '../../src/lib/autorizar.js';

export const config = { maxDuration: 60 };

export default async function handler(req: Request): Promise<Response> {
  if (!autorizadoPorCron(req)) return new Response('No autorizado', { status: 401 });

  const legislaturaId = process.env.LEGISLATURA_ACTIVA_ID;
  if (!legislaturaId) {
    console.error('cron/ingesta: falta LEGISLATURA_ACTIVA_ID');
    return sinCache({ ok: false, error: 'configuracion incompleta' }, 500);
  }

  try {
    const ingesta = await ejecutarIngesta(legislaturaId, 'XV', 10);
    const cola = await vaciarCola(legislaturaId);

    return sinCache({
      ok: true,
      ingesta,
      cola,
      metricas: 'las refresca pg_cron a las 6:30, no este endpoint',
      ejecutado: new Date().toISOString()
    });
  } catch (e) {
    console.error('cron/ingesta', e);
    return sinCache({ ok: false, error: 'fallo en la ingesta' }, 500);
  }
}