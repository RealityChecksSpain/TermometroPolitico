import { db } from './supabase';

export async function refrescarMetricas(): Promise<boolean> {
  const { error } = await db().rpc('refrescar_metricas');
  if (error) {
    console.error('\n  REFRESCO FALLIDO. La web sigue enseñando los datos anteriores.');
    console.error(`  ${error.message}`);
    console.error('  Las vistas materializadas se refrescan en una sola transaccion:');
    console.error('  si una falla, no se actualiza ninguna.\n');
    return false;
  }
  console.log('  metricas refrescadas');
  return true;
}
