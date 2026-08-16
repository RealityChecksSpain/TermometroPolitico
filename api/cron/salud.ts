import { db } from '../../src/lib/supabase';

export default async function handler(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('No autorizado', { status: 401 });
  }

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
        from: 'Escano <alertas@resend.dev>',
        to: process.env.ALERTA_EMAIL,
        subject: `Escano: ${pendientes.length} fuente(s) sin actualizar`,
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
