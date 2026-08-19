import { detectarPerfil } from '../src/lib/perfil.js';

type Caso = [string, string | null, string?];

const CASOS: Caso[] = [
  ['soy autónomo', 'autonomos'], ['soy autónoma', 'autonomos'], ['soy autonimo', 'autonomos'],
  ['soy autonomo', 'autonomos'], ['trabajo por mi cuenta', 'autonomos'], ['pago la cuota de autónomos', 'autonomos'],
  ['soy freelance', 'autonomos'], ['facturo como autonoma', 'autonomos'], ['me di de alta como autonomo', 'autonomos'],
  ['soy trabajador', 'trabajadores'], ['tengo un contrato', 'trabajadores'], ['soy asalariado', 'trabajadores'],
  ['cobro una nomina', 'trabajadores'], ['mi jefe no me paga', 'trabajadores'], ['trabajo por cuenta ajena', 'trabajadores'],
  ['soy pensionista', 'pensionistas'], ['pensionistaa', 'pensionistas'], ['soy jubilado', 'pensionistas'],
  ['cobro una pension', 'pensionistas'], ['mi pensión es baja', 'pensionistas'], ['estoy jubilada', 'pensionistas'],
  ['estoy en el paro', 'desempleados'], ['cobro el paro', 'desempleados'], ['estoy desempleado', 'desempleados'],
  ['busco trabajo', 'desempleados'], ['cobro un subsidio', 'desempleados'], ['estoy desemplada', 'desempleados'],
  ['vivo de alquiler', 'inquilinos'], ['bibo de alkiler', 'inquilinos'], ['soy inquilino', 'inquilinos'],
  ['pago un alquiler altisimo', 'inquilinos'], ['mi casero me sube el alquiler', 'inquilinos'],
  ['tengo una hipoteca', 'propietarios'], ['soy propietario', 'propietarios'], ['compre un piso', 'propietarios'],
  ['tengo dos hijos', 'familias'], ['tengo dos ijos', 'familias'], ['soy madre', 'familias'],
  ['soy padre de familia', 'familias'], ['busco guarderia', 'familias'], ['permiso de maternidad', 'familias'],
  ['necesito conciliar', 'familias'],
  ['soy mayor', 'mayores'], ['estoy en una residencia de mayores', 'mayores'],
  ['soy estudiante', 'estudiantes'], ['estudio en la universidad', 'estudiantes'], ['tengo una beca', 'estudiantes'],
  ['hago fp', 'estudiantes'], ['preparo una oposicion', 'estudiantes'],
  ['soy migrante', 'migrantes'], ['soy imigrante', 'migrantes'], ['soy inmigrante', 'migrantes'],
  ['estoy tramitando los papeles', 'migrantes'], ['pedi asilo', 'migrantes'], ['soy venezolano', 'migrantes'],
  ['necesito el nie', 'migrantes'], ['solicito nacionalidad', 'migrantes'], ['tengo arraigo social', 'migrantes'],
  ['soy mujer', 'mujeres'], ['sufri violencia de genero', 'mujeres'], ['estoy embarazada', 'mujeres'],
  ['tengo discapacidad', 'discapacidad'], ['tengo discapasidad', 'discapacidad'], ['tengo movilidad reducida', 'discapacidad'],
  ['soy dependiente', 'discapacidad'], ['voy en silla de ruedas', 'discapacidad'],
  ['soy lgtbi', 'lgtbi'], ['soy trans', 'lgtbi'], ['soy lesbiana', 'lgtbi'], ['soy gay', 'lgtbi'],
  ['tengo una pyme', 'pymes'], ['tengo un negocio', 'pymes'], ['tengo una tienda', 'pymes'],
  ['soy emprendedor', 'pymes'], ['tengo un bar', 'pymes'],
  ['soy agricultor', 'agricultores'], ['soy ganadero', 'agricultores'], ['trabajo en el campo', 'agricultores'],
  ['trabajo en el kampo', 'agricultores'], ['cobro la pac', 'agricultores'], ['tengo un olivar', 'agricultores'],
  ['soy pescador', 'pescadores'], ['trabajo en la pesca', 'pescadores'], ['soy marinero', 'pescadores'],
  ['soy medico', 'sanitarios'], ['soy enfermera', 'sanitarios'], ['soy enfermerra', 'sanitarios'],
  ['trabajo en un hospital', 'sanitarios'], ['soy sanitario', 'sanitarios'],
  ['soy profesor', 'docentes'], ['soy maestra', 'docentes'], ['doy clase en un instituto', 'docentes'],
  ['soy docente', 'docentes'],
  ['soy funcionario', 'funcionarios'], ['soy empleado publico', 'funcionarios'], ['soy interina', 'funcionarios'],
  ['soy consumidor', 'consumidores'], ['pago mucha luz', 'consumidores'], ['el banco me cobra comisiones', 'consumidores'],
  ['pago muchos impuestos', 'contribuyentes'], ['hago la declaracion de la renta', 'contribuyentes'],
  ['me sube el irpf', 'contribuyentes'],
  ['conduzco a diario', 'conductores'], ['tengo el carnet', 'conductores'], ['me pusieron una multa de trafico', 'conductores'],
  ['soy artista', 'sector_cultural'], ['soy musico', 'sector_cultural'], ['trabajo en el cine', 'sector_cultural'],
  ['soy paciente cronico', 'sanidad_pacientes'], ['estoy en lista de espera', 'sanidad_pacientes'],
  ['me importa el medio ambiente', 'ecosistemas'], ['me preocupa la contaminacion', 'ecosistemas'],
  ['vivo en una comunidad de vecinos', 'vecinos'], ['nos han puesto una derrama', 'vecinos'],
  ['soy victima de un accidente', 'victimas'],
  ['hola', null], ['no se', null], ['ayuda', null], ['xxxxx', null], ['a', null], ['que tal', null],
  ['soy autonoma y tengo dos hijos', 'autonomos'],
  ['vivo de alquiler y estoy en el paro', 'inquilinos'],
  ['soy migrante y trabajo en el campo', 'migrantes'],
  ['soy pensionista con discapacidad', 'pensionistas'],
  ['soy profesora y tengo una hipoteca', 'docentes']
];

