const DICCIONARIO = [
  ['autonomos', ['autonom', 'autonoma', 'freelance', 'por cuenta propia', 'cuota de autonom', 'trabajo por mi cuenta', 'facturo', 'reta']],
  ['trabajadores', ['trabajador', 'empleado', 'asalariado', 'por cuenta ajena', 'tengo un contrato', 'mi jefe', 'nomina', 'nómina', 'convenio', 'currante']],
  ['pensionistas', ['pensionista', 'jubilad', 'mi pension', 'mi pensión', 'cobro una pension', 'cobro una pensión']],
  ['desempleados', ['paro', 'desemplead', 'sin trabajo', 'busco trabajo', 'subsidio', 'prestacion por desempleo', 'en el inem', 'sepe']],
  ['inquilinos', ['alquiler', 'inquilin', 'de alquiler', 'arriendo', 'mi casero', 'pago renta', 'vivo de alquiler', 'piso de alquiler']],
  ['propietarios', ['propietari', 'hipoteca', 'mi vivienda', 'casero', 'arrendador', 'compre un piso', 'tengo un piso']],
  ['familias', ['hijo', 'hija', 'madre', 'padre', 'familia', 'guarderia', 'guardería', 'concilia', 'permiso de paternidad', 'maternidad', 'soy madre', 'soy padre', 'dos hijos', 'mis hijos']],
  ['mayores', ['mayor', 'tercera edad', 'anciano', 'residencia de mayores', 'abuel']],
  ['menores', ['menor de edad', 'adolescente', 'infancia', 'niñ']],
  ['estudiantes', ['estudiante', 'universidad', 'beca', 'estudio', 'fp', 'formacion profesional', 'oposicion', 'oposición']],
  ['migrantes', ['migrante', 'inmigrante', 'extranjer', 'papeles', 'nacionalidad', 'asilo', 'refugiad', 'nie', 'arraigo', 'permiso de residencia', 'venezolan', 'marroqu', 'colombian', 'tramitando papeles']],
  ['mujeres', ['mujer', 'violencia de genero', 'violencia de género', 'brecha salarial', 'igualdad', 'embarazada', 'aborto']],
  ['discapacidad', ['discapacidad', 'discapacitad', 'movilidad reducida', 'accesibilidad', 'dependencia', 'dependiente', 'gran dependiente', 'silla de ruedas', 'sordo', 'ciego', 'invidente', 'autismo', 'certificado de discapacidad']],
  ['lgtbi', ['lgtbi', 'lgtb', 'gay', 'lesbiana', 'trans', 'homosexual', 'bisexual', 'queer']],
  ['pymes', ['pyme', 'peque a empresa', 'pequeña empresa', 'micro empresa', 'microempresa', 'negocio', 'tienda', 'comercio propio', 'restaurante', 'cafeteria', 'cafetería', 'peluqueria', 'peluquería', 'taller', 'emprendedor', 'autoempleo', 'tengo un bar', 'tengo una empresa', 'microempresario']],
  ['grandes_empresas', ['multinacional', 'gran empresa', 'cotizada', 'corporacion']],
  ['agricultores', ['agricultor', 'ganader', 'en el campo', 'agrari', 'cultivo', 'la pac', 'olivar', 'viñedo', 'tractor', 'huerta', 'cosecha', 'regadio', 'invernadero', 'trabajo en el campo']],
  ['pescadores', ['pescador', 'pesca', 'marinero', 'flota', 'barco de pesca', 'caladero', 'pesquero']],
  ['sanitarios', ['medic', 'médic', 'enfermer', 'sanitari', 'hospital', 'atencion primaria', 'ambulatorio', 'soy enfermera', 'soy enfermero', 'soy medico', 'soy médico']],
  ['docentes', ['profesor', 'maestr', 'docente', 'doy clase', 'instituto', 'colegio', 'maestro']],
  ['funcionarios', ['funcionari', 'empleado publico', 'empleado público', 'administracion publica', 'interino', 'opositor']],
  ['consumidores', ['consumidor', 'usuario', 'factura', 'luz', 'telefonia', 'telefonía', 'banco me', 'clausula', 'cláusula']],
  ['contribuyentes', ['impuesto', 'irpf', 'iva', 'declaracion de la renta', 'hacienda', 'tributo', 'fiscal']],
  ['conductores', ['conduzco', 'conductor', 'coche', 'carnet', 'itv', 'multa de trafico', 'moto', 'camionero']],
  ['sector_cultural', ['artista', 'musico', 'músico', 'actor', 'actriz', 'cultura', 'cine', 'teatro', 'escritor']],
  ['sanidad_pacientes', ['paciente', 'enfermedad', 'tratamiento', 'medicamento', 'lista de espera', 'cronic', 'crónico']],
  ['ecosistemas', ['medio ambiente', 'naturaleza', 'ecolog', 'contaminacion', 'contaminación', 'rio', 'monte', 'bosque']],
  ['vecinos', ['comunidad de vecinos', 'propiedad horizontal', 'derrama', 'junta de vecinos']],
  ['victimas', ['victima', 'víctima', 'abuso', 'terrorismo', 'accidente']],
  ['ccaa', ['comunidad autonoma', 'competencia autonomica', 'estatuto', 'financiacion autonomica']]
];

