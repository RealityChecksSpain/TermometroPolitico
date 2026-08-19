import React from 'react';

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

export default function Metodologia({ cobertura }) {
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
        <p style={{ margin: '10px 0 0' }}>
          En su lugar, cada promesa y cada norma se etiqueta según seis preguntas de hecho, y la
          posición es una resta entre esas cuentas, normalizada entre −1 y +1. Puedes reproducir el
          número contando tú mismo. Se calcula dos veces: sobre los programas electorales de 2023
          y sobre las leyes que cada partido ha votado. La distancia entre ambas posiciones es lo
          que revela la diferencia entre el discurso y la práctica.
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

      <Seccion titulo="Fuentes">
        <Fuente nombre="Congreso de los Diputados · datos abiertos"
          que="Votaciones, diputados, intervenciones e iniciativas legislativas"
          url="https://www.congreso.es/es/datos-abiertos" />
        <Fuente nombre="Boletín Oficial de las Cortes Generales"
          que="Texto íntegro de las normas" />
        <Fuente nombre="Programas electorales de 2023"
          que="Publicados por cada partido en su web. No se alojan aquí." />
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
