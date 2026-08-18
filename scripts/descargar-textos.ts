import { db, exigirEnv } from '../src/lib/supabase';
import { UA } from '../src/lib/descubrir';
import { extractText, getDocumentProxy } from 'unpdf';

exigirEnv('LEGISLATURA_ACTIVA_ID');

const MAX_CHARS = Number(process.env.MAX_CHARS_TEXTO ?? 120000);
const PAUSA = 900;

function urlsDe(enlaces: string | null): string[] {
  if (!enlaces) return [];
  return String(enlaces)
    .split(/[\s·]+/)
    .filter(u => u.startsWith('http'))
    .filter(u => /\.pdf$/i.test(u) || /BOCG/i.test(u));
}

function limpiar(texto: string): string {
  return texto
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/BOLET[ÍI]N OFICIAL DE LAS CORTES GENERALES[\s\S]{0,80}?\n/gi, '')
    .replace(/^\s*Núm\.\s*\d+.*$/gim, '')
    .replace(/^\s*Pág\.\s*\d+\s*$/gim, '')
    .replace(/cve:\s*BOCG[^\s]*/gi, '')
    .trim();
}

const { data: pendientes, error } = await db()
  .from('iniciativas')
  .select('id, titulo, enlaces_bocg')
  .is('texto_at', null)
  .not('enlaces_bocg', 'is', null)
  .limit(1000);

if (error) { console.error(error.message); process.exit(1); }

console.log(`\nIniciativas sin texto descargado: ${pendientes?.length ?? 0}`);
console.log(`Limite por documento: ${MAX_CHARS.toLocaleString('es')} caracteres\n`);

let conTexto = 0, sinUrl = 0, fallos = 0, totalChars = 0;

for (let n = 0; n < (pendientes?.length ?? 0); n++) {
  const i = pendientes![n];
  const urls = urlsDe(i.enlaces_bocg);

  if (urls.length === 0) {
    sinUrl++;
    await db().from('iniciativas').update({ texto_at: new Date().toISOString(), texto_error: 'sin url pdf' }).eq('id', i.id);
    continue;
  }

  let guardado = false;

  for (const url of urls.slice(0, 2)) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/pdf' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error('fichero demasiado pequeño');
      if (String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') throw new Error('no es PDF');

      const pdf = await getDocumentProxy(buf);
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      const limpio = limpiar(text).slice(0, MAX_CHARS);

      if (limpio.length < 400) throw new Error(`texto insuficiente (${limpio.length} car.)`);

      await db().from('iniciativas').update({
        texto_extraido: limpio,
        texto_chars: limpio.length,
        texto_paginas: totalPages,
        texto_url: url,
        texto_error: null,
        texto_at: new Date().toISOString()
      }).eq('id', i.id);

      conTexto++;
      totalChars += limpio.length;
      guardado = true;

      if (n % 10 === 0 || n < 5) {
        console.log(`  [${String(n + 1).padStart(4)}/${pendientes!.length}] ${String(totalPages).padStart(3)}p ${String(limpio.length).padStart(7)}c  ${String(i.titulo).slice(0, 52)}`);
      }
      break;
    } catch (e: any) {
      if (url === urls.slice(0, 2).at(-1)) {
        fallos++;
        await db().from('iniciativas').update({
          texto_at: new Date().toISOString(),
          texto_error: String(e.message ?? e).slice(0, 200)
        }).eq('id', i.id);
        if (fallos <= 8) console.log(`  [${String(n + 1).padStart(4)}] FALLO ${String(e.message).slice(0, 50)} — ${String(i.titulo).slice(0, 40)}`);
      }
    }
  }

  await new Promise(r => setTimeout(r, PAUSA));
}

console.log('\nRESULTADO');
console.log(`  con texto:   ${conTexto}`);
console.log(`  sin url pdf: ${sinUrl}`);
console.log(`  fallos:      ${fallos}`);
if (conTexto > 0) console.log(`  media:       ${Math.round(totalChars / conTexto).toLocaleString('es')} caracteres`);
console.log('\nSIGUIENTE: npm run resumir\n');

export {};
