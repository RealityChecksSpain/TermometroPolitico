import { ejecutarIngesta } from '../../src/lib/congreso-adapter';
import { vaciarCola } from '../../src/lib/resolver';

export const config = { maxDuration: 60 };

function autorizado(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado || esperado.trim().length < 16) return false;
  const recibido = req.headers.get('authorization') ?? '';
  const esperadoCompleto = `Bearer ${esperado}`;
  if (recibido.length !== esperadoCompleto.length) return false;
  let diferencia = 0;
  for (let i = 0; i < esperadoCompleto.length; i++) {
    diferencia |= recibido.charCodeAt(i) ^ esperadoCompleto.charCodeAt(i);
  }
  return diferencia === 0;
}

export default async function handler(req: Request): Promise<Response> {
  if (!autorizado(req)) return new Response('No autorizado', { status: 401 });

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
    console.error('cron/ingesta', e);
    return Response.json({ ok: false, error: 'fallo en la ingesta' }, { status: 500 });
  }
}
