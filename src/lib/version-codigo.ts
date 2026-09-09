import { modelosDisponibles } from './gemini';

export const VERSION_CODIGO_LEY = 'codigo-ley-v7-2026-09';

const MOVIL = /-latest$|^latest$/;

export function versionCodigoLey(): string {
  const declarada = process.env.VERSION_CODIGO_LEY?.trim();
  if (declarada) return declarada;
  console.log(
    `\nVERSION_CODIGO_LEY no esta definida. Se usa la version activa: ${VERSION_CODIGO_LEY}\n` +
    `  Si querias auditar otra, lanza con VERSION_CODIGO_LEY=... delante.\n`
  );
  return VERSION_CODIGO_LEY;
}

export function exigirVersionCodigoLey(): string {
  const declarada = process.env.VERSION_CODIGO_LEY?.trim();
  if (!declarada) {
    throw new Error(
      'Falta VERSION_CODIGO_LEY.\n' +
      '  Este script escribe en iniciativa_codigo y no puede elegir version por su cuenta:\n' +
      '  un valor por defecto equivocado mezcla dos corpus sin avisar.\n' +
      `  Version activa hoy: ${VERSION_CODIGO_LEY}\n` +
      `  Ejemplo: VERSION_CODIGO_LEY=${VERSION_CODIGO_LEY} npm run codificar:leyes`
    );
  }
  return declarada;
}

export function exigirVersionCodigoPromesas(): string {
  const declarada = process.env.VERSION_CODIGO?.trim();
  if (!declarada) {
    throw new Error(
      'Falta VERSION_CODIGO.\n' +
      '  Ojo: las promesas usan VERSION_CODIGO, las leyes usan VERSION_CODIGO_LEY. Son dos corpus.\n' +
      '  Este script escribe en promesa_codigo, asi que la version tiene que ser explicita.\n' +
      '  Mira cual esta viva antes de elegir:\n' +
      '    select version_prompt, count(*) from promesa_codigo group by 1 order by 2 desc;'
    );
  }
  return declarada;
}

export function comprobarModelo(): { modelos: string[]; cadena: boolean } {
  const modelos = modelosDisponibles();
  if (modelos.length > 1) {
    console.log(
      `\nMODELO_IA trae ${modelos.length} modelos con relevo por cuota:\n` +
      `  ${modelos.join(', ')}\n` +
      '  Sirve para agotar cuota gratuita sin pararse, pero el corpus queda repartido\n' +
      '  entre varios codificadores y los ejes se mueven entre ejecuciones identicas.\n' +
      `  Cuando termines de cubrirlo, homogeneizalo con:\n` +
      `    MODELO_IA=${modelos[0]} npm run codificar:leyes -- --rehacer-mezcla\n`
    );
  } else if (MOVIL.test(modelos[0])) {
    console.log(
      `\nAVISO: ${modelos[0]} es un alias movil. La columna modelo guardaria la etiqueta,\n` +
      '  no el modelo, y el corpus deja de ser reproducible sin que nada falle.\n'
    );
  }
  return { modelos, cadena: modelos.length > 1 };
}