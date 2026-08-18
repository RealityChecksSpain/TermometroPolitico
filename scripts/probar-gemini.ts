import { exigirEnv } from '../src/lib/supabase';

const clave = exigirEnv('GEMINI_API_KEY');
const PROMPT = 'Explica en dos frases y en español llano que hace esta norma: "Proposición de Ley de reforma integral del trabajo autónomo." Responde solo JSON: {"resumen": string}';
const ESQUEMA = { type: 'object', properties: { resumen: { type: 'string' } }, required: ['resumen'] };

interface Intento { ok: boolean; texto: string; motivo: string; razonamiento: number; }

async function llamar(modelo: string, config: any): Promise<Intento> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }] }], generationConfig: config })
      }
    );
    const cuerpo = await res.text();
    if (!res.ok) {
      let msg = cuerpo.slice(0, 160);
      try { msg = JSON.parse(cuerpo).error?.message?.slice(0, 160) ?? msg; } catch {}
      return { ok: false, texto: '', motivo: `HTTP ${res.status}: ${msg}`, razonamiento: 0 };
    }
    const j = JSON.parse(cuerpo);
    const c = j.candidates?.[0];
    const texto = (c?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
    return {
      ok: texto.length > 0,
      texto,
      motivo: texto ? 'ok' : `vacio, finishReason=${c?.finishReason}`,
      razonamiento: j.usageMetadata?.thoughtsTokenCount ?? 0
    };
  } catch (e: any) {
    return { ok: false, texto: '', motivo: 'excepcion: ' + e.message, razonamiento: 0 };
  }
}

console.log('\nDescubriendo modelos de tu clave...\n');

const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
  headers: { 'x-goog-api-key': clave }
});
if (!r.ok) {
  console.log(`No se pudo listar modelos: HTTP ${r.status}`);
  process.exit(1);
}

const lista: string[] = ((await r.json()).models ?? [])
  .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
  .map((m: any) => m.name.replace('models/', ''))
  .filter((n: string) => !/tts|image|banana|embedding|customtools/i.test(n))
  .sort((a: string, b: string) => {
    const p = (n: string) => (n.includes('flash-lite') ? 0 : n.includes('flash') ? 1 : 2);
    return p(a) - p(b);
  });

console.log('Candidatos (prioridad: lite > flash > pro):');
lista.forEach(n => console.log('  ' + n));

console.log('\n\nPRUEBA 1 — llamada minima');
const vivos: string[] = [];
for (const m of lista) {
  const i = await llamar(m, { temperature: 0, maxOutputTokens: 4096 });
  console.log(`  ${i.ok ? 'OK   ' : 'falla'}  ${m.padEnd(32)} ${i.ok ? i.texto.slice(0, 50).replace(/\s+/g, ' ') : i.motivo}`);
  if (i.ok) vivos.push(m);
  await new Promise(res => setTimeout(res, 1200));
}

if (vivos.length === 0) {
  console.log('\nNingun modelo responde. Revisa la clave en aistudio.google.com/apikey\n');
  process.exit(1);
}

const elegido = vivos[0];
console.log(`\n\nPRUEBA 2 — configuraciones sobre ${elegido}`);

const configs: [string, any][] = [
  ['json + esquema', { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json', responseSchema: ESQUEMA }],
  ['json sin esquema', { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json' }],
  ['json + esquema + thinkingBudget 0', { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json', responseSchema: ESQUEMA, thinkingConfig: { thinkingBudget: 0 } }],
  ['json + esquema + thinkingLevel low', { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json', responseSchema: ESQUEMA, thinkingConfig: { thinkingLevel: 'low' } }]
];

const buenas: string[] = [];
for (const [nombre, cfg] of configs) {
  const i = await llamar(elegido, cfg);
  console.log(`  ${i.ok ? 'OK   ' : 'falla'}  ${nombre.padEnd(38)} razonamiento:${String(i.razonamiento).padStart(5)}  ${i.ok ? i.texto.slice(0, 40).replace(/\s+/g, ' ') : i.motivo}`);
  if (i.ok) buenas.push(nombre);
  await new Promise(res => setTimeout(res, 1200));
}

console.log('\n\n=== CONFIGURACION RECOMENDADA ===\n');
console.log('Pon esto en tu .env:\n');
console.log(`MODELO_IA=${elegido}`);
if (!buenas.includes('json + esquema')) console.log('SIN_ESQUEMA=true');
if (buenas.includes('json + esquema + thinkingBudget 0')) console.log('# razonamiento desactivable con thinkingBudget');
else console.log('SIN_RAZONAMIENTO=false');
console.log('MAX_TOKENS_IA=4096');
console.log(`\nModelos vivos: ${vivos.join(', ')}\n`);

export {};