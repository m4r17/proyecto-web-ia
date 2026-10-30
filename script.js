(() => {
  'use strict';

  const SEARCH_ENDPOINT = 'https://es.wikipedia.org/w/api.php';
  const API_USER_AGENT = 'UtopianScholasticProject/1.0 (mariog3.mgss@gmail.com)';
  const RESULTS_LIMIT = 20;

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
    resultsWindow: document.querySelector('#resultados')
  };

  if (!elements.form || !elements.input || !elements.resultTemplate) {
    console.warn('Vision: no se encontró la estructura necesaria para inicializar la búsqueda.');
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
  let lastQuery = '';
  let lastSearch = null;

  class WikipediaSearchError extends Error {
    constructor(kind, message, { status = null, retryAfter = null, cause = null } = {}) {
      super(message);
      this.name = 'WikipediaSearchError';
      this.kind = kind;
      this.status = status;
      this.retryAfter = retryAfter;
      this.cause = cause;
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

  function buildArticleUrl(title) {
    const wikiTitle = title.replace(/ /g, '_');
    return `https://es.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
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
      namespace: Number(item.ns) || 0,
      url: buildArticleUrl(title)
    };
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

    let response;

    try {
      response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
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
        data.error.info || 'La API de Wikipedia devolvió un error.'
      );
    }

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
      title.href = result.url;
      title.target = '_blank';
      title.rel = 'noopener noreferrer';
      title.dataset.url = result.url;
      title.dataset.title = result.title;
      title.dataset.pageid = String(result.pageid);

      snippet.textContent = result.snippet;

      if (openButton) {
        openButton.dataset.url = result.url;
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
    performSearch(elements.input.value);
  });

  elements.sort.addEventListener('change', () => {
    if (!lastSearch || lastSearch.results.length === 0) {
      return;
    }

    renderResults(lastSearch);
    showView('results');
    setStatus(resultsStatusText(lastSearch));
  });

  elements.type.addEventListener('change', () => {
    if (lastQuery) {
      performSearch(lastQuery);
    }
  });

  elements.retryButton.addEventListener('click', () => {
    if (lastQuery) {
      performSearch(lastQuery);
    }
  });

  elements.results.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-url]');

    if (!trigger || trigger.tagName === 'A') {
      return;
    }

    event.preventDefault();
    window.open(trigger.dataset.url, '_blank', 'noopener,noreferrer');
  });

  showView('empty');
  setStatus('Esperando una búsqueda');
})();
