const MINIMO_SECRETO = 16;

export function autorizadoPorCron(req: Request): boolean {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado || esperado.length < MINIMO_SECRETO) return false;
  const recibido = req.headers.get('authorization') ?? '';
  const completo = `Bearer ${esperado}`;
  if (recibido.length !== completo.length) return false;
  let diferencia = 0;
  for (let i = 0; i < completo.length; i++) {
    diferencia |= recibido.charCodeAt(i) ^ completo.charCodeAt(i);
  }
  return diferencia === 0;
}

export function sinCache(datos: unknown, estado = 200): Response {
  return Response.json(datos, {
    status: estado,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}