const MATERIAS = [
  ['vivienda', ['vivienda', 'alquiler', 'hipoteca', 'okupa', 'desahucio', 'piso', 'casa']],
  ['trabajo', ['trabajo', 'empleo', 'salario', 'smi', 'jornada laboral', 'despido', 'sindicato', 'convenio']],
  ['sanidad', ['sanidad', 'salud', 'hospital', 'medicamento', 'sanitario']],
  ['educacion', ['educacion', 'educación', 'escuela', 'universidad', 'beca', 'profesor']],
  ['migracion', ['migracion', 'migración', 'extranjeria', 'extranjería', 'asilo', 'frontera', 'nacionalidad']],
  ['social', ['pension', 'pensión', 'dependencia', 'discapacidad', 'ayuda social', 'ingreso minimo']],
  ['macroeconomia', ['impuesto', 'irpf', 'iva', 'presupuesto', 'inflacion', 'inflación', 'fiscal']],
  ['medioambiente', ['medio ambiente', 'clima', 'contaminacion', 'residuo', 'agua']],
  ['justicia', ['justicia', 'codigo penal', 'código penal', 'policia', 'policía', 'delito', 'carcel']],
  ['derechos', ['derecho', 'libertad', 'igualdad', 'discriminacion', 'discriminación', 'lgtbi']],
  ['transporte', ['transporte', 'tren', 'cercanias', 'cercanías', 'autobus', 'carretera', 'avion']],
  ['agricultura', ['agricultura', 'ganaderia', 'ganadería', 'pesca', 'campo', 'rural']],
  ['energia', ['energia', 'energía', 'luz', 'electricidad', 'gasolina', 'renovable', 'nuclear']],
  ['ciencia', ['tecnologia', 'tecnología', 'internet', 'inteligencia artificial', 'ia', 'datos', 'telecomunicaciones']],
  ['empresa', ['empresa', 'negocio', 'banco', 'consumidor', 'comercio', 'competencia']],
  ['cultura', ['cultura', 'cine', 'deporte', 'patrimonio', 'memoria historica']],
  ['exterior', ['exterior', 'europa', 'union europea', 'ucrania', 'palestina', 'gaza', 'oriente medio', 'guerra']],
  ['defensa', ['defensa', 'ejercito', 'ejército', 'militar', 'otan', 'armas']],
  ['territorio', ['autonomia', 'autonomía', 'competencia', 'estatuto', 'cataluña', 'euskadi', 'galicia']],
  ['administracion', ['funcionario', 'oposicion', 'oposición', 'burocracia', 'tramite', 'trámite']]
];

function normalizar(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function distancia(a, b, tope) {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(fila[j - 1] + 1, previa[j] + 1, previa[j - 1] + coste);
      if (fila[j] < minFila) minFila = fila[j];
    }
    if (minFila > tope) return tope + 1;
    previa = fila;
  }
  return previa[b.length];
}

function toleraErrata(palabra, clave) {
  if (clave.length < 4 || palabra.length < 3) return false;
  const tope = clave.length >= 8 ? 2 : 1;

  if (Math.abs(palabra.length - clave.length) <= tope
      && distancia(palabra, clave, tope) <= tope) return true;

  if (palabra.length > clave.length) {
    for (let corte = clave.length - tope; corte <= clave.length + tope; corte++) {
      if (corte < 3 || corte > palabra.length) continue;
      if (distancia(palabra.slice(0, corte), clave, tope) <= tope) return true;
    }
  }
  return false;
}

