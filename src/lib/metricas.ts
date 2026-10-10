import { db } from './supabase';

function segundos(desde: number): string {
  return `${((Date.now() - desde) / 1000).toFixed(1)} s`;
}

async function refrescarMetricasDeGolpe(): Promise<boolean> {
  const { error } = await db().rpc('refrescar_metricas');
  if (error) {
    console.error('\n  REFRESCO FALLIDO. La web sigue enseñando los datos anteriores.');
    console.error(`  ${error.message}`);
    console.error('  Corre en el SQL Editor el SQL de esta entrega para refrescar por partes.\n');
    return false;
  }
  console.log('  metricas refrescadas');
  return true;
}

export async function refrescarMetricas(): Promise<boolean> {
  const inicio = Date.now();
  const { data: lista, error } = await db().rpc('orden_metricas');
  let ok: boolean;
  if (error) {
    if (error.code !== 'PGRST202') console.error(`  No se puede leer la lista de metricas (${error.message}). Se refrescan de golpe.`);
    ok = await refrescarMetricasDeGolpe();
  } else {
    const nombres = Array.isArray(lista) ? (lista as string[]) : [];
    const tiempos: [string, number][] = [];
    const fallidas: [string, string][] = [];
    for (const mv of nombres) {
      const t0 = Date.now();
      const { data, error: e } = await db().rpc('refrescar_mv', { p_mv: mv });
      const estado = e ? `error: ${e.message}` : String(data);
      tiempos.push([mv, Date.now() - t0]);
      if (estado !== 'ok') fallidas.push([mv, estado]);
    }
    ok = fallidas.length === 0;
    const lentas = [...tiempos].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([mv, ms]) => `${mv} ${(ms / 1000).toFixed(1)} s`).join(', ');
    console.log(`  metricas refrescadas: ${nombres.length - fallidas.length} de ${nombres.length} en ${segundos(inicio)}${lentas ? ` (las mas lentas: ${lentas})` : ''}`);
    if (fallidas.length) {
      console.error(`\n  ${fallidas.length} metrica(s) sin refrescar. La web sigue con sus datos anteriores:`);
      for (const [mv, estado] of fallidas) console.error(`    ${mv}: ${estado}`);
      console.error('');
    }
  }
  return (await refrescarCaches()) && ok;
}

async function refrescarCachesDeGolpe(): Promise<boolean> {
  const { data, error } = await db().rpc('refrescar_caches');
  if (error) {
    if (error.code === 'PGRST202') return true;
    console.error('\n  CACHE DE LA WEB SIN REFRESCAR. Mapa, Leyes y Hallazgos siguen con los datos anteriores.');
    console.error(`  ${error.message}`);
    console.error('  Vuelve a intentarlo con: npm run refrescar\n');
    return false;
  }
  const fallidas = Object.entries((data ?? {}) as Record<string, string>).filter(([, estado]) => estado !== 'ok');
  if (fallidas.length) {
    console.error(`\n  ${fallidas.length} cache(s) de la web sin refrescar:`);
    for (const [mv, estado] of fallidas) console.error(`    ${mv}: ${estado}`);
    console.error('');
    return false;
  }
  console.log('  cache de la web refrescada');
  return true;
}

export async function refrescarCaches(): Promise<boolean> {
  const inicio = Date.now();
  const { data: filas, error } = await db().from('cache_web').select('mv').order('orden');
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') return true;
    console.error(`\n  No se puede leer la lista de caches (${error.message}).`);
    return false;
  }
  const copias = (filas ?? []).map(f => String((f as { mv: string }).mv));
  const fallidas: [string, string][] = [];
  let hechas = 0;
  for (const mv of copias) {
    const { data, error: e } = await db().rpc('refrescar_cache', { p_mv: mv });
    if (e) {
      if (e.code === 'PGRST202') return refrescarCachesDeGolpe();
      fallidas.push([mv, `error: ${e.message}`]);
      continue;
    }
    const estado = String(data);
    if (estado === 'sin copia') continue;
    if (estado === 'ok') hechas++;
    else fallidas.push([mv, estado]);
  }
  if (fallidas.length) {
    console.error(`\n  ${fallidas.length} cache(s) de la web sin refrescar. La web sigue con sus datos anteriores:`);
    for (const [mv, estado] of fallidas) console.error(`    ${mv}: ${estado}`);
    console.error('  Vuelve a intentarlo con: npm run refrescar\n');
    return false;
  }
  console.log(`  cache de la web refrescada: ${hechas} copias en ${segundos(inicio)}`);
  return true;
}