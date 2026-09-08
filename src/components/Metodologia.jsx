import React, { useEffect, useState } from 'react';
import {
  traerAuditoriaPlacebo, nombrarDimensiones, NOMBRE_EJE_LEY, FUERA_DE_EJE, NOMBRE_DIMENSION_LEY
} from '../lib/auditoria.js';

const C = {
  superficie: '#FFFFFF', pizarra: '#1F2328', tinta: '#14161A',
  media: '#4A5057', tenue: '#7C8288', linea: '#DCDCD3'
};

function Seccion({ titulo, children }) {
  return (
    <section style={{ marginTop: 30 }}>
      <h2 className="ed" style={{ fontSize: 'clamp(18px, 2.6vw, 23px)', fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
        {titulo}
      </h2>
      <div style={{ fontSize: 14, color: C.media, lineHeight: 1.65 }}>{children}</div>
    </section>
  );
}

function Fuente({ nombre, que, url }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '11px 0', borderTop: `1px solid ${C.linea}` }}>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.tinta }}>{nombre}</div>
        <div style={{ fontSize: 12.5, color: C.media, marginTop: 2 }}>{que}</div>
      </div>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="em"
          style={{ fontSize: 11, color: C.media, flexShrink: 0, alignSelf: 'center' }}>abrir →</a>
      )}
    </div>
  );
}

