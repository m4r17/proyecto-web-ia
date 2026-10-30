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
-Paleta: azul cielo, tonos verdes y plateados, degradados suaves.
-tipografía: Georgia para el cuerpo, Comic Sans MS y Ubuntu Condensed para titulos decorativos.
- Ventanas simuladas: Los contenidos de los artículos se muestran dentro de contendedores con interfaces retro (como botones degradados y bordes biselados).
- Elementos visuales: Globos terráqueos, libros, fósiles de dinosaurios, CDs, etc. como decorativos(SVG e imágenes de dominio público).
- Animaciones: Transiciones sutiles al cargar contenido (fade-in, ventana que se abre efecto)

API: Todas las peticiones fetch deben incluir el header Api-User-Agent, por ejemplo: headers: { 'Api-User-Agent': 'UtopianScholasticProject/1.0 (mariog3.mgss@gmail.com)' }
Wikipedia API (Action API)

Búsqueda: https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json&origin=*

Contenido: https://es.wikipedia.org/w/api.php?action=parse&page={title}&prop=text&format=json&origin=*

