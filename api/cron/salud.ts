import { db } from '../../src/lib/supabase.js';
import { autorizadoPorCron, responder, responderTexto } from '../../src/lib/autorizar.js';

export const config = { maxDuration: 30 };

const REMITENTE = 'Lente Democratica <alertas@resend.dev>';
const HORAS_CACHE = 30;

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

async function cachesSinRefrescar(): Promise<string[]> {
  try {
    const { data, error } = await db().rpc('estado_caches');
    if (error) {
      if (error.code === 'PGRST202') return [];
      console.error('cron/salud estado_caches', error.message);
      return [`estado_caches: ${plano(error.message)}`];
    }
    const caches = ((data as any)?.caches ?? {}) as Record<string, any>;
    return Object.entries(caches)
      .filter(([, c]) => c?.existe !== false && (c?.error || c?.horas == null || Number(c.horas) > HORAS_CACHE))
      .map(([mv, c]) => `${mv}: ${c?.error ? plano(c.error) : `sin refrescar desde hace ${c?.horas ?? '?'} horas`}`);
  } catch (e) {
    console.error('cron/salud estado_caches', e);
    return [];
  }
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

export default async function handler(req: any, res?: any): Promise<Response | undefined> {
  if (!autorizadoPorCron(req)) return responderTexto(res, 'No autorizado', 401);

  const conCorreo = Boolean(process.env.RESEND_API_KEY && process.env.ALERTA_EMAIL);

  try {
    const [caidos, cobertura, viejas] = await Promise.all([leer('v_etl_caido'), leer('mv_cobertura'), cachesSinRefrescar()]);
    const rotos = [caidos, cobertura].filter(l => !l.ok);

    let avisoCaches: string | null = null;
    if (viejas.length) {
      console.error(`cron/salud: ${viejas.length} cache(s) de la web sin refrescar`);
      if (conCorreo) {
        avisoCaches = await enviar(
          `Lente Democratica: ${viejas.length} cache(s) de la web sin refrescar`,
          `${viejas.join('\n')}\n\nLa web sigue enseñando los datos de la ultima vez que se refrescaron. Prueba con: npm run refrescar`
        );
      }
    }
    const caches = { cachesSinRefrescar: viejas, ...(avisoCaches ? { avisoCaches } : {}) };

    if (rotos.length > 0) {
      const detalle = rotos.map(l => `${l.objeto}: ${plano(l.error)}`).join('\n');
      if (conCorreo) {
        await enviar(
          `Lente Democratica: la comprobacion de salud no puede leer ${rotos.length} objeto(s)`,
          `${detalle}\n\nLa vigilancia diaria esta ciega hasta que se arregle esto.`
        );
      }
      return responder(res, {
          ok: false,
          error: 'la comprobacion de salud no puede leer sus propias fuentes',
          rotos: rotos.map(l => ({ objeto: l.objeto, error: plano(l.error) })),
          correo: conCorreo ? 'configurado' : 'sin configurar',
          ...caches
        }, 500);
    }

    const pendientes = caidos.filas.filter(c => !c.notificado_at);

    if (pendientes.length === 0) {
      return responder(res, {
        ok: true,
        caidos: caidos.filas,
        cobertura: cobertura.filas,
        pendientes: 0,
        notificados: 0,
        correo: conCorreo ? 'configurado' : 'sin configurar',
        ...caches
      });
    }

    const resumen = pendientes
      .map(c => `${plano(c.camara)} / ${plano(c.recurso)}: ${plano(c.dias_sin_exito ?? 'nunca')} dias sin ingesta correcta`)
      .join('\n');

    if (!conCorreo) {
      console.error(`cron/salud: ${pendientes.length} aviso(s) pendientes y ningun canal de correo`);
      return responder(res, {
        ok: false,
        error: 'hay fuentes caidas y no hay canal para avisar',
        pendientes: pendientes.length,
        detalle: resumen.split('\n'),
        correo: 'sin configurar',
        ...caches
      }, 500);
    }

    const falloEnvio = await enviar(
      `Lente Democratica: ${pendientes.length} fuente(s) sin actualizar`,
      `${resumen}\n\nRevisa el parser: es probable que el Congreso haya cambiado el formato.`
    );

    if (falloEnvio) {
      return responder(res, {
          ok: false,
          error: 'hay fuentes caidas y el aviso no ha salido',
          pendientes: pendientes.length,
          detalle: resumen.split('\n'),
          envio: falloEnvio,
          ...caches
        }, 500);
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

    return responder(res, {
      ok: true,
      caidos: caidos.filas,
      cobertura: cobertura.filas,
      pendientes: pendientes.length,
      notificados,
      correo: 'configurado',
      ...caches
    });
  } catch (e) {
    console.error('cron/salud', e);
    return responder(res, { ok: false, error: 'fallo en la comprobacion de salud' }, 500);
  }
}