function ComposicionEjes({ auditoria }) {
  if (auditoria === null) {
    return (
      <p style={{ margin: '10px 0 0' }}>
        La composición exacta de cada eje se guarda en la auditoría y ahora mismo no se puede leer.
        Mientras no se pueda, esta página no afirma cuántas dimensiones entran: preferimos el hueco
        a un número que no podamos enseñar.
      </p>
    );
  }
  const orden = { economico: 0, social: 1, territorial: 2 };
  const lista = [...auditoria].sort((a, b) => (orden[a.eje] ?? 9) - (orden[b.eje] ?? 9));
  const reps = Math.max(...lista.map(e => e.reps || 0));
  const dentroTotal = new Set(lista.flatMap(e => e.dimensiones));
  const fueraTotal = [...new Set(lista.flatMap(e => e.fuera))].filter(d => !dentroTotal.has(d));
  return (
    <>
      <p style={{ margin: '10px 0 0' }}>
        Cada norma se etiqueta según veinte preguntas de hecho, una por dimensión. No todas llegan a
        componer un eje: una dimensión solo entra si hay al menos tres normas en cada sentido para
        cada partido y si al menos el 80 % de los partidos la tienen. Esto es lo que entra hoy,
        leído de la auditoría y no escrito a mano:
      </p>
      <ul style={{ margin: '10px 0 0', paddingLeft: 20 }}>
        {lista.map(e => (
          <li key={e.eje} style={{ marginBottom: 6 }}>
            Eje <strong>{NOMBRE_EJE_LEY[e.eje] ?? e.eje}</strong>:{' '}
            {e.dimensiones.length === 0
              ? 'ninguna dimensión reúne base suficiente, así que este eje no se rotula.'
              : <>{e.dimensiones.length} de {e.dimensiones.length + e.fuera.length}{' '}
                  {e.dimensiones.length === 1 ? 'dimensión' : 'dimensiones'} —{' '}
                  {nombrarDimensiones(e.dimensiones)}.</>}
            {e.fuera.length > 0 && (
              <> Queda fuera por falta de base: {nombrarDimensiones(e.fuera)}.</>
            )}
          </li>
        ))}
      </ul>
      <p style={{ margin: '10px 0 0' }}>
        {fueraTotal.length > 0 && <>Que una dimensión quede fuera no significa que no se codifique:
          se codifica y se puede consultar, pero no mueve la posición de nadie en el mapa. </>}
        Además hay cuatro dimensiones que se calculan y no componen ningún eje, porque la literatura
        comparada no las sitúa en ninguno: {nombrarDimensiones(FUERA_DE_EJE)}.
      </p>
      {reps > 0 && (
        <p style={{ margin: '10px 0 0' }}>
          Antes de publicar cada eje se comprueba contra el azar: se barajan {reps.toLocaleString('es')}{' '}
          veces las etiquetas de las normas y se mide qué separación entre partidos sale por
          casualidad. Si la observada no destaca, el eje no se rotula.
          {lista.map(e => e.p === null ? null : (
            <span key={e.eje} style={{ display: 'block', marginTop: 4 }}>
              Eje {NOMBRE_EJE_LEY[e.eje] ?? e.eje}: p = {e.p.toFixed(4)}
              {e.p > 0.05 ? ' — no supera la comprobación, así que no se rotula.' : '.'}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

export default function Metodologia({ cobertura }) {
  const [auditoria, setAuditoria] = useState(null);
  useEffect(() => { traerAuditoriaPlacebo().then(setAuditoria).catch(() => setAuditoria(null)); }, []);
  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="ed" style={{ fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
        Cómo se hace esto
      </h1>
      <p style={{ fontSize: 16, color: C.media, lineHeight: 1.55, marginTop: 14 }}>
        Todo lo que ves aquí se puede comprobar. Esta página explica de dónde sale cada dato,
        qué calculamos nosotros y qué no vas a encontrar nunca en esta herramienta.
      </p>

      <Seccion titulo="Lo que no hacemos">
        <p style={{ margin: 0 }}>
          No puntuamos a nadie. No decimos si una ley es buena o mala, ni si un diputado lo hace bien
          o mal. No publicamos rankings de «los peores». No hay opinión editorial en ninguna pantalla.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Cuando un dato no se puede verificar, se deja el hueco y se explica por qué. Preferimos un
          espacio en blanco a una cifra que suene bien y no se sostenga.
        </p>
      </Seccion>

      <Seccion titulo="De dónde salen los votos">
        <p style={{ margin: 0 }}>
          Del portal de datos abiertos del Congreso de los Diputados. Cada noche se descargan las
          votaciones nuevas, se validan y se guardan. La validación compara los votos individuales
          con los totales que publica la Cámara: si no cuadran, la votación se rechaza entera y queda
          registrada como error en vez de guardarse a medias.
        </p>
        {cobertura && (
          <p style={{ margin: '10px 0 0' }}>
            Ahora mismo hay {Number(cobertura.votaciones).toLocaleString('es')} votaciones y{' '}
            {Number(cobertura.votos_individuales).toLocaleString('es')} votos individuales.
            Última sesión registrada: {cobertura.ultima_sesion}.
          </p>
        )}
      </Seccion>

      <Seccion titulo="Qué hace la inteligencia artificial y qué no">
        <p style={{ margin: 0 }}>
          Se usa para tres cosas concretas, todas verificables contra la fuente:
        </p>
        <ol style={{ margin: '10px 0 0', paddingLeft: 20 }}>
          <li style={{ marginBottom: 7 }}>
            <strong>Traducir el texto legal a lenguaje llano.</strong> Lee el texto oficial publicado
            en el Boletín de las Cortes y lo resume. Tiene prohibido valorar y prohibido decir nada
            que no esté en ese texto. Siempre tienes el enlace al original.
          </li>
          <li style={{ marginBottom: 7 }}>
            <strong>Etiquetar a quién afecta cada norma</strong>, eligiendo de una lista cerrada de
            colectivos. No puede inventarse etiquetas: si devuelve una que no está en la lista, se descarta.
          </li>
          <li>
            <strong>Codificar hechos</strong> de cada ley y cada promesa: ¿sube o baja el gasto?
            ¿amplía o restringe derechos? Son preguntas de hecho, no de opinión.
          </li>
        </ol>
        <p style={{ margin: '10px 0 0' }}>
          Nunca decide quién es de izquierdas o de derechas, nunca elige qué es noticia y nunca
          escribe un titular. Los titulares de las leyes son literales del Congreso, carácter por carácter.
        </p>
      </Seccion>

      <Seccion titulo="Cómo se calcula la posición de un partido">
        <p style={{ margin: 0 }}>
          No sale de agrupar quién vota con quién. Eso, en España, solo mide si estás en el bloque de
          investidura o en la oposición, no ideología: la disciplina de voto supera el 98% y las
          votaciones nominales reflejan mayorías, no convicciones.
        </p>
        <ComposicionEjes auditoria={auditoria} />
        <p style={{ margin: '10px 0 0' }}>
          Cada pregunta se responde por separado, así que un decreto que sube el gasto y endurece
          penas puntúa en las dos sin anularse. Las dimensiones y sus definiciones siguen el
          esquema de codificación del Manifesto Project y la encuesta de expertos de Chapel Hill,
          no un criterio propio.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Para cada partido y cada dimensión se calcula una resta: el porcentaje de normas que
          recortan que apoyó, menos el porcentaje de las que amplían. Va de −1 a +1 y puedes
          reproducirlo contando tú mismo. Al pulsar un partido en el mapa se muestra esa cuenta
          dimensión por dimensión, con cuántas normas hay de cada lado.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Tres reglas evitan los extremos falsos. Una dimensión solo cuenta si hay al menos tres
          normas en cada sentido. El resultado se encoge hacia el centro cuando hay pocas normas,
          de modo que nadie aparece en un extremo por haber votado poco. Y un eje se compone solo
          con las dimensiones que reúnen esa base en al menos el 80 % de los partidos, para que las
          posiciones sean comparables entre sí: si a demasiados grupos les falta una dimensión, esa
          dimensión sale del cálculo para todos.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          El borde del mapa no es el partido más alejado: es el máximo posible, apoyar todas las
          normas que recortan y ninguna de las que amplían. Por eso ningún partido se acerca al
          borde. Sobre las 456 normas codificadas, el eje económico completo mide 0,52 de un
          recorrido posible de 2,0, y el social 0,61.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          La comprobación caduca sola en cuanto entran datos nuevos, así que un eje etiquetado
          siempre lo está sobre los datos actuales.
        </p>
      </Seccion>

      <Seccion titulo="Por qué el eje económico mide poco">
        <p style={{ margin: 0 }}>
          De las normas codificadas hasta hoy, <strong>la inmensa mayoría de las que tocan gasto
          público lo amplían y apenas un puñado lo recorta</strong>.
          Lo mismo pasa en protección laboral, privatizaciones y proteccionismo. Solo impuestos y
          regulación de empresas tienen los dos sentidos poblados, y por eso son las únicas que
          sostienen hoy el eje horizontal.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Una posición se calcula restando el apoyo a las normas que recortan menos el apoyo a las
          que amplían. Si casi no hay normas que recorten, no hay contraste que medir. Por eso el
          eje horizontal supera la comprobación contra el azar por poco margen y la mayoría de los
          partidos no se distinguen del centro. No es un defecto del método: es que esta
          legislatura apenas ha votado en una de las dos direcciones.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          En los programas electorales sí aparecen las dos direcciones. Que un partido prometa
          recortar y luego no vote ningún recorte es, en sí mismo, algo que este mapa permite ver.
        </p>
      </Seccion>

      <Seccion titulo="Qué no mide el mapa">
        <p style={{ margin: 0 }}>
          Solo la actividad legislativa. Las proposiciones no de ley y las mociones consecuencia de
          interpelación, que son 897 de las 2.055 votaciones del pleno, no se pueden usar: el
          Congreso no las publica en su portal de datos abiertos como iniciativas, así que no hay
          texto que codificar. El mapa describe cómo vota cada partido las leyes, no las
          declaraciones de intenciones.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Tampoco mide todo por igual en los dos ejes. En lo económico la mayoría de los partidos
          tienen una posición que no se distingue del centro una vez descontado el margen de error;
          en lo social se separan casi todos. El eje que de verdad separa a esta cámara es el social.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Y no mide monarquía ni forma de Estado: son cuestiones constitucionales que apenas se
          votan y que las escalas comparadas internacionales no incluyen en este eje.
        </p>
      </Seccion>

      <Seccion titulo="Qué significa «verificable»">
        <p style={{ margin: 0 }}>
          Un compromiso es verificable si se puede contrastar con una votación concreta. «Subir el
          salario mínimo a 1.200 euros» lo es. «Apostar por la industria» no lo es: no existe
          votación posible que lo confirme o lo desmienta.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          El porcentaje de cumplimiento se calcula <strong>solo sobre las promesas que llegaron a
          votación</strong>. Las que nunca se sometieron a votación se cuentan aparte, porque
          mezclarlas produciría un número engañoso.
        </p>
      </Seccion>

      <Seccion titulo="Límites conocidos">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 6 }}>
            Las proposiciones no de ley, mociones e interpelaciones no tienen texto publicado en el
            portal de datos abiertos. De esas solo hay título oficial y acta de votación.
          </li>
          <li style={{ marginBottom: 6 }}>
            Cuando una norma pasa por muchas votaciones y ninguna se titula como decisiva, no
            afirmamos un resultado final: mostramos la última votación registrada.
          </li>
          <li style={{ marginBottom: 6 }}>
            Las ausencias son el número de votaciones en las que un diputado no emitió voto. Ministros,
            presidencia y líderes de la oposición acumulan ausencias por obligaciones institucionales.
          </li>
          <li>
            El emparejamiento entre norma y expediente se hace por similitud de título y se muestra
            el porcentaje de coincidencia. No es infalible.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Cuando dos fuentes no dicen lo mismo">
        <p style={{ margin: 0 }}>
          En la pestaña de comparativa externa hay partidos con dos encuestas de expertos detrás
          y otros con una sola. Cuando hay dos, la posición que ves es la media, y el óvalo que la
          rodea deja de ser la incertidumbre declarada por una encuesta: pasa a ser el desacuerdo
          real entre las dos. Un óvalo ancho ahí no significa que el partido sea ambiguo, significa
          que dos grupos de expertos independientes no lo colocan en el mismo sitio.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Al cruzar las dos fuentes aparece un patrón que merece contarse. <strong>En el eje
          izquierda-derecha coinciden casi punto por punto</strong>: los partidos que una sitúa a
          la izquierda, la otra también, y con valores casi idénticos. Dos encuestas hechas por
          equipos distintos, con preguntas distintas y paneles de expertos distintos, llegando al
          mismo sitio. Es la mejor prueba disponible de que ese eje mide algo real y no una
          convención.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          <strong>En el eje social no coinciden</strong>, y el desacuerdo tiene dirección: crece
          cuanto más conservador sitúa una fuente al partido. Los partidos que las dos colocan en
          el lado progresista casi no se mueven; los que una coloca en el lado conservador aparecen
          bastante menos conservadores en la otra. Por eso los óvalos son anchos justo en la mitad
          conservadora del mapa y estrechos en la otra.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          La explicación más probable no es que una se equivoque, sino que miden constructos
          distintos. Una pregunta a los expertos por una única posición global en el eje
          libertario-autoritario. La otra promedia cinco cosas concretas y separadas: inmigración,
          igualdad de género, religión, minorías y superioridad cultural. Un partido conservador
          europeo convencional puntúa muy conservador en la primera, pero en la segunda no llega a
          los extremos en todas las dimensiones a la vez, y esa media lo acerca al centro.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          No promediamos para tapar la discrepancia ni elegimos la fuente que nos guste más. La
          media se publica con el desacuerdo dibujado encima, porque el desacuerdo también es
          información: dice en qué eje la ciencia política está de acuerdo sobre dónde está cada
          partido, y en cuál no.
        </p>
      </Seccion>

      <Seccion titulo="Democracia y autocracia en el mundo">
        <p style={{ margin: 0 }}>
          Esta pestaña no mide ideología. No hay izquierda ni derecha en ella y sus posiciones
          no se pueden comparar con las de las otras pestañas: son otras preguntas, otra escala
          y otra unidad. Aquí la unidad es el país, no el partido.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Mide dos cosas distintas. El eje horizontal, si el gobierno se puede perder en unas
          elecciones: que existan, que se pueda votar, que la oposición pueda competir y que el
          resultado se acate. El vertical, si quien gana encuentra límites: tribunales que
          funcionen, un parlamento que controle y una ley que se aplique igual a todos. Son
          independientes, y por eso el plano dice algo que un número solo esconde. Un país puede
          celebrar elecciones reales y tener pocos frenos al que las gana.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Los dos índices son del Instituto V-Dem de la Universidad de Gotemburgo, que los
          construye preguntando a expertos de cada país y publica su libro de códigos. No son una
          nota ni un ranking de países buenos y malos: son dos descripciones concretas, cada una
          de 0 a 1, y todos los países salen medidos el mismo año para que se puedan comparar
          entre sí. Las entidades históricas que dejaron de existir no aparecen en el mapa del
          presente; su serie completa sigue disponible al fijar un país.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Conviene saber qué <em>no</em> significa una puntuación media en el eje vertical.
          España bajo el franquismo, en 1955, sale en 0,069 de elecciones y 0,220 de límites al
          poder. Ese 0,220 no describe libertad: describe que había un aparato jurídico, unas
          Cortes y unos tribunales que existían y funcionaban con sus reglas, aunque nada de
          aquello fuera disputable. El índice mide procedimiento, no libertad. Leerlo como si
          midiera lo segundo es el error más fácil de cometer en esta pantalla.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Por la misma razón, ningún número de esta capa se enseña suelto. Para ver la
          puntuación de un país hay que fijarlo, y al fijarlo aparece su serie completa debajo.
          Una cifra de un año concreto, sacada de su historia, admite cualquier lectura; con la
          línea al lado, muchas menos. Los datos son los que son y no se ocultan, pero tampoco
          se sirven en un formato que invite a usarlos como munición.
        </p>
      </Seccion>

      <Seccion titulo="Fuentes">
        <Fuente nombre="Congreso de los Diputados · datos abiertos"
          que="Votaciones, diputados, intervenciones e iniciativas legislativas"
          url="https://www.congreso.es/es/datos-abiertos" />
        <Fuente nombre="Boletín Oficial de las Cortes Generales"
          que="Texto íntegro de las normas" />
        <Fuente nombre="Programas electorales de 2023"
          que="Publicados por cada partido en su web. No se alojan aquí." />
        <Fuente nombre="Chapel Hill Expert Survey"
          que="Posiciones de partidos europeos según encuestas a expertos"
          url="https://www.chesdata.eu" />
        <Fuente nombre="V-Dem · Varieties of Democracy"
          que="Índices de democracia electoral y de límites al poder, por país y año, desde 1789"
          url="https://www.v-dem.net" />
      </Seccion>

      <Seccion titulo="Uso y licencia">
        <p style={{ margin: 0 }}>
          Reutilización conforme a la Ley 37/2007. Aplicación independiente, sin vínculo con el
          Congreso de los Diputados ni con ninguna institución pública, partido u organización.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          Si encuentras un error, es un error y se corrige. Los datos están para que los compruebes.
        </p>
      </Seccion>
    </div>
  );
}