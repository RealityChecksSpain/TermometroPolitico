import { ejecutarIngesta } from '../../src/lib/congreso-adapter';
import { vaciarCola } from '../../src/lib/resolver';

export const config = { maxDuration: 60 };

export default async function handler(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('No autorizado', { status: 401 });
  }

  const legislaturaId = process.env.LEGISLATURA_ACTIVA_ID;
  if (!legislaturaId) {
    return Response.json({ error: 'Falta LEGISLATURA_ACTIVA_ID' }, { status: 500 });
  }

  try {
    const ingesta = await ejecutarIngesta(legislaturaId, 'XV', 10);
    const cola = await vaciarCola(legislaturaId);

    const { db } = await import('../../src/lib/supabase');
    await db().rpc('refrescar_metricas');

    return Response.json({
      ok: true,
      ingesta,
      cola,
      ejecutado: new Date().toISOString()
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}