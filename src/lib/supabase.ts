import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

export function exigirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${nombre}.\n` +
      `  Local: revisa el fichero .env en la raiz del proyecto.\n` +
      `  Vercel: Settings > Environment Variables.\n` +
      `  Comprueba el estado con: npm run preflight`
    );
  }
  return valor.trim();
}

export function db(): SupabaseClient {
  if (cliente) return cliente;
  cliente = createClient(
    exigirEnv('SUPABASE_URL'),
    exigirEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
  return cliente;
}
