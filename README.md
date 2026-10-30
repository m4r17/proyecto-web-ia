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

