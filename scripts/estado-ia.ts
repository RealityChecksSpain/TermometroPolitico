import { db } from '../src/lib/supabase';

async function contar(tabla: string, filtro?: (q: any) => any) {
  let q = db().from(tabla).select('*', { count: 'exact', head: true });
  if (filtro) q = filtro(q);
  const { count } = await q;
  return count ?? 0;
}

const iniciativas = await contar('iniciativas');
const conTexto = await contar('iniciativas', (q: any) => q.gt('texto_chars', 400));
const sinIntentar = await contar('iniciativas', (q: any) => q.is('texto_at', null));
const conError = await contar('iniciativas', (q: any) => q.not('texto_error', 'is', null));

const { data: resumenes } = await db().from('resumenes_ia').select('version_prompt, basado_en');
const porVersion = new Map<string, number>();
(resumenes ?? []).forEach((r: any) => {
  const k = `${r.version_prompt} (${r.basado_en})`;
  porVersion.set(k, (porVersion.get(k) ?? 0) + 1);
});

const materias = await contar('iniciativa_materia', (q: any) => q.eq('principal', true));
const colectivos = await contar('iniciativa_colectivo');

const barra = (n: number, total: number) => {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return `${'█'.repeat(Math.round(pct / 4)).padEnd(25)} ${String(pct).padStart(3)}%  ${n}/${total}`;
};

console.log('\n=== ESTADO DEL PIPELINE DE IA ===\n');
console.log(`Iniciativas totales: ${iniciativas}\n`);
console.log('1. TEXTOS DEL BOCG');
console.log(`   ${barra(conTexto, iniciativas)}`);
console.log(`   sin intentar: ${sinIntentar}   con error: ${conError}\n`);

console.log('2. RESUMENES');
if (porVersion.size === 0) console.log('   ninguno todavia');
porVersion.forEach((n, v) => console.log(`   ${v.padEnd(34)} ${barra(n, conTexto)}`));

console.log('\n3. CLASIFICACION');
console.log(`   materia principal   ${barra(materias, iniciativas)}`);
console.log(`   efectos por colectivo: ${colectivos} filas\n`);

const pendientes = [
  sinIntentar > 0 ? `npm run textos      (${sinIntentar} sin descargar)` : null,
  conTexto - (porVersion.get('v2-texto-2026-08 (texto_bocg)') ?? 0) > 0
    ? `npm run resumir     (${conTexto - (porVersion.get('v2-texto-2026-08 (texto_bocg)') ?? 0)} sin resumen v2)` : null,
  iniciativas - materias > 0 ? `npm run clasificar  (${iniciativas - materias} sin clasificar)` : null
].filter(Boolean);

console.log(pendientes.length ? 'PENDIENTE:\n  ' + pendientes.join('\n  ') + '\n' : 'TODO COMPLETO\n');

export {};
