const REQUERIDAS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LEGISLATURA_ACTIVA_ID'
];

const OPCIONALES = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'PROVEEDOR_IA',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'ALERTA_EMAIL'
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let fallos = 0;

function comprobar(nombre: string, obligatoria: boolean) {
  const v = process.env[nombre];
  if (!v || v.trim() === '') {
    console.log(`  ${obligatoria ? 'FALTA   ' : 'ausente '} ${nombre}`);
    if (obligatoria) fallos++;
    return null;
  }
  console.log(`  OK       ${nombre}  (${v.length} car.)`);
  return v.trim();
}

console.log('\nVARIABLES OBLIGATORIAS');
REQUERIDAS.forEach(n => comprobar(n, true));

console.log('\nVARIABLES OPCIONALES');
OPCIONALES.forEach(n => comprobar(n, false));

console.log('\nFORMATO');
const url = process.env.SUPABASE_URL?.trim();
if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  console.log(`  AVISO    SUPABASE_URL no parece una URL de Supabase: ${url}`);
  console.log('           Formato esperado: https://xxxxxxxx.supabase.co');
  fallos++;
} else if (url) {
  console.log('  OK       SUPABASE_URL con formato valido');
}

const leg = process.env.LEGISLATURA_ACTIVA_ID?.trim();
if (leg && !UUID.test(leg)) {
  console.log('  AVISO    LEGISLATURA_ACTIVA_ID no es un UUID completo');
  console.log('           Debe tener 36 caracteres con guiones');
  fallos++;
} else if (leg) {
  console.log('  OK       LEGISLATURA_ACTIVA_ID con formato UUID');
}

const secret = process.env.CRON_SECRET?.trim();
if (secret && secret.length !== 64) {
  console.log(`  AVISO    CRON_SECRET tiene ${secret.length} caracteres, se esperan 64`);
}

console.log('\nRESOLUCION DE NOMBRES');
const tieneIa = !!(process.env.ANTHROPIC_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
const forzado = process.env.PROVEEDOR_IA?.trim().toLowerCase();
if (forzado === 'ninguno') {
  console.log('  MODO     solo trigramas (PROVEEDOR_IA=ninguno)');
} else if (tieneIa) {
  const cual = forzado ?? (process.env.ANTHROPIC_API_KEY?.trim() ? 'anthropic' : 'gemini');
  console.log(`  MODO     trigramas + desempate por IA (${cual})`);
} else {
  console.log('  MODO     solo trigramas (sin clave de IA)');
  console.log('           Lo no resuelto ira a cola_revision. Es un arranque valido.');
}

console.log('\nCONEXION');
if (fallos === 0) {
  const { db } = await import('../src/lib/supabase');
  const { data, error } = await db().from('legislaturas').select('numero, activa');
  if (error) {
    console.log(`  FALLO    ${error.message}`);
    console.log('           Has corrido sql/TODO_EN_UNO.sql en el SQL Editor?');
    fallos++;
  } else {
    console.log(`  OK       ${data?.length ?? 0} legislatura(s) en la base de datos`);
    data?.forEach(l => console.log(`             ${l.numero}${l.activa ? ' (activa)' : ''}`));
  }
} else {
  console.log('  omitida  faltan variables');
}

console.log(fallos === 0 ? '\nLISTO PARA DESPEGAR\n' : `\n${fallos} FALLO(S). Corrige antes de continuar.\n`);
process.exit(fallos === 0 ? 0 : 1);

export {};
