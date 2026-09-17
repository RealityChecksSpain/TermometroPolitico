import { db } from '../../src/lib/supabase.js';
import { autorizadoPorCron, sinCache } from '../../src/lib/autorizar.js';

export const config = { maxDuration: 30 };

const REMITENTE = 'Lente Democratica <alertas@resend.dev>';

interface Lectura {
  objeto: string;
  ok: boolean;
  error: string | null;
  filas: any[];
}

function plano(v: unknown): string {
  return String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200);
}

async function leer(objeto: string): Promise<Lectura> {
  const { data, error } = await db().from(objeto).select('*');
  if (error) {
    console.error(`cron/salud ${objeto}`, error.message);
    return { objeto, ok: false, error: error.message, filas: [] };
  }
  return { objeto, ok: true, error: null, filas: data ?? [] };
}

async function enviar(asunto: string, texto: string): Promise<string | null> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: process.env.ALERTA_EMAIL,
      subject: asunto,
      text: texto
    })
  });
  if (!r.ok) {
    const cuerpo = (await r.text()).slice(0, 200).replace(/\s+/g, ' ');
    console.error(`cron/salud resend ${r.status} ${cuerpo}`);
    return `resend ${r.status}: ${cuerpo}`;
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (!autorizadoPorCron(req)) return new Response('No autorizado', { status: 401 });

  const conCorreo = Boolean(process.env.RESEND_API_KEY && process.env.ALERTA_EMAIL);

  try {
    const [caidos, cobertura] = await Promise.all([leer('v_etl_caido'), leer('mv_cobertura')]);
    const rotos = [caidos, cobertura].filter(l => !l.ok);

    if (rotos.length > 0) {
      const detalle = rotos.map(l => `${l.objeto}: ${plano(l.error)}`).join('\n');
      if (conCorreo) {
        await enviar(
          `Lente Democratica: la comprobacion de salud no puede leer ${rotos.length} objeto(s)`,
          `${detalle}\n\nLa vigilancia diaria esta ciega hasta que se arregle esto.`
        );
      }
      return sinCache(
        {
          ok: false,
          error: 'la comprobacion de salud no puede leer sus propias fuentes',
          rotos: rotos.map(l => ({ objeto: l.objeto, error: plano(l.error) })),
          correo: conCorreo ? 'configurado' : 'sin configurar'
        },
        500
      );
    }

    const pendientes = caidos.filas.filter(c => !c.notificado_at);

    if (pendientes.length === 0) {
      return sinCache({
        ok: true,
        caidos: caidos.filas,
        cobertura: cobertura.filas,
        pendientes: 0,
        notificados: 0,
        correo: conCorreo ? 'configurado' : 'sin configurar'
      });
    }

    const resumen = pendientes
      .map(c => `${plano(c.camara)} / ${plano(c.recurso)}: ${plano(c.dias_sin_exito ?? 'nunca')} dias sin ingesta correcta`)
      .join('\n');

    if (!conCorreo) {
      console.error(`cron/salud: ${pendientes.length} aviso(s) pendientes y ningun canal de correo`);
      return sinCache(
        {
          ok: false,
          error: 'hay fuentes caidas y no hay canal para avisar',
          pendientes: pendientes.length,
          detalle: resumen.split('\n'),
          correo: 'sin configurar'
        },
        500
      );
    }

    const falloEnvio = await enviar(
      `Lente Democratica: ${pendientes.length} fuente(s) sin actualizar`,
      `${resumen}\n\nRevisa el parser: es probable que el Congreso haya cambiado el formato.`
    );

    if (falloEnvio) {
      return sinCache(
        {
          ok: false,
          error: 'hay fuentes caidas y el aviso no ha salido',
          pendientes: pendientes.length,
          detalle: resumen.split('\n'),
          envio: falloEnvio
        },
        500
      );
    }

    const ids = pendientes.map(c => c.id).filter(id => id !== null && id !== undefined);
    if (ids.length !== pendientes.length) {
      console.error('cron/salud: v_etl_caido no expone id en todas las filas');
    }

    let notificados = 0;
    if (ids.length) {
      const { error } = await db()
        .from('etl_salud')
        .update({ notificado_at: new Date().toISOString() })
        .in('id', ids);
      if (error) console.error('cron/salud marcar notificado', error.message);
      else notificados = ids.length;
    }

    return sinCache({
      ok: true,
      caidos: caidos.filas,
      cobertura: cobertura.filas,
      pendientes: pendientes.length,
      notificados,
      correo: 'configurado'
    });
  } catch (e) {
    console.error('cron/salud', e);
    return sinCache({ ok: false, error: 'fallo en la comprobacion de salud' }, 500);
  }
}