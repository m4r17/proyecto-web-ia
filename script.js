(() => {
  'use strict';

  const API_ENDPOINT = 'https://es.wikipedia.org/w/api.php';
  const API_USER_AGENT = 'UtopianScholasticProject/1.0 (mariog3.mgss@gmail.com)';
  const RESULTS_LIMIT = 20;
  const FAVORITES_KEY = 'vision:favorites:v1';

  const elements = {
    form: document.querySelector('#search-form'),
    input: document.querySelector('#search-input'),
    sort: document.querySelector('#sort-select'),
    type: document.querySelector('#type-select'),
    status: document.querySelector('#results-status'),
    results: document.querySelector('#result-list'),
    resultTemplate: document.querySelector('#result-template'),
    empty: document.querySelector('#empty-state'),
    noResults: document.querySelector('#no-results-state'),
    noResultsText: document.querySelector('#no-results-text'),
    loading: document.querySelector('#loading-state'),
    error: document.querySelector('#error-state'),
    errorTitle: document.querySelector('#error-state .state__title'),
    errorText: document.querySelector('#error-state .state__text'),
    retryButton: document.querySelector('#error-state [data-action="retry"]'),
    resultsWindow: document.querySelector('#resultados'),
    pageGrid: document.querySelector('.page-grid'),
    reader: document.querySelector('#article-reader'),
    readerTitle: document.querySelector('#article-title'),
    readerSource: document.querySelector('#article-source'),
    articleLoading: document.querySelector('#article-loading'),
    articleError: document.querySelector('#article-error'),
    articleErrorText: document.querySelector('#article-error-text'),
    articleRetry: document.querySelector('#article-error [data-action="retry-article"]'),
    articleContent: document.querySelector('#article-content'),
    articleFavorite: document.querySelector('#article-favorite'),
    articleFavoriteLabel: document.querySelector('#article-favorite [data-field="favorite-label"]'),
    backButtons: document.querySelectorAll('[data-action="back-to-search"]'),
    favoritesList: document.querySelector('#favorites-list'),
    favoritesCount: document.querySelector('#favorites-count'),
    favoritesEmpty: document.querySelector('#favorites-empty'),
    favoriteTemplate: document.querySelector('#favorite-template')
  };

  if (
    !elements.form ||
    !elements.input ||
    !elements.resultTemplate ||
    !elements.pageGrid ||
    !elements.reader ||
    !elements.articleContent
  ) {
    console.warn('Vision: no se encontró la estructura necesaria para inicializar la aplicación.');
    return;
  }

  const views = {
    empty: elements.empty,
    noResults: elements.noResults,
    loading: elements.loading,
    error: elements.error,
    results: elements.results
  };

  let activeController = null;
  let articleController = null;
  let lastQuery = '';
  let lastSearch = null;
  let favorites = [];
  let currentArticle = null;
  let returnFocus = null;
  let searchScrollY = 0;

  class WikipediaSearchError extends Error {
    constructor(kind, message, { status = null, retryAfter = null, cause = null, code = '' } = {}) {
      super(message);
      this.name = 'WikipediaSearchError';
      this.kind = kind;
      this.status = status;
      this.retryAfter = retryAfter;
      this.cause = cause;
      this.code = code;
    }
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function showView(name) {
    for (const [viewName, element] of Object.entries(views)) {
      if (element) {
        element.hidden = viewName !== name;
      }
    }

    if (elements.resultsWindow) {
      elements.resultsWindow.setAttribute('aria-busy', name === 'loading' ? 'true' : 'false');
    }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('es').format(value);
  }

  function parseRetryAfter(value) {
    if (!value) {
      return null;
    }

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds);
    }

    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
    }

    return null;
  }

  function stripHtml(value) {
    if (!value) {
      return 'Sin resumen disponible.';
    }

    const documentFragment = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
    const text = documentFragment.body.textContent || '';
    const cleanText = text.replace(/\s+/g, ' ').trim();

    return cleanText || 'Sin resumen disponible.';
  }

  function normalizeResult(item) {
    const title = String(item.title || 'Artículo sin título');

    return {
      pageid: Number(item.pageid) || 0,
      title,
      snippet: stripHtml(item.snippet),
      timestamp: item.timestamp || '',
      wordcount: Number(item.wordcount) || 0,
      size: Number(item.size) || 0,
      namespace: Number(item.ns) || 0
    };
  }

  async function requestWikipedia(params, signal) {
    let response;

    try {
      response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Api-User-Agent': API_USER_AGENT
        },
        signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }

      throw new WikipediaSearchError(
        'network',
        'No se pudo conectar con la API de Wikipedia.',
        { cause: error }
      );
    }

    if (response.status === 429) {
      throw new WikipediaSearchError(
        'rate-limit',
        'Wikipedia limitó temporalmente las solicitudes.',
        {
          status: 429,
          retryAfter: parseRetryAfter(response.headers.get('Retry-After'))
        }
      );
    }

    if (!response.ok) {
      throw new WikipediaSearchError(
        'http',
        `Wikipedia respondió con un error HTTP ${response.status}.`,
        { status: response.status }
      );
    }

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new WikipediaSearchError(
        'parse',
        'Wikipedia devolvió una respuesta que no pudimos leer.',
        { cause: error }
      );
    }

    if (data && data.error) {
      throw new WikipediaSearchError(
        'api',
        data.error.info || 'La API de Wikipedia devolvió un error.',
        { code: data.error.code || '' }
      );
    }

    return data;
  }

  async function searchWikipedia(query, { namespace = '', signal, limit = RESULTS_LIMIT } = {}) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return { query: '', results: [], totalHits: 0, suggestion: '' };
    }

    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: normalizedQuery,
      srlimit: String(limit),
      srprop: 'snippet|timestamp|wordcount|size',
      srinfo: 'totalhits|suggestion',
      format: 'json',
      origin: '*'
    });

    if (namespace !== '') {
      params.set('srnamespace', String(namespace));
    }

    const data = await requestWikipedia(params, signal);
    const rawResults = data?.query?.search;
    const results = Array.isArray(rawResults) ? rawResults.map(normalizeResult) : [];
    const totalHits = Number(data?.query?.searchinfo?.totalhits);

    return {
      query: normalizedQuery,
      results,
      totalHits: Number.isFinite(totalHits) ? totalHits : results.length,
      suggestion: data?.query?.searchinfo?.suggestion || ''
    };
  }

  async function fetchArticle(title, { signal } = {}) {
    const params = new URLSearchParams({
      action: 'parse',
      page: title,
      prop: 'text',
      disableeditsection: '1',
      disabletoc: '1',
      disablelimitreport: '1',
      redirects: '1',
      format: 'json',
      origin: '*'
    });

    const data = await requestWikipedia(params, signal);

    if (!data?.parse) {
      throw new WikipediaSearchError(
        'api',
        'Wikipedia no devolvió el contenido del artículo.'
      );
    }

    const html = data.parse.text?.['*'];

    if (typeof html !== 'string' || !html.trim()) {
      throw new WikipediaSearchError(
        'parse',
        'El artículo no contiene texto que podamos mostrar.'
      );
    }

    return {
      title: String(data.parse.title || title),
      pageid: Number(data.parse.pageid) || 0,
      html
    };
  }

  function safeUrl(value, base = 'https://es.wikipedia.org') {
    if (!value) {
      return null;
    }

    try {
      const url = new URL(value, base);

      if (url.protocol === 'http:') {
        url.protocol = 'https:';
      }

      return url;
    } catch {
      return null;
    }
  }

  function isSpanishWikipedia(hostname) {
    return hostname === 'es.wikipedia.org' || hostname === 'es.m.wikipedia.org';
  }

  function wikiArticleTitle(href) {
    const rawHref = String(href || '').trim();

    if (!rawHref || rawHref.startsWith('#')) {
      return '';
    }

    let candidate = '';

    if (rawHref.startsWith('./')) {
      candidate = rawHref.slice(2);
    } else {
      const url = safeUrl(rawHref);

      if (!url || !isSpanishWikipedia(url.hostname)) {
        return '';
      }

      const match = url.pathname.match(/^\/wiki\/(.+)$/);

      if (!match) {
        return '';
      }

      candidate = match[1];
    }

    candidate = candidate.split('#')[0].split('?')[0];

    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return '';
    }

    candidate = candidate.replace(/_/g, ' ').trim();

    if (!candidate) {
      return '';
    }

    if (/^(archivo|file|imagen|image|category|categoría|special|especial|help|ayuda|wikipedia|wikiproyecto|plantilla|template|portal|discusión|talk|usuario|user|módulo|modulo|mediawiki):/i.test(candidate)) {
      return '';
    }

    return candidate;
  }

  const ALLOWED_TAGS = new Set([
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col',
    'colgroup', 'dd', 'del', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption',
    'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins',
    'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 'rp', 'rt', 'ruby', 's',
    'samp', 'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'wbr'
  ]);

  function sanitizeAnchor(anchor) {
    const href = anchor.getAttribute('href');

    if (!href) {
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
      return;
    }

    if (href.startsWith('#')) {
      if (href === '#') {
        anchor.removeAttribute('href');
      }

      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
      return;
    }

    const title = wikiArticleTitle(href);

    if (title) {
      anchor.setAttribute('href', '#');
      anchor.setAttribute('data-article-title', title);
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
      return;
    }

    const url = safeUrl(href);

    if (url && /^https?:$/.test(url.protocol) && !/(^|\.)wikipedia\.org$/i.test(url.hostname)) {
      anchor.setAttribute('href', url.href);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
      return;
    }

    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  }

  function sanitizeImage(image) {
    const src = image.getAttribute('src');
    const url = safeUrl(src);

    if (!url || url.protocol !== 'https:' || !/(^|\.)(wikimedia|wikipedia)\.org$/i.test(url.hostname)) {
      image.remove();
      return;
    }

    image.setAttribute('src', url.href);
    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.removeAttribute('longdesc');
    image.removeAttribute('usemap');
    image.removeAttribute('ismap');
  }

  function sanitizeArticleHtml(html) {
    const parsed = new DOMParser().parseFromString(
      `<div id="vision-article-root">${html}</div>`,
      'text/html'
    );
    const root = parsed.querySelector('#vision-article-root');

    if (!root) {
      return '';
    }

    root.querySelectorAll(
      'script, style, link, meta, iframe, object, embed, form, input, button, select, textarea, audio, video, canvas, svg, math, noscript, template'
    ).forEach((node) => node.remove());

    root.querySelectorAll(
      '.mw-editsection, .mw-jump-link, .noprint, .mw-hidden-catlinks, .catlinks, .printfooter, .navbox, .vertical-navbox, .sistersitebox, .ambox, .mw-empty-elt, .mw-indicators'
    ).forEach((node) => node.remove());

    for (const element of [...root.querySelectorAll('*')]) {
      const tag = element.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        element.replaceWith(...element.childNodes);
        continue;
      }

      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();

        if (
          name.startsWith('on') ||
          name === 'style' ||
          name === 'srcset' ||
          name === 'sizes' ||
          name === 'contenteditable' ||
          name === 'spellcheck' ||
          name === 'hidden' ||
          name === 'inert' ||
          name === 'ping' ||
          name === 'background' ||
          name === 'xmlns' ||
          name.startsWith('data-')
        ) {
          element.removeAttribute(attribute.name);
        }
      }

      if (tag === 'a') {
        sanitizeAnchor(element);
      } else if (tag === 'img') {
        sanitizeImage(element);
      }
    }

    return root.innerHTML;
  }

  function sortResults(results, sortMode) {
    if (sortMode !== 'alpha-asc' && sortMode !== 'alpha-desc') {
      return [...results];
    }

    const direction = sortMode === 'alpha-desc' ? -1 : 1;

    return [...results].sort((first, second) => {
      return direction * first.title.localeCompare(second.title, 'es', {
        sensitivity: 'base'
      });
    });
  }

  function renderResults(data) {
    const sortedResults = sortResults(data.results, elements.sort.value);
    const fragment = document.createDocumentFragment();

    sortedResults.forEach((result, index) => {
      const card = elements.resultTemplate.content.cloneNode(true);
      const rank = card.querySelector('[data-field="rank"]');
      const title = card.querySelector('[data-field="title"]');
      const snippet = card.querySelector('[data-field="snippet"]');
      const openButton = card.querySelector('button[data-action="open"]');
      const favoriteButton = card.querySelector('[data-action="favorite"]');

      rank.textContent = String(index + 1).padStart(2, '0');

      title.textContent = result.title;
      title.href = '#';
      title.dataset.title = result.title;
      title.dataset.pageid = String(result.pageid);
      title.removeAttribute('target');
      title.removeAttribute('rel');

      snippet.textContent = result.snippet;

      if (openButton) {
        openButton.dataset.title = result.title;
        openButton.dataset.pageid = String(result.pageid);
      }

      if (favoriteButton) {
        favoriteButton.dataset.title = result.title;
        favoriteButton.dataset.pageid = String(result.pageid);
      }

      fragment.appendChild(card);
    });

    elements.results.replaceChildren(fragment);
    syncFavoriteButtons();
  }

  function resultsStatusText(data) {
    const shown = data.results.length;
    const total = Math.max(data.totalHits, shown);

    if (total > shown) {
      return `Mostrando ${formatNumber(shown)} de ${formatNumber(total)}`;
    }

    return `${formatNumber(shown)} ${shown === 1 ? 'resultado' : 'resultados'}`;
  }

  function showNoResults(data) {
    const query = data.query;

    if (data.suggestion) {
      elements.noResultsText.textContent = `No encontramos resultados para «${query}». Quizá quisiste decir «${data.suggestion}».`;
    } else {
      elements.noResultsText.textContent = `No encontramos resultados para «${query}». Prueba con otras palabras, revisa la ortografía o cambia el filtro de tipo de página.`;
    }

    showView('noResults');
    setStatus('Sin resultados');
  }

  function renderError(error) {
    let title = 'No pudimos completar la búsqueda';
    let message = 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    let status = 'Error de búsqueda';

    if (error instanceof WikipediaSearchError) {
      if (error.kind === 'rate-limit') {
        title = 'Wikipedia necesita un respiro';
        message = 'Wikipedia limitó temporalmente las solicitudes (HTTP 429). ';
        message += Number.isFinite(error.retryAfter) && error.retryAfter > 0
          ? `Espera ${error.retryAfter} ${error.retryAfter === 1 ? 'segundo' : 'segundos'} y vuelve a intentarlo.`
          : 'Espera unos segundos y vuelve a intentarlo.';
        status = 'Límite de solicitudes';
      } else if (error.kind === 'network') {
        title = 'Sin conexión con Wikipedia';
        message = 'No pudimos conectar con la API. Revisa tu conexión a internet e inténtalo de nuevo.';
        status = 'Error de red';
      } else if (error.kind === 'http') {
        title = 'Wikipedia no respondió';
        message = `La API devolvió un error HTTP ${error.status}. Inténtalo de nuevo en unos momentos.`;
        status = 'Error del servidor';
      } else if (error.kind === 'api') {
        title = 'La búsqueda no pudo completarse';
        message = error.message;
        status = 'Error de la API';
      } else if (error.kind === 'parse') {
        title = 'Respuesta inesperada';
        message = 'Wikipedia devolvió una respuesta que no pudimos leer. Inténtalo de nuevo.';
        status = 'Respuesta inválida';
      }
    }

    elements.errorTitle.textContent = title;
    elements.errorText.textContent = message;
    setStatus(status);
    showView('error');
  }

  function renderArticleError(error) {
    let message = 'No pudimos cargar el artículo. Inténtalo de nuevo.';

    if (error instanceof WikipediaSearchError) {
      if (error.kind === 'rate-limit') {
        message = 'Wikipedia limitó temporalmente las solicitudes. ';
        message += Number.isFinite(error.retryAfter) && error.retryAfter > 0
          ? `Espera ${error.retryAfter} ${error.retryAfter === 1 ? 'segundo' : 'segundos'} y vuelve a intentarlo.`
          : 'Espera unos segundos y vuelve a intentarlo.';
      } else if (error.kind === 'network') {
        message = 'No pudimos conectar con Wikipedia. Revisa tu conexión a internet e inténtalo de nuevo.';
      } else if (error.kind === 'http') {
        message = `Wikipedia devolvió un error HTTP ${error.status}. Inténtalo de nuevo en unos momentos.`;
      } else if (error.kind === 'api') {
        if (error.code === 'missingtitle') {
          message = 'Wikipedia no encontró este artículo. Puede que el título haya cambiado o que la página ya no exista.';
        } else if (error.code === 'invalidtitle') {
          message = 'El título del artículo no es válido. Vuelve a la búsqueda e inténtalo con otro resultado.';
        } else {
          message = error.message;
        }
      } else if (error.kind === 'parse') {
        message = error.message || 'La respuesta del artículo no se pudo leer.';
      }
    }

    elements.articleLoading.hidden = true;
    elements.articleContent.hidden = true;
    elements.articleErrorText.textContent = message;
    elements.articleError.hidden = false;
    elements.reader.setAttribute('aria-busy', 'false');
  }

  function favoriteKey(item) {
    const pageid = Number(item?.pageid) || 0;
    const title = String(item?.title || '').trim();

    return pageid > 0 ? `page:${pageid}` : `title:${title.toLocaleLowerCase('es')}`;
  }

  function normalizeFavorite(item) {
    const title = String(item?.title || '').trim();

    if (!title) {
      return null;
    }

    return {
      title,
      pageid: Number(item?.pageid) || 0
    };
  }

  function loadFavorites() {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);

      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        return [];
      }

      const seen = new Set();

      return parsed.map(normalizeFavorite).filter((item) => {
        if (!item) {
          return false;
        }

        const key = favoriteKey(item);

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
    } catch {
      return [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      return;
    }
  }

  function isFavorite(title, pageid) {
    const key = favoriteKey({ title, pageid });
    return favorites.some((item) => favoriteKey(item) === key);
  }

  function syncFavoriteButton(button, title, pageid) {
    if (!button) {
      return;
    }

    const saved = isFavorite(title, pageid);
    const label = button.querySelector('[data-field="favorite-label"]');

    button.setAttribute('aria-pressed', String(saved));

    if (label) {
      if (button === elements.articleFavorite) {
        label.textContent = saved ? 'Guardado en favoritos' : 'Guardar en favoritos';
      } else {
        label.textContent = saved ? 'Guardado' : 'Guardar';
      }
    }
  }

  function syncFavoriteButtons() {
    if (elements.results) {
      elements.results.querySelectorAll('[data-action="favorite"]').forEach((button) => {
        syncFavoriteButton(button, button.dataset.title, Number(button.dataset.pageid));
      });
    }

    if (currentArticle) {
      syncFavoriteButton(elements.articleFavorite, currentArticle.title, currentArticle.pageid);
    }
  }

  function renderFavorites() {
    if (!elements.favoritesList || !elements.favoriteTemplate) {
      return;
    }

    elements.favoritesList.replaceChildren();

    favorites.forEach((item) => {
      const favorite = elements.favoriteTemplate.content.cloneNode(true);
      const openButton = favorite.querySelector('[data-action="open"]');
      const removeButton = favorite.querySelector('[data-action="remove"]');

      if (openButton) {
        openButton.textContent = item.title;
        openButton.dataset.title = item.title;
        openButton.dataset.pageid = String(item.pageid);
      }

      if (removeButton) {
        removeButton.dataset.title = item.title;
        removeButton.dataset.pageid = String(item.pageid);
        removeButton.setAttribute('aria-label', `Quitar ${item.title} de favoritos`);
      }

      elements.favoritesList.appendChild(favorite);
    });

    if (elements.favoritesCount) {
      elements.favoritesCount.textContent = String(favorites.length);
    }

    if (elements.favoritesEmpty) {
      elements.favoritesEmpty.hidden = favorites.length > 0;
    }
  }

  function toggleFavorite(title, pageid) {
    const normalizedTitle = String(title || '').trim();

    if (!normalizedTitle) {
      return;
    }

    const item = {
      title: normalizedTitle,
      pageid: Number(pageid) || 0
    };
    const key = favoriteKey(item);
    const index = favorites.findIndex((favorite) => favoriteKey(favorite) === key);

    if (index === -1) {
      favorites = [item, ...favorites];
    } else {
      favorites.splice(index, 1);
    }

    saveFavorites();
    renderFavorites();
    syncFavoriteButtons();
  }

  function setArticleLoading(article) {
    elements.readerTitle.textContent = article.title;
    elements.readerSource.textContent = 'Wikipedia en español';
    elements.articleContent.replaceChildren();
    elements.articleContent.hidden = true;
    elements.articleError.hidden = true;
    elements.articleLoading.hidden = false;
    elements.reader.setAttribute('aria-busy', 'true');
    syncFavoriteButton(elements.articleFavorite, article.title, article.pageid);
  }

  async function loadArticle(article) {
    if (!article || !article.title) {
      return;
    }

    if (articleController) {
      articleController.abort();
    }

    const controller = new AbortController();
    articleController = controller;
    setArticleLoading(article);

    try {
      const data = await fetchArticle(article.title, { signal: controller.signal });

      if (controller.signal.aborted) {
        return;
      }

      const safeHtml = sanitizeArticleHtml(data.html);

      if (!safeHtml.trim()) {
        throw new WikipediaSearchError(
          'parse',
          'El artículo no contiene texto que podamos mostrar.'
        );
      }

      currentArticle = {
        title: data.title,
        pageid: data.pageid
      };

      elements.readerTitle.textContent = data.title;
      elements.articleContent.innerHTML = safeHtml;
      elements.articleContent.hidden = false;
      elements.articleLoading.hidden = true;
      elements.articleError.hidden = true;
      elements.reader.setAttribute('aria-busy', 'false');
      syncFavoriteButton(elements.articleFavorite, data.title, data.pageid);
      elements.readerTitle.focus({ preventScroll: true });
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      renderArticleError(error);
    } finally {
      if (articleController === controller) {
        articleController = null;
      }
    }
  }

  function openArticle(article) {
    const title = String(article?.title || '').trim();

    if (!title) {
      return;
    }

    const wasOpen = !elements.reader.hidden;

    if (!wasOpen) {
      returnFocus = document.activeElement;
      searchScrollY = window.scrollY;
    }

    currentArticle = {
      title,
      pageid: Number(article?.pageid) || 0
    };

    elements.pageGrid.hidden = true;
    elements.reader.hidden = false;
    elements.reader.scrollIntoView({ block: 'start' });
    loadArticle(currentArticle);
  }

  function backToSearch({ restoreFocus = true, restoreScroll = true } = {}) {
    if (articleController) {
      articleController.abort();
      articleController = null;
    }

    elements.reader.hidden = true;
    elements.pageGrid.hidden = false;
    elements.articleLoading.hidden = true;
    elements.articleError.hidden = true;
    elements.articleContent.hidden = true;
    elements.articleContent.replaceChildren();
    elements.reader.setAttribute('aria-busy', 'false');
    currentArticle = null;
    elements.articleFavorite.setAttribute('aria-pressed', 'false');

    if (elements.articleFavoriteLabel) {
      elements.articleFavoriteLabel.textContent = 'Guardar en favoritos';
    }

    if (restoreScroll) {
      window.scrollTo({ top: searchScrollY, behavior: 'auto' });
    }

    const focusTarget = returnFocus;
    returnFocus = null;

    if (!restoreFocus) {
      return;
    }

    if (
      focusTarget &&
      focusTarget !== document.body &&
      document.contains(focusTarget) &&
      !focusTarget.closest('[hidden]')
    ) {
      focusTarget.focus({ preventScroll: true });
    } else {
      elements.input.focus({ preventScroll: true });
    }
  }

  async function performSearch(query) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      elements.input.focus();
      return;
    }

    if (activeController) {
      activeController.abort();
    }

    const controller = new AbortController();
    activeController = controller;
    lastQuery = normalizedQuery;
    lastSearch = null;

    showView('loading');
    setStatus('Consultando Wikipedia…');

    try {
      const data = await searchWikipedia(normalizedQuery, {
        namespace: elements.type.value,
        signal: controller.signal
      });

      if (controller.signal.aborted) {
        return;
      }

      lastSearch = data;

      if (data.results.length === 0) {
        showNoResults(data);
        return;
      }

      renderResults(data);
      showView('results');
      setStatus(resultsStatusText(data));
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        return;
      }

      lastSearch = null;
      renderError(error);
    } finally {
      if (activeController === controller) {
        activeController = null;
      }
    }
  }

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!elements.reader.hidden) {
      backToSearch({ restoreFocus: false, restoreScroll: false });
    }

    performSearch(elements.input.value);
  });

  elements.sort.addEventListener('change', () => {
    if (!elements.reader.hidden) {
      backToSearch({ restoreFocus: false, restoreScroll: false });
    }

    if (!lastSearch || lastSearch.results.length === 0) {
      return;
    }

    renderResults(lastSearch);
    showView('results');
    setStatus(resultsStatusText(lastSearch));
  });

  elements.type.addEventListener('change', () => {
    if (!elements.reader.hidden) {
      backToSearch({ restoreFocus: false, restoreScroll: false });
    }

    if (lastQuery) {
      performSearch(lastQuery);
    }
  });

  if (elements.retryButton) {
    elements.retryButton.addEventListener('click', () => {
      if (lastQuery) {
        performSearch(lastQuery);
      }
    });
  }

  elements.results.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-action="favorite"]');

    if (favorite) {
      event.preventDefault();
      toggleFavorite(favorite.dataset.title, Number(favorite.dataset.pageid));
      return;
    }

    const opener = event.target.closest('[data-action="open"]');

    if (!opener) {
      return;
    }

    event.preventDefault();
    openArticle({
      title: opener.dataset.title,
      pageid: Number(opener.dataset.pageid)
    });
  });

  if (elements.favoritesList) {
    elements.favoritesList.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');

      if (!trigger) {
        return;
      }

      if (trigger.dataset.action === 'remove') {
        event.preventDefault();
        toggleFavorite(trigger.dataset.title, Number(trigger.dataset.pageid));
        return;
      }

      if (trigger.dataset.action === 'open') {
        event.preventDefault();
        openArticle({
          title: trigger.dataset.title,
          pageid: Number(trigger.dataset.pageid)
        });
      }
    });
  }

  elements.articleContent.addEventListener('click', (event) => {
    const link = event.target.closest('a');

    if (!link) {
      return;
    }

    const title = link.dataset.articleTitle;

    if (title) {
      event.preventDefault();
      openArticle({ title });
      return;
    }

    const href = link.getAttribute('href');

    if (!href || href === '#') {
      event.preventDefault();
    }
  });

  if (elements.articleFavorite) {
    elements.articleFavorite.addEventListener('click', () => {
      if (currentArticle) {
        toggleFavorite(currentArticle.title, currentArticle.pageid);
      }
    });
  }

  if (elements.articleRetry) {
    elements.articleRetry.addEventListener('click', () => {
      if (currentArticle) {
        loadArticle(currentArticle);
      }
    });
  }

  elements.backButtons.forEach((button) => {
    button.addEventListener('click', backToSearch);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.reader.hidden) {
      backToSearch();
    }
  });

  favorites = loadFavorites();
  renderFavorites();
  showView('empty');
  setStatus('Esperando una búsqueda');
})();
