import { exigirEnv } from '../src/lib/supabase';

const clave = exigirEnv('GEMINI_API_KEY');
const modelos = (process.env.MODELO_IA ?? 'gemini-flash-lite-latest').split(',').map(s => s.trim());

console.log('\nDIAGNOSTICO DE CUOTA\n');
console.log(`Hora local:    ${new Date().toLocaleString('es-ES')}`);
console.log(`Hora UTC:      ${new Date().toISOString()}`);
console.log(`Hora Pacifico: ${new Date().toLocaleString('es-ES', { timeZone: 'America/Los_Angeles' })}`);
console.log('  (la cuota diaria del tier gratuito se repone a las 00:00 del Pacifico)\n');

for (const modelo of modelos) {
  console.log(`\n=== ${modelo} ===`);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responde solo: {"ok":true}' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 100, responseMimeType: 'application/json' }
      })
    }
  );

  console.log(`HTTP ${res.status}`);

  const cuerpo = await res.text();

  if (res.ok) {
    console.log('FUNCIONA. Hay cuota disponible.');
    continue;
  }

  let j: any = null;
  try { j = JSON.parse(cuerpo); } catch {}

  if (!j?.error) { console.log(cuerpo.slice(0, 600)); continue; }

  console.log(`status:  ${j.error.status}`);
  console.log(`mensaje: ${j.error.message}`);

  for (const d of j.error.details ?? []) {
    const tipo = String(d['@type'] ?? '').split('.').pop();

    if (tipo === 'QuotaFailure') {
      console.log('\nCUOTAS VIOLADAS:');
      (d.violations ?? []).forEach((v: any) => {
        console.log(`  metrica:   ${v.quotaMetric ?? '?'}`);
        console.log(`  id:        ${v.quotaId ?? '?'}`);
        console.log(`  limite:    ${v.quotaValue ?? '?'}`);
        console.log(`  modelo:    ${v.quotaDimensions?.model ?? '?'}`);
        console.log(`  ubicacion: ${v.quotaDimensions?.location ?? '?'}`);
        console.log('');
      });
    }

    if (tipo === 'RetryInfo') {
      console.log(`REINTENTAR EN: ${d.retryDelay ?? '?'}`);
    }

    if (tipo === 'Help') {
      (d.links ?? []).forEach((l: any) => console.log(`ayuda: ${l.url}`));
    }
  }

  console.log('\nINTERPRETACION');
  const ids: string[] = (j.error.details ?? [])
    .flatMap((d: any) => d.violations ?? [])
    .map((v: any) => String(v.quotaId ?? ''));

  if (ids.some((i: string) => /PerDay/i.test(i))) {
    console.log('  Limite DIARIO agotado. Espera al reinicio del Pacifico.');
  } else if (ids.some((i: string) => /PerMinute/i.test(i))) {
    console.log('  Limite POR MINUTO. Basta con bajar la cadencia, no es cuota diaria.');
    console.log('  Solucion: subir el margen en Cadencia o poner MODELO_IA con un solo modelo.');
  } else if (ids.some((i: string) => /InputToken/i.test(i))) {
    console.log('  Limite de TOKENS. Baja MAX_CHARS_PROMPT.');
  } else {
    console.log('  No identificada. Revisa quotaId arriba.');
  }
}

console.log('');
export {};
