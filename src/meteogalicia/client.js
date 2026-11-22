// -----------------------------------------------------------------------------
// HTTP client of the MeteoGalicia open data (servizos.meteogalicia.gal/mgrss,
// Xunta de Galicia; no account, no key). JSON services read here:
//   - observacion/listaEstacionsMeteo.action: the automatic stations (name,
//     position, municipality);
//   - observacion/ultimos10minEstacionsMeteo.action?idEst=<id>: the last
//     10-minute reading of one station;
//   - observacion/observacionConcellos.action: the 313 municipalities (only
//     their ids and names are used);
//   - predicion/jsonPredConcellos.action?idConc=<id>: the daily forecast of
//     one municipality (today and the next 2 or 3 days);
//   - predicion/adversos/jsonConcellosNivelMax.action?idConcello=<id>&dia=-1:
//     the highest warning level of one municipality, today and the next 2 days.
// Read-only GET requests; the query only holds public ids (a station, a
// municipality), never the position of the house.
// -----------------------------------------------------------------------------

const BASE = 'https://servizos.meteogalicia.gal/mgrss';

export const URLS = {
  stations: `${BASE}/observacion/listaEstacionsMeteo.action`,
  observation: (id) => `${BASE}/observacion/ultimos10minEstacionsMeteo.action?idEst=${id}`,
  concellos: `${BASE}/observacion/observacionConcellos.action`,
  forecast: (id) => `${BASE}/predicion/jsonPredConcellos.action?idConc=${id}`,
  warningLevels: (id) =>
    `${BASE}/predicion/adversos/jsonConcellosNivelMax.action?idConcello=${id}&dia=-1`,
};

/** An answer that is not the expected JSON: `status` is the HTTP status, if any. */
export class MeteoGaliciaError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'MeteoGaliciaError';
    this.status = status;
  }
}

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.userAgent]
 * @param {{ debug: Function }} [options.logger]
 */
export function createMeteoGaliciaClient({
  fetch = globalThis.fetch,
  timeoutMs = 20000,
  userAgent = 'gladys-meteogalicia (+https://github.com/guim31/gladys-meteogalicia)',
  logger,
} = {}) {
  async function getJson(address) {
    const url = new URL(address);
    const where = url.host + url.pathname;
    logger?.debug(`GET ${where}${url.search}`);
    let response;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const reason =
        err.name === 'TimeoutError' ? `no answer within ${timeoutMs / 1000} s` : err.message;
      throw new MeteoGaliciaError(`${url.host} unreachable (${reason})`);
    }
    if (!response.ok) {
      throw new MeteoGaliciaError(`${where} answered HTTP ${response.status}`, response.status);
    }
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object') {
        return data;
      }
    } catch {
      // Reported below.
    }
    throw new MeteoGaliciaError(`${where} answered something that is not JSON`, response.status);
  }

  return {
    stations: () => getJson(URLS.stations),
    observation: (id) => getJson(URLS.observation(encodeURIComponent(id))),
    concellos: () => getJson(URLS.concellos),
    forecast: (id) => getJson(URLS.forecast(encodeURIComponent(id))),
    warningLevels: (id) => getJson(URLS.warningLevels(encodeURIComponent(id))),
  };
}
