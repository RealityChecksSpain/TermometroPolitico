# Escaño

Transparencia parlamentaria española. Congreso de los Diputados y Asamblea de Madrid.

Aplicación independiente. Sin vínculo con ninguna institución pública.

## Principio de diseño

La aplicación no asigna ideología a ninguna ley ni a ningún diputado.

- Los **votos** salen del registro oficial del Congreso.
- Las **posiciones de partido** salen de fuentes académicas externas y citadas (CHES, CIS, Manifesto Project).
- La **posición de una votación** se calcula: es el centro de gravedad de las posiciones externas de los partidos que la apoyaron, ponderado por escaños.

Si un dato no se puede trazar hasta una de esas dos fuentes, no se publica.

## Orden de instalación

### 1. Base de datos

En el SQL Editor de Supabase, pegar entero:

    sql/TODO_EN_UNO.sql

Si compartes el proyecto Supabase con otra app, primero:

    create schema escano;
    set search_path to escano;

y añade `escano` a Settings > API > Exposed schemas.

### 2. Variables de entorno

    cp .env.example .env

`LEGISLATURA_ACTIVA_ID` se saca después de correr el SQL:

    select id from legislaturas where numero = 'XV';

`CRON_SECRET`: genera uno con `openssl rand -hex 32`.

### 3. Cargar el censo

Primero inspecciona el fichero oficial para ver qué campos trae:

    npm run censo:inspeccionar

Si dice `id estable -> NO DETECTADO`, es lo esperado: el cruce irá por nombre.
Luego:

    npm run censo:cargar

### 4. Grupo Mixto

El Mixto contiene partidos ideológicamente opuestos. Sin resolverlo, los cálculos
de posición dan resultados falsos.

    select * from partidos_sin_confirmar();

Para cada uno:

    update mandatos
    set partido_efectivo_id = (select id from partidos where slug = 'podemos'),
        partido_confirmado = true
    where id = '...';

Son entre 5 y 8 personas por legislatura. Se hace una vez.

### 5. Primera ingesta

    npm run ingesta:local

Tarda, porque hay una pausa de 800 ms entre peticiones. Al terminar informa de
cuántos nombres quedaron sin resolver.

## Resolución de nombres

El JSON de votaciones identifica a los diputados solo por nombre, sin ID.
La resolución va en cascada y solo escala cuando el nivel anterior falla:

1. `alias_diputados` — exacto, instantáneo, gratis
2. Trigramas en Postgres — automático por encima de 0.85 de similitud
3. Claude Haiku — solo ante empate real, y únicamente eligiendo entre los
   candidatos que Postgres ya encontró. No puede inventar un diputado.
4. `cola_revision` — solo lo que ninguno de los tres resolvió

Cada acierto se graba como alias, así que un nombre nunca se pregunta dos veces.

## Mantenimiento

El único aviso que recibirás es cuando algo se rompa.

`/api/cron/salud` corre a diario y avisa por correo si pasan más de 10 días sin
una ingesta correcta. Eso normalmente significa que el Congreso ha cambiado el
formato del JSON o la estructura de URLs.

Para ver el estado sin esperar al correo:

    select * from v_cobertura_datos;
    select * from v_etl_caido;

## Límites de plataforma

- Vercel Hobby: cron una vez al día como máximo. Por eso hay dos crons y no tres:
  el vaciado de cola va dentro de la ingesta.
- Vercel Hobby es solo uso no comercial. Este proyecto no monetiza.
- Supabase gratis: 2 proyectos activos, pausa a los 7 días sin actividad.
  El cron diario actúa de heartbeat, así que este proyecto no se pausa.

## Fuentes

- Congreso de los Diputados, datos abiertos — https://www.congreso.es/es/datos-abiertos
- Asamblea de Madrid, datos abiertos — bloquea acceso automatizado por robots.txt.
  Solo se consumen los datasets publicados, nunca su web.
- Chapel Hill Expert Survey — https://www.chesdata.eu
- Centro de Investigaciones Sociológicas — https://www.cis.es
- Manifesto Project — https://manifesto-project.wzb.eu

Reutilización conforme a la Ley 37/2007. Cada dato publicado enlaza a su fuente
y a su fecha de actualización.

## Pendiente

- Cargar valores reales en `src/lib/posiciones.ts` (ahora `provisional: true`)
- Adapter de la Asamblea de Madrid
- Estimación de puntos ideales (PCA sobre la matriz de votos) para el eje derivado
- Chat: búsqueda semántica solo para temas, funciones SQL cerradas para todo lo
  que sea contar o comparar. Nunca SQL libre.
