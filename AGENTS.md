# AGENTS.md

## Project

Vanilla HTML/CSS/JS single-page app ("Vision") for searching and reading Spanish Wikipedia articles in a 90s "Utopian Scholastic" encyclopedia style. The spec lives in `README.md` (Spanish); `index.html`, `script.js`, and `style.css` are the only source files and were empty at setup time.

## Constraints

- No package manager, bundler, build, test, or lint tooling. Do not add one unless asked; edit the three files directly and verify in a browser.
- Use the **Spanish** Wikipedia Action API, not English:
  - Search: `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json&origin=*`
  - Content: `https://es.wikipedia.org/w/api.php?action=parse&page={title}&prop=text&format=json&origin=*`
- Every `fetch()` must send `Api-User-Agent` (Wikipedia requirement), e.g. `headers: { 'Api-User-Agent': 'UtopianScholasticProject/1.0 (mariog3.mgss@gmail.com)' }`. Keep `origin=*` for CORS.
- Required functionality from the README: functional search, result filters/sorting, favorites section, error and empty states, responsive layout.

## Style

- Palette: space indigo `#3C2C5B`, olive `#3E5C38`, lime `#C3D129`, sage `#729B8F`, cream `#EAE4D3`.
- Fonts (Google Fonts): Lora body, Jost display headings, Space Mono labels/UI accents.
- Zine/analog collage aesthetic: paper grids, tape strips, rotated cutout labels, hard offset shadows, pixel and wireframe ornaments.
- Retro OS chrome: gray Win95/System 7-style titlebars, pixel bevel buttons, floating dialog ornaments, and subtle fade-in/open animations.
- CRT finish: fixed scanline overlay, slight chromatic aberration on imagery, and a wait cursor during loading.
- Use the transparent assets in `assets/images/` (globe, CD, T-Rex skeleton) rather than duplicating them as SVG.

## Comportamiento ante incertidumbre

- **Si no estás seguro, pregunta primero**: cuando no tengas claro los requisitos, el diseño o el comportamiento esperado, no adivines ni asumas por tu cuenta. Detente y hazme una pregunta concreta.
- **Aplica a**: cualquier decisión que afecte la funcionalidad, el estilo visual o la estructura de datos, si hay ambigüedad, pregunta primero.
- **No aplica a**: detalles de implementación menores (como nombres de variables internas, orden de líneas de código), estos puedes decidirlos tú mismo.
