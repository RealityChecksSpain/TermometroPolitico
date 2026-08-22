/** Implicaciones prácticas por colectivo. Solo hechos genéricos de uso; sin valorar la norma. */

export const IMPLICACIONES = {
  autonomos: {
    etiqueta: 'Autónomos',
    implica: 'Cuotas, facturación, deducciones y obligaciones fiscales del RETA.',
    hacer: 'Revisa si cambia tu cuota, plazos de declaración o ayudas al cese de actividad.'
  },
  trabajadores: {
    etiqueta: 'Trabajadores por cuenta ajena',
    implica: 'Contrato, salario, jornada, despido o derechos laborales.',
    hacer: 'Comprueba convenio, nómina y si tu empresa debe adaptar el contrato.'
  },
  pensionistas: {
    etiqueta: 'Pensionistas',
    implica: 'Cuantía, revalorización o requisitos de la pensión.',
    hacer: 'Mira si afecta al cobro mensual y desde qué fecha se aplica.'
  },
  desempleados: {
    etiqueta: 'Personas en desempleo',
    implica: 'Prestaciones, subsidios o requisitos de inscripción.',
    hacer: 'Consulta SEPE/SPEE si cambian plazos, cuantías o compatibilidades.'
  },
  inquilinos: {
    etiqueta: 'Inquilinos',
    implica: 'Renta, duración del contrato, desahucio o ayudas al alquiler.',
    hacer: 'Revisa tu contrato y si el casero puede subir la renta o no renovar.'
  },
  propietarios: {
    etiqueta: 'Propietarios de vivienda',
    implica: 'Alquiler, hipoteca, IBI o límites a la renta.',
    hacer: 'Comprueba obligaciones nuevas frente a inquilinos o Hacienda.'
  },
  familias: {
    etiqueta: 'Familias',
    implica: 'Permisos, ayudas por hijo, conciliación o escolarización.',
    hacer: 'Mira plazos de solicitud y si debes comunicar el cambio a tu empresa.'
  },
  migrantes: {
    etiqueta: 'Migrantes',
    implica: 'Residencia, trabajo, nacionalidad o regularización.',
    hacer: 'Verifica documentación y plazos en Extranjería antes de que caduque algo.'
  },
  mujeres: {
    etiqueta: 'Mujeres',
    implica: 'Igualdad laboral, salud reproductiva o protección frente a violencia.',
    hacer: 'Si te afecta un derecho o un trámite, conserva resoluciones y plazos.'
  },
  pymes: {
    etiqueta: 'Pymes / microempresas',
    implica: 'Fiscalidad, contratación, ayudas o regulación sectorial.',
    hacer: 'Revisa obligaciones nuevas y si hay bonificaciones o plazos de adaptación.'
  },
  agricultores: {
    etiqueta: 'Agricultores / ganaderos',
    implica: 'PAC, agua, sanidad animal/vegetal o ayudas al campo.',
    hacer: 'Consulta la convocatoria y requisitos antes de la fecha límite.'
  },
  pescadores: {
    etiqueta: 'Pescadores',
    implica: 'Cuotas, caladeros, ayudas a la flota o seguridad a bordo.',
    hacer: 'Comprueba si cambia tu autorización o los días de pesca.'
  },
  sanitarios: {
    etiqueta: 'Personal sanitario',
    implica: 'Condiciones laborales, ratios o protocolos clínicos.',
    hacer: 'Revisa circular interna del centro y plazos de aplicación.'
  },
  docentes: {
    etiqueta: 'Docentes',
    implica: 'Currículo, ratios, interinidad u oposiciones.',
    hacer: 'Sigue el boletín de tu comunidad y la convocatoria oficial.'
  },
  funcionarios: {
    etiqueta: 'Empleo público',
    implica: 'Oposiciones, interinidad o condiciones de la administración.',
    hacer: 'Lee la convocatoria BOE/BOC y anota plazos de solicitud.'
  },
  consumidores: {
    etiqueta: 'Consumidores',
    implica: 'Facturas, cláusulas, reclamaciones o servicios básicos.',
    hacer: 'Guarda facturas y usa la hoja de reclamaciones si te aplican un cambio.'
  },
  contribuyentes: {
    etiqueta: 'Contribuyentes',
    implica: 'IRPF, IVA, plazos o deducciones.',
    hacer: 'Anota la fecha de entrada en vigor para la próxima declaración.'
  },
  discapacidad: {
    etiqueta: 'Discapacidad / dependencia',
    implica: 'Prestaciones, accesibilidad o valoración del grado.',
    hacer: 'Pide cita en servicios sociales si cambia el baremo o la ayuda.'
  },
  estudiantes: {
    etiqueta: 'Estudiantes',
    implica: 'Becas, tasas o acceso universitario.',
    hacer: 'Revisa requisitos y plazo de solicitud de beca.'
  },
  mayores: {
    etiqueta: 'Personas mayores',
    implica: 'Residencias, dependencia o farmacia.',
    hacer: 'Consulta con tu centro de salud o servicios sociales el cambio concreto.'
  },
  conductores: {
    etiqueta: 'Conductores',
    implica: 'Carnet, ITV, multas o peajes.',
    hacer: 'Comprueba si debes renovar documentación o adaptar el vehículo.'
  },
  sanidad_pacientes: {
    etiqueta: 'Pacientes',
    implica: 'Prestaciones, copago, listas de espera o medicamentos.',
    hacer: 'Pregunta en tu centro si el tratamiento o el plazo cambia.'
  }
};

export function implicacionDe(slug) {
  return IMPLICACIONES[slug] ?? null;
}