const RAICES = [
  ['autonom', 6], ['inquilin', 7], ['pension', 6], ['migrant', 6], ['inmigrant', 7],
  ['trabajad', 7], ['desemple', 7], ['discapac', 7], ['agricult', 7], ['ganader', 6],
  ['pescad', 6], ['estudiant', 7], ['funcionari', 8], ['consumid', 7], ['propietari', 8],
  ['alquil', 6], ['hipotec', 6], ['vivienda', 7], ['sanitari', 7], ['profesor', 7],
  ['jubilad', 6], ['embaraz', 6], ['aloquiler', 7]
];

export function detectarPerfil(texto) {
  const t = normalizar(texto);
  if (t.trim().length < 3) return { colectivos: [], materias: [] };

  const palabras = t.split(' ').filter(p => p.length > 2);
  const conH = palabras.map(p => (p.startsWith('h') ? p : 'h' + p));
  palabras.push(...conH.filter(p => !palabras.includes(p)));

  const marcar = (tabla) => {
    const puntos = new Map();
    tabla.forEach(([slug, claves]) => {
      claves.forEach(clave => {
        const cn = normalizar(clave);

        if (t.includes(cn)) {
          puntos.set(slug, (puntos.get(slug) ?? 0) + cn.length * 3);
          return;
        }

        const partes = cn.split(' ');
        if (partes.length === 1) {
          for (const p of palabras) {
            if (cn.length >= 4 && p.startsWith(cn)) {
              puntos.set(slug, (puntos.get(slug) ?? 0) + cn.length * 2);
              return;
            }
            if (toleraErrata(p, cn)) {
              puntos.set(slug, (puntos.get(slug) ?? 0) + cn.length);
              return;
            }
          }
        } else {
          const largas = partes.filter(parte => parte.length >= 4);
          if (largas.length === 0) return;
          const todasCerca = largas.every(parte =>
            palabras.some(p => p.startsWith(parte) || toleraErrata(p, parte)));
          if (todasCerca) {
            puntos.set(slug, (puntos.get(slug) ?? 0) + cn.length);
            return;
          }
        }
      });
    });
    return Array.from(puntos.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  };

  const porRaiz = (tabla) => {
    const extra = new Map();
    palabras.forEach(p => {
      RAICES.forEach(([raiz, min]) => {
        if (p.length < min) return;
        const ok = p.startsWith(raiz) || toleraErrata(p.slice(0, raiz.length + 1), raiz);
        if (!ok) return;
        tabla.forEach(([slug, claves]) => {
          if (claves.some(c => normalizar(c).includes(raiz))) {
            extra.set(slug, (extra.get(slug) ?? 0) + raiz.length);
          }
        });
      });
    });
    return extra;
  };

  const combinar = (tabla) => {
    const base = marcar(tabla);
    const extra = porRaiz(tabla);
    const orden = new Map();
    base.forEach((s, i) => orden.set(s, (base.length - i) * 10));
    extra.forEach((v, s) => orden.set(s, (orden.get(s) ?? 0) + v));
    return Array.from(orden.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  };

  return { colectivos: combinar(DICCIONARIO).slice(0, 4), materias: combinar(MATERIAS).slice(0, 3) };
}

export function normalizarConsulta(texto) {
  return normalizar(texto);
}

export async function detectarPerfilAmpliado(texto) {
  const local = detectarPerfil(texto);
  if (local.colectivos.length > 0) return { ...local, origen: 'diccionario' };

  try {
    const r = await fetch('/api/perfil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, normalizado: normalizar(texto) })
    });
    if (!r.ok) return { ...local, origen: 'error' };
    const j = await r.json();
    return { colectivos: j.colectivos ?? [], materias: j.materias ?? [], origen: j.origen };
  } catch {
    return { ...local, origen: 'error' };
  }
}

export const EJEMPLOS = [
  'Soy autónoma y tengo dos hijos',
  'Vivo de alquiler en Madrid',
  'Soy migrante y estoy tramitando papeles',
  'Cobro una pensión',
  'Trabajo en el campo',
  'Soy enfermera'
];