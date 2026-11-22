// -----------------------------------------------------------------------------
// A simulated MeteoGalicia: a `fetch` that answers the services the
// integration reads with the real answers recorded in test/fixtures on
// 22 November 2026. No network.
//
// The reading time of a station is re-dated to the last 10-minute step before
// the test clock, so a test that moves the clock still sees fresh readings.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const fixture = (name) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

export const FIXTURES = {
  stations: fixture('stations.json'),
  concellos: fixture('concellos.json'),
  observations: {
    10053: fixture('observation-10053.json'),
    10142: fixture('observation-10142.json'),
    10157: fixture('observation-10157.json'),
  },
  forecasts: {
    15030: fixture('forecast-15030.json'),
    27028: fixture('forecast-27028.json'),
    36057: fixture('forecast-36057.json'),
  },
  warningLevels: fixture('warning-levels-27028.json'),
};

/** Test clock: Sunday 22 November 2026, 12:00 in Galicia (11:00 UTC), when the answers were read. */
export const NOW = Date.parse('2026-11-22T11:00:00Z');
export const TIME_ZONE = 'Europe/Madrid';

/**
 * The warning levels of a municipality, as MeteoGalicia answers them, with
 * the levels given by day (the recorded answer has none: 0 everywhere).
 * @param {string} id INE code
 * @param {number[]} levels level of today, tomorrow, the day after
 */
export function warningLevels(id, levels = [0, 0, 0]) {
  return JSON.stringify({
    listaDiaConcellos: levels.map((level, dia) => ({
      dia,
      listaNiveisMaximos: [{ dia, idConcello: Number(id), nivelMax: level, nomeConcello: 'x' }],
    })),
  });
}

/**
 * @param {object} [options]
 * @param {() => number} [options.now]
 */
export function createFakeMeteoGalicia({ now = () => NOW } = {}) {
  const requests = [];
  // Answers by endpoint: a JSON text, a function of the id, an Error, or { status }.
  const answers = {
    stations: FIXTURES.stations,
    concellos: FIXTURES.concellos,
    observation: (id) => {
      const recorded = FIXTURES.observations[id];
      if (!recorded) {
        return '{"listUltimos10min":[]}';
      }
      const step = Math.floor((now() - 5 * 60 * 1000) / (10 * 60 * 1000)) * 10 * 60 * 1000;
      const time = new Date(step).toISOString().slice(0, 19);
      return recorded.replace(/"instanteLecturaUTC":"[^"]*"/, `"instanteLecturaUTC":"${time}"`);
    },
    forecast: (id) => FIXTURES.forecasts[id] ?? '{"predConcello":null}',
    warningLevels: (id) =>
      id === '27028'
        ? FIXTURES.warningLevels
        : '{"listaDiaConcellos":[{"dia":0,"listaNiveisMaximos":[]}]}',
  };

  const endpointOf = (url) => {
    const name = url.pathname.split('/').pop();
    return (
      {
        'listaEstacionsMeteo.action': ['stations'],
        'observacionConcellos.action': ['concellos'],
        'ultimos10minEstacionsMeteo.action': ['observation', url.searchParams.get('idEst')],
        'jsonPredConcellos.action': ['forecast', url.searchParams.get('idConc')],
        'jsonConcellosNivelMax.action': ['warningLevels', url.searchParams.get('idConcello')],
      }[name] ?? [null]
    );
  };

  async function fetch(input) {
    const url = new URL(String(input));
    const [endpoint, id] = endpointOf(url);
    requests.push({ endpoint, id, url });
    const answer = answers[endpoint];
    if (answer instanceof Error) {
      throw answer;
    }
    if (answer && typeof answer === 'object' && answer.status) {
      return new Response(answer.body ?? 'error', { status: answer.status });
    }
    const body = typeof answer === 'function' ? answer(id) : answer;
    if (body === undefined) {
      return new Response('not found', { status: 404 });
    }
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
  }

  return {
    fetch,
    requests,
    answers,
    /** Requests per endpoint. */
    count: (endpoint) => requests.filter((request) => request.endpoint === endpoint).length,
  };
}
