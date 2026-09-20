const MINIMO_SECRETO = 16;

export function cabecera(req: any, nombre: string): string {
  const h = req?.headers;
  if (!h) return '';
  if (typeof h.get === 'function') return h.get(nombre) ?? '';
  const clave = String(nombre).toLowerCase();
  const valor = h[clave] ?? h[nombre];
  if (Array.isArray(valor)) return valor[0] ?? '';
  return valor == null ? '' : String(valor);
}

export function metodo(req: any): string {
  return String(req?.method ?? 'GET').toUpperCase();
}

export async function cuerpoTexto(req: any, limite = 1_000_000): Promise<string> {
  if (typeof req?.text === 'function') return await req.text();
  if (typeof req?.body === 'string') return req.body;
  if (req?.body && typeof req.body === 'object') return JSON.stringify(req.body);
  if (typeof req?.on !== 'function') return '';
  return await new Promise<string>((resolver, rechazar) => {
    let datos = '';
    req.setEncoding?.('utf8');
    req.on('data', (trozo: string) => {
      datos += trozo;
      if (datos.length > limite) {
        datos = datos.slice(0, limite);
        req.destroy?.();
      }
    });
    req.on('end', () => resolver(datos));
    req.on('error', rechazar);
  });
}

export function autorizadoPorCron(req: any): boolean {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado || esperado.length < MINIMO_SECRETO) {
    console.error('autorizadoPorCron: CRON_SECRET ausente o de menos de 16 caracteres');
    return false;
  }
  const recibido = cabecera(req, 'authorization');
  const completo = `Bearer ${esperado}`;
  if (recibido.length !== completo.length) {
    console.error(`autorizadoPorCron: cabecera authorization ${recibido ? 'con longitud distinta a la esperada' : 'ausente'}`);
    return false;
  }
  let diferencia = 0;
  for (let i = 0; i < completo.length; i++) {
    diferencia |= recibido.charCodeAt(i) ^ completo.charCodeAt(i);
  }
  if (diferencia !== 0) console.error('autorizadoPorCron: el secreto recibido no coincide');
  return diferencia === 0;
}

export function sinCache(datos: unknown, estado = 200): Response {
  return Response.json(datos, {
    status: estado,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

export function responder(res: any, datos: unknown, estado = 200): Response | undefined {
  if (res && typeof res.setHeader === 'function') {
    res.statusCode = estado;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(JSON.stringify(datos));
    return undefined;
  }
  return sinCache(datos, estado);
}

export function responderTexto(res: any, texto: string, estado = 200): Response | undefined {
  if (res && typeof res.setHeader === 'function') {
    res.statusCode = estado;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(texto);
    return undefined;
  }
  return new Response(texto, {
    status: estado,
    headers: { 'cache-control': 'no-store' }
  });
}