let aciertos = 0, fallos = 0, falsos = 0;
const detalle: string[] = [];

CASOS.forEach(([texto, esperado]) => {
  const r = detectarPerfil(texto);
  if (esperado === null) {
    if (r.colectivos.length === 0) aciertos++;
    else { falsos++; detalle.push(`FALSO POSITIVO  "${texto}" -> ${r.colectivos.join(',')}`); }
    return;
  }
  if (r.colectivos.includes(esperado)) {
    aciertos++;
    if (r.colectivos[0] !== esperado) {
      detalle.push(`  orden   "${texto}" -> esperado ${esperado}, primero ${r.colectivos[0]}`);
    }
  } else {
    fallos++;
    detalle.push(`FALLO           "${texto}" -> ${r.colectivos.join(',') || 'nada'} (esperaba ${esperado})`);
  }
});

const total = CASOS.length;
console.log(`\nCASOS: ${total}`);
console.log(`  aciertos:        ${aciertos}  (${(aciertos / total * 100).toFixed(1)}%)`);
console.log(`  fallos:          ${fallos}`);
console.log(`  falsos positivos:${falsos}\n`);

if (detalle.length) {
  console.log('DETALLE');
  detalle.forEach(d => console.log('  ' + d));
}

const ruido = CASOS.filter(([, e]) => e !== null)
  .map(([t]) => detectarPerfil(t).colectivos.length)
  .reduce((a, b) => a + b, 0) / CASOS.filter(([, e]) => e !== null).length;
console.log(`\nEtiquetas medias por consulta: ${ruido.toFixed(2)} (ideal entre 1 y 2)\n`);

export {};
