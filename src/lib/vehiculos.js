/**
 * Clasifica filas de "VEHÍCULOS, EMBARCACIONES Y AERONAVES" del PDF del Congreso.
 * Parte del texto de descripción (p. ej. "MOTOCICLETA BMW R80RT").
 */

function trozosDetalle(detalle) {
  if (!detalle) return [];
  return String(detalle)
    .split(/[;\n|]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function clasificarVehiculos(detalle, totalDeclarado = null) {
  const items = trozosDetalle(detalle);
  let coches = 0, motos = 0, embarcaciones = 0, aeronaves = 0, otros = 0;
  const lista = [];

  for (const raw of items) {
    const t = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let tipo = 'otro';
    if (/motocicleta|\bmoto\b|scooter|ciclomotor/.test(t)) tipo = 'moto';
    else if (/embarcacion|barco|yate|lancha|velero|buque|navegar/.test(t)) tipo = 'embarcacion';
    else if (/aeronave|avion|helicoptero|ultraligero/.test(t)) tipo = 'aeronave';
    else if (/vehiculo|turismo|todoterreno|todo terreno|jeep|furgoneta|camion|coche|automovil|suv|pickup/.test(t)
      || /\b(bmw|audi|seat|vw|volkswagen|mercedes|toyota|ford|renault|peugeot|citroen|opel|nissan|hyundai|kia|volvo|porsche|ferrari)\b/.test(t)) {
      tipo = 'coche';
    }

    if (tipo === 'moto') motos++;
    else if (tipo === 'embarcacion') embarcaciones++;
    else if (tipo === 'aeronave') aeronaves++;
    else if (tipo === 'coche') coches++;
    else otros++;

    lista.push({ tipo, texto: raw });
  }

  const clasificados = coches + motos + embarcaciones + aeronaves + otros;
  // Si Gemini solo puso un número total sin detalle, úsalo como coches aproximados
  let total = clasificados;
  if (totalDeclarado != null && Number(totalDeclarado) > clasificados) {
    const hueco = Number(totalDeclarado) - clasificados;
    coches += hueco;
    total = Number(totalDeclarado);
  }

  return {
    n_coches: coches,
    n_motos: motos,
    n_embarcaciones: embarcaciones,
    n_aeronaves: aeronaves,
    n_vehiculos: total,
    vehiculos_lista: lista
  };
}

export function etiquetaVehiculo(tipo) {
  return ({
    coche: 'Coche',
    moto: 'Moto',
    embarcacion: 'Embarcación',
    aeronave: 'Aeronave',
    otro: 'Otro'
  })[tipo] ?? tipo;
}
