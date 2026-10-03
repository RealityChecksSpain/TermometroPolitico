import { db } from './supabase';

export async function refrescarMetricas(): Promise<boolean> {
  const { error } = await db().rpc('refrescar_metricas');
  let ok = true;
  if (error) {
    console.error('\n  REFRESCO FALLIDO. La web sigue enseñando los datos anteriores.');
    console.error(`  ${error.message}`);
    console.error('  Las vistas materializadas se refrescan en una sola transaccion:');
    console.error('  si una falla, no se actualiza ninguna.\n');
    ok = false;
  } else {
    console.log('  metricas refrescadas');
  }
  return (await refrescarCaches()) && ok;
}

export async function refrescarCaches(): Promise<boolean> {
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
