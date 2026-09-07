import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { leerConsejo, claveDe, COMPATIBLES } from '../src/lib/consejo';
import { DIMENSIONES, ESQUEMA, Regimen, prompt } from '../src/lib/prompt-regimenes';

const args = process.argv.slice(2);
const opcion = (n: string) => {
  const i = args.indexOf(`--${n}`);
  if (i < 0) return null;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
};

const RUTA = opcion('fichero') || 'datos/regimenes/regimenes.json';
const CARPETA = 'datos/regimenes/diagnostico';
const clave = opcion('regimen');

if (!existsSync(RUTA)) {
  console.error(`\nNo existe ${RUTA}.\n`);
  process.exit(1);
}

const regimenes: Regimen[] = JSON.parse(readFileSync(RUTA, 'utf8'));
const objetivo = clave
  ? regimenes.find(r => r.clave === clave || r.nombre_corto === clave)
  : regimenes[0];

if (!objetivo) {
  console.error(`\nNo encuentro el regimen "${clave}". Disponibles:`);
  regimenes.forEach(r => console.error(`  ${r.clave}   ${r.nombre_corto}`));
  console.error('');
  process.exit(1);
}

const consejo = leerConsejo();
const texto = prompt(objetivo);

mkdirSync(CARPETA, { recursive: true });

console.log(`\nRegimen:  ${objetivo.nombre} (${objetivo.desde}-${objetivo.hasta})`);
console.log(`Consejo:  ${consejo.map(m => m.id).join(', ')}`);
console.log(`Volcados: ${CARPETA}/\n`);

function resumen(obj: any): string {
  const t = JSON.stringify(obj);
  return t.length > 400 ? `${t.slice(0, 400)}…` : t;
}

for (const miembro of consejo) {
  const apiKey = process.env[claveDe(miembro.proveedor)]?.trim();
  const nombreFichero = `${CARPETA}/${objetivo.clave.replace(/[^a-z0-9]+/gi, '-')}__${miembro.id.replace(/[^a-z0-9]+/gi, '-')}.json`;

  if (!apiKey) {
    console.log(`${miembro.id}\n  falta ${claveDe(miembro.proveedor)}\n`);
    continue;
  }

  try {
    let res: Response;

    if (miembro.proveedor === 'gemini') {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${miembro.modelo}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: texto }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseSchema: ESQUEMA
            }
          })
        }
      );
    } else if (miembro.proveedor === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: miembro.modelo,
          max_tokens: 4096,
          temperature: 0,
          messages: [{ role: 'user', content: texto }]
        })
      });
    } else {
      const cfg = COMPATIBLES[miembro.proveedor];
      const url = miembro.proveedor === 'compatible'
        ? (process.env.COMPATIBLE_BASE_URL?.trim() ?? '')
        : cfg.url;
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: miembro.modelo,
          temperature: 0,
          max_tokens: 4096,
          messages: [{ role: 'user', content: texto }]
        })
      });
    }

    const bruto = await res.text();
    writeFileSync(nombreFichero, bruto, 'utf8');

    console.log(`${miembro.id}`);
    console.log(`  HTTP ${res.status}`);
    console.log(`  cabeceras de limite: ${['retry-after', 'x-ratelimit-remaining-requests', 'x-ratelimit-reset-requests']
      .map(h => `${h}=${res.headers.get(h) ?? '-'}`).join('  ')}`);

    let cuerpo: any = null;
    try { cuerpo = JSON.parse(bruto); } catch { /* respuesta no JSON */ }

    if (!cuerpo) {
      console.log(`  cuerpo no es JSON: ${bruto.slice(0, 200)}`);
    } else if (miembro.proveedor === 'gemini') {
      const c = cuerpo?.candidates?.[0];
      console.log(`  finishReason: ${c?.finishReason ?? '-'}`);
      console.log(`  promptFeedback: ${resumen(cuerpo?.promptFeedback ?? null)}`);
      console.log(`  safetyRatings: ${resumen(c?.safetyRatings ?? null)}`);
      const salida = c?.content?.parts?.[0]?.text ?? '';
      console.log(`  longitud del texto: ${salida.length}`);
      if (salida) {
        const faltan = DIMENSIONES.filter(d => {
          try { return !(d in JSON.parse(salida)); } catch { return true; }
        });
        console.log(`  dimensiones ausentes: ${faltan.length}`);
        console.log(`  inicio: ${salida.slice(0, 160)}`);
      }
    } else if (miembro.proveedor === 'anthropic') {
      console.log(`  stop_reason: ${cuerpo?.stop_reason ?? '-'}`);
      const salida = (cuerpo?.content ?? []).map((x: any) => x?.text ?? '').join('');
      console.log(`  longitud del texto: ${salida.length}`);
      console.log(`  inicio: ${salida.slice(0, 160)}`);
    } else {
      const m = cuerpo?.choices?.[0]?.message ?? {};
      console.log(`  finish_reason: ${cuerpo?.choices?.[0]?.finish_reason ?? '-'}`);
      console.log(`  campos del mensaje: ${Object.keys(m).join(', ') || '(ninguno)'}`);
      console.log(`  longitud content: ${String(m.content ?? '').length}`);
      console.log(`  longitud reasoning: ${String(m.reasoning ?? m.reasoning_content ?? '').length}`);
      console.log(`  error: ${resumen(cuerpo?.error ?? null)}`);
      const salida = String(m.content ?? m.reasoning ?? '');
      if (salida) console.log(`  inicio: ${salida.slice(0, 160)}`);
    }

    console.log(`  volcado: ${nombreFichero}\n`);
  } catch (e: any) {
    console.log(`${miembro.id}\n  EXCEPCION: ${String(e?.message ?? e).slice(0, 200)}\n`);
  }
}

console.log('Los ficheros de la carpeta contienen la respuesta completa sin recortar.\n');
