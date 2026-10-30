Utopian Scholastic Página.
Objetivo del Proyecto
Desarrollar una página web (Vanilla HTML/CSS/JS) que permita buscar y visualizar artículos de Wikipedia, presentando la información a través de una interfaz inspirada en la estética Utopian Scholastic (nostalgia de enciclopedias multimedia de los 90, optimismo tecnológico, collage, estética tecnológica retro). El objetivo es transformar la consulta de conocimiento en una experiencia visual atractiva y nostálgica, sin sacrificar la legibilidad del contenido. La página consultará datos reales desde la API pública de wikipedia.
Estructura: vanilla page.
- Titulo de la pagina: Vision
- Barra de búsqueda grande y centrada.
- Botón de búsqueda con efecto "presionado" (bisel).
- Área de resultados: lista de artículos encontrados (título + snippet)
- Filtros: Selector para ordenar resultados (ej. alfabéticamente, por relevancia) y/o filtrar por tipo de página.
- Requisitos indispensables: conexión a la api mediante fetch(), buscador funcional, filtros para organizar resultados, sección de favoritos, mensajes de error y estado vacío, diseño responsivo.
Diseño visual y estética:
-Paleta: índigo espacial (#3C2C5B), verde oliva (#3E5C38), lima (#C3D129), azul acuoso (#729B8F) y crema (#EAE4D3), con degradados suaves.
-tipografía: Lora para el cuerpo, Jost para títulos decorativos y Space Mono para etiquetas y acentos de interfaz.
- Ventanas simuladas: Los contenidos de los artículos se muestran dentro de contendedores con interfaces retro (como botones degradados y bordes biselados).
- Elementos visuales: Globos terráqueos, libros, fósiles de dinosaurios, CDs, etc. como decorativos. Usar las imágenes transparentes de `assets/images/` (globo, CD y esqueleto de T-Rex).
- Animaciones: Transiciones sutiles al cargar contenido (fade-in, ventana que se abre efecto)
- Estética: collage tipo zine, ventanas grises de sistema operativo antiguo, scanlines CRT y aberración cromática sutil en las imágenes.

API: Todas las peticiones fetch deben incluir el header Api-User-Agent, por ejemplo: headers: { 'Api-User-Agent': 'UtopianScholasticProject/1.0 (mariog3.mgss@gmail.com)' }
Wikipedia API (Action API)

Búsqueda: https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json&origin=*

Contenido: https://es.wikipedia.org/w/api.php?action=parse&page={title}&prop=text&format=json&origin=*

Tres prompts importantes en el desarrollo y sus respuestas:
- Actúá como desarrollador frontend especializado en estética retro de los 90s/2000s. Necesito una estructural html para una pagina que consulte la API de wikipedia, con una barra de búsqueda y un área de resultados. El diseño debe evocar la estética Utopian Scholastic. La documentación está en el archivo README.md de este proyecto, solo lee esta carpeta.
  Resultado: Se creó el index.html con la estructura semántica completa yun style.css con estética Utopian Scholastic
  Problemas: La estética de la página no fue del todo "Utopian Scholastic", entonces tuve que agregarlo al issue.
- Escribe el código del javascript que use fetch() para buscar en la API indicada y devuelva los resultados, debe incluir el api user agent especificado en README.md y manejar errores 429 y de red.
    Resultado: Se implementó script.js con searchWikipedia(), que devuelve datos y envía api-user-agent, usa origin=* y aplica filtro por namespace y ordenación. Incluye estados de carga, sin resultados y error, mensajes especificos para http. Verificado con node --check y una consulta real a la API.
    Problemas: La comunicación era correcta pero olvidé implementar que fuese un despliegue en el mismo sitio web en lugar de que sea una redirección a wikipedia.
- Me gustaría hace rcambios en la paleta de colores y fonts, procura utilizar los siguientes colores: [pasted 29 lines], utiliza también las imágenes incluidas en /assets/images de este proyecto en alguna pantalla.
  Resultado: Se implementaron cambios en la interfaz más a profundidad y se corrigieron algunos errores. Ahora la página muestra el resultado en el mismo sitio web.

En esta práctica, aprendí a gestionar mejor los tokens en opencode, ya que utiliza una configuración predeterminada en la que lee AGENTS.md (que no está creado originalmente) de manera automática. Este detalle hace que se deba inicializar y especificar un resumen de instrucciones claras que tenga que ejecutar en cada consulta en lugar de releer todo el proyecto.
