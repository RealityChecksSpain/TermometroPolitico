import { db } from '../../src/lib/supabase';

export const config = { maxDuration: 30 };

const REMITENTE = 'Lente Democratica <alertas@resend.dev>';

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

  const { data: caidos } = await db().from('v_etl_caido').select('*');
  const { data: cobertura } = await db().from('v_cobertura_datos').select('*');

  const pendientes = (caidos ?? []).filter(c => !c.notificado_at);

  if (pendientes.length > 0 && process.env.RESEND_API_KEY && process.env.ALERTA_EMAIL) {
    const cuerpo = pendientes
      .map(c => `${c.camara} / ${c.recurso}: ${c.dias_sin_exito ?? 'nunca'} dias sin ingesta correcta`)
      .join('\n');

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: process.env.ALERTA_EMAIL,
        subject: `Lente Democratica: ${pendientes.length} fuente(s) sin actualizar`,
        text: `${cuerpo}\n\nRevisa el parser: es probable que el Congreso haya cambiado el formato.`
      })
    });

    await db()
      .from('etl_salud')
      .update({ notificado_at: new Date().toISOString() })
      .in('id', pendientes.map(c => c.id));
  }

  return Response.json({ caidos: caidos ?? [], cobertura: cobertura ?? [], notificados: pendientes.length });
}
