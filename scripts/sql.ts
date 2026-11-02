import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const archivo = process.argv.slice(2).find(a => !a.startsWith('--'));
const url = process.env.DATABASE_URL;

async function main() {
  if (!archivo) throw new Error('Uso: npm run sql -- ruta\\al\\archivo.sql');
  if (!url) throw new Error('Falta DATABASE_URL en el .env (cadena de conexión «Session pooler» de Supabase)');
  const texto = await readFile(resolve(archivo), 'utf8');
  const cliente = new pg.Client({ connectionString: url, ssl: /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined });
  cliente.on('notice', n => console.log(`  aviso: ${n.message}`));
  await cliente.connect();
  const inicio = Date.now();
  console.log(`\nEjecutando ${archivo} en una sola transacción…`);
  try {
    await cliente.query('set statement_timeout = 0');
    const res = await cliente.query(texto);
    const ultima = Array.isArray(res) ? [...res].reverse().find(r => r.rows?.length) : res;
    console.log(`\nHecho en ${Math.round((Date.now() - inicio) / 1000)} s.`);
    if (ultima?.rows?.length) console.table(ultima.rows);
  } finally {
    await cliente.end();
  }
}

main().catch(e => {
  console.error(`\nERROR: ${(e as Error).message}\nNo se ha cambiado nada: la transacción se deshizo entera.\n`);
  process.exit(1);
});
