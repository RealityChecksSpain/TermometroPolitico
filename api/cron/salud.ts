import { db } from '../../src/lib/supabase';
import { autorizadoPorCron, sinCache } from '../../src/lib/autorizar';

export const config = { maxDuration: 30 };

const REMITENTE = 'Lente Democratica <alertas@resend.dev>';

async function avisar(pendientes: any[]): Promise<boolean> {
  const cuerpo = pendientes
    .map(c => `${c.camara} / ${c.recurso}: ${c.dias_sin_exito ?? 'nunca'} dias sin ingesta correcta`)
    .join('\n');

  const r = await fetch('https://api.resend.com/emails', {
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

  if (!r.ok) {
    console.error('cron/salud resend', r.status);
    return false;
  }
  return true;
}

export default async function handler(req: Request): Promise<Response> {
  if (!autorizadoPorCron(req)) return new Response('No autorizado', { status: 401 });

  try {
    const [{ data: caidos, error: eCaidos }, { data: cobertura, error: eCob }] = await Promise.all([
      db().from('v_etl_caido').select('*'),
      db().from('v_cobertura_datos').select('*')
    ]);
    if (eCaidos) console.error('cron/salud v_etl_caido', eCaidos.message);
    if (eCob) console.error('cron/salud v_cobertura_datos', eCob.message);

    const pendientes = (caidos ?? []).filter(c => !c.notificado_at);
    const conCorreo = Boolean(process.env.RESEND_API_KEY && process.env.ALERTA_EMAIL);
    let notificados = 0;

    if (pendientes.length > 0 && conCorreo && (await avisar(pendientes))) {
      const ids = pendientes.map(c => c.id).filter(id => id !== null && id !== undefined);
      if (ids.length !== pendientes.length) {
        console.error('cron/salud: v_etl_caido no expone id en todas las filas');
      }
      if (ids.length) {
        const { error } = await db()
          .from('etl_salud')
          .update({ notificado_at: new Date().toISOString() })
          .in('id', ids);
        if (error) console.error('cron/salud marcar notificado', error.message);
        else notificados = ids.length;
      }
    }

    return sinCache({
      caidos: caidos ?? [],
      cobertura: cobertura ?? [],
      pendientes: pendientes.length,
      notificados,
      correo: conCorreo ? 'configurado' : 'sin configurar'
    });
  } catch (e) {
    console.error('cron/salud', e);
    return sinCache({ ok: false, error: 'fallo en la comprobacion de salud' }, 500);
  }
}
